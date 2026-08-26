"use client";

import { useState } from "react";
import type { ContentTask, Event } from "@/lib/neon";
import { PlanCalendar } from "@/components/PlanCalendar";
import { EventsPanel } from "@/components/EventsPanel";

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

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1">
        <PlanCalendar
          initialTasks={tasks}
          initialEvents={events}
          initialWeekStartKey={initialWeekStartKey}
          onGeneratePlanClick={() => setShowAIModal(true)}
        />
        {showAIModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-96 rounded-3xl bg-surface-container-low p-6 text-right">
              <h2 className="mb-2 text-lg font-bold text-on-surface">הפקת תוכנית AI</h2>
              <p className="mb-4 text-sm text-on-surface-variant">תכונה זו תיושם בשלב הבא.</p>
              <button
                onClick={() => setShowAIModal(false)}
                className="rounded-full border border-outline-variant px-4 py-1.5 text-sm font-bold text-on-surface-variant"
              >
                סגירה
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="w-72 shrink-0">
        <EventsPanel
          initialEvents={events}
          onEventsChange={setEvents}
        />
      </div>
    </div>
  );
}
