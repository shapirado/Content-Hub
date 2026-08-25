// One-time migration: Airtable Tasks → Neon content_tasks
// Run with: node --env-file=.env.local scripts/migrate-airtable-tasks.mjs

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const BASE_ID = "appjb01XUH9eMP9MA";
const TABLE_ID = "tblLnTfroTGbR1caO";

// Airtable field IDs (from lib/airtable.ts FIELDS.tasks)
const F = {
  name:        "fldJPKQ9wnQZcxy1U",
  date:        "fldHMnNbHIZKUFmv1",
  channel:     "fldzR7bmpX1PtJwy8",
  status:      "fldfUMyCHtx5fF3du",
  fullContent: "fldpjcZxZTMf0W9vu",
  clipSourceId:"fldy6KXFQtcvaw2A9",
  hook:        "fldcxr6GzLdolMc9n",
  hashtags:    "fldlg4Y2FAtjUXRXs",
};

/** Map Airtable channel label → content_tasks platform value */
function mapPlatform(channel) {
  if (!channel) return "instagram";
  const c = channel.toLowerCase();
  if (c.includes("tiktok") || c.includes("טיקטוק")) return "tiktok";
  if (c.includes("newsletter") || c.includes("ניוזלטר") || c.includes("מייל")) return "newsletter";
  return "instagram";
}

/** Map Airtable status → content_tasks status */
function mapStatus(status) {
  if (!status) return "pending_review";
  const s = status.toLowerCase();
  if (s.includes("posted") || s.includes("sent") || s.includes("נשלח")) return "posted";
  if (s.includes("approved") || s.includes("מאושר")) return "approved";
  return "pending_review";
}

async function fetchAllTasks() {
  const records = [];
  let offset;
  do {
    const params = new URLSearchParams({ pageSize: "100" });
    if (offset) params.set("offset", offset);
    const res = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${TABLE_ID}?${params}`,
      { headers: { Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}` } }
    );
    if (!res.ok) throw new Error(`Airtable error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

async function main() {
  console.log("Fetching Airtable tasks...");
  const records = await fetchAllTasks();
  console.log(`Found ${records.length} tasks.`);

  let inserted = 0;
  let skipped = 0;
  let fkSkipped = 0;

  for (const r of records) {
    const f = r.fields;
    const scheduledDate = f[F.date] ?? null;
    if (!scheduledDate) { skipped++; continue; } // skip dateless tasks

    const platform = mapPlatform(f[F.channel]);
    const status = mapStatus(f[F.status]);
    const clipDetId = f[F.clipSourceId] ?? null;
    const hook = f[F.hook] ?? null;
    const caption = f[F.fullContent] ?? null;
    const hashtags = f[F.hashtags] ?? null;

    try {
      await sql`
        INSERT INTO content_tasks (clip_det_id, platform, scheduled_date, status, hook, caption, hashtags)
        VALUES (${clipDetId}, ${platform}, ${scheduledDate}, ${status}, ${hook}, ${caption}, ${hashtags})
        ON CONFLICT DO NOTHING
      `;
      inserted++;
    } catch (error) {
      // Check if this is a foreign key constraint violation (PostgreSQL error code 23503)
      if (error.code === "23503") {
        fkSkipped++;
      } else {
        throw error;
      }
    }
  }

  console.log(`Done. Inserted: ${inserted}, skipped (no date): ${skipped}, skipped (FK error): ${fkSkipped}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
