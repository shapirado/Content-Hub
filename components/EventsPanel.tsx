"use client";

import { useState, useTransition, useMemo } from "react";
import type { Event } from "@/lib/neon";
import type { EventInput } from "@/lib/neon";
import { DatePicker as AntDatePicker, ConfigProvider } from "antd";
import he_IL from "antd/locale/he_IL";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/he";
import updateLocale from "dayjs/plugin/updateLocale";

dayjs.extend(updateLocale);
dayjs.locale("he");
dayjs.updateLocale("he", { weekStart: 0 });
import {
  createEventAction,
  updateEventAction,
  deleteEventAction,
} from "@/app/actions";

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  nature_retreat: "פשוט לאהוב",
  weekend_retreat: "סוף שבוע של שינוי",
  life_alignment_course: "קורס מטפלים",
  workshop: "סדנה",
  large_event: "אירוע גדול",
  retreat_abroad: "ריטריט חול",
};

const PRODUCT_TYPE_OPTIONS = Object.keys(PRODUCT_TYPE_LABELS);

const PRODUCT_COLOR: Record<string, string> = {
  nature_retreat: "bg-rose-100 text-rose-700",
  weekend_retreat: "bg-amber-100 text-amber-700",
  life_alignment_course: "bg-sky-100 text-sky-700",
  workshop: "bg-teal-100 text-teal-700",
  large_event: "bg-sky-100 text-sky-700",
  retreat_abroad: "bg-amber-100 text-amber-800",
};

function daysUntil(dateKey: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = dateKey.split("-").map(Number);
  const ev = new Date(y, m - 1, d);
  return Math.round((ev.getTime() - today.getTime()) / 86400000);
}

const HE_MONTH = ["ינואר","פברואר","מרץ","אפריל","מאי","יוני","יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר"];

function formatEventDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return `${d} ב${HE_MONTH[m - 1]} ${y}`;
}

const EMPTY_FORM: EventInput = {
  name: "",
  product_type: "nature_retreat",
  event_date: "",
  registration_link: null,
  target_headcount: null,
  price_early_bird: null,
  price_regular: null,
  location: null,
  notes: null,
};

function EventForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: EventInput;
  onSave: (data: EventInput) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<EventInput>(initial);
  const set = <K extends keyof EventInput>(k: K, v: EventInput[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.event_date) return;
    onSave(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-right">
      <div>
        <label className="mb-1 block text-xs font-bold text-on-surface-variant">שם האירוע *</label>
        <input
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          required
          className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-right text-sm text-on-surface outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-bold text-on-surface-variant">סוג *</label>
        <select
          value={form.product_type}
          onChange={(e) => set("product_type", e.target.value)}
          className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-right text-sm text-on-surface outline-none focus:border-primary"
        >
          {PRODUCT_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{PRODUCT_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-bold text-on-surface-variant">תאריך *</label>
        <ConfigProvider direction="rtl" locale={he_IL} theme={{ token: { borderRadius: 12, colorBorder: 'var(--color-outline-variant, #E2E8F0)', controlHeight: 40, colorPrimary: '#5a7a5a' } }}>
          <AntDatePicker
            format="DD/MM/YYYY"
            className="w-full"
            value={form.event_date ? dayjs(form.event_date, "YYYY-MM-DD") : null}
            onChange={(d: Dayjs | null) => set("event_date", d ? d.format("YYYY-MM-DD") : "")}
          />
        </ConfigProvider>
      </div>
      <div>
        <label className="mb-1 block text-xs font-bold text-on-surface-variant">מקום</label>
        <input
          value={form.location ?? ""}
          onChange={(e) => set("location", e.target.value || null)}
          className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-right text-sm text-on-surface outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-bold text-on-surface-variant">קישור לרישום</label>
        <input
          type="url"
          value={form.registration_link ?? ""}
          onChange={(e) => set("registration_link", e.target.value || null)}
          className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
          dir="ltr"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-bold text-on-surface-variant">מחיר Early Bird</label>
          <input
            type="number"
            min={0}
            value={form.price_early_bird ?? ""}
            onChange={(e) => set("price_early_bird", e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-on-surface-variant">מחיר רגיל</label>
          <input
            type="number"
            min={0}
            value={form.price_regular ?? ""}
            onChange={(e) => set("price_regular", e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-bold text-on-surface-variant">מספר משתתפים יעד</label>
        <input
          type="number"
          min={0}
          value={form.target_headcount ?? ""}
          onChange={(e) => set("target_headcount", e.target.value ? Number(e.target.value) : null)}
          className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-bold text-on-surface-variant">הערות</label>
        <textarea
          value={form.notes ?? ""}
          onChange={(e) => set("notes", e.target.value || null)}
          rows={3}
          className="w-full resize-none rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-right text-sm text-on-surface outline-none focus:border-primary"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-full bg-primary py-2 text-sm font-bold text-on-primary disabled:opacity-60"
        >
          {saving ? "שומרת..." : "שמירה"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-full border border-outline-variant py-2 text-sm font-bold text-on-surface-variant"
        >
          ביטול
        </button>
      </div>
    </form>
  );
}

export function EventsPanel({
  initialEvents,
  onEventsChange,
}: {
  initialEvents: Event[];
  onEventsChange: (events: Event[]) => void;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [modalMode, setModalMode] = useState<"none" | "add" | "edit">("none");
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [saving, startSaving] = useTransition();

  function updateAndNotify(next: Event[]) {
    const sorted = [...next].sort((a, b) => a.event_date.localeCompare(b.event_date));
    setEvents(sorted);
    onEventsChange(sorted);
  }

  function openAdd() {
    setEditingEvent(null);
    setModalMode("add");
  }

  function openEdit(ev: Event) {
    setEditingEvent(ev);
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode("none");
    setEditingEvent(null);
  }

  function handleSave(data: EventInput) {
    startSaving(async () => {
      try {
        if (modalMode === "add") {
          const created = await createEventAction(data);
          updateAndNotify([...events, created]);
        } else if (modalMode === "edit" && editingEvent) {
          const updated = await updateEventAction(editingEvent.id, data);
          updateAndNotify(events.map((e) => (e.id === editingEvent.id ? updated : e)));
        }
        closeModal();
      } catch (err) {
        console.error("Failed to save event:", err);
      }
    });
  }

  function handleDelete(ev: Event) {
    if (!confirm(`למחוק את "${ev.name}"?`)) return;
    startSaving(async () => {
      try {
        await deleteEventAction(ev.id);
        updateAndNotify(events.filter((e) => e.id !== ev.id));
      } catch (err) {
        console.error("Failed to delete event:", err);
      }
    });
  }

  const upcoming = events.filter((e) => daysUntil(e.event_date) >= 0);
  const past = events.filter((e) => daysUntil(e.event_date) < 0);

  return (
    <div className="rounded-3xl border border-outline-variant bg-surface-container-lowest p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-on-surface">אירועים</h2>
        <button
          onClick={openAdd}
          className="flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-on-primary"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          הוספה
        </button>
      </div>

      {events.length === 0 && (
        <p className="text-center text-xs text-on-surface-variant">אין אירועים עדיין.</p>
      )}

      <div className="space-y-2">
        {upcoming.map((ev) => {
          const days = daysUntil(ev.event_date);
          const countdown =
            days === 0 ? "היום!" :
            days === 1 ? "מחר" :
            days < 7   ? `עוד ${days} ימים` :
            days < 30  ? `עוד ${Math.round(days / 7)} שבועות` :
                         `עוד ${Math.round(days / 30)} חודשים`;
          return (
            <div key={ev.id} className="rounded-2xl border border-outline-variant bg-surface-container-low p-3 text-right">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-on-surface">{ev.name}</p>
                  <p className="text-[11px] text-on-surface-variant">{formatEventDate(ev.event_date)}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => openEdit(ev)}
                    disabled={saving}
                    title="עריכה"
                    className="text-on-surface-variant hover:text-primary disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                  <button
                    onClick={() => handleDelete(ev)}
                    disabled={saving}
                    title="מחיקה"
                    className="text-on-surface-variant hover:text-error disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-start gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${PRODUCT_COLOR[ev.product_type] ?? "bg-surface-container text-on-surface-variant"}`}>
                  {PRODUCT_TYPE_LABELS[ev.product_type] ?? ev.product_type}
                </span>
                <span className="text-[11px] font-bold text-primary">{countdown}</span>
              </div>
            </div>
          );
        })}

        {past.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-bold text-on-surface-variant">
              אירועים שעברו ({past.length})
            </summary>
            <div className="mt-2 space-y-1.5">
              {past.map((ev) => (
                <div key={ev.id} className="rounded-xl border border-outline-variant/50 p-2 text-right opacity-60">
                  <p className="text-xs font-bold text-on-surface">{ev.name}</p>
                  <p className="text-[10px] text-on-surface-variant">{formatEventDate(ev.event_date)}</p>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>

      {modalMode !== "none" && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 py-10">
          <div className="w-full max-w-md rounded-3xl bg-surface-container-low p-6">
            <h2 className="mb-4 text-right text-lg font-bold text-on-surface">
              {modalMode === "add" ? "הוספת אירוע" : "עריכת אירוע"}
            </h2>
            <EventForm
              initial={
                editingEvent
                  ? {
                      name: editingEvent.name,
                      product_type: editingEvent.product_type,
                      event_date: editingEvent.event_date,
                      registration_link: editingEvent.registration_link,
                      target_headcount: editingEvent.target_headcount,
                      price_early_bird: editingEvent.price_early_bird,
                      price_regular: editingEvent.price_regular,
                      location: editingEvent.location,
                      notes: editingEvent.notes,
                    }
                  : EMPTY_FORM
              }
              onSave={handleSave}
              onCancel={closeModal}
              saving={saving}
            />
          </div>
        </div>
      )}
    </div>
  );
}
