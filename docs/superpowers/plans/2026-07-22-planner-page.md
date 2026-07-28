# Planner Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/planner` page that visualizes the Airtable `Tasks` table (the marketing agent's dated content plan) as a weekly calendar with per-channel content cards, and lets a human change a task's `Status`.

**Architecture:** New Airtable data-layer functions in `lib/airtable.ts` (table/field IDs, list, update), two new server actions in `app/actions.ts`, a real sidebar link replacing the stubbed "לוח שנה" item, and a new client component `PlannerCalendar.tsx` rendering the week view + card groups. No Neon involvement — this is Airtable-native data with no clip relationship beyond an optional thumbnail lookup.

**Tech Stack:** Next.js 16 (App Router, Server Actions), TypeScript, Tailwind CSS v4, Airtable REST API via the existing `airtableFetch` helper in `lib/airtable.ts`.

## Global Constraints

- No test framework exists in this repo (`package.json` has no jest/vitest) — verification is `npx tsc --noEmit`, `npx eslint`, and manual browser checks via the preview tools, matching how every other feature in this codebase has been verified.
- Follow the field-ID-not-name pattern already used throughout `lib/airtable.ts` — every Airtable field is read/written via its `fld...` ID from `FIELDS`, never a display name, so renaming a column label in Airtable never breaks the app.
- RTL Hebrew UI throughout, matching existing components' Tailwind classes (`bg-surface-container*`, `text-primary`, `text-on-surface`, `text-on-surface-variant`, `border-outline-variant`, `rounded-xl`/`rounded-[32px]`).
- **Setup dependency (already handled by the user, not a plan task):** the user is adding "Cancelled" as a 5th choice on `Tasks.Status` (`fldfUMyCHtx5fF3du`) directly in the Airtable UI. Existing choices: Not Started / In Review / Approved / Posted/Sent.
- Design reference: `docs/superpowers/specs/2026-07-22-planner-page-design.md`.

---

## File Structure

- **Modify `lib/airtable.ts`** — add the `Tasks` table ID, its field IDs, a `taskStatus` options list, a `TaskFields` type, a `thumbnail` field on `ContentInventoryFields`, and two functions: `listAllTasks()` (paginated list, same pattern as `listAllRawClipLibraryRecords`) and `updateTaskStatus()` (PATCH, same pattern as `updateRawClipLibraryRecord`).
- **Modify `app/actions.ts`** — add `listTasksAction()` (fetches tasks + resolves TikTok thumbnails from linked Content Inventory records, returns a flat `PlannerTask[]`) and `updateTaskStatusAction()`.
- **Modify `components/Sidebar.tsx`** — extend the `active` prop union with `"planner"`, remove "לוח שנה" from the stubbed nav array, add it as a real `Link` to `/planner` in the same style as the existing two real links.
- **Create `app/planner/page.tsx`** — server component, same shape as `app/raw-clips/page.tsx`.
- **Create `components/PlannerCalendar.tsx`** — client component: week navigator, 7-day header strip, and three card-group renderers (TikTok, Newsletter, generic — covering Instagram/WhatsApp/Internal-Review) with a shared status pill and expandable-content sub-component.

---

### Task 1: Airtable data layer for Tasks

**Files:**
- Modify: `lib/airtable.ts`

**Interfaces:**
- Produces: `TABLES.tasks: string`, `FIELDS.tasks: {name, date, cycleType, channel, status, fullContent, contentInventoryLink}`, `OPTIONS.taskStatus: {value: string; label: string}[]`, `type TaskFields`, `listAllTasks(): Promise<AirtableRecord<TaskFields>[]>`, `updateTaskStatus(recordId: string, status: string): Promise<AirtableRecord<TaskFields>>`. Also extends the existing `ContentInventoryFields` type with an optional `thumbnail` field.

- [ ] **Step 1: Add the Tasks table ID**

In `lib/airtable.ts`, find the `TABLES` const (near the top) and add `tasks`:

