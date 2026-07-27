# Planner page design

## Context

The Airtable base already has a `Tasks` table — a dated content plan (post name, date, channel, cycle type, status, and ready-to-use `Full Content`: hooks, overlays, CTAs, hashtags, or full newsletter body). A marketing agent (human or automated) writes into it. There's currently no way to see this plan inside Content Hub; the sidebar has a stubbed "לוח שנה" (calendar) nav item marked "coming soon" that this fills in.

The user supplied a reference mockup (`Planner design.txt`, a CreatorHub "Marketing Operations" bento layout) built with Google Stitch. This spec adapts that mockup's structure to the real `Tasks` schema and to Content Hub's existing design tokens/patterns, and narrows scope to what's buildable against real data today.

## Scope decisions

- **Read-only content, editable status.** The page visualizes what the agent already wrote — no "new post" form, no editing `Full Content`/date/channel from here. The one exception: a status pill on every card that a human can click to change (Not Started → In Review → Approved → Cancelled → Posted/Sent). Airtable/the agent stays the source of truth for content.
- **Add a "Cancelled" status.** The live `Tasks.Status` field only has Not Started / In Review / Approved / Posted/Sent. Add a 5th choice, Cancelled, so a suggested post can be rejected without deleting the row.
- **Week view only.** The mockup has a weekly/monthly toggle; only weekly ships now (toggle button is visually present but monthly isn't wired up), matching current data volume (a handful of Tasks per week).
- **`Full Content` shown as one expandable block**, not parsed into separate Hook/Overlay/CTA/Hashtags fields — the field is free text with no guaranteed structure across tasks.
- **TikTok cards show the source clip's thumbnail** (added after initial mockup review) — pulled from the linked Content Inventory record's `Thumbnail` attachment field, when present.

## Data source

Airtable base `appjb01XUH9eMP9MA`, table `Tasks` (`tblLnTfroTGbR1caO`):

| Field | ID | Use |
|---|---|---|
| Name | `fldJPKQ9wnQZcxy1U` | Card title |
| Date | `fldHMnNbHIZKUFmv1` | Calendar placement, card date |
| Channel | `fldzR7bmpX1PtJwy8` | Icon/grouping (TikTok, Instagram, WhatsApp ×2, Rav-Masar, Internal/Review) |
| Cycle Type | `fldsXMDFtfnoGreG6` | Not displayed in v1 (redundant with Channel for card styling) |
| Status | `fldfUMyCHtx5fF3du` | Editable status pill |
| Full Content | `fldpjcZxZTMf0W9vu` | Expandable card body |
| Content Inventory | `fld711LOt2iwASJcJ` | Linked record — source of the TikTok thumbnail |

`Content Inventory` (`tblNNoQN7kG3mGvhR`), field `Thumbnail` (`fldnS0C1uGiFuYlca`, attachment) — used only to fetch the thumbnail for cards whose Channel is TikTok.

**Setup dependency:** add "Cancelled" as a 5th choice on `Tasks.Status` in Airtable before wiring up the status editor.

## Architecture

New route `/planner` (server component, same pattern as `/raw-clips`), plus a real sidebar link replacing the stubbed "לוח שנה" item.

- `app/planner/page.tsx` — fetches all Tasks server-side (data volume is small enough that no date-range query is needed).
- `components/PlannerCalendar.tsx` (new, client) — week view:
  - Week navigator: prev/next arrows, "היום" (today) button, and a week-range label.
  - A weekly/monthly toggle pill (monthly inert for now).
  - 7-day header row with each day's date; days with tasks show a small colored chip naming the task.
  - Below the calendar, one row per Channel grouping, matching the mockup's differentiated cards:
    - **TikTok card** (tan background, `#eae1d9`): one white sub-card per TikTok task in the current week — title, scheduled date, status pill, clip thumbnail (from linked Content Inventory), Hook/Hashtags-labeled excerpt from Full Content, full text expandable.
    - **Instagram card** (white background): title, status pill, Full Content excerpt (no thumbnail — Instagram tasks don't reliably have a linked Content Inventory record yet).
    - **Newsletter card** (light tan, `#f6ece4`): edition/date, headline (first line of Full Content), expandable body, and a footer listing linked `Links` records (from the Task's `Links` field) as small chips.
  - Channels with no task in the current week render nothing (no empty-state card per channel).

## Data flow

- `listTasksAction()` — new server action wrapping a new `lib/airtable.ts` function `listAllTasks()`, following the same shape as `listAllRawClipRecordsAction`. Includes, per task: id, name, date, channel, status, fullContent, and (for TikTok tasks only) the linked Content Inventory thumbnail URL.
- `updateTaskStatusAction(taskId, status)` — the only write path; PATCHes just the `Status` field via the existing `airtableFetch` pattern (same shape as `updateRawClipLibraryRecord`).

## Error handling

Airtable fetch failure on page load shows an empty-state message ("לא ניתן לטעון את התוכניות") instead of crashing, consistent with other pages. Status updates optimistically update local state, then reconcile with the server response — same pattern as `updateClipCopyPlatform`.

## Verification

- Load `/planner`; confirm the 4 real Tasks render with correct channel grouping, dates, and (for the 2 TikTok tasks) thumbnails from their linked Content Inventory records.
- Expand a Full Content preview on each card type; confirm it shows the complete text.
- Change one task's status to Cancelled; confirm it persists in Airtable on reload, and that the choice was actually added to the field (not typecast into an unexpected value).
- Confirm the sidebar's "לוח שנה" link is no longer stubbed and highlights as active on `/planner`.
- Confirm a channel with no Task in the current week renders no card for that channel.
