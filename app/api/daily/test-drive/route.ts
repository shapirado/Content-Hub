import { NextResponse } from "next/server";

function extractDriveFileId(url: string): string | null {
  const m = url.match(/\/file\/d\/([^/?&]+)/);
  if (m) return m[1];
  const m2 = url.match(/[?&]id=([^&]+)/);
  return m2 ? m2[1] : null;
}

export async function POST(req: Request) {
  try {
    const { driveUrl } = (await req.json()) as { driveUrl?: string };
    if (!driveUrl?.trim()) {
      return NextResponse.json({ error: "חסר קישור" }, { status: 400 });
    }

    const fileId = extractDriveFileId(driveUrl.trim());
    if (!fileId) {
      return NextResponse.json({ error: "לא נמצא מזהה קובץ בקישור" }, { status: 400 });
    }

    const downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t`;
    const res = await fetch(downloadUrl, { redirect: "follow" });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Google Drive החזיר ${res.status}`, fileId },
        { status: 502 }
      );
    }

    const disposition = res.headers.get("content-disposition") ?? "";
    const nameMatch = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";\n]+)/i);
    const filename = nameMatch
      ? decodeURIComponent(nameMatch[1].trim().replace(/"/g, ""))
      : `clip-${fileId}.mp4`;

    const contentType = res.headers.get("content-type") ?? "unknown";
    const contentLength = res.headers.get("content-length");

    // Read just the first 64KB to confirm the stream opens; don't buffer the whole file
    const reader = res.body?.getReader();
    let bytesRead = 0;
    if (reader) {
      while (bytesRead < 65536) {
        const { done, value } = await reader.read();
        if (done) break;
        bytesRead += value.length;
      }
      await reader.cancel();
    }

    const reportedSize = contentLength ? `${(parseInt(contentLength) / 1024 / 1024).toFixed(1)} MB` : "לא ידוע";

    return NextResponse.json({
      ok: true,
      fileId,
      filename,
      contentType,
      reportedSize,
      firstBytesRead: bytesRead,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error)?.message ?? "שגיאה לא ידועה" },
      { status: 500 }
    );
  }
}
