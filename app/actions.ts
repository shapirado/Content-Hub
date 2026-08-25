"use server";

import { auth } from "@/auth";
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
  type ClipLibraryRow,
  type ClipPerformanceUpsert,
  type ClipExportRow,
  type ContentTask,
} from "@/lib/neon";
import { resolveCopyLink } from "@/lib/paths";

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
  platform?: string | null
) {
  await requireSession();
  return addClipCopy(clipDetId, sourceType, path, platform);
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
  platform: "tiktok" | "instagram" | "newsletter";
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
