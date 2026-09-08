import { NextResponse } from "next/server";
import path from "path";
import { auth } from "@/auth";
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
    if (!(videoFile instanceof File) || videoFile.size === 0) {
      return NextResponse.json({ error: "יש לספק קובץ וידאו" }, { status: 400 });
    }

    const buffer = Buffer.from(await videoFile.arrayBuffer());
    const originalFilename = videoFile.name;
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
