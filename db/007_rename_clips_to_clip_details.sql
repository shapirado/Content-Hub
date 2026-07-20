-- "clips" originally held one row per logical clip (AI pipeline output +
-- a single source path). We're splitting "logical clip" from "physical
-- copy of a clip" — this table becomes the logical-clip side of that split.
alter table clips rename to clip_details;
