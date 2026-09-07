"use server";

import { auth } from "@/auth";
import path from "path";
import crypto from "crypto";
import {
  getClipDetails,
  getClipRepresentativeLinks,
  getClipThumbnails,
  getClipTranscripts,
  listClipCopiesForIds,
  listClipCopies,
  addClipCopy,
  removeClipCopy,
  searchClipPaths,
  listKnownDriveFolders,
  updateClipCopyPlatform,
  updateClipCopyPath,
  listClipPerformance,
  upsertClipPerformance,
  deleteClipPerformance,
  updateClipDetailsMetadata,
  updateClipTranscript,
  mergeClipDetails,
  deleteClipDetails,
  getClipsForExport,
  listContentTasks,
  updateContentTaskStatus,
  createEvent,
  updateEvent,
  deleteEvent,
  createContentTask,
  updateContentTask,
  deleteContentTask,
  listContentTasksByDateRange,
  listClipsForPlanning,
  listWhatsappReviewsByProductType,
  listEvents,
  createMassarYom,
  listMassarYomClips,
  setMassarYomChecklistFlag,
  setTaskPosted,
  addYouTubeClipsCopy,
  addGoogleDriveClipsCopy,
  updateClipThumbnail,
  updateClipHooks,
  type ClipLibraryRow,
  type ClipPerformanceUpsert,
  type ClipExportRow,
  type ContentTask,
  type Event,
  type EventInput,
  type ContentTaskInput,
  type ContentTaskPatch,
  type ClipForPlanning,
  type ReviewForPlanning,
  type MassarYomClip,
} from "@/lib/neon";
import { generateMassarYomContent } from "@/lib/claude";
import { resolveCopyLink } from "@/lib/paths";
import { buildContentPlanPrompt, callContentPlannerClaude, parseContentPlanResponse } from "@/lib/claude";

