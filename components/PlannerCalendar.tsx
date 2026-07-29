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
          {expanded ? "הציגי פחות" : "הציגי עוד"}
        </button>
      )}
    </div>
  );
}

/** Hook (preserving an embedded alt-hook line break) + Hashtags as their own structured fields — Airtable now carries these separately instead of only inside Full Content's prose — followed by the still-useful expandable full text (overlay/CTA/source-clip context). */
function TaskContent({ task }: { task: PlannerTask }) {
  return (
    <>
      {task.hook && (
        <p className="mb-2 whitespace-pre-wrap text-sm font-bold text-on-surface">{task.hook}</p>
      )}
      {task.hashtags && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {task.hashtags
            .split(/\s+/)
            .filter(Boolean)
            .map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary"
              >
                {tag}
              </span>
            ))}
        </div>
      )}
      <ExpandableContent text={task.fullContent} />
    </>
  );
}

export function PlannerCalendar({
  initialTasks,
  initialWeekStartKey,
}: {
  initialTasks: PlannerTask[];
  initialWeekStartKey: string;
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [weekStart, setWeekStart] = useState(() => parseDateKey(initialWeekStartKey));
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

  const hasInstagram = instagramTasks.length > 0;
  const hasTikTok = tikTokTasks.length > 0;
  const hasNewsletter = newsletterTasks.length > 0;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-12 gap-8">
        <section
          className={`col-span-12 rounded-[32px] border border-outline-variant bg-surface-container-lowest p-6 ${hasInstagram ? "lg:col-span-8" : ""}`}
        >
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
                  {dayTasks.map((t) =>
                    t.clipUrl ? (
                      <a
                        key={t.id}
                        href={t.clipUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mb-1 block truncate rounded bg-primary-fixed px-1.5 py-1 text-[10px] text-on-primary-fixed hover:opacity-80"
                        title={t.name}
                      >
                        {t.name}
                      </a>
                    ) : (
                      <div
                        key={t.id}
                        className="mb-1 truncate rounded bg-primary-fixed px-1.5 py-1 text-[10px] text-on-primary-fixed"
                        title={t.name}
                      >
                        {t.name}
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {hasInstagram && (
          <section className="col-span-12 space-y-3 lg:col-span-4">
            {instagramTasks.map((t) => (
              <div key={t.id} className="rounded-[32px] border border-outline-variant bg-surface-container-lowest p-6">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <InstagramIcon className="h-6 w-6 text-primary" />
                    <h3 className="text-headline-sm font-headline-sm text-on-surface">{t.name}</h3>
                  </div>
                  <StatusPill status={t.status} onCycle={(s) => updateStatus(t.id, s)} disabled={saving} />
                </div>
                <span className="mb-3 block text-[11px] text-on-surface-variant">
                  {t.date ? `${DAY_LABELS[parseDateKey(t.date).getDay()]} ${parseDateKey(t.date).getDate()}` : ""}
                </span>
                <TaskContent task={t} />
              </div>
            ))}
          </section>
        )}
      </div>

      {(hasTikTok || hasNewsletter) && (
        <div className="grid grid-cols-12 gap-8">
          {hasTikTok && (
            <section
              className={`col-span-12 rounded-[32px] bg-surface-container-highest p-6 ${hasNewsletter ? "lg:col-span-6" : ""}`}
            >
              <div className="mb-5 flex items-center gap-2.5">
                <TikTokIcon className="h-6 w-6 text-primary" />
                <h3 className="text-headline-sm font-headline-sm text-on-surface">לוח שידורים טיקטוק</h3>
              </div>
              <div className="space-y-3">
                {tikTokTasks.map((t) => (
                  <div key={t.id} className="flex gap-4 rounded-2xl bg-surface-container-lowest p-5">
                    <div className="flex h-64 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-container-high">
                      {t.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.thumbnailUrl}
                          alt={t.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="material-symbols-outlined text-xl text-on-surface-variant/40">
                          movie
                        </span>
                      )}
                    </div>
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
                      <TaskContent task={t} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {hasNewsletter && (
            <section
              className={`col-span-12 rounded-[32px] bg-surface-container p-6 ${hasTikTok ? "lg:col-span-6" : ""}`}
            >
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
                    <TaskContent task={t} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
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
              <TaskContent task={t} />
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