```ts
const TABLES = {
  rawClipLibrary: "tbl0JHtFGYG75DVOP",
  contentInventory: "tblNNoQN7kG3mGvhR",
  copies: "tblbRlPLJ8tVpOE70",
  tasks: "tblLnTfroTGbR1caO",
} as const;
```

- [ ] **Step 2: Add Tasks field IDs and taskStatus options**

In the `FIELDS` export const, add a `tasks` block after `copies`:

```ts
  copies: {
    title: "fldXvBgdQx67kAW49",
    copyText: "fldHvbq1jVlkP5cn3",
    platform: "fldGXBQaJN0yHeB5z",
    linkedClip: "fldjYVJd29aZBXcbl",
  },
  tasks: {
    name: "fldJPKQ9wnQZcxy1U",
    date: "fldHMnNbHIZKUFmv1",
    cycleType: "fldsXMDFtfnoGreG6",
    channel: "fldzR7bmpX1PtJwy8",
    status: "fldfUMyCHtx5fF3du",
    fullContent: "fldpjcZxZTMf0W9vu",
    contentInventoryLink: "fld711LOt2iwASJcJ",
  },
} as const;
```

(Note: this closes the `FIELDS` object — remove the old closing `} as const;` that followed `copies` and keep only the one after `tasks`.)

In the `OPTIONS` export const, add `taskStatus` after `wardrobe`:

```ts
  taskStatus: [
    { value: "Not Started", label: "טרם החל" },
    { value: "In Review", label: "בבדיקה" },
    { value: "Approved", label: "אושר" },
    { value: "Cancelled", label: "בוטל" },
    { value: "Posted/Sent", label: "פורסם" },
  ],
} as const;
```

(Same note: this becomes the new closing brace for `OPTIONS`, replacing the one that used to follow `wardrobe`.)

- [ ] **Step 3: Add the thumbnail field to ContentInventoryFields**

Find `export type ContentInventoryFields = {` and add a `thumbnail` line right after the `name` line (it reuses the `AirtableAttachment` type already defined above `RawClipLibraryFields`):

```ts
export type ContentInventoryFields = {
  [FIELDS.contentInventory.name]: string;
  [FIELDS.contentInventory.thumbnail]?: AirtableAttachment[];
  [FIELDS.contentInventory.contentType]?: string;
```

- [ ] **Step 4: Add the TaskFields type and listAllTasks/updateTaskStatus functions**

At the end of `lib/airtable.ts`, after the `linkCopyToRawClip` function, add:

```ts

// ---------- Tasks (Planner) ----------

export type TaskFields = {
  [FIELDS.tasks.name]: string;
  [FIELDS.tasks.date]?: string;
  [FIELDS.tasks.cycleType]?: string;
  [FIELDS.tasks.channel]?: string;
  [FIELDS.tasks.status]?: string;
  [FIELDS.tasks.fullContent]?: string;
  [FIELDS.tasks.contentInventoryLink]?: string[];
};

/** All Tasks records — data volume is a handful per week, so client-side week-filtering is simpler than a formula-based date-range query. Paginates past Airtable's 100-per-page limit. */
export async function listAllTasks(): Promise<AirtableRecord<TaskFields>[]> {
  const all: AirtableRecord<TaskFields>[] = [];
  let offset: string | undefined;
  do {
    const params = [withFieldIdParams(["pageSize=100"])];
    if (offset) params.push(`offset=${offset}`);
    const res = await airtableFetch<{
      records: AirtableRecord<TaskFields>[];
      offset?: string;
    }>(TABLES.tasks, `?${params.join("&")}`);
    all.push(...res.records);
    offset = res.offset;
  } while (offset);
  return all;
}

/** The only write path from the Planner UI — everything else on a Task is set by the marketing agent and stays read-only here. */
export async function updateTaskStatus(
  recordId: string,
  status: string
): Promise<AirtableRecord<TaskFields>> {
  return airtableFetch<AirtableRecord<TaskFields>>(
    TABLES.tasks,
    `/${recordId}?${withFieldIdParams()}`,
    {
      method: "PATCH",
      body: JSON.stringify({ fields: { [FIELDS.tasks.status]: status }, typecast: true }),
    }
  );
}
```

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no output (no errors).

