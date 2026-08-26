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