async function requireSession() {
  const session = await auth();
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function getClipDetailAction(clipId: string) {
  await requireSession();
  return getClipDetails(clipId);
}

export async function listClipCopiesAction(clipDetId: string) {
  await requireSession();
  return listClipCopies(clipDetId);
}

export async function addClipCopyAction(
  clipDetId: string,
  sourceType: "upload" | "url",
  path: string,
  platform?: string | null,
  title?: string | null
) {
  await requireSession();
  return addClipCopy(clipDetId, sourceType, path, platform, title);
}

export async function searchClipPathsAction(query: string, excludeClipDetId: string) {
  await requireSession();
  if (!query.trim()) return [];
  return searchClipPaths(query.trim(), excludeClipDetId);
}

export async function listKnownDriveFoldersAction() {
  await requireSession();
  return listKnownDriveFolders();
}

export async function removeClipCopyAction(copyId: string) {
  await requireSession();
  return removeClipCopy(copyId);
}

export async function updateClipCopyPathAction(copyId: string, path: string) {
  await requireSession();
  return updateClipCopyPath(copyId, path);
}

export async function updateClipCopyPlatformAction(copyId: string, platform: string | null) {
  await requireSession();
  return updateClipCopyPlatform(copyId, platform);
}

export async function listClipPerformanceAction(clipDetId: string) {
  await requireSession();
  return listClipPerformance(clipDetId);
}

export async function upsertClipPerformanceAction(row: ClipPerformanceUpsert) {
  await requireSession();
  return upsertClipPerformance(row);
}

export async function deleteClipPerformanceAction(id: string) {
  await requireSession();
  return deleteClipPerformance(id);
}

/** Merges a duplicate logical clip (clip_details row) into a survivor — repoints its copies/performance rows, then deletes it. Neon-native equivalent of mergeRawClipRecordsAction, operating on the new schema instead of Airtable. */
export async function mergeClipDetailsAction(survivorId: string, loserId: string) {
  await requireSession();
  return mergeClipDetails(loserId, survivorId);
}

export async function deleteClipDetailsAction(clipId: string) {
  await requireSession();
  return deleteClipDetails(clipId);
}

/** Edits pillar/season/context tags/usable/wardrobe/TikTok-posted directly on clip_details in Neon — no Airtable round-trip. */
export async function updateClipMetadataAction(
  clipId: string,
  fields: {
    pillar?: string;
    season?: string;
    usable?: string;
    contextTags?: string[];
    wardrobe?: string;
    postedToTikTok?: boolean;
  }
) {
  await requireSession();
  // Only touch fields actually present on the caller's object — each edit action passes exactly
  // one field at a time, and an explicit `undefined` value means "clear this field", not "leave
  // every other field untouched" (which is why we check key presence, not truthiness).
  const updates: Parameters<typeof updateClipDetailsMetadata>[1] = {};
  if ("pillar" in fields) updates.pillar = fields.pillar;
  if ("season" in fields) updates.season = fields.season;
  if ("usable" in fields) updates.usable = fields.usable;
  if ("contextTags" in fields) updates.context_tags = fields.contextTags;
  if ("wardrobe" in fields) updates.wardrobe = fields.wardrobe;
  if ("postedToTikTok" in fields) updates.posted_to_tiktok = fields.postedToTikTok;
  return updateClipDetailsMetadata(clipId, updates);
}

export async function updateClipTranscriptAction(clipId: string, transcript: string) {
  await requireSession();
  return updateClipTranscript(clipId, transcript);
}

/** Every clip_details field, one row per matching clip_performance record, for whichever clip ids are currently filtered/searched in the UI. */
export async function exportClipsAction(clipIds: string[]): Promise<ClipExportRow[]> {
  await requireSession();
  return getClipsForExport(clipIds);
}

export type PlannerTask = {
  id: string;
  platform: "tiktok" | "instagram" | "newsletter" | "youtube";
  scheduled_date: string;    // ISO date YYYY-MM-DD
  status: "ai_draft" | "pending_review" | "approved" | "posted";
  hook: string | null;
  caption: string | null;
  hashtags: string | null;
  canva_url: string | null;
  live_url: string | null;
  event_id: string | null;
  thumbnailUrl: string | null;
  clipUrl: string | null;
  transcript: string | null;
  copies: { path: string; platform: string | null; url: string | null }[];
};

export async function listTasksAction(): Promise<PlannerTask[]> {
  await requireSession();
  const tasks = await listContentTasks();

  const clipSourceIds = [
    ...new Set(
      tasks.map((t) => t.clip_det_id).filter((id): id is string => !!id)
    ),
  ];

  const [clipThumbnails, clipLinks, clipTranscripts, clipCopiesById] =
    await Promise.all([
      getClipThumbnails(clipSourceIds),
      getClipRepresentativeLinks(clipSourceIds),
      getClipTranscripts(clipSourceIds),
      listClipCopiesForIds(clipSourceIds),
    ]);

  return tasks.map((t) => {
    const thumbnailUrl = t.clip_det_id ? (clipThumbnails[t.clip_det_id] ?? null) : null;
    const clipPath = t.clip_det_id ? (clipLinks[t.clip_det_id] ?? null) : null;
    const clipUrl = clipPath ? resolveCopyLink(clipPath) : null;
    const transcript = t.clip_det_id ? (clipTranscripts[t.clip_det_id] ?? null) : null;
    const copies = (t.clip_det_id ? clipCopiesById[t.clip_det_id] : undefined) ?? [];

    return {
      id: t.id,
      platform: t.platform,
      scheduled_date: t.scheduled_date,
      status: t.status,
      hook: t.hook,
      caption: t.caption,
      hashtags: t.hashtags,
      canva_url: t.canva_url,
      live_url: t.live_url,
      event_id: t.event_id,
      thumbnailUrl,
      clipUrl,
      transcript,
      copies: copies.map((c) => ({
        path: c.path,
        platform: c.platform,
        url: resolveCopyLink(c.path),
      })),
    };
  });
}

export async function updateTaskStatusAction(taskId: string, status: string): Promise<string> {
  await requireSession();
  await updateContentTaskStatus(taskId, status);
  return status;
}

// ---------------------------------------------------------------------------
// Events server actions
// ---------------------------------------------------------------------------

export async function createEventAction(data: EventInput): Promise<Event> {
  await requireSession();
  return createEvent(data);
}

export async function updateEventAction(id: string, data: EventInput): Promise<Event> {
  await requireSession();
  const result = await updateEvent(id, data);
  if (!result) throw new Error(`Event ${id} not found`);
  return result;
}

export async function deleteEventAction(id: string): Promise<void> {
  await requireSession();
  await deleteEvent(id);
}

// ---------------------------------------------------------------------------
// ContentTask server actions
// ---------------------------------------------------------------------------

export async function createContentTaskAction(data: ContentTaskInput): Promise<ContentTask> {
  await requireSession();
  return createContentTask(data);
}

export async function updateContentTaskAction(id: string, patch: ContentTaskPatch): Promise<ContentTask> {
  await requireSession();
  const result = await updateContentTask(id, patch);
  if (!result) throw new Error(`ContentTask ${id} not found`);
  return result;
}

export async function deleteContentTaskAction(id: string): Promise<void> {
  await requireSession();
  await deleteContentTask(id);
}

export async function listContentTasksByDateRangeAction(from: string, to: string): Promise<ContentTask[]> {
  await requireSession();
  return listContentTasksByDateRange(from, to);
}

// ---------------------------------------------------------------------------
// AI Content Planner
// ---------------------------------------------------------------------------

export type GeneratePlanParams = {
  from: string;
  to: string;
  eventIds: string[];
};

export async function generateContentPlanAction(
  params: GeneratePlanParams
): Promise<ContentTask[]> {
  await requireSession();

  const [clips, eventsAll, reviews] = await Promise.all([
    listClipsForPlanning(),
    listEvents(),
    listWhatsappReviewsByProductType(null),
  ]);

  const events =
    params.eventIds.length > 0
      ? eventsAll.filter((e) => params.eventIds.includes(e.id))
      : eventsAll.filter(
          (e) => e.event_date >= params.from && e.event_date <= params.to
        );

  const prompt = buildContentPlanPrompt(clips, events, reviews, params.from, params.to);
  const responseText = await callContentPlannerClaude(prompt);
  const taskInputs = parseContentPlanResponse(responseText);

  const created: ContentTask[] = [];
  for (const input of taskInputs) {
    const task = await createContentTask(input);
    created.push(task);
  }
  return created;
}

// ---------------------------------------------------------------------------
// Stubs for Airtable-backed actions that are being replaced in Task 8.
// These keep downstream components type-safe until Task 8 removes or rewrites
// the raw-clips page and the Airtable copies workflow.
// ---------------------------------------------------------------------------

export type RawClipBrowserRecord = {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  youtubeLink: string | null;
  pillar: string | null;
  season: string | null;
  usable: string | null;
  wardrobe: string | null;
  contextTags: string[];
  postedToTikTok: boolean;
  alternateSources: string[];
  contentInventoryCount: number;
};

export type MergeFieldChoices = {
  pillar?: string;
  season?: string;
  wardrobe?: string;
};

/** @deprecated Replaced by Neon in Task 8. */
export async function listAllRawClipRecordsAction(): Promise<RawClipBrowserRecord[]> {
  throw new Error("listAllRawClipRecordsAction: Airtable removed — stub for Task 8");
}

/** @deprecated Replaced by Neon in Task 8. */
export async function mergeRawClipRecordsAction(
  _survivorId: string,
  _loserId: string,
  _resolved: MergeFieldChoices
): Promise<{ survivorId: string; syncedClipIds: string[] }> {
  throw new Error("mergeRawClipRecordsAction: Airtable removed — stub for Task 8");
}

/** @deprecated Replaced by Neon in Task 8. */
export async function searchRawClipLibraryAction(
  _query: string
): Promise<{ id: string; name: string; youtubeLink: string | null }[]> {
  throw new Error("searchRawClipLibraryAction: Airtable removed — stub for Task 8");
}

/** @deprecated Replaced by Neon in Task 8. */
export async function linkClipToExistingRawClipAction(
  _clipId: string,
  _rawClipRecordId: string
): Promise<ClipLibraryRow | null> {
  throw new Error("linkClipToExistingRawClipAction: Airtable removed — stub for Task 8");
}

/** @deprecated Replaced by Neon in Task 8. */
export async function attachExistingCopyAction(
  _clipId: string,
  _copyRecordId: string
): Promise<ClipLibraryRow | null> {
  throw new Error("attachExistingCopyAction: Airtable removed — stub for Task 8");
}

/** @deprecated Replaced by Neon in Task 8. */
export async function createCopyAction(
  _clipId: string,
  _fields: { title: string; copyText: string; platform?: string }
): Promise<ClipLibraryRow | null> {
  throw new Error("createCopyAction: Airtable removed — stub for Task 8");
}

/** @deprecated Replaced by Neon in Task 8. */
export async function searchCopiesAction(
  _query: string
): Promise<{ id: string; title: string; copyText: string; platform: string | null }[]> {
  throw new Error("searchCopiesAction: Airtable removed — stub for Task 8");
}

// ---------------------------------------------------------------------------
// Phase 1.5: מסר יום actions
// ---------------------------------------------------------------------------

export async function listMassarYomClipsAction(): Promise<MassarYomClip[]> {
  await requireSession();
  return listMassarYomClips();
}

export async function createMassarYomAction(
  formData: FormData
): Promise<{ clipDetId: string; youtubeError: string | null }> {
  await requireSession();

  const videoFile = formData.get("videoFile");
  const videoUrlRaw = formData.get("videoUrl");
  const localPathRaw = formData.get("localPath");
  const scheduledDate = formData.get("scheduledDate");
  const niritCaption = formData.get("niritCaption");

  const driveUrl =
    typeof videoUrlRaw === "string" && videoUrlRaw.trim()
      ? videoUrlRaw.trim()
      : null;

  if (typeof scheduledDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) {
    throw new Error("תאריך פרסום לא תקין");
  }
  if (typeof niritCaption !== "string" || !niritCaption.trim()) {
    throw new Error("טקסט הפוסט חסר");
  }

  // Build buffer + filename from whichever video source was provided
  let buffer: Buffer;
  let originalFilename: string;

  if (videoFile instanceof File && videoFile.size > 0) {
    buffer = Buffer.from(await videoFile.arrayBuffer());
    originalFilename = videoFile.name;
  } else if (typeof localPathRaw === "string" && localPathRaw.trim()) {
    const localPath = localPathRaw.trim().replace(/^"(.*)"$/, "$1");
    const fsModule = (await import("fs")).default;
    buffer = Buffer.from(fsModule.readFileSync(localPath));
    originalFilename = path.basename(localPath);
  } else {
    throw new Error("יש לספק קובץ וידאו או נתיב קובץ מקומי");
  }

  const clipDetId = crypto.randomUUID();
  const displayTitle = originalFilename.replace(/\.[^.]+$/, "");

  // Transcribe + write tmp mp4
  const { transcribeAndSave } = await import("@/lib/transcribe");
  const { transcript, thumbnail, videoPath } = await transcribeAndSave(buffer, clipDetId);

  // YouTube upload + content generation in parallel
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

  if (contentResult.status === "rejected") throw contentResult.reason;
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
    const youtubeTask = clips.find((c) => c.id === clipDetId)?.tasks.find((t) => t.platform === "youtube");
    if (youtubeTask) await setTaskPosted(youtubeTask.id, videoUrl);
  } else {
    youtubeError = (youtubeResult.reason as Error)?.message ?? "שגיאה לא ידועה";
  }

  return { clipDetId, youtubeError };
}

