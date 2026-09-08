import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const maxDuration = 60; // Vercel Hobby max; needed for large Drive downloads

function fixHeaderEncoding(str: string): string {
  try {
    const bytes = Uint8Array.from(str, c => c.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return str;
  }
}

function extractDriveFileId(url: string): string | null {
  const m = url.match(/\/file\/d\/([^/?&]+)/);
  if (m) return m[1];
  const m2 = url.match(/[?&]id=([^&]+)/);
  return m2 ? m2[1] : null;
}

async function downloadFromDrive(fileId: string): Promise<{ buffer: Buffer; filename: string }> {
  const downloadUrl = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&authuser=0&confirm=t`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);
  let res: Response;
  try {
    res = await fetch(downloadUrl, { redirect: "follow", signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!res.ok) throw new Error(`הורדה מ-Google Drive נכשלה (${res.status})`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const disposition = res.headers.get("content-disposition") ?? "";
  const rfc5987 = disposition.match(/filename\*=UTF-8''([^;\n\r]+)/i);
  let filename: string;
  if (rfc5987) {
    filename = decodeURIComponent(rfc5987[1].trim());
  } else {
    const plain = disposition.match(/filename="?([^";\n\r]+)"?/i);
    filename = plain ? fixHeaderEncoding(plain[1].trim()) : `clip-${fileId}.mp4`;
  }
  return { buffer, filename };
}
import {
  createMassarYom,
  addGoogleDriveClipsCopy,
  addYouTubeClipsCopy,
  listMassarYomClips,
  setTaskPosted,
} from "@/lib/neon";
import { generateMassarYomContent } from "@/lib/claude";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const videoFile = formData.get("videoFile");
    const videoUrlRaw = formData.get("videoUrl");
    const scheduledDate = formData.get("scheduledDate");
    const niritCaption = formData.get("niritCaption");

    const driveUrl =
      typeof videoUrlRaw === "string" && videoUrlRaw.trim()
        ? videoUrlRaw.trim()
        : null;

    if (typeof scheduledDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
      return NextResponse.json({ error: "תאריך פרסום לא תקין" }, { status: 400 });
    }
    if (typeof niritCaption !== "string" || !niritCaption.trim()) {
      return NextResponse.json({ error: "טקסט הפוסט חסר" }, { status: 400 });
    }
    const driveFileId = driveUrl ? extractDriveFileId(driveUrl) : null;

    let buffer: Buffer;
    let originalFilename: string;

    if (driveFileId) {
      const downloaded = await downloadFromDrive(driveFileId);
      buffer = downloaded.buffer;
      originalFilename = downloaded.filename;
    } else if (videoFile instanceof File && videoFile.size > 0) {
      buffer = Buffer.from(await videoFile.arrayBuffer());
      originalFilename = videoFile.name;
    } else {
      return NextResponse.json({ error: "יש לספק קישור Google Drive או קובץ וידאו" }, { status: 400 });
    }
    const clipDetId = crypto.randomUUID();
    const displayTitle = originalFilename.replace(/\.[^.]+$/, "");

    const { transcribeAndSave } = await import("@/lib/transcribe");
    const { transcript, thumbnail, videoPath } = await transcribeAndSave(buffer, clipDetId);

    const { uploadToYouTube } = await import("@/lib/youtube");
    const [youtubeResult, contentResult] = await Promise.allSettled([
      uploadToYouTube({
        videoPath,
        title: displayTitle,
        description: niritCaption.trim(),
        hashtags: "",
      }),
      generateMassarYomContent(transcript, niritCaption.trim()),
    ]);

    if (contentResult.status === "rejected") {
      const msg = (contentResult.reason as Error)?.message ?? "שגיאה ביצירת תוכן";
      return NextResponse.json({ error: msg }, { status: 502 });
    }
    const { hook, tiktokHashtags, youtubeTitle, pillar, summary, tag } = contentResult.value;

    const isGoogleDriveUrl = driveUrl !== null && /drive\.google\.com/i.test(driveUrl);

    await createMassarYom({
      clipDetId,
      youtubeTitle,
      transcript,
      summary,
      hook,
      tiktokHashtags,
      niritCaption: niritCaption.trim(),
      scheduledDate,
      videoPath,
      sourceType: "upload",
      driveUrl: isGoogleDriveUrl ? driveUrl : null,
      pillar,
      tag,
      thumbnail,
      originalFilename,
      googleDriveUploaded: isGoogleDriveUrl,
    });

    if (isGoogleDriveUrl && driveUrl) {
      await addGoogleDriveClipsCopy(clipDetId, driveUrl, displayTitle);
    }

    let youtubeError: string | null = null;
    if (youtubeResult.status === "fulfilled") {
      const { videoUrl } = youtubeResult.value;
      await addYouTubeClipsCopy(clipDetId, videoUrl, displayTitle);
      const clips = await listMassarYomClips();
      const youtubeTask = clips
        .find((c) => c.id === clipDetId)
        ?.tasks.find((t) => t.platform === "youtube");
      if (youtubeTask) await setTaskPosted(youtubeTask.id, videoUrl);
    } else {
      youtubeError = (youtubeResult.reason as Error)?.message ?? "שגיאה לא ידועה";
    }

    return NextResponse.json({ clipDetId, youtubeError });
  } catch (err) {
    console.error("analyze route error:", err);
    return NextResponse.json(
      { error: (err as Error)?.message ?? "שגיאה לא צפויה" },
      { status: 500 }
    );
  }
}