Run: `npx eslint lib/airtable.ts`
Expected: no output (no errors).

- [ ] **Step 6: Verify listAllTasks and updateTaskStatus against the real base**

Run this from the project root (loads `DATABASE_URL`-style env parsing already used elsewhere in this repo, but here only `AIRTABLE_API_KEY` is needed):

```bash
node --input-type=module <<'EOF'
import { readFileSync } from "fs";
const envText = readFileSync(".env.local", "utf8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!m) continue;
  let value = m[2].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
  process.env[m[1]] = value;
}
const { listAllTasks } = await import("./lib/airtable.ts");
const tasks = await listAllTasks();
console.log(tasks.length, "tasks");
console.log(JSON.stringify(tasks[0], null, 2));
EOF
```

Expected: prints `4 tasks` (or however many currently exist) and the first record's fields, keyed by field ID, including a `fldfUMyCHtx5fF3du` status value.

(If this errors with an import/TS-loader issue because Node can't run a `.ts` file directly, skip this step — Step 7's typecheck already proves the function compiles, and Task 2's action will be exercised live in the browser in Task 4.)

- [ ] **Step 7: Commit**

```bash
git add lib/airtable.ts
git commit -m "Add Tasks table support to Airtable data layer"
```

---

### Task 2: Server actions for the Planner

**Files:**
- Modify: `app/actions.ts`

**Interfaces:**
- Consumes: `listAllTasks`, `updateTaskStatus`, `FIELDS`, `TaskFields` from `@/lib/airtable` (Task 1). `getContentInventoryRecords` from `@/lib/airtable` (already imported in this file).
- Produces: `export type PlannerTask = {id: string; name: string; date: string | null; channel: string | null; status: string | null; fullContent: string | null; thumbnailUrl: string | null}`, `listTasksAction(): Promise<PlannerTask[]>`, `updateTaskStatusAction(taskId: string, status: string): Promise<string | null>`.

- [ ] **Step 1: Import the new lib/airtable exports**

In `app/actions.ts`, find the import block from `@/lib/airtable` (it currently imports `FIELDS`, `createCopyRecord`, `createRawClipLibraryRecord`, etc.) and add `listAllTasks` and `updateTaskStatus` to it, alphabetically among the existing names:

```ts
import {
  FIELDS,
  createCopyRecord,
  createRawClipLibraryRecord,
  deleteRawClipLibraryRecord,
  getContentInventoryRecords,
  getCopiesRecords,
  getRawClipLibraryRecord,
  linkCopyToRawClip,
  listAllRawClipLibraryRecords,
  listAllTasks,
  searchCopies,
  searchRawClipLibrary,
  updateRawClipLibraryRecord,
  updateTaskStatus,
} from "@/lib/airtable";
```

- [ ] **Step 2: Add PlannerTask type and listTasksAction**

At the end of `app/actions.ts`, after `mergeRawClipRecordsAction`, add:

```ts

export type PlannerTask = {
  id: string;
  name: string;
  date: string | null;
  channel: string | null;
  status: string | null;
  fullContent: string | null;
  thumbnailUrl: string | null;
};

/** All Tasks for the Planner page. TikTok-channel tasks get a thumbnail resolved from their linked Content Inventory record — the only card type that shows one, since Instagram/newsletter tasks don't reliably have a Content Inventory link yet. */
export async function listTasksAction(): Promise<PlannerTask[]> {
  await requireSession();
  const tasks = await listAllTasks();

  const tikTokContentInventoryIds = [
    ...new Set(
      tasks
        .filter((t) => t.fields[FIELDS.tasks.channel] === "TikTok")
        .flatMap((t) => t.fields[FIELDS.tasks.contentInventoryLink] ?? [])
    ),
  ];
  const contentInventoryRecords = await getContentInventoryRecords(tikTokContentInventoryIds);
  const thumbnailByContentInventoryId = new Map(
    contentInventoryRecords.map((r) => [
      r.id,
      r.fields[FIELDS.contentInventory.thumbnail]?.[0]?.thumbnails?.small?.url ??
        r.fields[FIELDS.contentInventory.thumbnail]?.[0]?.url ??
        null,
    ])
  );

  return tasks.map((t) => {
    const linkedContentInventoryId = t.fields[FIELDS.tasks.contentInventoryLink]?.[0];
    return {
      id: t.id,
      name: t.fields[FIELDS.tasks.name],
      date: t.fields[FIELDS.tasks.date] ?? null,
      channel: t.fields[FIELDS.tasks.channel] ?? null,
      status: t.fields[FIELDS.tasks.status] ?? null,
      fullContent: t.fields[FIELDS.tasks.fullContent] ?? null,
      thumbnailUrl: linkedContentInventoryId
        ? (thumbnailByContentInventoryId.get(linkedContentInventoryId) ?? null)
        : null,
    };
  });
}

/** The only write path from the Planner UI. Returns the new status so the caller can update local state without refetching. */
export async function updateTaskStatusAction(taskId: string, status: string): Promise<string | null> {
  await requireSession();
  const updated = await updateTaskStatus(taskId, status);
  return updated.fields[FIELDS.tasks.status] ?? null;
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx eslint app/actions.ts`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add app/actions.ts
git commit -m "Add listTasksAction and updateTaskStatusAction for the Planner"
```

---

### Task 3: Sidebar entry point

**Files:**
- Modify: `components/Sidebar.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `Sidebar`'s `active` prop now accepts `"library" | "rawClips" | "planner"`.

- [ ] **Step 1: Remove "לוח שנה" from the stubbed nav list**

In `components/Sidebar.tsx`, change:

```ts
const STUBBED_NAV = [
  { icon: "insert_chart", label: "אנליטיקה" },
  { icon: "calendar_month", label: "לוח שנה" },
  { icon: "sync", label: "אינטגרציות" },
  { icon: "settings", label: "הגדרות" },
];
```

to:

```ts
const STUBBED_NAV = [
  { icon: "insert_chart", label: "אנליטיקה" },
  { icon: "sync", label: "אינטגרציות" },
  { icon: "settings", label: "הגדרות" },
];
```

- [ ] **Step 2: Widen the active prop type**

Change:

```ts
export async function Sidebar({
  active = "library",
}: {
  active?: "library" | "rawClips";
}) {
```

to:

```ts
export async function Sidebar({
  active = "library",
}: {
  active?: "library" | "rawClips" | "planner";
}) {
```

- [ ] **Step 3: Add the real planner Link**

Right after the "איתור כפילויות" `Link` (the one with `href="/raw-clips"`) and before `{STUBBED_NAV.map((item) => (`, add:

```tsx
        <Link
          className={
            active === "planner"
              ? "flex items-center gap-3 rounded bg-primary/10 px-4 py-3 font-bold text-primary transition-colors"
              : "flex items-center gap-3 rounded px-4 py-3 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
          }
          href="/planner"
        >
          <span className="material-symbols-outlined">calendar_month</span>
          <span className="text-sm">לוח שנה</span>
        </Link>
```

- [ ] **Step 4: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx eslint components/Sidebar.tsx`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add components/Sidebar.tsx
git commit -m "Add real sidebar link for the Planner page"
```

---

### Task 4: PlannerCalendar component and /planner page

**Files:**
- Create: `app/planner/page.tsx`
- Create: `components/PlannerCalendar.tsx`

**Interfaces:**
- Consumes: `listTasksAction`, `updateTaskStatusAction`, `PlannerTask` from `@/app/actions` (Task 2). `OPTIONS` from `@/lib/airtable` (Task 1, for `taskStatus`). `Sidebar` from `@/components/Sidebar` (Task 3). `TopBar` from `@/components/TopBar`. `TikTokIcon`, `InstagramIcon`, `WhatsAppIcon` from `@/components/icons`.
- Produces: `PlannerCalendar({initialTasks}: {initialTasks: PlannerTask[]})` — self-contained, no props consumed by later tasks (this is the last task).

- [ ] **Step 1: Create the page**

Create `app/planner/page.tsx`:

```tsx
import { listTasksAction } from "@/app/actions";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { PlannerCalendar } from "@/components/PlannerCalendar";

export const dynamic = "force-dynamic";

export default async function PlannerPage() {
  const tasks = await listTasksAction();

  return (
    <>
      <Sidebar active="planner" />
      <TopBar />
      <main className="mr-64 mt-16 min-h-[calc(100vh-64px)] bg-background p-8">
        <PlannerCalendar initialTasks={tasks} />
      </main>
    </>
  );
}
```

- [ ] **Step 2: Create PlannerCalendar.tsx**

Create `components/PlannerCalendar.tsx`:

```tsx
"use client";

import { useMemo, useState, useTransition } from "react";
import { updateTaskStatusAction, type PlannerTask } from "@/app/actions";
import { OPTIONS } from "@/lib/airtable";
import { InstagramIcon, TikTokIcon, WhatsAppIcon } from "@/components/icons";

const DAY_LABELS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const MONTH_LABELS = [
  "בינואר", "בפברואר", "במרץ", "באפריל", "במאי", "ביוני",
  "ביולי", "באוגוסט", "בספטמבר", "באוקטובר", "בנובמבר", "בדצמבר",
];

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, n: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + n);
  return next;
}

function startOfWeek(date: Date): Date {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  return start;
}

function formatWeekRangeLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const startLabel = `${weekStart.getDate()}`;
  const endLabel = `${weekEnd.getDate()} ${MONTH_LABELS[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`;
  return `${startLabel}–${endLabel}`;
}

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  "Not Started": { bg: "bg-surface-container-highest", fg: "text-on-surface-variant" },
  "In Review": { bg: "bg-primary-container", fg: "text-on-primary-container" },
  Approved: { bg: "bg-tertiary-container", fg: "text-on-tertiary-container" },
  Cancelled: { bg: "bg-error-container", fg: "text-on-error-container" },
  "Posted/Sent": { bg: "bg-secondary-container", fg: "text-on-secondary-container" },
};

function StatusPill({
  status,
  onCycle,
  disabled,
}: {
  status: string | null;
  onCycle: (next: string) => void;
  disabled: boolean;
}) {
  const current = status ?? "Not Started";
  const style = STATUS_STYLE[current] ?? STATUS_STYLE["Not Started"];
  const label = OPTIONS.taskStatus.find((s) => s.value === current)?.label ?? current;

  function cycle() {
    const options = OPTIONS.taskStatus;
    const currentIndex = options.findIndex((s) => s.value === current);
    const next = options[(currentIndex + 1) % options.length];
    onCycle(next.value);
  }

  return (
    <button
      onClick={cycle}
      disabled={disabled}
      className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold transition-opacity disabled:opacity-60 ${style.bg} ${style.fg}`}
    >
      {label}
    </button>
  );
}