export async function uploadToYouTubeAction(
  clipDetId: string
): Promise<{ videoUrl: string }> {
  await requireSession();

  const detail = await getClipDetails(clipDetId);
  if (!detail) throw new Error("קליפ לא נמצא");

  const clips = await listMassarYomClips();
  const clip = clips.find((c) => c.id === clipDetId);
  if (!clip) throw new Error("קליפ לא נמצא");

  const youtubeTask = clip.tasks.find((t) => t.platform === "youtube");
  if (!youtubeTask) throw new Error("משימת YouTube לא נמצאה לקליפ זה");

  // Title: original filename without extension; fall back to Claude-generated title
  const rawFilename = detail.original_filename ?? null;
  const titleFromFilename = rawFilename
    ? rawFilename.replace(/\.[^.]+$/, "")
    : null;
  const uploadTitle = titleFromFilename ?? detail.title ?? "מסר יום";

  const os = await import("os");
  const videoPath = path.join(os.default.tmpdir(), `${clipDetId}.mp4`);
  const fsCheck = (await import("fs")).default;
  if (!fsCheck.existsSync(videoPath)) {
    throw new Error("קובץ הווידאו המקומי כבר לא זמין. יש ליצור את הקליפ מחדש.");
  }
  const { uploadToYouTube } = await import("@/lib/youtube");
  const { videoId, videoUrl } = await uploadToYouTube({
    videoPath,
    title: uploadTitle,
    description: detail.org_whatsapp_text ?? youtubeTask.caption ?? "",
    hashtags: youtubeTask.hashtags ?? "",
  });

  await setTaskPosted(youtubeTask.id, videoUrl);
  await addYouTubeClipsCopy(clipDetId, videoUrl, uploadTitle);

  // Fetch YouTube's auto-generated thumbnail if the clip doesn't have one yet
  if (!detail.thumbnail) {
    try {
      const thumbRes = await fetch(
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
      );
      if (thumbRes.ok) {
        const buf = Buffer.from(await thumbRes.arrayBuffer());
        const dataUri = `data:image/jpeg;base64,${buf.toString("base64")}`;
        await updateClipThumbnail(clipDetId, dataUri);
      }
    } catch {
      // non-fatal — clip works without thumbnail
    }
  }

  return { videoUrl };
}

