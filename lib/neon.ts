import { neon } from "@neondatabase/serverless";

function sql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }
  return neon(process.env.DATABASE_URL);
}

/** One row per logical clip — AI analysis + editorial metadata. A clip_details row can have N physical `ClipCopy` rows (Drive file, YouTube upload, ...). */
export type ClipDetails = {
  id: string;
  duration_seconds: number | null;
  language: string | null;
  transcript: string;
  summary: string | null;
  hooks: string[];
  warning: string | null;
  created_at: string;
  thumbnail: string | null;
  /** AI-generated "{category}-{value}" tag (e.g. חגים-פסח) — a suggestion for the editable context tags, not itself editable. */
  tag: string | null;
  title: string | null;
  pillar: string | null;
  season: string | null;
  context_tags: string[];
  usable: string | null;
  posted_to_tiktok: boolean | null;
  wardrobe: string | null;
};

/** One physical copy of a clip_details row (a Drive file or a YouTube upload). `platform` (e.g. "instagram") records where that specific copy was posted, when known. */
export type ClipCopy = {
  id: string;
  clip_det_id: string;
  source_type: "upload" | "url";
  path: string;
  platform: string | null;
  created_at: string;
};

/** One platform-posting of a clip_details row (views/likes/etc. for a single post, not summed across posts). */
export type ClipPerformance = {
  id: string;
  clip_det_id: string;
  platform: string | null;
  views: number | null;
  likes: number | null;
  shares: number | null;
  comments: number | null;
  status: string | null;
  hook_key_line: string | null;
  hashtags: string | null;
  live_post_url: string | null;
  date_posted: string | null;
  created_at: string;
  updated_at: string;
};

export type ClipLibraryRow = {
  clip_id: string;
  airtable_raw_clip_id: string | null;
  airtable_content_inventory_ids: string[];
  title: string | null;
  youtube_link: string | null;
  pillar: string | null;
  season: string | null;
  context_tags: string[];
  usable: string | null;
  posted_to_tiktok: boolean | null;
  wardrobe: string | null;
  alternate_sources: string[];
  status: string | null;
  platforms: string[];
  hook_key_line: string | null;
  hashtags: string | null;
  live_post_url: string | null;
  views: number | null;
  likes: number | null;
  shares: number | null;
  comments: number | null;
  copies: { title: string; copyText: string; platform: string | null }[];
  updated_at: string;
};

export async function getClipLibraryRow(
  clipId: string
): Promise<ClipLibraryRow | null> {
  const client = sql();
  const rows = (await client`
    select * from clip_library where clip_id = ${clipId}
  `) as unknown as ClipLibraryRow[];
  return rows[0] ?? null;
}

export async function listClipLibraryRows(): Promise<
  Record<string, ClipLibraryRow>
> {
  const client = sql();
  const rows = (await client`select * from clip_library`) as unknown as ClipLibraryRow[];
  return Object.fromEntries(rows.map((r) => [r.clip_id, r]));
}

/** All Neon clip_ids currently linked to a given Raw Clip Library record. */
export async function listClipIdsForRawClipId(rawClipId: string): Promise<string[]> {
  const client = sql();
  const rows = (await client`
    select clip_id from clip_library where airtable_raw_clip_id = ${rawClipId}
  `) as unknown as { clip_id: string }[];
  return rows.map((r) => r.clip_id);
}

/** Distinct context tags currently in use, for the tag filter dropdown. */
export async function listDistinctContextTags(): Promise<string[]> {
  const client = sql();
  const rows = (await client`
    select distinct unnest(context_tags) as tag from clip_details order by tag
  `) as unknown as { tag: string }[];
  return rows.map((r) => r.tag);
}

export type ClipDetailsListItem = Pick<
  ClipDetails,
  | "id"
  | "duration_seconds"
  | "language"
  | "summary"
  | "warning"
  | "created_at"
  | "thumbnail"
  | "title"
  | "pillar"
  | "season"
  | "context_tags"
  | "usable"
  | "posted_to_tiktok"
  | "wardrobe"
> & { representativePath: string | null; platforms: string[]; paths: string[] };

/** List logical clips for the asset table/filters, each with one representative physical path and the distinct set of platforms it was posted to (from both copies and clip_performance postings — excludes transcript/hooks, only needed on expand). */
export async function listClipDetails(): Promise<ClipDetailsListItem[]> {
  const client = sql();
  const rows = (await client`
    select cd.id, cd.duration_seconds, cd.language, cd.summary, cd.warning, cd.created_at,
           cd.thumbnail, cd.title, cd.pillar, cd.season, cd.context_tags, cd.usable,
           cd.posted_to_tiktok, cd.wardrobe,
           (select c.path from clips c where c.clip_det_id = cd.id order by c.created_at limit 1) as "representativePath",
           coalesce(
             (select array_agg(c.path) from clips c where c.clip_det_id = cd.id),
             '{}'
           ) as "paths",
           coalesce(
             (
               select array_agg(distinct platform) from (
                 select platform from clips where clip_det_id = cd.id and platform is not null
                 union
                 select platform from clip_performance where clip_det_id = cd.id and platform is not null
               ) p
             ),
             '{}'
           ) as "platforms"
    from clip_details cd
    order by cd.created_at desc
  `) as unknown as ClipDetailsListItem[];
  return rows;
}

