-- Add youtube to platform CHECK constraint
ALTER TABLE content_tasks DROP CONSTRAINT IF EXISTS content_tasks_platform_check;
ALTER TABLE content_tasks ADD CONSTRAINT content_tasks_platform_check
  CHECK (platform IN ('tiktok', 'instagram', 'newsletter', 'youtube'));

-- Checklist flags on clip_details for steps with no other DB tracking
ALTER TABLE clip_details
  ADD COLUMN IF NOT EXISTS google_drive_uploaded boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS website_added         boolean NOT NULL DEFAULT false;
