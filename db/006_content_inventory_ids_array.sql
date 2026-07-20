alter table clip_library add column if not exists airtable_content_inventory_ids text[] not null default '{}';
update clip_library set airtable_content_inventory_ids = array[airtable_content_inventory_id]
  where airtable_content_inventory_id is not null and airtable_content_inventory_ids = '{}';
alter table clip_library drop column if exists airtable_content_inventory_id;
