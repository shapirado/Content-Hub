import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { listClipCopies } from "@/lib/neon";
import { fetchYouTubeStats } from "@/lib/youtube";

function extractVideoId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const clipDetId = searchParams.get("clipDetId");
  if (!clipDetId) return NextResponse.json({ error: "Missing clipDetId" }, { status: 400 });

  const copies = await listClipCopies(clipDetId);
  const ytCopy = copies.find(
    (c) =>
      (c.platform ?? "").toLowerCase().startsWith("youtube") &&
      (c.path.includes("youtu.be") || c.path.includes("youtube.com"))
  );

  if (!ytCopy) return NextResponse.json({ error: "No YouTube copy found" }, { status: 404 });

  const videoId = extractVideoId(ytCopy.path);
  if (!videoId) return NextResponse.json({ error: "Could not extract video ID" }, { status: 422 });

  const stats = await fetchYouTubeStats(videoId);
  if (!stats) return NextResponse.json({ error: "Could not fetch stats from YouTube" }, { status: 502 });

  return NextResponse.json({ ...stats, videoId, videoUrl: ytCopy.path });
}
