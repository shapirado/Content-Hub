# Marketing Agency: Foundation (Phase 0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Airtable as a runtime dependency and migrate all scheduling data to Neon, adding four new tables and rebuilding the Planner to work without any Airtable calls.

**Architecture:** All task/scheduling data moves to a new `content_tasks` Neon table. Three companion tables are added: `events` (upcoming workshops/retreats as calendar anchors), `whatsapp_reviews` (testimonial source), and `task_performance_snapshots` (time-series analytics per post). The Planner page is rebuilt to query Neon directly. `lib/airtable.ts` is deleted. The existing `clip_details`, `clips`, and `clip_performance` tables are unchanged.

**Tech Stack:** Next.js 16 App Router, TypeScript 5 strict, Neon serverless PostgreSQL (`@neondatabase/serverless`), Tailwind CSS v4, Hebrew RTL UI.

**Spec:** `C:\Users\User\.claude\plans\g-my-drive-brand-brief-nirit-shapira-md-cozy-lagoon.md`

## Global Constraints

- **AGENTS.md:** Read `node_modules/next/dist/docs/` before writing any Next.js code — this version has breaking API changes from training data.
- **Hebrew UI only.** All visible text is Hebrew RTL.
- **Button labels use שם פעולה (verbal noun), never ציווי זכר:** e.g. `שמירה` not `שמור`, `עדכון` not `עדכן`.
- **App self-references use גוף ראשון נקבה:** e.g. `שומרת...` `טוענת...` `מעדכנת...`
- **SQL is applied manually by the user** — write the SQL file; do not auto-run migrations.
- **No test framework exists** — verify by running the dev server and checking the UI.
- **All DB queries use the `sql()` factory from `lib/neon.ts`** — never import `neon` directly in other files.
- `DATABASE_URL` and `AIRTABLE_API_KEY` are in `.env.local` — never hardcode credentials.
- **platform values in `content_tasks`:** `'tiktok'` | `'instagram'` | `'newsletter'` (lowercase, no spaces).
- **status values in `content_tasks`:** `'ai_draft'` | `'pending_review'` | `'approved'` | `'posted'` (lowercase, underscores).

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `db/005_events_content_tasks_reviews.sql` | All new table DDL |
| Create | `scripts/migrate-airtable-tasks.mjs` | One-time Airtable Tasks → content_tasks |
| Create | `scripts/import-whatsapp-reviews.mjs` | WhatsApp text export → whatsapp_reviews |
| Modify | `lib/neon.ts` | Add types + queries for all 4 new tables; keep existing functions |
| Modify | `app/actions.ts` | Replace Airtable imports/actions with Neon; delete Airtable-only actions |
| Modify | `app/planner/page.tsx` | No structural change — already calls `listTasksAction` |
| Modify | `components/PlannerCalendar.tsx` | Remove `OPTIONS` import from airtable; update status values |
| Modify | `components/Sidebar.tsx` | Add Plan/Create/Review links; remove Raw Clips; expand `active` type |
| Delete | `lib/airtable.ts` | Remove after all imports removed |
| Stub | `app/raw-clips/page.tsx` | Replace with "coming soon" placeholder |

---

## Task 1: SQL Migration File

**Files:**
- Create: `db/005_events_content_tasks_reviews.sql`

**Interfaces:**
- Produces: 4 new tables ready to query from Neon

- [ ] **Step 1: Write the migration SQL**

Create `db/005_events_content_tasks_reviews.sql` with exactly this content:

