// One-off data backfill for the clip_details / clips / clip_performance
// redesign (see db/007-009 migrations). Safe to re-run: every insert uses
// `on conflict do nothing` / is idempotent.
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const envText = readFileSync(".env.local", "utf8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!m) continue;
  let value = m[2].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  process.env[m[1]] = value;
}

const sql = neon(process.env.DATABASE_URL);

console.log("1. Copying editorial fields from clip_library onto clip_details...");
await sql`
  update clip_details cd
  set
    title = cl.title,
    pillar = cl.pillar,
    season = cl.season,
    context_tags = cl.context_tags,
    usable = cl.usable,
    posted_to_tiktok = cl.posted_to_tiktok,
    wardrobe = cl.wardrobe
  from clip_library cl
  where cl.clip_id = cd.id
`;

console.log("2. Inserting 'upload' copies from original_filename...");
await sql`
  insert into clips (clip_det_id, source_type, path)
  select id, 'upload', original_filename
  from clip_details
  where original_filename is not null
  on conflict (clip_det_id, path) do nothing
`;

console.log("3. Inserting 'url' copies from source_url...");
await sql`
  insert into clips (clip_det_id, source_type, path)
  select id, 'url', source_url
  from clip_details
  where source_url is not null
  on conflict (clip_det_id, path) do nothing
`;

console.log("4. Inserting 'url' copies from clip_library.youtube_link...");
await sql`
  insert into clips (clip_det_id, source_type, path)
  select cl.clip_id, 'url', cl.youtube_link
  from clip_library cl
  where cl.youtube_link is not null
  on conflict (clip_det_id, path) do nothing
`;

console.log("5. Parsing alternate_sources free-text lines into clips rows...");
const altRows = await sql`
  select clip_id, alternate_sources
  from clip_library
  where array_length(alternate_sources, 1) > 0
`;
const urlPattern = /https?:\/\/\S+/i;
let altInserted = 0;
for (const row of altRows) {
  for (const entry of row.alternate_sources) {
    const [namePart, linkPart] = entry.split(" — ");
    const candidate = (linkPart ?? namePart ?? "").trim();
    if (!candidate) continue;
    const isUrl = urlPattern.test(candidate);
    const path = isUrl ? candidate.match(urlPattern)[0] : entry.trim();
    const result = await sql`
      insert into clips (clip_det_id, source_type, path)
      values (${row.clip_id}, ${isUrl ? "url" : "upload"}, ${path})
      on conflict (clip_det_id, path) do nothing
      returning id
    `;
    if (result.length > 0) altInserted++;
  }
}
console.log(`   inserted ${altInserted} rows from alternate_sources (best-effort parse — review recommended).`);

console.log("6. Seeding clip_performance from clip_library (one row per clip, no per-platform breakdown available)...");
await sql`
  insert into clip_performance (clip_det_id, platform, views, likes, shares, comments, status, hook_key_line, hashtags, live_post_url, date_posted)
  select clip_id, null, views, likes, shares, comments, status, hook_key_line, hashtags, live_post_url, null
  from clip_library cl
  where (views is not null or likes is not null or shares is not null or comments is not null
      or status is not null or hook_key_line is not null or hashtags is not null or live_post_url is not null)
    and not exists (select 1 from clip_performance cp where cp.clip_det_id = cl.clip_id)
`;

console.log("\n--- Validation ---");
const [{ count: clipDetailsCount }] = await sql`select count(*)::int as count from clip_details`;
console.log("clip_details rows:", clipDetailsCount);

const orphans = await sql`
  select cd.id from clip_details cd
  where not exists (select 1 from clips c where c.clip_det_id = cd.id)
`;
console.log("clip_details with zero clips rows (should be ~0):", orphans.length);
if (orphans.length > 0) {
  console.log("  orphan ids:", orphans.map((r) => r.id).join(", "));
}

const [{ count: clipLibraryMetricsCount }] = await sql`
  select count(*)::int as count from clip_library
  where views is not null or likes is not null or shares is not null or comments is not null
`;
const [{ count: clipPerformanceCount }] = await sql`select count(*)::int as count from clip_performance`;
console.log("clip_library rows with metrics:", clipLibraryMetricsCount, "| clip_performance rows:", clipPerformanceCount);

console.log("\nBackfill complete.");
