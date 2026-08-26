"use client";

import type { Event } from "@/lib/neon";

export function EventsPanel({
  initialEvents: _initialEvents,
  onEventsChange: _onEventsChange,
}: {
  initialEvents: Event[];
  onEventsChange: (events: Event[]) => void;
}) {
  return (
    <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-4">
      <p className="text-sm font-bold text-on-surface">אירועים</p>
      <p className="mt-2 text-xs text-on-surface-variant">טוענת...</p>
    </div>
  );
}
