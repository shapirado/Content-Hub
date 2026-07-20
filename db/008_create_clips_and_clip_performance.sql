-- New "clips" table: one row per physical copy of a clip_details row
-- (e.g. a Google Drive file and a YouTube upload of the same content are
-- two rows here sharing one clip_det_id — that multiplicity IS "this clip
-- has 2 copies", no separate join table needed).
create table if not exists clips (
  id uuid primary key default gen_random_uuid(),
  clip_det_id uuid not null references clip_details (id) on delete cascade,
  source_type text not null check (source_type in ('upload', 'url')),
  path text not null,
  created_at timestamptz not null default now()
);

create index if not exists clips_clip_det_id_idx on clips (clip_det_id);
create unique index if not exists clips_clip_det_id_path_idx on clips (clip_det_id, path);

-- One row per platform-posting of a clip, replacing the old flattened/summed
-- metrics on clip_library (which lost per-platform breakdown).
create table if not exists clip_performance (
  id uuid primary key default gen_random_uuid(),
  clip_det_id uuid not null references clip_details (id) on delete cascade,
  platform text,
  views integer,
  likes integer,
  shares integer,
  comments integer,
  status text,
  hook_key_line text,
  hashtags text,
  live_post_url text,
  date_posted date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists clip_performance_clip_det_id_idx on clip_performance (clip_det_id);
