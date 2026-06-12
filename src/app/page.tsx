'use client';

import { useState, useRef } from 'react';

interface Comment {
  id: string;
  text: string;
  ownerUsername: string;
  timestamp: string;
  likesCount: number;
  postUrl: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

interface PostResult {
  postUrl: string;
  postId: string;
  comments: Comment[];
  stats: { positive: number; negative: number; neutral: number; total: number; totalLikes: number; positiveLikes: number; negativeLikes: number; neutralLikes: number };
  error?: string | null;
}

interface ProfileSummary {
  username: string;
  comments: (Comment & { postUrl: string })[];
  stats: { positive: number; negative: number; neutral: number; total: number; totalLikes: number; positiveLikes: number; negativeLikes: number; neutralLikes: number };
}

interface ReportData {
  posts: PostResult[];
  profiles: ProfileSummary[];
  overallStats: { positive: number; negative: number; neutral: number; total: number; totalLikes: number; positiveLikes: number; negativeLikes: number; neutralLikes: number };
  warning?: string;
}

const SENTIMENT_COLORS = {
  positive: 'bg-green-50 text-green-800 border-green-300',
  negative: 'bg-red-50 text-red-800 border-red-300',
  neutral: 'bg-gray-100 text-gray-700 border-gray-300',
};
const SENTIMENT_LABELS = {
  positive: 'Pozytywny',
  negative: 'Negatywny',
  neutral: 'Neutralny',
};

function StatBar({ stats }: { stats: { positive: number; negative: number; neutral: number; total: number; totalLikes?: number; positiveLikes?: number; negativeLikes?: number; neutralLikes?: number } }) {
  if (stats.total === 0) return <p className="text-xs text-gray-500">Brak komentarzy</p>;
  const posW = (stats.positive / stats.total) * 100;
  const negW = (stats.negative / stats.total) * 100;
  const neuW = (stats.neutral / stats.total) * 100;
  const hasLikes = stats.totalLikes !== undefined && stats.totalLikes > 0;
  const posLikesW = hasLikes ? ((stats.positiveLikes ?? 0) / stats.totalLikes!) * 100 : 0;
  const negLikesW = hasLikes ? ((stats.negativeLikes ?? 0) / stats.totalLikes!) * 100 : 0;
  const neuLikesW = hasLikes ? ((stats.neutralLikes ?? 0) / stats.totalLikes!) * 100 : 0;
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <div className="text-xs text-gray-500 font-medium">Komentarze ({stats.total})</div>
        <div className="flex overflow-hidden h-2 bg-gray-200">
          <div className="bg-green-500" style={{ width: `${posW}%` }} />
          <div className="bg-gray-400" style={{ width: `${neuW}%` }} />
          <div className="bg-red-500" style={{ width: `${negW}%` }} />
        </div>
        <div className="flex gap-4 text-xs text-gray-600">
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 inline-block" />{stats.positive} ({posW.toFixed(0)}%)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-gray-400 inline-block" />{stats.neutral} ({neuW.toFixed(0)}%)</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 inline-block" />{stats.negative} ({negW.toFixed(0)}%)</span>
        </div>
      </div>
      {hasLikes && (
        <div className="space-y-1">
          <div className="text-xs text-gray-500 font-medium">Polubienia ({stats.totalLikes})</div>
          <div className="flex overflow-hidden h-2 bg-gray-200">
            <div className="bg-green-500" style={{ width: `${posLikesW}%` }} />
            <div className="bg-gray-400" style={{ width: `${neuLikesW}%` }} />
            <div className="bg-red-500" style={{ width: `${negLikesW}%` }} />
          </div>
          <div className="flex gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 inline-block" />{stats.positiveLikes} ({posLikesW.toFixed(0)}%)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-gray-400 inline-block" />{stats.neutralLikes} ({neuLikesW.toFixed(0)}%)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 inline-block" />{stats.negativeLikes} ({negLikesW.toFixed(0)}%)</span>
          </div>
        </div>
      )}
    </div>
  );
}

