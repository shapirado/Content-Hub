"use client";

import { useState, useTransition, useMemo } from "react";
import type { ContentTask, Event } from "@/lib/neon";
import type { ContentTaskPatch } from "@/lib/neon";
import { updateContentTaskAction, deleteContentTaskAction } from "@/app/actions";

// ── Date helpers ─────────────────────────────────────────────────────────────

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

const HE_DAY_SHORT = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];
const HE_MONTH = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

function formatDayHeader(d: Date): string {
  return `${HE_DAY_SHORT[d.getDay()]}, ${d.getDate()} ב${HE_MONTH[d.getMonth()]}`;
}

function formatWeekLabel(start: Date): string {
  const end = addDays(start, 6);
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}–${end.getDate()} ב${HE_MONTH[start.getMonth()]} ${start.getFullYear()}`;
  }
  return `${start.getDate()} ב${HE_MONTH[start.getMonth()]} – ${end.getDate()} ב${HE_MONTH[end.getMonth()]} ${end.getFullYear()}`;
}

function daysUntil(eventDateKey: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ev = parseDateKey(eventDateKey);
  return Math.round((ev.getTime() - today.getTime()) / 86400000);
}

// ── Event colour ──────────────────────────────────────────────────────────────

const PRODUCT_COLOR: Record<string, string> = {
  "פשוט לאהוב": "bg-rose-100 text-rose-700 border-rose-200",
  weekend_retreat: "bg-amber-100 text-amber-700 border-amber-200",
  life_alignment_course: "bg-violet-100 text-violet-700 border-violet-200",
  large_event: "bg-sky-100 text-sky-700 border-sky-200",
};

function eventColor(productType: string): string {
  return PRODUCT_COLOR[productType] ?? "bg-surface-container text-on-surface-variant border-outline-variant";
}

// ── Platform icons ────────────────────────────────────────────────────────────

const PLATFORM_ICON: Record<string, string> = {
  tiktok: "smart_display",
  instagram: "photo_camera",
  newsletter: "mail",
};

// ── Status ────────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  ai_draft: "טיוטת AI",
  pending_review: "ממתינה",
  approved: "אושרה",
  posted: "פורסמה",
};

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  ai_draft:       { bg: "bg-surface-container-low",  fg: "text-on-surface-variant" },
  pending_review: { bg: "bg-amber-100",               fg: "text-amber-800" },
  approved:       { bg: "bg-green-100",               fg: "text-green-800" },
  posted:         { bg: "bg-primary/10",              fg: "text-primary" },
};

const STATUS_CYCLE: Record<string, ContentTask["status"]> = {
  ai_draft:       "pending_review",
  pending_review: "approved",
  approved:       "posted",
  posted:         "ai_draft",
};

// ── Event countdown chip ──────────────────────────────────────────────────────

function EventCountdownChip({ event }: { event: Event }) {
  const days = daysUntil(event.event_date);
  if (days < 0) return null;
  const label =
    days === 0 ? "היום!" :
    days === 1 ? "מחר" :
    days < 7   ? `${days} ימים ל${event.name}` :
    days < 14  ? `שבוע ל${event.name}` :
    days < 30  ? `${Math.round(days / 7)} שבועות ל${event.name}` :
                 `${Math.round(days / 30)} חודשים ל${event.name}`;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-xs font-bold ${eventColor(event.product_type)}`}>
      <span className="material-symbols-outlined text-sm">event</span>
      {label}
    </span>
  );
}

// ── Task card ─────────────────────────────────────────────────────────────────

