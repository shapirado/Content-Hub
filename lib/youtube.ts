const YOUTUBE_URL_PATTERN = /(?:youtube\.com|youtu\.be)/i;

export function isYouTubeUrl(url: string): boolean {
  return YOUTUBE_URL_PATTERN.test(url);
}

/** Live video title via YouTube's public oEmbed endpoint — no API key. Never throws; returns null on any failure (private/deleted video, rate limit, network error). */
export async function fetchYouTubeTitle(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string };
    return data.title ?? null;
  } catch {
    return null;
  }
}