function CommentCard({ comment, showPostLink }: { comment: Comment & { postUrl?: string }; showPostLink?: boolean }) {
  const sentiment = comment.sentiment ?? 'neutral';
  return (
    <div className={`border p-3 text-sm ${SENTIMENT_COLORS[sentiment]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <span className="font-semibold">@{comment.ownerUsername}</span>
          {showPostLink && comment.postUrl && (
            <a href={comment.postUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 text-xs hover:underline">post</a>
          )}
          <p className="mt-1">{comment.text}</p>
        </div>
        <span className="text-xs font-medium whitespace-nowrap px-2 py-1 border border-current opacity-70">
          {SENTIMENT_LABELS[sentiment]}
        </span>
      </div>
      <div className="mt-1 text-xs opacity-50">
        {new Date(comment.timestamp).toLocaleDateString('pl-PL')} · {comment.likesCount} lajków
      </div>
    </div>
  );
}

export default function Home() {
  const [urls, setUrls] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [apifyToken, setApifyToken] = useState('');
  const [showSessionHelp, setShowSessionHelp] = useState(false);
  const [showApifyHelp, setShowApifyHelp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [report, setReport] = useState<ReportData | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [shareError, setShareError] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'profiles'>('posts');
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const [filterSentiment, setFilterSentiment] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleAnalyze = async () => {
    const urlList = urls.split('\n').map((u) => u.trim()).filter(Boolean);
    if (urlList.length === 0) { setError('Wklej przynajmniej jeden link.'); return; }
    const hasInstagram = urlList.some((u) => !/tiktok\.com/i.test(u));
    const hasTikTok = urlList.some((u) => /tiktok\.com/i.test(u));
    if (hasInstagram && !sessionId.trim()) { setError('Wklej Instagram Session ID (wymagany dla postów Instagram).'); return; }
    if (hasTikTok && !apifyToken.trim()) { setError('Wklej Apify Token (wymagany dla TikToka).'); return; }

    setError(''); setReport(null); setReportId(null); setLoading(true); setElapsed(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

    try {
      // Step 1: fetch comments from Instagram
      setLoadingMsg('Pobieranie komentarzy z Instagram...');
      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: urlList, sessionId: sessionId.trim(), apifyToken: apifyToken.trim() }),
      });
      const analyzeData = await analyzeRes.json();
      if (!analyzeRes.ok) { setError(analyzeData.error ?? 'Błąd pobierania.'); return; }

      const totalComments = analyzeData.results.reduce(
        (sum: number, r: { comments: unknown[] }) => sum + r.comments.length, 0
      );

      // Step 2: analyze sentiment
      setLoadingMsg(`Analiza sentymentu ${totalComments} komentarzy przez Claude AI...`);
      const resultsRes = await fetch('/api/results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawResults: analyzeData.results, urls: urlList }),
      });
      const resultsData = await resultsRes.json();
      if (!resultsRes.ok) { setError(resultsData.error ?? 'Błąd analizy.'); return; }

      setReport(resultsData);

      // Step 3: save report to get shareable ID
      setLoadingMsg('Zapisywanie raportu...');
      try {
        const saveRes = await fetch('/api/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resultsData),
        });
        if (saveRes.ok) {
          const { id } = await saveRes.json();
          setReportId(id);
        }
      } catch (e) {
        console.error('Failed to save report:', e);
      }
    } catch {
      setError('Błąd połączenia z serwerem.');
    } finally {
      setLoading(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  async function handleShare() {
    if (!report) return;
    setShareError('');
    setSaving(true);
    
    let shareId = reportId;
    
    // Save to API if not already saved
    if (!shareId) {
      try {
        const res = await fetch('/api/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report),
        });
        if (res.ok) {
          const { id } = await res.json();
          shareId = id;
          setReportId(id);
        } else {
          const errText = await res.text();
          console.error('Failed to save report:', errText);
          setShareError(`Błąd zapisu: ${errText}`);
          setSaving(false);
          return;
        }
      } catch (e) {
        console.error('Failed to save report:', e);
        setShareError('Błąd połączenia z serwerem');
        setSaving(false);
        return;
      }
    }
    
    setSaving(false);
    if (!shareId) {
      setShareError('Nie udało się zapisać raportu');
      return;
    }
    const url = `${window.location.origin}/report?id=${shareId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleOpenInNewTab() {
    if (!report) return;
    setShareError('');
    setSaving(true);
    
    let openId = reportId;
    
    // Save to API if not already saved
    if (!openId) {
      try {
        const res = await fetch('/api/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(report),
        });
        if (res.ok) {
          const { id } = await res.json();
          openId = id;
          setReportId(id);
        } else {
          const errText = await res.text();
          console.error('Failed to save report:', errText);
          setShareError(`Błąd zapisu: ${errText}`);
          setSaving(false);
          return;
        }
      } catch (e) {
        console.error('Failed to save report:', e);
        setShareError('Błąd połączenia z serwerem');
        setSaving(false);
        return;
      }
    }
    
    setSaving(false);
    if (!openId) {
      setShareError('Nie udało się zapisać raportu');
      return;
    }
    window.open(`/report?id=${openId}`, '_blank');
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-black mb-2">Social Sentiment Analyzer</h1>
          <p className="text-gray-500 text-sm">Analizuj komentarze z Instagram i TikToka — poznaj sentyment swojej społeczności</p>
        </div>

        <div className="bg-gray-50 border border-black p-6 mb-6 space-y-4">
          {/* Session ID */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-black">Instagram Session ID</label>
              <button
                onClick={() => setShowSessionHelp(!showSessionHelp)}
                className="text-xs text-blue-600 hover:underline cursor-pointer"
              >
                Jak to znaleźć?
              </button>
            </div>
            {showSessionHelp && (
              <div className="mb-2 p-3 bg-blue-50 border border-blue-200 text-xs text-gray-700 space-y-1">
                <p className="font-medium text-black">Jak skopiować Session ID z przeglądarki:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Otwórz instagram.com w przeglądarce i zaloguj się</li>
                  <li>Naciśnij <kbd className="bg-white border border-gray-300 px-1">F12</kbd> → zakładka <strong>Application</strong> (Chrome) lub <strong>Storage</strong> (Firefox)</li>
                  <li>Kliknij <strong>Cookies</strong> → <strong>https://www.instagram.com</strong></li>
                  <li>Znajdź <strong>sessionid</strong> i skopiuj jego wartość</li>
                </ol>
                <p className="text-orange-600 font-medium mt-1">Session ID jest poufny — nie udostępniaj go nikomu.</p>
              </div>
            )}
            <input
              type="password"
              className="w-full border border-black bg-white p-3 text-sm text-black focus:outline-none focus:border-gray-500"
              placeholder="np. 12345678%3AabcXYZ..."
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Apify Token */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-black">Apify Token <span className="text-gray-400 font-normal">(wymagany dla TikToka)</span></label>
              <button
                onClick={() => setShowApifyHelp(!showApifyHelp)}
                className="text-xs text-blue-600 hover:underline cursor-pointer"
              >
                Jak to znaleźć?
              </button>
            </div>
            {showApifyHelp && (
              <div className="mb-2 p-3 bg-blue-50 border border-blue-200 text-xs text-gray-700 space-y-1">
                <p className="font-medium text-black">Jak zdobyć Apify Token:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Wejdź na <strong>apify.com</strong> i utwórz konto (bezpłatny plan wystarczy)</li>
                  <li>Przejdź do <strong>Settings → Integrations</strong></li>
                  <li>Skopiuj <strong>Personal API token</strong></li>
                </ol>
                <p className="text-orange-600 font-medium mt-1">Token jest poufny — nie udostępniaj go nikomu.</p>
              </div>
            )}
            <input
              type="password"
              className="w-full border border-black bg-white p-3 text-sm text-black focus:outline-none focus:border-gray-500"
              placeholder="apify_api_xxxxxxxxxxxxxxxxxxxx"
              value={apifyToken}
              onChange={(e) => setApifyToken(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* URLs */}
          <div>
            <label className="block text-sm font-medium text-black mb-1">Linki do postów (jeden na linię)</label>
            <textarea
              className="w-full border border-black bg-white p-3 text-sm text-black focus:outline-none focus:border-gray-500 resize-none"
              rows={4}
              placeholder={"https://www.instagram.com/p/ABC123/\nhttps://www.tiktok.com/@user/video/123456789"}
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-300 text-red-700 text-sm">{error}</div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="w-full bg-black text-white font-semibold py-3 hover:bg-gray-800 disabled:opacity-50 transition cursor-pointer"
          >
            {loading ? loadingMsg : 'Analizuj komentarze'}
          </button>
        </div>

        {loading && (
          <div className="bg-gray-50 border border-black p-8 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-black border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-black font-medium">{loadingMsg}</p>
            <p className="text-gray-500 text-xs mt-1">{elapsed}s</p>
          </div>
        )}

        {report && (
          <div className="space-y-6">
            {/* Action buttons */}
            <div className="flex flex-col gap-2 no-print">
              <div className="flex gap-3">
                <button
                  onClick={handleShare}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium border border-black text-black hover:bg-gray-100 transition cursor-pointer bg-white disabled:opacity-50"
                >
                  {saving ? 'Zapisywanie...' : copied ? 'Skopiowano!' : 'Udostępnij raport'}
                </button>
                <button
                  onClick={handleOpenInNewTab}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium border border-black text-black hover:bg-gray-100 transition cursor-pointer bg-white disabled:opacity-50"
                >
                  {saving ? 'Zapisywanie...' : 'Otwórz w osobnej karcie'}
                </button>
              </div>
              {shareError && (
                <div className="text-red-600 text-sm">{shareError}</div>
              )}
            </div>

            {report.warning && (
              <div className="border border-orange-300 bg-orange-50 p-4 text-sm text-orange-700">{report.warning}</div>
            )}

            <div className="bg-gray-50 border border-black p-6">
              <h2 className="font-semibold text-black mb-4">Podsumowanie ogólne</h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-4 bg-green-50 border border-green-300">
                  <div className="text-2xl font-bold text-green-700">{report.overallStats.positive}</div>
                  <div className="text-xs text-green-700 mt-1">Pozytywne</div>
                  <div className="text-xs text-green-600 mt-1">❤️ {report.overallStats.positiveLikes}</div>
                </div>
                <div className="text-center p-4 bg-gray-100 border border-gray-300">
                  <div className="text-2xl font-bold text-gray-600">{report.overallStats.neutral}</div>
                  <div className="text-xs text-gray-600 mt-1">Neutralne</div>
                  <div className="text-xs text-gray-500 mt-1">❤️ {report.overallStats.neutralLikes}</div>
                </div>
                <div className="text-center p-4 bg-red-50 border border-red-300">
                  <div className="text-2xl font-bold text-red-700">{report.overallStats.negative}</div>
                  <div className="text-xs text-red-700 mt-1">Negatywne</div>
                  <div className="text-xs text-red-600 mt-1">❤️ {report.overallStats.negativeLikes}</div>
                </div>
              </div>
              <StatBar stats={report.overallStats} />
              <p className="text-xs text-gray-500 mt-2 text-center">{report.overallStats.total} komentarzy · {report.overallStats.totalLikes} polubień łącznie</p>
            </div>

            <div className="flex gap-0 bg-gray-50 border border-black p-0">
              <button onClick={() => setActiveTab('posts')} className={`flex-1 py-2 text-sm font-medium transition cursor-pointer border-r border-black ${activeTab === 'posts' ? 'bg-black text-white' : 'text-gray-600 hover:text-black'}`}>
                Posty ({report.posts.length})
              </button>
              <button onClick={() => setActiveTab('profiles')} className={`flex-1 py-2 text-sm font-medium transition cursor-pointer ${activeTab === 'profiles' ? 'bg-black text-white' : 'text-gray-600 hover:text-black'}`}>
                Profile ({report.profiles.length})
              </button>
            </div>

            <div className="flex gap-2 flex-wrap">
              {(['all', 'positive', 'negative', 'neutral'] as const).map((f) => (
                <button key={f} onClick={() => setFilterSentiment(f)}
                  className={`px-3 py-1 text-xs font-medium border transition cursor-pointer ${filterSentiment === f ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300 hover:border-black'}`}>
                  {f === 'all' ? 'Wszystkie' : SENTIMENT_LABELS[f]}
                </button>
              ))}
            </div>

            {activeTab === 'posts' && (
              <div className="space-y-4">
                {report.posts.map((post) => {
                  const filtered = filterSentiment === 'all' ? post.comments : post.comments.filter((c) => c.sentiment === filterSentiment);
                  const isExpanded = expandedPost === post.postId;
                  return (
                    <div key={post.postId} className="bg-gray-50 border border-black overflow-hidden">
                      <div className="p-5 cursor-pointer hover:bg-gray-100 transition" onClick={() => setExpandedPost(isExpanded ? null : post.postId)}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <a href={post.postUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm hover:underline truncate block" onClick={(e) => e.stopPropagation()}>
                              {post.postUrl}
                            </a>
                            {post.error && <p className="text-xs text-red-600 mt-1">{post.error}</p>}
                            <div className="mt-2"><StatBar stats={post.stats} /></div>
                          </div>
                          <span className="text-gray-500 text-sm mt-1">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="border-t border-black p-4 space-y-2 max-h-96 overflow-y-auto">
                          {filtered.length === 0
                            ? <p className="text-sm text-gray-500 text-center py-4">Brak komentarzy</p>
                            : filtered.map((c) => <CommentCard key={c.id} comment={c} />)
                          }
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'profiles' && (
              <div className="space-y-4">
                {[...report.profiles].sort((a, b) => b.stats.total - a.stats.total).map((profile) => {
                  const filtered = filterSentiment === 'all' ? profile.comments : profile.comments.filter((c) => c.sentiment === filterSentiment);
                  const isExpanded = expandedProfile === profile.username;
                  return (
                    <div key={profile.username} className="bg-gray-50 border border-black overflow-hidden">
                      <div className="p-5 cursor-pointer hover:bg-gray-100 transition" onClick={() => setExpandedProfile(isExpanded ? null : profile.username)}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex-1">
                            <div className="font-semibold text-black">@{profile.username}</div>
                            <div className="mt-2"><StatBar stats={profile.stats} /></div>
                          </div>
                          <span className="text-gray-500 text-sm">{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="border-t border-black p-4 space-y-2 max-h-96 overflow-y-auto">
                          {filtered.length === 0
                            ? <p className="text-sm text-gray-500 text-center py-4">Brak komentarzy</p>
                            : filtered.map((c, i) => <CommentCard key={i} comment={c} showPostLink />)
                          }
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
