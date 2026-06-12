import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.SENTIMENT_ANTHROPIC_KEY });
}

interface RawComment {
  id: string;
  text: string;
  ownerUsername: string;
  timestamp: string;
  likesCount: number;
  postUrl: string;
}

interface Comment extends RawComment {
  sentiment: 'positive' | 'negative' | 'neutral';
}

async function analyzeSentiment(comments: RawComment[]): Promise<Comment[]> {
  if (comments.length === 0) return [];

  const CHUNK = 80;
  const result: Comment[] = [];

  for (let i = 0; i < comments.length; i += CHUNK) {
    const chunk = comments.slice(i, i + CHUNK);
    const numbered = chunk.map((c, j) => `${j + 1}. ${c.text}`).join('\n');

    const msg = await getAnthropic().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: `Jesteś ekspertem analizy sentymentu komentarzy w mediach społecznościowych, głównie po polsku.

Zasady klasyfikacji:
- "positive" = pochwała, zachwyt, miłe słowa, wsparcie, emoji serduszek/ognia, żarty w dobrej wierze
- "negative" = krytyka, oburzenie, rozczarowanie, złośliwość, wulgaryzmy, ironia krytyczna, słowa: "słabe", "wstyd", "zalosne", "szkoda", "AI" w kontekście krytycznym, "cringe", "antyreklama", pytania retoryczne wyrażające niezadowolenie
- "neutral" = pytania o informacje, neutralne obserwacje, spam/bełkot, same emoji bez kontekstu

WAŻNE: Komentarze w stylu "imagine robić reklamę przez AI", "szkoda że AI", "zalosne", "cringe", "wstyd" to NEGATIVE, nie neutral.

Odpowiedz WYŁĄCZNIE tablicą JSON: [{"index":1,"sentiment":"positive"},...]
Żadnego innego tekstu.`,
      messages: [{ role: 'user', content: `Sklasyfikuj sentyment tych komentarzy:\n\n${numbered}` }],
    });

    const text = msg.content[0].type === 'text' ? msg.content[0].text : '[]';
    let parsed: { index: number; sentiment: 'positive' | 'negative' | 'neutral' }[] = [];
    try {
      const m = text.match(/\[[\s\S]*\]/);
      if (m) parsed = JSON.parse(m[0]);
    } catch { /* fallback neutral */ }

    for (let j = 0; j < chunk.length; j++) {
      const found = parsed.find((r) => r.index === j + 1);
      result.push({ ...chunk[j], sentiment: found?.sentiment ?? 'neutral' });
    }
  }

  return result;
}

function buildStats(comments: Comment[]) {
  const positive = comments.filter((c) => c.sentiment === 'positive');
  const negative = comments.filter((c) => c.sentiment === 'negative');
  const neutral = comments.filter((c) => c.sentiment === 'neutral');
  return {
    positive: positive.length,
    negative: negative.length,
    neutral: neutral.length,
    total: comments.length,
    totalLikes: comments.reduce((sum, c) => sum + c.likesCount, 0),
    positiveLikes: positive.reduce((sum, c) => sum + c.likesCount, 0),
    negativeLikes: negative.reduce((sum, c) => sum + c.likesCount, 0),
    neutralLikes: neutral.reduce((sum, c) => sum + c.likesCount, 0),
  };
}

export async function POST(req: NextRequest) {
  try {
    const { rawResults, urls } = (await req.json()) as {
      rawResults: { url: string; comments: RawComment[]; error: string | null }[];
      urls: string[];
    };

    const allRaw = rawResults.flatMap((r) => r.comments);

    if (allRaw.length === 0) {
      const emptyPosts = urls.map((url) => ({
        postUrl: url,
        postId: url.match(/\/(?:p|reels?|video)\/([A-Za-z0-9_-]+)/)?.[1] ?? url,
        comments: [],
        stats: { positive: 0, negative: 0, neutral: 0, total: 0 },
        error: rawResults.find((r) => r.url === url)?.error ?? null,
      }));
      return NextResponse.json({
        status: 'done',
        posts: emptyPosts,
        profiles: [],
        overallStats: { positive: 0, negative: 0, neutral: 0, total: 0, totalLikes: 0, positiveLikes: 0, negativeLikes: 0, neutralLikes: 0 },
        warning: 'Brak komentarzy — sprawdź session ID lub czy posty mają komentarze.',
      });
    }

    const analyzed = await analyzeSentiment(allRaw);

    // Group by post
    const postMap = new Map<string, Comment[]>();
    for (const url of urls) postMap.set(url, []);
    for (const c of analyzed) {
      if (!postMap.has(c.postUrl)) postMap.set(c.postUrl, []);
      postMap.get(c.postUrl)!.push(c);
    }

    const posts = Array.from(postMap.entries()).map(([url, comments]) => ({
      postUrl: url,
      postId: url.match(/\/(?:p|reels?|video)\/([A-Za-z0-9_-]+)/)?.[1] ?? url,
      comments,
      stats: buildStats(comments),
      error: rawResults.find((r) => r.url === url)?.error ?? null,
    }));

    // Group by profile
    const profileMap = new Map<string, (Comment & { postUrl: string })[]>();
    for (const c of analyzed) {
      if (!profileMap.has(c.ownerUsername)) profileMap.set(c.ownerUsername, []);
      profileMap.get(c.ownerUsername)!.push(c);
    }

    const profiles = Array.from(profileMap.entries()).map(([username, comments]) => ({
      username,
      comments,
      stats: buildStats(comments),
    }));

    return NextResponse.json({
      status: 'done',
      posts,
      profiles,
      overallStats: buildStats(analyzed),
    });
  } catch (err) {
    console.error('Results error:', err);
    return NextResponse.json({ status: 'failed', error: String(err) }, { status: 500 });
  }
}
