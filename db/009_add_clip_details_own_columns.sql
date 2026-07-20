-- Editorial fields moving from clip_library (Airtable read-cache) onto
-- clip_details, so the app can read/write them directly against Neon.
alter table clip_details add column if not exists title text;
alter table clip_details add column if not exists pillar text;
alter table clip_details add column if not exists season text;
alter table clip_details add column if not exists context_tags text[] not null default '{}';
alter table clip_details add column if not exists usable text;
alter table clip_details add column if not exists posted_to_tiktok boolean;
alter table clip_details add column if not exists wardrobe text;
