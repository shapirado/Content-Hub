import { NextResponse } from "next/server";

function extractDriveFileId(url: string): string | null {
  const m = url.match(/\/file\/d\/([^/?&]+)/);
  if (m) return m[1];
  const m2 = url.match(/[?&]id=([^&]+)/);
  return m2 ? m2[1] : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as { driveUrl?: string };
    const driveUrl = body.driveUrl?.trim() ?? "";

    if (!driveUrl) {
      return NextResponse.json({ error: "חסר קישור" }, { status: 400 });
    }

    const fileId = extractDriveFileId(driveUrl);
    if (!fileId) {
      return NextResponse.json({ error: "לא נמצא מזהה קובץ בקישור" }, { status: 400 });
    }

    const downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t`;

    // Abort if Google Drive doesn't respond within 8 s (Vercel Hobby limit is 10 s)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    let res: Response;
    try {
      res = await fetch(downloadUrl, { redirect: "follow", signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: `Google Drive החזיר ${res.status} ${res.statusText}`, fileId },
        { status: 502 }
      );
    }

    // Cancel body immediately — we only need headers for the test
    await res.body?.cancel();

    const disposition = res.headers.get("content-disposition") ?? "";
    const contentType = res.headers.get("content-type") ?? "unknown";
    const contentLength = res.headers.get("content-length");

    // Prefer RFC 5987 (filename*=UTF-8''...) over plain filename= (often Windows-1252 encoded)
    let filename: string;
    const rfc5987 = disposition.match(/filename\*=UTF-8''([^;\n\r]+)/i);
    if (rfc5987) {
      filename = decodeURIComponent(rfc5987[1].trim());
    } else {
      const plain = disposition.match(/filename="?([^";\n\r]+)"?/i);
      filename = plain ? plain[1].trim() : `clip-${fileId}.mp4`;
    }

    const reportedSize = contentLength
      ? `${(parseInt(contentLength) / 1024 / 1024).toFixed(1)} MB`
      : "לא ידוע (אין Content-Length)";

    const displayTitle = filename.replace(/\.[^.]+$/, "");
    const isVideo = contentType.startsWith("video/") || filename.match(/\.(mp4|mov|m4v|webm)$/i);

    return NextResponse.json({
      ok: true,
      fileId,
      filename,
      contentType,
      reportedSize,
      isVideo,
      rawDisposition: disposition,
      // Values that will be written to the DB
      db: {
        "clips.path": driveUrl,
        "clips.platform": "googledrive",
        "clips.source_type": "url",
        "clips.title": displayTitle,
        "clip_details.original_filename": filename,
        "clip_details.video_path": "(os.tmpdir()/<uuid>.mp4 after download)",
      },
    });
  } catch (err) {
    const msg = (err as Error)?.message ?? "שגיאה לא ידועה";
    const isTimeout = msg.includes("abort") || msg.includes("Abort");
    return NextResponse.json(
      { error: isTimeout ? "הורדה לא הסתיימה תוך 8 שניות (timeout)" : msg },
      { status: 500 }
    );
  }
}