function PlanTaskCard({
  task,
  onStatusCycle,
  onUpdate,
  onDelete,
  disabled,
}: {
  task: ContentTask;
  onStatusCycle: (id: string, next: ContentTask["status"]) => void;
  onUpdate: (id: string, patch: ContentTaskPatch) => void;
  onDelete: (id: string) => void;
  disabled: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    hook: task.hook ?? "",
    caption: task.caption ?? "",
    hashtags: task.hashtags ?? "",
  });

  const style = STATUS_STYLE[task.status] ?? STATUS_STYLE.ai_draft;
  const icon = PLATFORM_ICON[task.platform] ?? "article";

  function handleSave() {
    onUpdate(task.id, {
      hook: draft.hook || null,
      caption: draft.caption || null,
      hashtags: draft.hashtags || null,
      canva_url: task.canva_url,
      live_url: task.live_url,
      status: task.status,
      scheduled_date: task.scheduled_date,
      event_id: task.event_id,
    });
    setEditing(false);
  }

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-3 text-right">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          onClick={() => onStatusCycle(task.id, STATUS_CYCLE[task.status] ?? "ai_draft")}
          disabled={disabled}
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold transition-opacity disabled:opacity-60 ${style.bg} ${style.fg}`}
        >
          {STATUS_LABEL[task.status] ?? task.status}
        </button>
        <span className="material-symbols-outlined text-sm text-on-surface-variant">{icon}</span>
      </div>

      {!editing ? (
        <>
          {task.hook && <p className="mb-1 text-sm font-bold italic text-on-surface">{task.hook}</p>}
          {task.caption && (
            <p className="line-clamp-3 text-xs leading-relaxed text-on-surface-variant">{task.caption}</p>
          )}
          {task.hashtags && (
            <p className="mt-1 line-clamp-1 text-[10px] text-primary/70">{task.hashtags}</p>
          )}
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={() => {
                setDraft({ hook: task.hook ?? "", caption: task.caption ?? "", hashtags: task.hashtags ?? "" });
                setEditing(true);
              }}
              disabled={disabled}
              className="text-[11px] font-bold text-primary hover:underline disabled:opacity-60"
            >
              עריכה
            </button>
            <button
              onClick={() => { if (confirm("למחוק את המשימה?")) onDelete(task.id); }}
              disabled={disabled}
              className="text-[11px] font-bold text-error hover:underline disabled:opacity-60"
            >
              מחיקה
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <textarea
            value={draft.hook}
            onChange={(e) => setDraft((p) => ({ ...p, hook: e.target.value }))}
            placeholder="הוק"
            rows={2}
            className="w-full resize-none rounded-lg border border-outline-variant bg-surface-container-low px-2 py-1.5 text-right text-sm text-on-surface outline-none focus:border-primary"
          />
          <textarea
            value={draft.caption}
            onChange={(e) => setDraft((p) => ({ ...p, caption: e.target.value }))}
            placeholder="כיתוב"
            rows={4}
            className="w-full resize-none rounded-lg border border-outline-variant bg-surface-container-low px-2 py-1.5 text-right text-sm text-on-surface outline-none focus:border-primary"
          />
          <input
            value={draft.hashtags}
            onChange={(e) => setDraft((p) => ({ ...p, hashtags: e.target.value }))}
            placeholder="#hashtags"
            className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-2 py-1.5 text-right text-sm text-on-surface outline-none focus:border-primary"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={disabled}
              className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-on-primary disabled:opacity-60"
            >
              שמירה
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-full border border-outline-variant px-3 py-1 text-xs font-bold text-on-surface-variant"
            >
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Day column ────────────────────────────────────────────────────────────────

const PLATFORM_ORDER: ContentTask["platform"][] = ["tiktok", "instagram", "newsletter"];

function DayColumn({
  date,
  events,
  tasks,
  onStatusCycle,
  onUpdate,
  onDelete,
  disabled,
}: {
  date: Date;
  events: Event[];
  tasks: ContentTask[];
  onStatusCycle: (id: string, next: ContentTask["status"]) => void;
  onUpdate: (id: string, patch: ContentTaskPatch) => void;
  onDelete: (id: string) => void;
  disabled: boolean;
}) {
  const today = toDateKey(new Date());
  const key = toDateKey(date);
  const isToday = key === today;
  const sorted = [...tasks].sort(
    (a, b) => PLATFORM_ORDER.indexOf(a.platform) - PLATFORM_ORDER.indexOf(b.platform)
  );

  return (
    <div className={`min-h-[120px] rounded-2xl border p-3 ${isToday ? "border-primary/40 bg-primary/5" : "border-outline-variant bg-surface-container-lowest/50"}`}>
      <p className={`mb-2 text-right text-[11px] font-bold ${isToday ? "text-primary" : "text-on-surface-variant"}`}>
        {formatDayHeader(date)}
      </p>
      {events.map((ev) => (
        <div key={ev.id} className={`mb-1.5 rounded-xl border px-2 py-1 text-right text-[10px] font-bold ${eventColor(ev.product_type)}`}>
          <span className="material-symbols-outlined mr-1 align-middle text-sm">event</span>
          {ev.name}
        </div>
      ))}
      <div className="space-y-2">
        {sorted.map((task) => (
          <PlanTaskCard
            key={task.id}
            task={task}
            onStatusCycle={onStatusCycle}
            onUpdate={onUpdate}
            onDelete={onDelete}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main PlanCalendar component ───────────────────────────────────────────────

export function PlanCalendar({
  initialTasks,
  initialEvents,
  initialWeekStartKey,
  onGeneratePlanClick,
}: {
  initialTasks: ContentTask[];
  initialEvents: Event[];
  initialWeekStartKey: string;
  onGeneratePlanClick: () => void;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [weekStart, setWeekStart] = useState(() => parseDateKey(initialWeekStartKey));
  const [saving, startSaving] = useTransition();

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const weekTasks = useMemo(() => {
    const end = addDays(weekStart, 6);
    return tasks.filter((t) => {
      const d = parseDateKey(t.scheduled_date);
      return d >= weekStart && d <= end;
    });
  }, [tasks, weekStart]);

  const upcomingEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return [...initialEvents]
      .filter((e) => parseDateKey(e.event_date) >= today)
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
      .slice(0, 4);
  }, [initialEvents]);

  function handleStatusCycle(id: string, next: ContentTask["status"]) {
    startSaving(async () => {
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      await updateContentTaskAction(id, {
        hook: task.hook,
        caption: task.caption,
        hashtags: task.hashtags,
        canva_url: task.canva_url,
        live_url: task.live_url,
        status: next,
        scheduled_date: task.scheduled_date,
        event_id: task.event_id,
      });
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: next } : t)));
    });
  }

  function handleUpdate(id: string, patch: ContentTaskPatch) {
    startSaving(async () => {
      const updated = await updateContentTaskAction(id, patch);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    });
  }

  function handleDelete(id: string) {
    startSaving(async () => {
      await deleteContentTaskAction(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    });
  }

  return (
    <div className="space-y-5">
      {upcomingEvents.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {upcomingEvents.map((ev) => (
            <EventCountdownChip key={ev.id} event={ev} />
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary"
          >
            <span className="material-symbols-outlined text-lg">chevron_right</span>
          </button>
          <span className="text-sm font-bold text-on-surface">{formatWeekLabel(weekStart)}</span>
          <button
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary"
          >
            <span className="material-symbols-outlined text-lg">chevron_left</span>
          </button>
        </div>
        <button
          onClick={onGeneratePlanClick}
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:bg-primary/90"
        >
          <span className="material-symbols-outlined text-sm">auto_awesome</span>
          הפקת תוכנית
        </button>
      </div>

      <div className="grid grid-cols-7 gap-3">
        {days.map((day) => {
          const key = toDateKey(day);
          return (
            <DayColumn
              key={key}
              date={day}
              events={initialEvents.filter((e) => e.event_date === key)}
              tasks={weekTasks.filter((t) => t.scheduled_date === key)}
              onStatusCycle={handleStatusCycle}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              disabled={saving}
            />
          );
        })}
      </div>

      {weekTasks.length === 0 && (
        <p className="text-center text-sm text-on-surface-variant">
          אין משימות לשבוע זה. לחצי על &ldquo;הפקת תוכנית&rdquo; כדי ליצור טיוטות.
        </p>
      )}
    </div>
  );
}
