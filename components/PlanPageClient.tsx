"use client";

import { useState, useTransition } from "react";
import type { ContentTask, Event } from "@/lib/neon";
import { PlanCalendar } from "@/components/PlanCalendar";
import { EventsPanel } from "@/components/EventsPanel";
import { generateContentPlanAction, type GeneratePlanParams } from "@/app/actions";
import { DatePicker as AntDatePicker, ConfigProvider } from "antd";
import he_IL from "antd/locale/he_IL";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/he";
import updateLocale from "dayjs/plugin/updateLocale";

dayjs.extend(updateLocale);
dayjs.locale("he");
dayjs.updateLocale("he", { weekStart: 0 });

function AIPlannerModal({
  events,
  onGenerate,
  onClose,
  generating,
  error,
}: {
  events: Event[];
  onGenerate: (params: GeneratePlanParams) => void;
  onClose: () => void;
  generating: boolean;
  error: string | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const nextMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0)
    .toISOString()
    .slice(0, 10);

  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(nextMonth);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);

  function toggleEvent(id: string) {
    setSelectedEventIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const upcomingEvents = events.filter((e) => e.event_date >= today);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-3xl bg-surface-container-low p-6 text-right">
        <h2 className="mb-4 text-lg font-bold text-on-surface">הפקת תוכנית AI</h2>
        <div className="space-y-4">
          <ConfigProvider direction="rtl" locale={he_IL} theme={{ token: { borderRadius: 12, colorBorder: 'var(--color-outline-variant, #E2E8F0)', controlHeight: 40, colorPrimary: '#5a7a5a' } }}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-on-surface-variant">מ-</label>
                <AntDatePicker
                  format="DD/MM/YYYY"
                  className="w-full"
                  value={from ? dayjs(from, "YYYY-MM-DD") : null}
                  onChange={(d: Dayjs | null) => setFrom(d ? d.format("YYYY-MM-DD") : "")}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-bold text-on-surface-variant">עד-</label>
                <AntDatePicker
                  format="DD/MM/YYYY"
                  className="w-full"
                  value={to ? dayjs(to, "YYYY-MM-DD") : null}
                  onChange={(d: Dayjs | null) => setTo(d ? d.format("YYYY-MM-DD") : "")}
                />
              </div>
            </div>
          </ConfigProvider>
          {upcomingEvents.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-bold text-on-surface-variant">
                אירועים להדגשה (ריק = כל האירועים בטווח)
              </p>
              <div className="space-y-1.5">
                {upcomingEvents.map((ev) => (
                  <label key={ev.id} className="flex cursor-pointer items-center gap-2 text-right">
                    <input
                      type="checkbox"
                      checked={selectedEventIds.includes(ev.id)}
                      onChange={() => toggleEvent(ev.id)}
                      className="accent-primary"
                    />
                    <span className="text-sm text-on-surface">{ev.name}</span>
                    <span className="text-xs text-on-surface-variant">{ev.event_date}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          {error && (
            <p className="rounded-xl bg-error/10 px-3 py-2 text-sm text-error">{error}</p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onGenerate({ from, to, eventIds: selectedEventIds })}
              disabled={generating || !from || !to}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary py-2.5 text-sm font-bold text-on-primary disabled:opacity-60"
            >
              {generating ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-sm">autorenew</span>
                  מייצרת תוכנית...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm">auto_awesome</span>
                  הפקת תוכנית
                </>
              )}
            </button>
            <button
              onClick={onClose}
              disabled={generating}
              className="rounded-full border border-outline-variant px-4 py-2.5 text-sm font-bold text-on-surface-variant disabled:opacity-60"
            >
              ביטול
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlanPageClient({
  initialTasks,
  initialEvents,
  initialWeekStartKey,
}: {
  initialTasks: ContentTask[];
  initialEvents: Event[];
  initialWeekStartKey: string;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [tasks, setTasks] = useState(initialTasks);
  const [showAIModal, setShowAIModal] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [generating, startGenerating] = useTransition();

  function handleGenerate(params: GeneratePlanParams) {
    setPlanError(null);
    startGenerating(async () => {
      try {
        const newTasks = await generateContentPlanAction(params);
        setTasks((prev) => {
          const ids = new Set(prev.map((t) => t.id));
          return [...prev, ...newTasks.filter((t) => !ids.has(t.id))];
        });
        setShowAIModal(false);
      } catch (err) {
        setPlanError(err instanceof Error ? err.message : "שגיאה לא ידועה");
      }
    });
  }

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1">
        <PlanCalendar
          tasks={tasks}
          setTasks={setTasks}
          initialEvents={events}
          initialWeekStartKey={initialWeekStartKey}
          onGeneratePlanClick={() => setShowAIModal(true)}
        />
      </div>
      <div className="w-72 shrink-0">
        <EventsPanel initialEvents={events} onEventsChange={setEvents} />
      </div>
      {showAIModal && (
        <AIPlannerModal
          events={events}
          onGenerate={handleGenerate}
          onClose={() => setShowAIModal(false)}
          generating={generating}
          error={planError}
        />
      )}
    </div>
  );
}