export async function markTaskPostedAction(
  taskId: string,
  liveUrl: string
): Promise<void> {
  await requireSession();
  await setTaskPosted(taskId, liveUrl);
}

export async function setChecklistFlagAction(
  clipDetId: string,
  flag: "google_drive_uploaded" | "website_added",
  value: boolean
): Promise<void> {
  await requireSession();
  await setMassarYomChecklistFlag(clipDetId, flag, value);
}

export async function updateClipThumbnailAction(
  clipDetId: string,
  thumbnailDataUri: string
): Promise<void> {
  await requireSession();
  await updateClipThumbnail(clipDetId, thumbnailDataUri);
}

export async function regenerateHookAction(
  clipDetId: string
): Promise<{ hook: string; tiktokHashtags: string; youtubeTitle: string }> {
  await requireSession();
  const detail = await getClipDetails(clipDetId);
  if (!detail) throw new Error("קליפ לא נמצא");
  const transcript = detail.transcript ?? "";
  const niritCaption = detail.org_whatsapp_text ?? "";
  const { hook, tiktokHashtags, youtubeTitle } = await generateMassarYomContent(
    transcript,
    niritCaption
  );
  await updateClipHooks(clipDetId, [hook]);
  return { hook, tiktokHashtags, youtubeTitle };
}