function ExpandableContent({ text }: { text: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!text) return null;
  const preview = text.length > 80 ? text.slice(0, 80) + "..." : text;
  return (
    <div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-on-surface-variant">
        {expanded ? text : preview}
      </p>
      {text.length > 80 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-bold text-primary hover:underline"
        >
          {expanded ? "הצג פחות" : "הצג עוד"}
        </button>
      )}
    </div>
  );
}

export function PlannerCalendar({ initialTasks }: { initialTasks: PlannerTask[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [saving, startSaving] = useTransition();

  const weekTasks = useMemo(() => {
    const start = weekStart;
    const end = addDays(weekStart, 6);
    return tasks.filter((t) => {
      if (!t.date) return false;
      const date = parseDateKey(t.date);
      return date >= start && date <= end;
    });
  }, [tasks, weekStart]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  function updateStatus(taskId: string, status: string) {
    startSaving(async () => {
      const newStatus = await updateTaskStatusAction(taskId, status);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));
    });
  }

  const tikTokTasks = weekTasks.filter((t) => t.channel === "TikTok");
  const instagramTasks = weekTasks.filter((t) => t.channel === "Instagram");
  const newsletterTasks = weekTasks.filter((t) => t.channel === "Rav-Masar");
  const otherTasks = weekTasks.filter(
    (t) => !["TikTok", "Instagram", "Rav-Masar"].includes(t.channel ?? "")
  );

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-outline-variant bg-surface-container-lowest p-6">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <h2 className="text-headline-sm font-headline-sm text-on-surface">לוח זמנים שבועי</h2>
            <div className="flex rounded-full bg-surface-container-low p-1">
              <span className="rounded-full bg-surface-container-lowest px-4 py-1 text-xs font-bold text-primary shadow-sm">
                שבועי
              </span>
              <span
                className="cursor-not-allowed rounded-full px-4 py-1 text-xs text-on-surface-variant/50"
                title="תצוגה חודשית תתווסף בהמשך"
              >
                חודשי
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekStart((w) => addDays(w, -7))}
              className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container-high"
              aria-label="שבוע קודם"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
            <button
              onClick={() => setWeekStart(startOfWeek(new Date()))}
              className="rounded-full border border-outline-variant px-3 py-1 text-xs font-bold text-on-surface-variant hover:text-on-surface"
            >
              היום
            </button>
            <span className="text-sm text-on-surface-variant">{formatWeekRangeLabel(weekStart)}</span>
            <button
              onClick={() => setWeekStart((w) => addDays(w, 7))}
              className="rounded-full p-1.5 text-on-surface-variant hover:bg-surface-container-high"
              aria-label="שבוע הבא"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, i) => {
            const dateKey = toDateKey(day);
            const dayTasks = weekTasks.filter((t) => t.date === dateKey);
            return (
              <div key={dateKey} className="rounded-2xl bg-surface-container-low p-2.5">
                <div className="mb-1 text-[10px] text-on-surface-variant/60">{DAY_LABELS[i]}</div>
                <div className="mb-2 text-sm font-bold text-on-surface">{day.getDate()}</div>
                {dayTasks.map((t) => (
                  <div
                    key={t.id}
                    className="mb-1 truncate rounded bg-primary-container px-1.5 py-1 text-[10px] text-on-primary-container"
                    title={t.name}
                  >
                    {t.name}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>

      {tikTokTasks.length > 0 && (
        <section className="rounded-[32px] bg-surface-container-highest p-6">
          <div className="mb-5 flex items-center gap-2.5">
            <TikTokIcon className="h-6 w-6 text-primary" />
            <h3 className="text-headline-sm font-headline-sm text-on-surface">לוח שידורים טיקטוק</h3>
          </div>
          <div className="space-y-3">
            {tikTokTasks.map((t) => (
              <div key={t.id} className="flex gap-4 rounded-2xl bg-surface-container-lowest p-5">
                {t.thumbnailUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={t.thumbnailUrl}
                    alt={t.name}
                    className="h-20 w-14 shrink-0 rounded-lg object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="text-sm font-bold text-primary">{t.name}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-[11px] text-on-surface-variant">
                        {t.date ? `${DAY_LABELS[parseDateKey(t.date).getDay()]} ${parseDateKey(t.date).getDate()}` : ""}
                      </span>
                      <StatusPill status={t.status} onCycle={(s) => updateStatus(t.id, s)} disabled={saving} />
                    </div>
                  </div>
                  <ExpandableContent text={t.fullContent} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {instagramTasks.length > 0 && (
        <section className="space-y-3">
          {instagramTasks.map((t) => (
            <div key={t.id} className="rounded-[32px] border border-outline-variant bg-surface-container-lowest p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <InstagramIcon className="h-6 w-6 text-primary" />
                  <h3 className="text-headline-sm font-headline-sm text-on-surface">{t.name}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-on-surface-variant">
                    {t.date ? `${DAY_LABELS[parseDateKey(t.date).getDay()]} ${parseDateKey(t.date).getDate()}` : ""}
                  </span>
                  <StatusPill status={t.status} onCycle={(s) => updateStatus(t.id, s)} disabled={saving} />
                </div>
              </div>
              <ExpandableContent text={t.fullContent} />
            </div>
          ))}
        </section>
      )}

      {newsletterTasks.length > 0 && (
        <section className="rounded-[32px] bg-surface-container p-6">
          <div className="mb-5 flex items-center gap-2.5">
            <span className="material-symbols-outlined text-2xl text-primary">mail</span>
            <h3 className="text-headline-sm font-headline-sm text-on-surface">ניוזלטר</h3>
          </div>
          <div className="space-y-3">
            {newsletterTasks.map((t) => (
              <div key={t.id} className="rounded-[24px] bg-surface-container-lowest p-6">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-primary">
                      {t.date ? `${DAY_LABELS[parseDateKey(t.date).getDay()]} ${parseDateKey(t.date).getDate()}` : ""}
                    </span>
                    <h4 className="mt-0.5 text-base font-bold text-on-surface">{t.name}</h4>
                  </div>
                  <StatusPill status={t.status} onCycle={(s) => updateStatus(t.id, s)} disabled={saving} />
                </div>
                <ExpandableContent text={t.fullContent} />
              </div>
            ))}
          </div>
        </section>
      )}

      {otherTasks.length > 0 && (
        <section className="space-y-3">
          {otherTasks.map((t) => (
            <div key={t.id} className="rounded-[32px] border border-outline-variant bg-surface-container-lowest p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  {t.channel?.startsWith("WhatsApp") ? (
                    <WhatsAppIcon className="h-6 w-6 text-primary" />
                  ) : (
                    <span className="material-symbols-outlined text-2xl text-primary">visibility</span>
                  )}
                  <div>
                    <h3 className="text-headline-sm font-headline-sm text-on-surface">{t.name}</h3>
                    <span className="text-[11px] text-on-surface-variant">{t.channel}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-on-surface-variant">
                    {t.date ? `${DAY_LABELS[parseDateKey(t.date).getDay()]} ${parseDateKey(t.date).getDate()}` : ""}
                  </span>
                  <StatusPill status={t.status} onCycle={(s) => updateStatus(t.id, s)} disabled={saving} />
                </div>
              </div>
              <ExpandableContent text={t.fullContent} />
            </div>
          ))}
        </section>
      )}

      {weekTasks.length === 0 && (
        <div className="rounded-[32px] border border-outline-variant bg-surface-container-lowest p-10 text-center text-sm text-on-surface-variant">
          אין תוכניות לשבוע זה
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx eslint app/planner/page.tsx components/PlannerCalendar.tsx`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add app/planner/page.tsx components/PlannerCalendar.tsx
git commit -m "Add Planner page: weekly calendar with per-channel content cards"
```

- [ ] **Step 5: Manual browser verification**

Start the dev server (ask before touching port 3000 if something else is already listening on it — check with the project's established process first), then in the browser:

1. Navigate to `/`, click "לוח שנה" in the sidebar — confirm it navigates to `/planner` and highlights as active (no longer shows "בקרוב").
2. On `/planner`, confirm the current week's real Tasks render. As of this plan's writing there are 4 real Tasks (two TikTok, one Instagram, one Newsletter) — depending on today's date they may or may not fall in the default (current) week; use the prev/next week arrows and confirm they eventually appear, each under the right card group with the right channel icon.
3. Confirm the two TikTok cards show a thumbnail image (pulled from their linked Content Inventory record) — if a given task has no linked Content Inventory record or that record has no thumbnail attachment, confirm the card still renders correctly without one (no broken image, no layout break).
4. Click "הצג עוד" on a Full Content preview; confirm it expands to the complete text, and "הצג פחות" collapses it back.
5. Click a status pill; confirm it cycles to the next status, the color changes accordingly, and reloading the page shows the change persisted (check it lands correctly in Airtable too, via the Airtable UI or an MCP `list_records_for_table` call).
6. Cycle a status all the way to "Cancelled" specifically — confirm this works, proving the user's manually-added Airtable choice matches the value this code sends (`"Cancelled"` exactly). If it 422s or silently fails to stick, the Airtable choice name doesn't match — surface this to the user rather than guessing at a fix.
7. Click "היום" after navigating away; confirm it returns to the current week.
8. Confirm a channel with zero tasks in the current week renders no card/section for that channel (not an empty one).
