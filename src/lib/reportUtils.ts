import LZString from 'lz-string';

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
  stats: { positive: number; negative: number; neutral: number; total: number; totalLikes?: number; positiveLikes?: number; negativeLikes?: number; neutralLikes?: number };
  error?: string | null;
}

interface ProfileSummary {
  username: string;
  comments: (Comment & { postUrl: string })[];
  stats: { positive: number; negative: number; neutral: number; total: number; totalLikes?: number; positiveLikes?: number; negativeLikes?: number; neutralLikes?: number };
}

export interface ReportData {
  posts: PostResult[];
  profiles: ProfileSummary[];
  overallStats: { positive: number; negative: number; neutral: number; total: number; totalLikes?: number; positiveLikes?: number; negativeLikes?: number; neutralLikes?: number };
  warning?: string;
}

export function encodeReport(report: ReportData): string {
  // Use LZ-string compression for URL-safe encoding (much smaller than base64)
  return LZString.compressToEncodedURIComponent(JSON.stringify(report));
}

export function decodeReport(encoded: string): ReportData {
  // Try LZ-string decompression first, fall back to legacy base64 for old links
  const decompressed = LZString.decompressFromEncodedURIComponent(encoded);
  if (decompressed) {
    return JSON.parse(decompressed);
  }
  // Fallback for old base64-encoded links
  return JSON.parse(decodeURIComponent(atob(encoded)));
}