```sql
-- Events: upcoming workshops, retreats, and conventions as calendar anchors
CREATE TABLE IF NOT EXISTS events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  product_type      text NOT NULL,
  -- 'פשוט לאהוב' | 'weekend_retreat' | 'life_alignment_course' | 'large_event'
  event_date        date NOT NULL,
  registration_link text,
  target_headcount  integer,
  price_early_bird  integer,
  price_regular     integer,
  location          text,
  notes             text,
  created_at        timestamptz DEFAULT now()
);

-- Content tasks: one row per scheduled content piece (replaces Airtable Tasks table)
CREATE TABLE IF NOT EXISTS content_tasks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_det_id    uuid REFERENCES clip_details(id) ON DELETE SET NULL,
  event_id       uuid REFERENCES events(id) ON DELETE SET NULL,
  platform       text NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'newsletter')),
  scheduled_date date NOT NULL,
  status         text NOT NULL DEFAULT 'ai_draft'
                   CHECK (status IN ('ai_draft', 'pending_review', 'approved', 'posted')),
  hook           text,
  caption        text,
  hashtags       text,
  canva_url      text,
  live_url       text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

-- Testimonials parsed from Nirit's WhatsApp recommendations group export
CREATE TABLE IF NOT EXISTS whatsapp_reviews (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_name  text,
  text         text NOT NULL,
  product_type text,  -- inferred from keywords; nullable
  created_at   timestamptz DEFAULT now()
);

-- Time-series performance snapshots per content task
-- One row per (task_id, snapshot_date); re-submitting same day overwrites via upsert
CREATE TABLE IF NOT EXISTS task_performance_snapshots (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id        uuid NOT NULL REFERENCES content_tasks(id) ON DELETE CASCADE,
  snapshot_date  date NOT NULL DEFAULT current_date,
  -- Social metrics (TikTok / Instagram)
  views          integer,
  likes          integer,
  comments       integer,
  shares         integer,
  saves          integer,
  reach          integer,
  -- Newsletter metrics (רבמסר)
  sends          integer,
  opens          integer,
  clicks         integer,
  unsubscribes   integer,
  created_at     timestamptz DEFAULT now(),
  UNIQUE (task_id, snapshot_date)
);
```

- [ ] **Step 2: Tell the user to apply the migration**

The user applies this manually:
```
Run the contents of db/005_events_content_tasks_reviews.sql against your Neon database.
```
Verify with: `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;`
Expected: `content_tasks`, `events`, `task_performance_snapshots`, `whatsapp_reviews` all appear.

---

## Task 2: Airtable Migration Script

**Files:**
- Create: `scripts/migrate-airtable-tasks.mjs`

**Interfaces:**
- Consumes: Airtable Tasks table (BASE_ID `appjb01XUH9eMP9MA`, table `tblLnTfroTGbR1caO`) via REST; env vars `AIRTABLE_API_KEY`, `DATABASE_URL`
- Produces: rows in `content_tasks` matching Airtable Tasks records

> This is a one-time script, not production code. Run it once, then it's done.

- [ ] **Step 1: Write the migration script**

Create `scripts/migrate-airtable-tasks.mjs`:

```js
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

    await sql`
      INSERT INTO content_tasks (clip_det_id, platform, scheduled_date, status, hook, caption, hashtags)
      VALUES (${clipDetId}, ${platform}, ${scheduledDate}, ${status}, ${hook}, ${caption}, ${hashtags})
      ON CONFLICT DO NOTHING
    `;
    inserted++;
  }

  console.log(`Done. Inserted: ${inserted}, skipped (no date): ${skipped}.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Tell the user how to run it**

```
node --env-file=.env.local scripts/migrate-airtable-tasks.mjs
```

Expected output: `Done. Inserted: N, skipped (no date): M.`

Verify row count:
```sql
SELECT COUNT(*) FROM content_tasks;
```

---

## Task 3: WhatsApp Reviews Import Script

**Files:**
- Create: `scripts/import-whatsapp-reviews.mjs`

**Interfaces:**
- Consumes: `C:\Users\User\Downloads\TEMP WHATSAPP\‏צ'אט WhatsApp עם המלצות.txt` (WhatsApp export); `DATABASE_URL` env var
- Produces: rows in `whatsapp_reviews`

**WhatsApp export format:** Each message line starts with `DD.MM.YYYY, HH:MM - Sender: text`. The sender is always "Nirit Shapira - Life Alignment". Nirit forwards reviews in two parts: (1) a name-label line (short, e.g. `"מיכל רוזן מילגרם:"` or `"מקרן כהן על ראויה וממגנטת"`) followed by (2) the actual review text block. Skip system messages, URLs, and Nirit's own short commentary.

