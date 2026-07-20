"use server";

import { auth } from "@/auth";
import {
  getClipDetails,
  getClipLibraryRow,
  listClipIdsForRawClipId,
  repointRawClipId,
  upsertClipLibraryRow,
  listClipCopies,
  addClipCopy,
  removeClipCopy,
  updateClipCopyPlatform,
  listClipPerformance,
  upsertClipPerformance,
  deleteClipPerformance,
  updateClipDetailsMetadata,
  mergeClipDetails,
  deleteClipDetails,
  type ClipLibraryUpsert,
  type ClipPerformanceUpsert,
} from "@/lib/neon";
import {
  FIELDS,
  createCopyRecord,
  createRawClipLibraryRecord,
  deleteRawClipLibraryRecord,
  getContentInventoryRecords,
  getCopiesRecords,
  getRawClipLibraryRecord,
  linkCopyToRawClip,
  listAllRawClipLibraryRecords,
  searchCopies,
  searchRawClipLibrary,
  updateRawClipLibraryRecord,
} from "@/lib/airtable";

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

export async function removeClipCopyAction(copyId: string) {
  await requireSession();
  return removeClipCopy(copyId);
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

export async function searchRawClipLibraryAction(query: string) {
  await requireSession();
  if (!query.trim()) return [];
  const records = await searchRawClipLibrary(query);
  return records.map((r) => ({
    id: r.id,
    name: r.fields[FIELDS.rawClipLibrary.name],
    youtubeLink: r.fields[FIELDS.rawClipLibrary.youtubeLink] ?? null,
  }));
}

/** Newest-line-first entries from the Alternate Sources multilineText field. */
function parseAlternateSources(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

const STATUS_PRIORITY = ["Posted", "Reviewed", "Drafted"] as const;

/** Picks the most-advanced status among a set of Content Inventory statuses. */
function bestStatus(statuses: (string | undefined)[]): string | null {
  for (const candidate of STATUS_PRIORITY) {
    if (statuses.includes(candidate)) return candidate;
  }
  return statuses.find((s): s is string => !!s) ?? null;
}

function sumOrNull(values: (number | undefined)[]): number | null {
  const present = values.filter((v): v is number => v !== undefined);
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0);
}

/** Builds the merged clip_library row from a Raw Clip Library record (following its Airtable links) and upserts it. Aggregates across *all* linked Content Inventory records — a clip may have been posted multiple times (different platforms, or merged from a duplicate). */
async function syncClipLibraryFromRawClip(clipId: string, rawClipRecordId: string) {
  const rawClip = await getRawClipLibraryRecord(rawClipRecordId);
  const contentInventoryIds = rawClip.fields[FIELDS.rawClipLibrary.contentInventoryLink] ?? [];
  const copiesIds = rawClip.fields[FIELDS.rawClipLibrary.copiesLink] ?? [];

  const [contentInventory, copiesRecords] = await Promise.all([
    getContentInventoryRecords(contentInventoryIds),
    getCopiesRecords(copiesIds),
  ]);

  const platforms = [
    ...new Set(contentInventory.flatMap((c) => c.fields[FIELDS.contentInventory.platforms] ?? [])),
  ];
  const firstNonEmpty = <T,>(values: (T | undefined)[]): T | null =>
    values.find((v): v is T => v !== undefined && v !== "") ?? null;

  const row: ClipLibraryUpsert = {
    clip_id: clipId,
    airtable_raw_clip_id: rawClip.id,
    airtable_content_inventory_ids: contentInventory.map((c) => c.id),
    title: rawClip.fields[FIELDS.rawClipLibrary.name] ?? null,
    youtube_link: rawClip.fields[FIELDS.rawClipLibrary.youtubeLink] ?? null,
    pillar: rawClip.fields[FIELDS.rawClipLibrary.pillar] ?? null,
    season: rawClip.fields[FIELDS.rawClipLibrary.season] ?? null,
    context_tags: rawClip.fields[FIELDS.rawClipLibrary.contextTags] ?? [],
    usable: rawClip.fields[FIELDS.rawClipLibrary.usable] ?? null,
    posted_to_tiktok: rawClip.fields[FIELDS.rawClipLibrary.postedToTikTok] ?? null,
    wardrobe: rawClip.fields[FIELDS.rawClipLibrary.wardrobe] ?? null,
    alternate_sources: parseAlternateSources(rawClip.fields[FIELDS.rawClipLibrary.alternateSources]),
    // Content Inventory's status (Drafted/Reviewed/Posted), not Raw Clip Library's —
    // that field just duplicated "usable" and has been dropped from the UI.
    status: bestStatus(contentInventory.map((c) => c.fields[FIELDS.contentInventory.status])),
    platforms,
    hook_key_line: firstNonEmpty(contentInventory.map((c) => c.fields[FIELDS.contentInventory.hookKeyLine])),
    hashtags: firstNonEmpty(contentInventory.map((c) => c.fields[FIELDS.contentInventory.hashtagsUsed])),
    live_post_url: firstNonEmpty(contentInventory.map((c) => c.fields[FIELDS.contentInventory.livePostUrl])),
    views: sumOrNull(contentInventory.map((c) => c.fields[FIELDS.contentInventory.views])),
    likes: sumOrNull(contentInventory.map((c) => c.fields[FIELDS.contentInventory.likes])),
    shares: sumOrNull(contentInventory.map((c) => c.fields[FIELDS.contentInventory.shares])),
    comments: sumOrNull(contentInventory.map((c) => c.fields[FIELDS.contentInventory.comments])),
    copies: copiesRecords.map((c) => ({
      title: c.fields[FIELDS.copies.title],
      copyText: c.fields[FIELDS.copies.copyText] ?? "",
      platform: c.fields[FIELDS.copies.platform] ?? null,
    })),
  };

  await upsertClipLibraryRow(row);
  return getClipLibraryRow(clipId);
}

/**
 * Every clip is manageable (pillar/season/tags/usable/copies) whether or not it's linked to
 * Airtable yet. This resolves the linked Raw Clip Library record, silently creating a minimal
 * one (Name + YouTube Link from the Neon clip) the first time any field is edited.
 */
async function getOrCreateRawClipRecord(clipId: string): Promise<string> {
  const existing = await getClipLibraryRow(clipId);
  if (existing?.airtable_raw_clip_id) return existing.airtable_raw_clip_id;

  const details = await getClipDetails(clipId);
  if (!details) throw new Error("Clip not found");
  const copies = await listClipCopies(clipId);
  const urlCopy = copies.find((c) => c.source_type === "url");

  const created = await createRawClipLibraryRecord({
    [FIELDS.rawClipLibrary.name]: details.title ?? copies[0]?.path ?? "Untitled clip",
    [FIELDS.rawClipLibrary.youtubeLink]: urlCopy?.path ?? undefined,
  });
  return created.id;
}

/** Attaches an existing Raw Clip Library record to a Neon clip — the secondary "link to existing" flow, for avoiding duplicates when Airtable already has a matching record. */
export async function linkClipToExistingRawClipAction(clipId: string, rawClipRecordId: string) {
  await requireSession();
  return syncClipLibraryFromRawClip(clipId, rawClipRecordId);
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

export async function searchCopiesAction(query: string) {
  await requireSession();
  if (!query.trim()) return [];
  const records = await searchCopies(query);
  return records.map((r) => ({
    id: r.id,
    title: r.fields[FIELDS.copies.title],
    copyText: r.fields[FIELDS.copies.copyText] ?? "",
    platform: r.fields[FIELDS.copies.platform] ?? null,
  }));
}

export async function attachExistingCopyAction(clipId: string, copyRecordId: string) {
  await requireSession();
  const rawClipRecordId = await getOrCreateRawClipRecord(clipId);
  await linkCopyToRawClip(copyRecordId, rawClipRecordId);
  return syncClipLibraryFromRawClip(clipId, rawClipRecordId);
}

export async function createCopyAction(
  clipId: string,
  fields: { title: string; copyText: string; platform?: string }
) {
  await requireSession();
  const rawClipRecordId = await getOrCreateRawClipRecord(clipId);
  await createCopyRecord(rawClipRecordId, fields);
  return syncClipLibraryFromRawClip(clipId, rawClipRecordId);
}

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

/** All Raw Clip Library records, independent of any Neon clip — powers the duplicate browser. */
export async function listAllRawClipRecordsAction(): Promise<RawClipBrowserRecord[]> {
  await requireSession();
  const records = await listAllRawClipLibraryRecords();
  return records.map((r) => ({
    id: r.id,
    name: r.fields[FIELDS.rawClipLibrary.name],
    thumbnailUrl:
      r.fields[FIELDS.rawClipLibrary.thumbnail]?.[0]?.thumbnails?.small?.url ??
      r.fields[FIELDS.rawClipLibrary.thumbnail]?.[0]?.url ??
      null,
    youtubeLink: r.fields[FIELDS.rawClipLibrary.youtubeLink] ?? null,
    pillar: r.fields[FIELDS.rawClipLibrary.pillar] ?? null,
    season: r.fields[FIELDS.rawClipLibrary.season] ?? null,
    usable: r.fields[FIELDS.rawClipLibrary.usable] ?? null,
    wardrobe: r.fields[FIELDS.rawClipLibrary.wardrobe] ?? null,
    contextTags: r.fields[FIELDS.rawClipLibrary.contextTags] ?? [],
    postedToTikTok: !!r.fields[FIELDS.rawClipLibrary.postedToTikTok],
    alternateSources: parseAlternateSources(r.fields[FIELDS.rawClipLibrary.alternateSources]),
    contentInventoryCount: (r.fields[FIELDS.rawClipLibrary.contentInventoryLink] ?? []).length,
  }));
}

export type MergeFieldChoices = {
  pillar?: string;
  season?: string;
  wardrobe?: string;
};

/**
 * Merges two Raw Clip Library records that describe the same real clip. `survivorId` keeps its
 * Name/record; usable and Alternate Sources auto-resolve (non-blank wins / accumulates), pillar/
 * season/wardrobe take whatever the caller resolved (a human radio-pick in the UI), context tags
 * union, TikTok-posted ORs, and every linked Content Inventory record carries over onto the
 * survivor so no post/performance history is lost. Any clip_library row pointing at the loser is
 * re-pointed and re-synced, then the loser is permanently deleted from Airtable.
 */
export async function mergeRawClipRecordsAction(
  survivorId: string,
  loserId: string,
  resolved: MergeFieldChoices
) {
  await requireSession();
  const [survivor, loser] = await Promise.all([
    getRawClipLibraryRecord(survivorId),
    getRawClipLibraryRecord(loserId),
  ]);

  const usable =
    survivor.fields[FIELDS.rawClipLibrary.usable] || loser.fields[FIELDS.rawClipLibrary.usable];
  const contextTags = [
    ...new Set([
      ...(survivor.fields[FIELDS.rawClipLibrary.contextTags] ?? []),
      ...(loser.fields[FIELDS.rawClipLibrary.contextTags] ?? []),
    ]),
  ];
  const postedToTikTok =
    !!survivor.fields[FIELDS.rawClipLibrary.postedToTikTok] ||
    !!loser.fields[FIELDS.rawClipLibrary.postedToTikTok];
  const contentInventoryLink = [
    ...new Set([
      ...(survivor.fields[FIELDS.rawClipLibrary.contentInventoryLink] ?? []),
      ...(loser.fields[FIELDS.rawClipLibrary.contentInventoryLink] ?? []),
    ]),
  ];

  const loserYoutubeLink = loser.fields[FIELDS.rawClipLibrary.youtubeLink];
  const loserEntry = loserYoutubeLink
    ? `${loser.fields[FIELDS.rawClipLibrary.name]} — ${loserYoutubeLink}`
    : loser.fields[FIELDS.rawClipLibrary.name];
  const alternateSources = [
    ...new Set([
      ...parseAlternateSources(survivor.fields[FIELDS.rawClipLibrary.alternateSources]),
      ...parseAlternateSources(loser.fields[FIELDS.rawClipLibrary.alternateSources]),
      loserEntry,
    ]),
  ];

  await updateRawClipLibraryRecord(survivorId, {
    [FIELDS.rawClipLibrary.pillar]: resolved.pillar ?? survivor.fields[FIELDS.rawClipLibrary.pillar],
    [FIELDS.rawClipLibrary.season]: resolved.season ?? survivor.fields[FIELDS.rawClipLibrary.season],
    [FIELDS.rawClipLibrary.wardrobe]:
      resolved.wardrobe ?? survivor.fields[FIELDS.rawClipLibrary.wardrobe],
    [FIELDS.rawClipLibrary.usable]: usable,
    [FIELDS.rawClipLibrary.contextTags]: contextTags,
    [FIELDS.rawClipLibrary.postedToTikTok]: postedToTikTok,
    [FIELDS.rawClipLibrary.alternateSources]: alternateSources.join("\n"),
    [FIELDS.rawClipLibrary.contentInventoryLink]: contentInventoryLink,
  });

  const repointedClipIds = await repointRawClipId(loserId, survivorId);
  await deleteRawClipLibraryRecord(loserId);

  // Re-sync every Neon clip now pointing at the survivor — both the ones re-pointed just now
  // and any that were already linked to it, since its fields may have just changed.
  const alreadyLinkedClipIds = await listClipIdsForRawClipId(survivorId);
  const clipIdsToSync = [...new Set([...repointedClipIds, ...alreadyLinkedClipIds])];
  await Promise.all(clipIdsToSync.map((clipId) => syncClipLibraryFromRawClip(clipId, survivorId)));

  return { survivorId, syncedClipIds: clipIdsToSync };
}
