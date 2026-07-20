alter table clip_library add column if not exists context_tags text[] not null default '{}';
