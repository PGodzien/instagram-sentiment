import { NextRequest, NextResponse } from 'next/server';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function shortcodeToMediaId(shortcode: string): string {
  let mediaId = BigInt(0);
  for (const c of shortcode) {
    mediaId = mediaId * BigInt(64) + BigInt(ALPHABET.indexOf(c));
  }
  return mediaId.toString();
}

function extractShortcode(url: string): string | null {
  return url.match(/\/(?:p|reels?)\/([A-Za-z0-9_-]+)/)?.[1] ?? null;
}

interface IGComment {
  pk: string;
  text: string;
  user: { username: string; full_name?: string };
  created_at: number;
  comment_like_count: number;
  child_comment_count?: number;
}

async function fetchAllComments(
  mediaId: string,
  sessionId: string,
  postUrl: string
): Promise<{ id: string; text: string; ownerUsername: string; timestamp: string; likesCount: number; postUrl: string }[]> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Cookie': `sessionid=${sessionId}`,
    'X-IG-App-ID': '936619743392459',
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': '*/*',
    'Accept-Language': 'pl-PL,pl;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://www.instagram.com/',
    'Origin': 'https://www.instagram.com',
    'Sec-Fetch-Site': 'same-origin',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Dest': 'empty',
  };

  const allComments: ReturnType<typeof fetchAllComments> extends Promise<infer T> ? T : never = [];
  let nextMinId: string | null = null;
  let page = 0;

  do {
    const url = new URL(`https://www.instagram.com/api/v1/media/${mediaId}/comments/`);
    url.searchParams.set('can_support_threading', 'true');
    url.searchParams.set('permalink_enabled', 'false');
    if (nextMinId) url.searchParams.set('min_id', nextMinId);

    const res = await fetch(url.toString(), { headers });
    if (!res.ok) throw new Error(`Instagram API ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`);

    const data = await res.json() as {
      status: string;
      message?: string;
      comments?: IGComment[];
      next_min_id?: string;
    };

    if (data.status === 'fail') {
      throw new Error(`Instagram odrzucił żądanie: ${data.message ?? 'nieprawidłowy Session ID lub post jest prywatny'}`);
    }

    const comments = data.comments ?? [];
    for (const c of comments) {
      if (!c.text?.trim()) continue;
      allComments.push({
        id: c.pk,
        text: c.text.trim(),
        ownerUsername: c.user?.username ?? 'unknown',
        timestamp: new Date(c.created_at * 1000).toISOString(),
        likesCount: c.comment_like_count ?? 0,
        postUrl,
      });
    }

    nextMinId = data.next_min_id ?? null;
    page++;
    // Safety: max 20 pages (20 * ~20 comments = 400)
  } while (nextMinId && page < 20);

  return allComments;
}

export async function POST(req: NextRequest) {
  try {
    const { urls, sessionId } = (await req.json()) as { urls: string[]; sessionId: string };

    if (!Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ error: 'Brak linków.' }, { status: 400 });
    }
    if (!sessionId?.trim()) {
      return NextResponse.json({ error: 'Brak Instagram session ID.' }, { status: 400 });
    }

    const results = await Promise.all(
      urls.map(async (url) => {
        const shortcode = extractShortcode(url);
        if (!shortcode) return { url, comments: [], error: 'Nieprawidłowy URL' };
        const mediaId = shortcodeToMediaId(shortcode);
        try {
          const comments = await fetchAllComments(mediaId, sessionId.trim(), url);
          return { url, comments, error: null };
        } catch (e) {
          return { url, comments: [], error: String(e) };
        }
      })
    );

    return NextResponse.json({ results });
  } catch (err) {
    console.error('Analyze error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
