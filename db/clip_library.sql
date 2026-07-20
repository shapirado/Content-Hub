-- Agent-facing mirror table. The app upserts into this whenever a clip's
-- Airtable link is established or edited; the marketing agent queries it
-- directly with plain SQL and never touches Airtable itself.
create table if not exists clip_library (
  clip_id uuid primary key references clips (id),
  airtable_raw_clip_id text,
  airtable_content_inventory_ids text[] not null default '{}',
  title text,
  youtube_link text,
  pillar text,
  season text,
  context_tags text[] not null default '{}',
  usable text,
  posted_to_tiktok boolean,
  wardrobe text,
  alternate_sources text[] not null default '{}',
  status text,
  platforms text[] not null default '{}',
  hook_key_line text,
  hashtags text,
  live_post_url text,
  views integer,
  likes integer,
  shares integer,
  comments integer,
  copies jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists clip_library_updated_at_idx on clip_library (updated_at desc);
