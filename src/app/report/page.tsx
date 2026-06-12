'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { decodeReport, ReportData } from '@/lib/reportUtils';

interface Comment {
  id: string;
  text: string;
  ownerUsername: string;
  timestamp: string;
  likesCount: number;
  postUrl: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
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

function recalcStats(comments: Comment[]) {
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
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 inline-block" />
            {stats.positive} ({posW.toFixed(0)}%)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-gray-400 inline-block" />
            {stats.neutral} ({neuW.toFixed(0)}%)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-red-500 inline-block" />
            {stats.negative} ({negW.toFixed(0)}%)
          </span>
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
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 inline-block" />
              {stats.positiveLikes} ({posLikesW.toFixed(0)}%)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-gray-400 inline-block" />
              {stats.neutralLikes} ({neuLikesW.toFixed(0)}%)
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-red-500 inline-block" />
              {stats.negativeLikes} ({negLikesW.toFixed(0)}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function EditableCommentCard({
  comment,
  showPostLink,
  onSentimentChange,
}: {
  comment: Comment & { postUrl?: string };
  showPostLink?: boolean;
  onSentimentChange: (id: string, sentiment: 'positive' | 'negative' | 'neutral') => void;
}) {
  const sentiment = comment.sentiment ?? 'neutral';
  return (
    <div className={`border p-3 text-sm ${SENTIMENT_COLORS[sentiment]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <span className="font-semibold">@{comment.ownerUsername}</span>
          {showPostLink && comment.postUrl && (
            <a
              href={comment.postUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-blue-600 text-xs hover:underline"
            >
              post
            </a>
          )}
          <p className="mt-1">{comment.text}</p>
        </div>
        <div className="flex flex-col gap-1 items-end no-print">
          <span className="text-xs font-medium whitespace-nowrap px-2 py-1 border border-current opacity-70">
            {SENTIMENT_LABELS[sentiment]}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => onSentimentChange(comment.id, 'positive')}
              className={`px-2 py-0.5 text-xs border cursor-pointer transition ${sentiment === 'positive' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-green-600 border-green-300 hover:bg-green-50'}`}
              title="Pozytywny"
            >
              +
            </button>
            <button
              onClick={() => onSentimentChange(comment.id, 'neutral')}
              className={`px-2 py-0.5 text-xs border cursor-pointer transition ${sentiment === 'neutral' ? 'bg-gray-500 text-white border-gray-500' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-100'}`}
              title="Neutralny"
            >
              ~
            </button>
            <button
              onClick={() => onSentimentChange(comment.id, 'negative')}
              className={`px-2 py-0.5 text-xs border cursor-pointer transition ${sentiment === 'negative' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-red-600 border-red-300 hover:bg-red-50'}`}
              title="Negatywny"
            >
              -
            </button>
          </div>
        </div>
      </div>
      <div className="mt-1 text-xs opacity-50">
        {new Date(comment.timestamp).toLocaleDateString('pl-PL')} · {comment.likesCount} lajków
      </div>
    </div>
  );
}

function ReportPageInner() {
  const searchParams = useSearchParams();
  const reportId = searchParams.get('id');
  const encoded = searchParams.get('d');

  const [report, setReport] = useState<ReportData | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(reportId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'posts' | 'profiles'>('posts');
  const [expandedPost, setExpandedPost] = useState<string | null>(null);
  const [expandedProfile, setExpandedProfile] = useState<string | null>(null);
  const [filterSentiment, setFilterSentiment] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all');
  const [copied, setCopied] = useState(false);
  const [printMode, setPrintMode] = useState(false);

  useEffect(() => {
    async function loadReport() {
      setLoading(true);
      setError(null);

      try {
        if (reportId) {
          // Load from API
          const res = await fetch(`/api/report?id=${reportId}`);
          if (!res.ok) {
            throw new Error('Raport nie znaleziony');
          }
          const data = await res.json();
          setReport(data);
          setCurrentId(reportId);
        } else if (encoded) {
          // Legacy: decode from URL
          const decoded = decodeReport(encoded);
          setReport(decoded);
          // Save to API and get new ID
          const res = await fetch('/api/report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(decoded),
          });
          if (res.ok) {
            const { id } = await res.json();
            setCurrentId(id);
            // Update URL to use new short ID
            window.history.replaceState(null, '', `/report?id=${id}`);
          }
        } else {
          setError('Brak danych raportu w URL.');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Nie udało się odczytać raportu.');
      } finally {
        setLoading(false);
      }
    }

    loadReport();
  }, [reportId, encoded]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-black border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Ładowanie raportu...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-sm">{error || 'Nie udało się odczytać raportu.'}</p>
          <a href="/" className="text-black text-sm underline mt-2 inline-block">Wróć do analizatora</a>
        </div>
      </div>
    );
  }

  async function updateCommentSentiment(commentId: string, newSentiment: 'positive' | 'negative' | 'neutral') {
    if (!report) return;

    const updatedPosts = report.posts.map((post) => {
      const updatedComments = post.comments.map((c) =>
        c.id === commentId ? { ...c, sentiment: newSentiment } : c
      );
      return { ...post, comments: updatedComments, stats: recalcStats(updatedComments) };
    });

    const updatedProfiles = report.profiles.map((profile) => {
      const updatedComments = profile.comments.map((c) =>
        c.id === commentId ? { ...c, sentiment: newSentiment } : c
      );
      return { ...profile, comments: updatedComments, stats: recalcStats(updatedComments) };
    });

    const allComments = updatedPosts.flatMap((p) => p.comments);
    const overallStats = recalcStats(allComments);

    const newReport: ReportData = {
      ...report,
      posts: updatedPosts,
      profiles: updatedProfiles,
      overallStats,
    };

    setReport(newReport);

    // Save to API and update URL
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReport),
      });
      if (res.ok) {
        const { id } = await res.json();
        setCurrentId(id);
        window.history.replaceState(null, '', `/report?id=${id}`);
      }
    } catch (e) {
      console.error('Failed to save report:', e);
    }
  }

  async function handleShare() {
    if (!report) return;
    
    let shareId = currentId;
    
    // If no ID yet, save first
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
          setCurrentId(id);
          window.history.replaceState(null, '', `/report?id=${id}`);
        }
      } catch (e) {
        console.error('Failed to save report:', e);
        return;
      }
    }
    
    const url = `${window.location.origin}/report?id=${shareId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handlePrint() {
    setPrintMode(true);
    // Wait for state update and render, then print
    setTimeout(() => {
      window.print();
      setPrintMode(false);
    }, 100);
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-black mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
            Raport sentymentu
          </h1>
          <p className="text-gray-500 text-sm">Udostępniony raport analizy komentarzy Instagram</p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mb-6 no-print">
          <button
            onClick={handleShare}
            className="px-4 py-2 text-sm font-medium border border-black text-black hover:bg-gray-100 transition cursor-pointer bg-white"
          >
            {copied ? 'Skopiowano!' : 'Udostępnij raport'}
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-sm font-medium border border-black text-black hover:bg-gray-100 transition cursor-pointer bg-white"
          >
            Pobierz PDF
          </button>
          <a
            href="/"
            className="px-4 py-2 text-sm font-medium border border-black text-gray-600 hover:text-black hover:bg-gray-100 transition"
          >
            Nowa analiza
          </a>
        </div>

        {report.warning && (
          <div className="border border-orange-300 bg-orange-50 p-4 text-sm text-orange-700 mb-6">{report.warning}</div>
        )}

        {/* Overall stats */}
        <div className="bg-gray-50 border border-black p-6 mb-6">
          <h2 className="font-semibold text-black mb-4" style={{ fontFamily: 'var(--font-heading)' }}>
            Podsumowanie ogólne
          </h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center p-4 bg-green-50 border border-green-300">
              <div className="text-2xl font-bold text-green-700">{report.overallStats.positive}</div>
              <div className="text-xs text-green-700 mt-1">Pozytywne</div>
              <div className="text-xs text-green-600 mt-1">❤️ {report.overallStats.positiveLikes ?? 0}</div>
            </div>
            <div className="text-center p-4 bg-gray-100 border border-gray-300">
              <div className="text-2xl font-bold text-gray-600">{report.overallStats.neutral}</div>
              <div className="text-xs text-gray-600 mt-1">Neutralne</div>
              <div className="text-xs text-gray-500 mt-1">❤️ {report.overallStats.neutralLikes ?? 0}</div>
            </div>
            <div className="text-center p-4 bg-red-50 border border-red-300">
              <div className="text-2xl font-bold text-red-700">{report.overallStats.negative}</div>
              <div className="text-xs text-red-700 mt-1">Negatywne</div>
              <div className="text-xs text-red-600 mt-1">❤️ {report.overallStats.negativeLikes ?? 0}</div>
            </div>
          </div>
          <StatBar stats={report.overallStats} />
          <p className="text-xs text-gray-500 mt-2 text-center">{report.overallStats.total} komentarzy · {report.overallStats.totalLikes ?? 0} polubień łącznie</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 bg-gray-50 border border-black p-0 mb-4 no-print">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex-1 py-2 text-sm font-medium transition cursor-pointer border-r border-black ${activeTab === 'posts' ? 'bg-black text-white' : 'text-gray-600 hover:text-black'}`}
          >
            Posty ({report.posts.length})
          </button>
          <button
            onClick={() => setActiveTab('profiles')}
            className={`flex-1 py-2 text-sm font-medium transition cursor-pointer ${activeTab === 'profiles' ? 'bg-black text-white' : 'text-gray-600 hover:text-black'}`}
          >
            Profile ({report.profiles.length})
          </button>
        </div>

        {/* Filter */}
        <div className="flex gap-2 flex-wrap mb-4 no-print">
          {(['all', 'positive', 'negative', 'neutral'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterSentiment(f)}
              className={`px-3 py-1 text-xs font-medium border transition cursor-pointer ${filterSentiment === f ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300 hover:border-black'}`}
            >
              {f === 'all' ? 'Wszystkie' : SENTIMENT_LABELS[f]}
            </button>
          ))}
        </div>

        {(activeTab === 'posts' || printMode) && (
          <div className="space-y-4">
            {printMode && <h2 className="font-semibold text-black mb-2" style={{ fontFamily: 'var(--font-heading)' }}>Posty</h2>}
            {report.posts.map((post) => {
              const filtered = filterSentiment === 'all' || printMode ? post.comments : post.comments.filter((c) => c.sentiment === filterSentiment);
              const isExpanded = expandedPost === post.postId || printMode;
              return (
                <div key={post.postId} className="bg-gray-50 border border-black overflow-hidden">
                  <div
                    className="p-5 cursor-pointer hover:bg-gray-100 transition"
                    onClick={() => setExpandedPost(isExpanded ? null : post.postId)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <a
                          href={post.postUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 text-sm hover:underline truncate block"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {post.postUrl}
                        </a>
                        {post.error && <p className="text-xs text-red-600 mt-1">{post.error}</p>}
                        <div className="mt-2"><StatBar stats={post.stats} /></div>
                      </div>
                      <span className="text-gray-500 text-sm mt-1 no-print">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className={`border-t border-black p-4 space-y-2 ${printMode ? '' : 'max-h-96 overflow-y-auto'}`}>
                      {filtered.length === 0
                        ? <p className="text-sm text-gray-500 text-center py-4">Brak komentarzy</p>
                        : filtered.map((c) => (
                          <EditableCommentCard
                            key={c.id}
                            comment={c}
                            onSentimentChange={updateCommentSentiment}
                          />
                        ))
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {(activeTab === 'profiles' || printMode) && (
          <div className="space-y-4">
            {printMode && <h2 className="font-semibold text-black mb-2 mt-6" style={{ fontFamily: 'var(--font-heading)' }}>Profile</h2>}
            {[...report.profiles].sort((a, b) => b.stats.total - a.stats.total).map((profile) => {
              const filtered = filterSentiment === 'all' || printMode ? profile.comments : profile.comments.filter((c) => c.sentiment === filterSentiment);
              const isExpanded = expandedProfile === profile.username || printMode;
              return (
                <div key={profile.username} className="bg-gray-50 border border-black overflow-hidden">
                  <div
                    className="p-5 cursor-pointer hover:bg-gray-100 transition"
                    onClick={() => setExpandedProfile(isExpanded ? null : profile.username)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="font-semibold text-black">@{profile.username}</div>
                        <div className="mt-2"><StatBar stats={profile.stats} /></div>
                      </div>
                      <span className="text-gray-500 text-sm no-print">{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className={`border-t border-black p-4 space-y-2 ${printMode ? '' : 'max-h-96 overflow-y-auto'}`}>
                      {filtered.length === 0
                        ? <p className="text-sm text-gray-500 text-center py-4">Brak komentarzy</p>
                        : filtered.map((c, i) => (
                          <EditableCommentCard
                            key={i}
                            comment={c}
                            showPostLink
                            onSentimentChange={updateCommentSentiment}
                          />
                        ))
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500 text-sm">Ładowanie raportu...</p>
      </div>
    }>
      <ReportPageInner />
    </Suspense>
  );
}
