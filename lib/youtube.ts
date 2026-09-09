import fs from "fs";

export function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be)/i.test(url);
}

export async function fetchYouTubeTitle(url: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { title?: string };
    return json.title ?? null;
  } catch {
    return null;
  }
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing YouTube OAuth env vars: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN"
    );
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("No access_token in token refresh response");
  return json.access_token;
}

async function findOrCreatePlaylist(
  accessToken: string,
  title: string
): Promise<string | null> {
  try {
    const listRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?part=snippet&mine=true&maxResults=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!listRes.ok) return null;
    const listJson = (await listRes.json()) as {
      items?: { id: string; snippet: { title: string } }[];
    };
    const existing = listJson.items?.find((p) => p.snippet.title === title);
    if (existing) return existing.id;

    // Create it
    const createRes = await fetch(
      "https://www.googleapis.com/youtube/v3/playlists?part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          snippet: { title, defaultLanguage: "iw" },
          status: { privacyStatus: "public" },
        }),
      }
    );
    if (!createRes.ok) return null;
    const created = (await createRes.json()) as { id?: string };
    return created.id ?? null;
  } catch {
    return null;
  }
}

async function addToPlaylist(
  accessToken: string,
  playlistId: string,
  videoId: string
): Promise<void> {
  const res = await fetch("https://www.googleapis.com/youtube/v3/playlistItems?part=snippet", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      snippet: {
        playlistId,
        resourceId: { kind: "youtube#video", videoId },
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube playlist add failed ${res.status}: ${body.slice(0, 200)}`);
  }
}

export async function fetchYouTubeStats(videoId: string): Promise<{
  views: number | null;
  likes: number | null;
  comments: number | null;
} | null> {
  try {
    const accessToken = await getAccessToken();
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      items?: { statistics?: { viewCount?: string; likeCount?: string; commentCount?: string } }[];
    };
    const stats = json.items?.[0]?.statistics;
    if (!stats) return null;
    return {
      views: stats.viewCount != null ? parseInt(stats.viewCount, 10) : null,
      likes: stats.likeCount != null ? parseInt(stats.likeCount, 10) : null,
      comments: stats.commentCount != null ? parseInt(stats.commentCount, 10) : null,
    };
  } catch {
    return null;
  }
}

export async function uploadToYouTube(params: {
  videoPath: string;
  title: string;
  description: string;
  hashtags: string;
}): Promise<{ videoId: string; videoUrl: string }> {
  const accessToken = await getAccessToken();

  const tags = params.hashtags
    .split(/\s+/)
    .filter((t) => t.startsWith("#"))
    .map((t) => t.slice(1));

  const metadata = {
    snippet: {
      title: params.title,
      description: params.description,
      tags,
    },
    status: {
      privacyStatus: "unlisted",
      selfDeclaredMadeForKids: false,
    },
  };

  // Initiate resumable upload session
  const initRes = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Type": "video/mp4",
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!initRes.ok) {
    const body = await initRes.text();
    throw new Error(`YouTube upload init failed ${initRes.status}: ${body.slice(0, 200)}`);
  }

  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) throw new Error("YouTube upload init returned no Location header");

  const videoBytes = fs.readFileSync(params.videoPath);

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4" },
    body: videoBytes,
  });

  if (!uploadRes.ok && uploadRes.status !== 200 && uploadRes.status !== 201) {
    const body = await uploadRes.text();
    throw new Error(`YouTube video upload failed ${uploadRes.status}: ${body.slice(0, 200)}`);
  }

  const json = (await uploadRes.json()) as { id?: string };
  const videoId = json.id;
  if (!videoId) throw new Error("YouTube upload response missing video id");

  // Add to playlist (best-effort — doesn't fail the upload)
  const playlistId =
    process.env.YOUTUBE_PLAYLIST_ID ??
    (await findOrCreatePlaylist(accessToken, "יהלומים"));
  if (playlistId) await addToPlaylist(accessToken, playlistId, videoId);

  return { videoId, videoUrl: `https://youtu.be/${videoId}` };
}
