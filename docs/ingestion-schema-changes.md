# Schema change: what the ingestion pipeline needs to update

The Content Hub app's database was restructured to separate "a physical clip file/link" from "the AI
analysis of a clip." This changes how your pipeline should write a newly-processed clip into Neon.

## What changed

Previously, your pipeline inserted one row per clip into a single `clips` table that held both the
AI output (transcript, summary, hooks, ...) and the source location (`source_type`,
`source_url`, `original_filename`).

That table has been renamed to **`clip_details`** and split from a new **`clips`** table that now
holds *only* the physical location. A `clip_details` row can have **one or more** `clips` rows
pointing at it (e.g. the same clip uploaded to Drive *and* to YouTube) — that's the new
multi-copy concept. For a normal single-source ingest, you'll just create exactly one `clips` row.

## New DDL (already applied to the live database)

```sql
create table clip_details (
  id uuid primary key default gen_random_uuid(),
  duration_seconds numeric,
  language text,
  transcript text not null,
  summary text,
  hooks text[] not null default '{}',
  warning text,
  created_at timestamptz not null default now(),
  thumbnail text,
  tag text,
  -- editorial fields (added later, not written by the pipeline — leave these null/default on insert)
  title text,
  pillar text,
  season text,
  context_tags text[] not null default '{}',
  usable text,
  posted_to_tiktok boolean,
  wardrobe text
);

create table clips (
  id uuid primary key default gen_random_uuid(),
  clip_det_id uuid not null references clip_details (id) on delete cascade,
  source_type text not null check (source_type in ('upload', 'url')),
  path text not null, -- Drive filename/path for 'upload', or the URL for 'url'
  platform text,      -- e.g. 'instagram', 'youtube', 'tiktok' — which platform this specific copy was posted to, if known
  created_at timestamptz not null default now()
);
-- unique on (clip_det_id, path) — inserting the same path twice for the same clip is a no-op if you use ON CONFLICT DO NOTHING
```

`platform` is optional and only meaningful if your pipeline already knows where a given copy lives (e.g.
it's ingesting directly from an Instagram export) — leave it null otherwise; it's editable later in the
Content Hub UI per copy, and the app now derives the "posted platforms" indicator on the clip list
straight from this column.

`clip_performance`, `clip_library`, and Airtable sync are unrelated to your pipeline — ignore them.

## What your insert needs to become

**Before** (single insert into `clips`):
```sql
insert into clips (
  source_type, source_url, original_filename, duration_seconds,
  language, transcript, summary, hooks, warning, thumbnail, tag
) values (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
)
returning id;
```

**After** (insert into `clip_details`, then one row per source into `clips`):
```sql
-- 1. Insert the AI analysis / logical clip.
insert into clip_details (
  duration_seconds, language, transcript, summary, hooks, warning, thumbnail, tag
) values (
  $1, $2, $3, $4, $5, $6, $7, $8
)
returning id;

-- 2. Insert its physical location(s), using the id returned above as clip_det_id.
insert into clips (clip_det_id, source_type, path)
values ($clip_det_id, $source_type, $path)
on conflict (clip_det_id, path) do nothing;
```

Concretely:
- Where you used to pass `source_url`, now insert a `clips` row with `source_type = 'url'`, `path = <that url>`.
- Where you used to pass `original_filename`, now insert a `clips` row with `source_type = 'upload'`, `path = <that filename/path>`.
- If a single ingest run produces both (e.g. you have the Drive filename *and* you've already uploaded it to YouTube), insert **two** `clips` rows against the same `clip_det_id` — don't try to cram both into one row.
- Wrap the `clip_details` insert + the `clips` insert(s) in a single transaction, so a clip is never left without at least one physical-copy row.

## Fields to leave alone

Don't write to `title`, `pillar`, `season`, `context_tags`, `usable`, `posted_to_tiktok`, or
`wardrobe` on `clip_details` — those are editorial fields set later by a human in the Content Hub UI.
Leave them at their column defaults (null / `'{}'`) on insert.

## Validation after switching over

Run these against Neon after your first few ingests on the new code path:
```sql
-- Every clip_details row should have at least one clips row.
select cd.id from clip_details cd
where not exists (select 1 from clips c where c.clip_det_id = cd.id)
order by cd.created_at desc limit 20;

-- Spot-check the newest ingests end-to-end.
select cd.id, cd.created_at, c.source_type, c.path
from clip_details cd
join clips c on c.clip_det_id = cd.id
order by cd.created_at desc limit 20;
```
