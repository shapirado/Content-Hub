alter table clip_library add column if not exists alternate_sources text[] not null default '{}';