/** Full logical-clip detail, including transcript/hooks — fetch only for the selected clip. */
export async function getClipDetails(id: string): Promise<ClipDetails | null> {
  const client = sql();
  const rows = (await client`
    select id, duration_seconds, language, transcript, summary, hooks, warning, created_at,
           thumbnail, tag, title, pillar, season, context_tags, usable, posted_to_tiktok, wardrobe
    from clip_details
    where id = ${id}
  `) as unknown as ClipDetails[];
  return rows[0] ?? null;
}

/** All physical copies (Drive file / YouTube upload / ...) of a logical clip. */
export async function listClipCopies(clipDetId: string): Promise<ClipCopy[]> {
  const client = sql();
  const rows = (await client`
    select id, clip_det_id, source_type, path, platform, created_at
    from clips
    where clip_det_id = ${clipDetId}
    order by created_at
  `) as unknown as ClipCopy[];
  return rows;
}

export async function addClipCopy(
  clipDetId: string,
  sourceType: "upload" | "url",
  path: string,
  platform?: string | null
): Promise<ClipCopy> {
  const client = sql();
  const rows = (await client`
    insert into clips (clip_det_id, source_type, path, platform)
    values (${clipDetId}, ${sourceType}, ${path}, ${platform ?? null})
    on conflict (clip_det_id, path) do update set source_type = excluded.source_type, platform = excluded.platform
    returning id, clip_det_id, source_type, path, platform, created_at
  `) as unknown as ClipCopy[];
  return rows[0];
}

/** Sets the platform a physical copy was posted to (e.g. "instagram") — lets the collapsed list show real per-platform posting status instead of the old Airtable-synced clip_library.platforms array. */
export async function updateClipCopyPlatform(copyId: string, platform: string | null): Promise<ClipCopy> {
  const client = sql();
  const rows = (await client`
    update clips set platform = ${platform} where id = ${copyId}
    returning id, clip_det_id, source_type, path, platform, created_at
  `) as unknown as ClipCopy[];
  return rows[0];
}

export async function removeClipCopy(copyId: string): Promise<void> {
  const client = sql();
  await client`delete from clips where id = ${copyId}`;
}

/** All platform-postings recorded for a logical clip. */
export async function listClipPerformance(clipDetId: string): Promise<ClipPerformance[]> {
  const client = sql();
  const rows = (await client`
    select id, clip_det_id, platform, views, likes, shares, comments, status,
           hook_key_line, hashtags, live_post_url, date_posted, created_at, updated_at
    from clip_performance
    where clip_det_id = ${clipDetId}
    order by date_posted desc nulls last, created_at desc
  `) as unknown as ClipPerformance[];
  return rows;
}

export type ClipPerformanceUpsert = Omit<ClipPerformance, "id" | "created_at" | "updated_at"> & {
  id?: string;
};

export async function upsertClipPerformance(row: ClipPerformanceUpsert): Promise<ClipPerformance> {
  const client = sql();
  if (row.id) {
    const rows = (await client`
      update clip_performance set
        platform = ${row.platform}, views = ${row.views}, likes = ${row.likes},
        shares = ${row.shares}, comments = ${row.comments}, status = ${row.status},
        hook_key_line = ${row.hook_key_line}, hashtags = ${row.hashtags},
        live_post_url = ${row.live_post_url}, date_posted = ${row.date_posted}, updated_at = now()
      where id = ${row.id}
      returning id, clip_det_id, platform, views, likes, shares, comments, status,
                hook_key_line, hashtags, live_post_url, date_posted, created_at, updated_at
    `) as unknown as ClipPerformance[];
    return rows[0];
  }
  const rows = (await client`
    insert into clip_performance (
      clip_det_id, platform, views, likes, shares, comments, status,
      hook_key_line, hashtags, live_post_url, date_posted
    ) values (
      ${row.clip_det_id}, ${row.platform}, ${row.views}, ${row.likes}, ${row.shares}, ${row.comments},
      ${row.status}, ${row.hook_key_line}, ${row.hashtags}, ${row.live_post_url}, ${row.date_posted}
    )
    returning id, clip_det_id, platform, views, likes, shares, comments, status,
              hook_key_line, hashtags, live_post_url, date_posted, created_at, updated_at
  `) as unknown as ClipPerformance[];
  return rows[0];
}

export async function deleteClipPerformance(id: string): Promise<void> {
  const client = sql();
  await client`delete from clip_performance where id = ${id}`;
}

export type ClipDetailsMetadataUpdate = Partial<
  Pick<ClipDetails, "title" | "pillar" | "season" | "usable" | "context_tags" | "wardrobe" | "posted_to_tiktok">
>;