**Product type keyword map:**
- `"ראויה וממגנטת"` → `'ראויה וממגנטת'`
- `"התגלות"` → `'התגלות'`
- `"שאקטי"` → `'שאקטי'`
- `"פשוט לאהוב"` → `'פשוט לאהוב'`
- `"לייב"` or `"זום"` → `'live'`
- `"הכשרה"` or `"קורס"` or `"מטפל"` → `'life_alignment_course'`

- [ ] **Step 1: Write the import script**

Create `scripts/import-whatsapp-reviews.mjs`:

```js
// One-time import: WhatsApp text export → Neon whatsapp_reviews
// Run with: node --env-file=.env.local scripts/import-whatsapp-reviews.mjs

import fs from "fs";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// Adjust path if the file has moved:
const FILE_PATH = String.raw`C:\Users\User\Downloads\TEMP WHATSAPP\‏צ'אט WhatsApp עם המלצות.txt`;

const PRODUCT_KEYWORDS = [
  ["ראויה וממגנטת", "ראויה וממגנטת"],
  ["התגלות",         "התגלות"],
  ["שאקטי",          "שאקטי"],
  ["פשוט לאהוב",     "פשוט לאהוב"],
  ["לייב",           "live"],
  ["זום",            "live"],
  ["הכשרה",          "life_alignment_course"],
  ["קורס",           "life_alignment_course"],
  ["מטפל",           "life_alignment_course"],
];

function inferProductType(text) {
  for (const [kw, pt] of PRODUCT_KEYWORDS) {
    if (text.includes(kw)) return pt;
  }
  return null;
}

/** Parse a WhatsApp .txt export into message objects {sender, text} */
function parseMessages(raw) {
  const lines = raw.split(/\r?\n/);
  // Line starts with: DD.MM.YYYY, HH:MM - Sender: text
  const MSG_RE = /^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2} - (.+?): (.*)/;
  const SYS_RE = /^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2} - [^:]+$/; // system message (no sender colon)

  const messages = [];
  let current = null;

  for (const line of lines) {
    const m = MSG_RE.exec(line);
    if (m) {
      if (current) messages.push(current);
      current = { sender: m[1], text: m[2] };
    } else if (SYS_RE.test(line) || line.startsWith("\u200e")) {
      // system/encryption notice — flush and ignore
      if (current) { messages.push(current); current = null; }
    } else if (current) {
      // continuation of previous message
      current.text += "\n" + line;
    }
  }
  if (current) messages.push(current);
  return messages;
}

/** Detect if a short message is a name-label (introduces the next review block) */
function isNameLabel(text) {
  const t = text.trim();
  // ends with ":" → "מיכל רוזן מילגרם:"
  if (t.endsWith(":")) return true;
  // "על" phrase: "מקרן כהן על ראויה וממגנטת"
  if (/^[\u05d0-\u05ea\s'"-]{2,30} על .{3,}$/.test(t)) return true;
  // very short (≤ 40 chars) with no URL and no sentence punctuation → likely a label
  if (t.length <= 40 && !t.includes("http") && !/[.!?]/.test(t)) return true;
  return false;
}

function isUrl(text) {
  return /^https?:\/\/\S+$/.test(text.trim());
}

function isTooShort(text) {
  return text.trim().length < 20;
}

async function main() {
  const raw = fs.readFileSync(FILE_PATH, "utf-8");
  const messages = parseMessages(raw);

  // Only Nirit's messages
  const niritMsgs = messages.filter((m) =>
    m.sender.includes("Nirit Shapira")
  );

  const reviews = [];
  let pendingName = null;

  for (const msg of niritMsgs) {
    const text = msg.text.trim();

    if (!text || isUrl(text)) { pendingName = null; continue; }

    if (isNameLabel(text)) {
      // Extract the name part (strip trailing ": " and "על X" suffix)
      let name = text.replace(/:$/, "").trim();
      name = name.replace(/ על .+$/, "").trim();
      pendingName = name;
      continue;
    }

    if (isTooShort(text)) { continue; }

    // This is a review block
    const productType = inferProductType(text);
    reviews.push({ author_name: pendingName ?? null, text, product_type: productType });
    pendingName = null;
  }

  console.log(`Parsed ${reviews.length} reviews. Sample:`);
  if (reviews[0]) console.log(JSON.stringify(reviews[0], null, 2));

  for (const r of reviews) {
    await sql`
      INSERT INTO whatsapp_reviews (author_name, text, product_type)
      VALUES (${r.author_name}, ${r.text}, ${r.product_type})
    `;
  }

  console.log(`Inserted ${reviews.length} reviews into whatsapp_reviews.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Tell the user how to run it**

```
node --env-file=.env.local scripts/import-whatsapp-reviews.mjs
```

Expected: prints count + first review sample. Verify:
```sql
SELECT author_name, left(text, 60), product_type FROM whatsapp_reviews LIMIT 5;
```

---

## Task 4: Neon Types and Queries for New Tables

**Files:**
- Modify: `lib/neon.ts` — append new types and query functions; do NOT modify existing code

**Interfaces:**
- Produces:
  - `type ContentTask`, `type Event`, `type WhatsappReview`, `type TaskPerformanceSnapshot`
  - `listContentTasks(): Promise<ContentTask[]>`
  - `getContentTask(id: string): Promise<ContentTask | null>`
  - `updateContentTaskStatus(id: string, status: string): Promise<ContentTask>`
  - `listEvents(): Promise<Event[]>`
  - `upsertTaskPerformanceSnapshot(taskId: string, snapshot_date: string, data: SnapshotData): Promise<TaskPerformanceSnapshot>`

- [ ] **Step 1: Append types and query functions to `lib/neon.ts`**

Add at the bottom of `lib/neon.ts` (after all existing code):

```typescript
// ─── Marketing Agency: New tables ──────────────────────────────────────────

export type ContentTask = {
  id: string;
  clip_det_id: string | null;
  event_id: string | null;
  platform: "tiktok" | "instagram" | "newsletter";
  scheduled_date: string;       // ISO date YYYY-MM-DD
  status: "ai_draft" | "pending_review" | "approved" | "posted";
  hook: string | null;
  caption: string | null;
  hashtags: string | null;
  canva_url: string | null;
  live_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Event = {
  id: string;
  name: string;
  product_type: string;
  event_date: string;           // ISO date YYYY-MM-DD
  registration_link: string | null;
  target_headcount: number | null;
  price_early_bird: number | null;
  price_regular: number | null;
  location: string | null;
  notes: string | null;
  created_at: string;
};

export type WhatsappReview = {
  id: string;
  author_name: string | null;
  text: string;
  product_type: string | null;
  created_at: string;
};

export type TaskPerformanceSnapshot = {
  id: string;
  task_id: string;
  snapshot_date: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  reach: number | null;
  sends: number | null;
  opens: number | null;
  clicks: number | null;
  unsubscribes: number | null;
  created_at: string;
};

export type SnapshotData = Omit<TaskPerformanceSnapshot, "id" | "task_id" | "snapshot_date" | "created_at">;

export async function listContentTasks(): Promise<ContentTask[]> {
  const client = sql();
  const rows = (await client`
    SELECT id, clip_det_id, event_id, platform, scheduled_date, status,
           hook, caption, hashtags, canva_url, live_url, created_at, updated_at
    FROM content_tasks
    ORDER BY scheduled_date ASC, created_at ASC
  `) as unknown as ContentTask[];
  return rows;
}

export async function getContentTask(id: string): Promise<ContentTask | null> {
  const client = sql();
  const rows = (await client`
    SELECT id, clip_det_id, event_id, platform, scheduled_date, status,
           hook, caption, hashtags, canva_url, live_url, created_at, updated_at
    FROM content_tasks WHERE id = ${id}
  `) as unknown as ContentTask[];
  return rows[0] ?? null;
}

export async function updateContentTaskStatus(id: string, status: string): Promise<ContentTask> {
  const client = sql();
  const rows = (await client`
    UPDATE content_tasks SET status = ${status}, updated_at = now()
    WHERE id = ${id}
    RETURNING id, clip_det_id, event_id, platform, scheduled_date, status,
              hook, caption, hashtags, canva_url, live_url, created_at, updated_at
  `) as unknown as ContentTask[];
  return rows[0];
}

export async function listEvents(): Promise<Event[]> {
  const client = sql();
  const rows = (await client`
    SELECT id, name, product_type, event_date, registration_link,
           target_headcount, price_early_bird, price_regular, location, notes, created_at
    FROM events
    ORDER BY event_date ASC
  `) as unknown as Event[];
  return rows;
}

export async function upsertTaskPerformanceSnapshot(
  taskId: string,
  snapshotDate: string,
  data: SnapshotData
): Promise<TaskPerformanceSnapshot> {
  const client = sql();
  const rows = (await client`
    INSERT INTO task_performance_snapshots
      (task_id, snapshot_date, views, likes, comments, shares, saves, reach,
       sends, opens, clicks, unsubscribes)
    VALUES
      (${taskId}, ${snapshotDate}, ${data.views ?? null}, ${data.likes ?? null},
       ${data.comments ?? null}, ${data.shares ?? null}, ${data.saves ?? null},
       ${data.reach ?? null}, ${data.sends ?? null}, ${data.opens ?? null},
       ${data.clicks ?? null}, ${data.unsubscribes ?? null})
    ON CONFLICT (task_id, snapshot_date) DO UPDATE SET
      views        = EXCLUDED.views,
      likes        = EXCLUDED.likes,
      comments     = EXCLUDED.comments,
      shares       = EXCLUDED.shares,
      saves        = EXCLUDED.saves,
      reach        = EXCLUDED.reach,
      sends        = EXCLUDED.sends,
      opens        = EXCLUDED.opens,
      clicks       = EXCLUDED.clicks,
      unsubscribes = EXCLUDED.unsubscribes
    RETURNING id, task_id, snapshot_date, views, likes, comments, shares, saves, reach,
              sends, opens, clicks, unsubscribes, created_at
  `) as unknown as TaskPerformanceSnapshot[];
  return rows[0];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npx tsc --noEmit
```
Expected: no errors.

---

## Task 5: Replace Airtable Actions with Neon in `app/actions.ts`

**Files:**
- Modify: `app/actions.ts`

**Interfaces:**
- Consumes: `listContentTasks`, `updateContentTaskStatus`, `getClipThumbnails`, `getClipRepresentativeLinks`, `getClipTranscripts`, `listClipCopiesForIds` from `@/lib/neon`
- Produces: `export type PlannerTask`, `listTasksAction(): Promise<PlannerTask[]>`, `updateTaskStatusAction(taskId: string, status: string): Promise<string>`

- [ ] **Step 1: Remove all Airtable imports from `app/actions.ts`**

Remove the entire import block (lines ~35–49):
```typescript
import {
  FIELDS,
  createCopyRecord,
  ...
  updateTaskStatus,
} from "@/lib/airtable";
```

- [ ] **Step 2: Add new Neon imports**

Add to the existing `@/lib/neon` import block at the top of `app/actions.ts`:

```typescript
import {
  // ... existing imports stay ...
  listContentTasks,
  updateContentTaskStatus,
  type ContentTask,
} from "@/lib/neon";
```

- [ ] **Step 3: Replace `PlannerTask` type and `listTasksAction`**

Find the existing `listTasksAction` function (around line 459) and replace it — plus the `PlannerTask` type defined nearby — with:

```typescript
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
```

- [ ] **Step 4: Remove Airtable-only actions**

Delete these server actions entirely (they have no Neon replacement — the raw-clips page will be stubbed in Task 8):
- `listAllRawClipRecordsAction`
- `searchRawClipRecordsAction`
- `syncClipLibraryAction`
- `mergeRawClipRecordsAction`
- Any action that only calls `lib/airtable.ts` functions and isn't called by the media library

Keep all existing media library / clip_details / clip_performance / clip_copies actions unchanged.

- [ ] **Step 5: TypeScript check**

```
npx tsc --noEmit
```
Expected: no errors.

---

## Task 6: Update `PlannerCalendar.tsx`

**Files:**
- Modify: `components/PlannerCalendar.tsx`

**Interfaces:**
- Consumes: `PlannerTask` type from `@/app/actions` (new shape from Task 5)
- Removes: `OPTIONS` import from `@/lib/airtable`

The calendar currently uses `OPTIONS.taskStatus` for status cycling and the old field names `name`, `date`, `channel`, `fullContent`. These must be updated to the new schema.

- [ ] **Step 1: Replace Airtable import and status constants**

At the top of `PlannerCalendar.tsx`, remove:
```typescript
import { OPTIONS } from "@/lib/airtable";
```

Replace the `STATUS_STYLE` constant (currently using old string values) with:

```typescript
const TASK_STATUS_CYCLE: Array<"ai_draft" | "pending_review" | "approved" | "posted"> = [
  "ai_draft",
  "pending_review",
  "approved",
  "posted",
];

const STATUS_LABEL: Record<string, string> = {
  ai_draft:       "טיוטת AI",
  pending_review: "ממתינה לאישור",
  approved:       "מאושרת",
  posted:         "פורסמה",
};

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  ai_draft:       { bg: "bg-surface-container-highest", fg: "text-on-surface-variant" },
  pending_review: { bg: "bg-primary-container",         fg: "text-on-primary-container" },
  approved:       { bg: "bg-tertiary-container",        fg: "text-on-tertiary-container" },
  posted:         { bg: "bg-secondary-container",       fg: "text-on-secondary-container" },
};
```

- [ ] **Step 2: Update status cycling logic**

Find the existing `onCycle` / status cycling code (it currently references `OPTIONS.taskStatus`). Replace the cycle lookup with:

```typescript
function cycleStatus(current: string | null): string {
  const idx = TASK_STATUS_CYCLE.indexOf(
    current as "ai_draft" | "pending_review" | "approved" | "posted"
  );
  return TASK_STATUS_CYCLE[(idx + 1) % TASK_STATUS_CYCLE.length];
}
```

Call `cycleStatus(task.status)` wherever the old code called `OPTIONS.taskStatus[nextIdx]`.

- [ ] **Step 3: Update field references in JSX**

Replace all old field references with new ones:

| Old | New |
|---|---|
| `task.name` | `task.hook ?? task.caption ?? "(ללא כותרת)"` |
| `task.date` | `task.scheduled_date` |
| `task.channel` | `task.platform` |
| `task.fullContent` | `task.caption` |

Also update the status pill to show `STATUS_LABEL[task.status ?? ""]` as readable text.

- [ ] **Step 4: TypeScript check**

```
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Run dev server and open `/planner`**

```
npm run dev
```

Open `http://localhost:3000/planner`. Verify:
- Tasks load (from Neon after migration)
- No Airtable API calls visible in Network tab
- Status pills show Hebrew labels
- Clicking status cycles through the 4 new values

---

## Task 7: Update `Sidebar.tsx`

**Files:**
- Modify: `components/Sidebar.tsx`

**Interfaces:**
- Produces: updated `active` prop type; 3 new nav links; Raw Clips replaced

- [ ] **Step 1: Replace Sidebar content**

Replace `components/Sidebar.tsx` with:

```typescript
import Link from "next/link";
import { auth, signOut } from "@/auth";

type ActivePage = "library" | "planner" | "plan" | "create" | "review";

export async function Sidebar({ active = "library" }: { active?: ActivePage }) {
  const session = await auth();

  const links: { href: string; key: ActivePage; icon: string; label: string }[] = [
    { href: "/",       key: "library", icon: "photo_library",  label: "ספריית מדיה" },
    { href: "/planner",key: "planner", icon: "calendar_month", label: "לוח שנה" },
    { href: "/plan",   key: "plan",    icon: "edit_calendar",  label: "תכנון תוכן" },
    { href: "/create", key: "create",  icon: "draw",           label: "יצירת תוכן" },
    { href: "/review", key: "review",  icon: "insert_chart",   label: "סקירת ביצועים" },
  ];

  return (
    <aside className="fixed right-0 top-0 z-50 flex h-screen w-64 flex-col border-l border-outline-variant bg-surface-container px-4 py-8 shadow-sm">
      <div className="mb-10 px-4">
        <h1 className="text-3xl font-bold text-primary">Content Hub</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          נירית שפירא
        </p>
      </div>

      <nav className="flex-grow space-y-1">
        {links.map(({ href, key, icon, label }) => (
          <Link
            key={key}
            href={href}
            className={
              active === key
                ? "flex items-center gap-3 rounded bg-primary/10 px-4 py-3 font-bold text-primary transition-colors"
                : "flex items-center gap-3 rounded px-4 py-3 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
            }
          >
            <span className="material-symbols-outlined">{icon}</span>
            <span className="text-sm">{label}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-3 border-t border-outline-variant px-4 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-highest ring-1 ring-outline-variant">
          <span className="material-symbols-outlined text-on-surface-variant">person</span>
        </div>
        <div className="overflow-hidden">
          <p className="truncate text-sm font-bold text-on-surface">
            {session?.user?.email ?? ""}
          </p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="text-xs text-on-surface-variant hover:text-primary">
              התנתקות
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Update all existing `<Sidebar active="...">` call sites**

The old `active` values `"rawClips"` no longer exists. Update:
- `app/raw-clips/page.tsx`: will be replaced in Task 8 — skip for now
- `app/page.tsx`: already `active="library"` — no change
- `app/planner/page.tsx`: already `active="planner"` — no change

- [ ] **Step 3: TypeScript check**

```
npx tsc --noEmit
```

---

## Task 8: Stub `/raw-clips` and Remove Airtable

**Files:**
- Modify: `app/raw-clips/page.tsx` — replace with stub
- Delete: `lib/airtable.ts`

**Why stub, not delete:** `/raw-clips` is linked from the old sidebar. Deleting without a stub causes a 404. The stub signals it's being rebuilt.

- [ ] **Step 1: Replace `/raw-clips/page.tsx` with a stub**

```typescript
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

export default function RawClipsPage() {
  return (
    <>
      <Sidebar active="library" />
      <TopBar />
      <main className="mr-64 mt-16 flex min-h-[calc(100vh-64px)] items-center justify-center bg-background">
        <p className="text-on-surface-variant">דף זה עובר שדרוג ויחזור בקרוב.</p>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Confirm no remaining imports of `@/lib/airtable`**

```
npx tsc --noEmit
```

If the TypeScript compiler reports no errors, `lib/airtable.ts` is no longer imported. If errors remain, fix them (they are likely lingering imports in `app/actions.ts` or `app/raw-clips/page.tsx`).

- [ ] **Step 3: Delete `lib/airtable.ts`**

```
del "C:\Users\User\Documents\Content Hub\lib\airtable.ts"
```

- [ ] **Step 4: Final TypeScript check**

```
npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 5: Smoke-test the full app**

```
npm run dev
```

Verify:
1. `/` (media library) loads and filters work
2. `/planner` shows tasks with Hebrew status labels; status cycling works; no console errors
3. `/raw-clips` shows the stub message
4. Browser Network tab: zero requests to `api.airtable.com` on any page

- [ ] **Step 6: Commit**

```bash
git add db/005_events_content_tasks_reviews.sql \
        scripts/migrate-airtable-tasks.mjs \
        scripts/import-whatsapp-reviews.mjs \
        lib/neon.ts \
        app/actions.ts \
        app/raw-clips/page.tsx \
        components/PlannerCalendar.tsx \
        components/Sidebar.tsx
git commit -m "feat: replace Airtable with Neon content_tasks; add events/reviews/snapshots tables"
```

Then:
```bash
git rm lib/airtable.ts
git commit -m "chore: delete lib/airtable.ts (replaced by Neon content_tasks)"
```

---

## Verification Checklist

Run these after completing all tasks:

- [ ] `SELECT COUNT(*) FROM content_tasks` → matches the task count from Airtable before migration
- [ ] `SELECT COUNT(*) FROM whatsapp_reviews` → > 0 rows with non-empty `text` and `author_name`
- [ ] `/planner` loads without any `api.airtable.com` calls (check Network tab)
- [ ] Status cycling on a Planner task works: `ai_draft → pending_review → approved → posted → ai_draft`
- [ ] `/raw-clips` shows the stub message (not a 404 or crash)
- [ ] `npx tsc --noEmit` exits with 0 errors
- [ ] `npm run build` succeeds (no build-time errors)