/** Direct Neon write for editorial metadata — no Airtable round-trip. */
export async function updateClipDetailsMetadata(
  id: string,
  fields: ClipDetailsMetadataUpdate
): Promise<ClipDetails | null> {
  const client = sql();
  const current = await getClipDetails(id);
  if (!current) return null;
  const merged = { ...current, ...fields };
  const rows = (await client`
    update clip_details set
      title = ${merged.title}, pillar = ${merged.pillar}, season = ${merged.season},
      usable = ${merged.usable}, context_tags = ${merged.context_tags},
      wardrobe = ${merged.wardrobe}, posted_to_tiktok = ${merged.posted_to_tiktok}
    where id = ${id}
    returning id, duration_seconds, language, transcript, summary, hooks, warning, created_at,
              thumbnail, tag, title, pillar, season, context_tags, usable, posted_to_tiktok, wardrobe
  `) as unknown as ClipDetails[];
  return rows[0] ?? null;
}

/** Sets clip_details.title directly — used to cache a fetched YouTube video title so it isn't re-fetched on every page load. */
export async function updateClipTitle(id: string, title: string): Promise<void> {
  const client = sql();
  await client`update clip_details set title = ${title} where id = ${id}`;
}

/** Deletes a logical clip. clip_library has no cascade FK to clip_details, so it's deleted explicitly first; clips/clip_performance cascade automatically. */
export async function deleteClipDetails(id: string): Promise<void> {
  const client = sql();
  await client`delete from clip_library where clip_id = ${id}`;
  await client`delete from clip_details where id = ${id}`;
}

/** Merges a duplicate logical clip into a survivor: repoints its copies/performance rows, then deletes it. */
export async function mergeClipDetails(
  loserId: string,
  survivorId: string
): Promise<{ repointedClipIds: string[] }> {
  const client = sql();
  // Drop any loser copies that duplicate a path the survivor already has — repointing those
  // would collide with the (clip_det_id, path) unique index since they'd become identical rows.
  await client`
    delete from clips
    where clip_det_id = ${loserId}
      and path in (select path from clips where clip_det_id = ${survivorId})
  `;
  const copyRows = (await client`
    update clips set clip_det_id = ${survivorId} where clip_det_id = ${loserId} returning id
  `) as unknown as { id: string }[];
  await client`
    update clip_performance set clip_det_id = ${survivorId} where clip_det_id = ${loserId}
  `;
  await client`delete from clip_details where id = ${loserId}`;
  return { repointedClipIds: copyRows.map((r) => r.id) };
}

export type ClipLibraryUpsert = Omit<ClipLibraryRow, "updated_at">;

/** Upsert the merged Airtable + clip view for the marketing agent's read path. */
export async function upsertClipLibraryRow(row: ClipLibraryUpsert): Promise<void> {
  const client = sql();
  await client`
    insert into clip_library (
      clip_id, airtable_raw_clip_id, airtable_content_inventory_ids, title, youtube_link,
      pillar, season, context_tags, usable, posted_to_tiktok, wardrobe, alternate_sources,
      status, platforms, hook_key_line, hashtags,
      live_post_url, views, likes, shares, comments, copies, updated_at
    ) values (
      ${row.clip_id}, ${row.airtable_raw_clip_id}, ${row.airtable_content_inventory_ids},
      ${row.title}, ${row.youtube_link},
      ${row.pillar}, ${row.season}, ${row.context_tags}, ${row.usable},
      ${row.posted_to_tiktok}, ${row.wardrobe}, ${row.alternate_sources}, ${row.status}, ${row.platforms},
      ${row.hook_key_line}, ${row.hashtags}, ${row.live_post_url},
      ${row.views}, ${row.likes}, ${row.shares}, ${row.comments},
      ${JSON.stringify(row.copies)}::jsonb, now()
    )
    on conflict (clip_id) do update set
      airtable_raw_clip_id = excluded.airtable_raw_clip_id,
      airtable_content_inventory_ids = excluded.airtable_content_inventory_ids,
      title = excluded.title,
      youtube_link = excluded.youtube_link,
      pillar = excluded.pillar,
      season = excluded.season,
      context_tags = excluded.context_tags,
      usable = excluded.usable,
      posted_to_tiktok = excluded.posted_to_tiktok,
      wardrobe = excluded.wardrobe,
      alternate_sources = excluded.alternate_sources,
      status = excluded.status,
      platforms = excluded.platforms,
      hook_key_line = excluded.hook_key_line,
      hashtags = excluded.hashtags,
      live_post_url = excluded.live_post_url,
      views = excluded.views,
      likes = excluded.likes,
      shares = excluded.shares,
      comments = excluded.comments,
      copies = excluded.copies,
      updated_at = now()
  `;
}

/** Re-points every clip_library row that references the losing Raw Clip Library record onto the survivor — used when merging duplicate Airtable records. Returns the affected clip_ids so their cached fields can be re-synced. */
export async function repointRawClipId(
  loserRawClipId: string,
  survivorRawClipId: string
): Promise<string[]> {
  const client = sql();
  const rows = (await client`
    update clip_library set airtable_raw_clip_id = ${survivorRawClipId}, updated_at = now()
    where airtable_raw_clip_id = ${loserRawClipId}
    returning clip_id
  `) as unknown as { clip_id: string }[];
  return rows.map((r) => r.clip_id);
}
