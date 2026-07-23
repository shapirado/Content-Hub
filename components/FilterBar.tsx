"use client";

import { useEffect, useRef, useState } from "react";
import { OPTIONS } from "@/lib/airtable";
import { PLATFORM_DISPLAY } from "@/lib/platforms";
import type { SortField, SortState } from "@/lib/types";

/** Sentinel filter value meaning "the field is empty/null" — distinct from "all". */
export const NONE_VALUE = "__none__";

export type Filters = {
  status: "all" | "draft" | "posted" | "unlinked";
  pillar: string;
  season: string;
  /** Empty = all. */
  platform: string[];
  /** Empty = all. */
  wardrobe: string[];
  tag: string;
  copies: "all" | "1" | "2" | "3+";
  usable: string;
};

export const DEFAULT_FILTERS: Filters = {
  status: "all",
  pillar: "all",
  season: "all",
  platform: [],
  wardrobe: [],
  tag: "all",
  copies: "all",
  usable: "all",
};

const STATUS_TABS: { key: Filters["status"]; label: string }[] = [
  { key: "all", label: "כל הקבצים" },
  { key: "unlinked", label: "טרם תויג" },
  { key: "draft", label: "טיוטות" },
  { key: "posted", label: "פורסם" },
];

const SORT_FIELDS: { key: SortField; label: string }[] = [
  { key: "title", label: "כותרת" },
  { key: "season", label: "עונה" },
  { key: "pillar", label: "פילר" },
  { key: "wardrobe", label: "צעיף" },
  { key: "tags", label: "תגיות" },
  { key: "date", label: "תאריך הוספה" },
];

export function FilterBar({
  filters,
  onChange,
  sort,
  onSortChange,
  count,
  contextTagOptions,
  viewMode,
  onViewModeChange,
  onExport,
  exporting,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  sort: SortState;
  onSortChange: (s: SortState) => void;
  count: number;
  contextTagOptions: string[];
  viewMode: "list" | "grid";
  onViewModeChange: (mode: "list" | "grid") => void;
  onExport: () => void;
  exporting: boolean;
}) {
  return (
    <section className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-4">
        <h2 className="text-headline-md font-headline-md text-on-surface">
          ספריית מדיה
        </h2>
        <span className="text-sm text-on-surface-variant">{count} פריטים</span>
        <div className="mx-2 h-8 w-px bg-outline-variant" />
        <div className="flex items-center gap-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onChange({ ...filters, status: tab.key })}
              className={
                filters.status === tab.key
                  ? "rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-on-primary"
                  : "rounded-full bg-surface-container-high px-4 py-1.5 text-xs text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface"
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={filters.season}
          onChange={(e) => onChange({ ...filters, season: e.target.value })}
          className="cursor-pointer appearance-none rounded border border-outline-variant bg-surface-container-lowest px-4 py-2 pl-10 text-xs text-on-surface shadow-sm focus:border-primary focus:ring-0"
        >
          <option value="all">עונה: הכל</option>
          <option value={NONE_VALUE}>לא נבחר</option>
          {OPTIONS.season.map((s) => (
            <option key={s.value} value={s.value}>
              {s.icon} {s.label}
            </option>
          ))}
        </select>

        <select
          value={filters.pillar}
          onChange={(e) => onChange({ ...filters, pillar: e.target.value })}
          className="cursor-pointer appearance-none rounded border border-outline-variant bg-surface-container-lowest px-4 py-2 pl-10 text-xs text-on-surface shadow-sm focus:border-primary focus:ring-0"
        >
          <option value="all">פילר: הכל</option>
          <option value={NONE_VALUE}>לא נבחר</option>
          {OPTIONS.pillar.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <PlatformMultiSelect
          selected={filters.platform}
          onChange={(platform) => onChange({ ...filters, platform })}
        />

        <WardrobeMultiSelect
          selected={filters.wardrobe}
          onChange={(wardrobe) => onChange({ ...filters, wardrobe })}
        />

        <select
          value={filters.copies}
          onChange={(e) => onChange({ ...filters, copies: e.target.value as Filters["copies"] })}
          className="cursor-pointer appearance-none rounded border border-outline-variant bg-surface-container-lowest px-4 py-2 pl-10 text-xs text-on-surface shadow-sm focus:border-primary focus:ring-0"
        >
          <option value="all">עותקים: הכל</option>
          <option value="1">עותק אחד</option>
          <option value="2">2 עותקים</option>
          <option value="3+">3+ עותקים</option>
        </select>

        <select
          value={filters.usable}
          onChange={(e) => onChange({ ...filters, usable: e.target.value })}
          className="cursor-pointer appearance-none rounded border border-outline-variant bg-surface-container-lowest px-4 py-2 pl-10 text-xs text-on-surface shadow-sm focus:border-primary focus:ring-0"
        >
          <option value="all">שמיש: הכל</option>
          <option value={NONE_VALUE}>לא נבחר</option>
          {OPTIONS.usable.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>

        {contextTagOptions.length > 0 && (
          <select
            value={filters.tag}
            onChange={(e) => onChange({ ...filters, tag: e.target.value })}
            className="cursor-pointer appearance-none rounded border border-outline-variant bg-surface-container-lowest px-4 py-2 pl-10 text-xs text-on-surface shadow-sm focus:border-primary focus:ring-0"
          >
            <option value="all">תגית: הכל</option>
            <option value={NONE_VALUE}>לא נבחר</option>
            {contextTagOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-1 rounded-full bg-surface-container-high p-1">
          <button
            onClick={() => onViewModeChange("list")}
            title="תצוגת רשימה"
            className={`flex items-center justify-center rounded-full p-1.5 transition-colors ${
              viewMode === "list"
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-base">view_list</span>
          </button>
          <button
            onClick={() => onViewModeChange("grid")}
            title="תצוגת רשת"
            className={`flex items-center justify-center rounded-full p-1.5 transition-colors ${
              viewMode === "grid"
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-base">grid_view</span>
          </button>
        </div>

        <button
          onClick={onExport}
          disabled={exporting || count === 0}
          title="ייצוא הרשימה המסוננת ל-JSON"
          className="flex items-center gap-1.5 rounded-full border border-outline-variant px-4 py-2 text-xs font-bold text-on-surface-variant transition-colors hover:border-primary/40 hover:text-on-surface disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-sm">download</span>
          {exporting ? "מייצאת..." : "ייצוא ל-JSON"}
        </button>
      </div>

      <div className="flex w-full basis-full items-center gap-2">
        <span className="text-xs text-on-surface-variant">מיון:</span>
        {SORT_FIELDS.map((f) => (
          <button
            key={f.key}
            onClick={() =>
              onSortChange(
                sort.field === f.key
                  ? { field: f.key, direction: sort.direction === "asc" ? "desc" : "asc" }
                  : { field: f.key, direction: "asc" }
              )
            }
            className={
              sort.field === f.key
                ? "flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary"
                : "rounded-full px-3 py-1 text-xs text-on-surface-variant hover:text-on-surface"
            }
          >
            {f.label}
            {sort.field === f.key && (
              <span className="material-symbols-outlined text-sm">
                {sort.direction === "asc" ? "arrow_upward" : "arrow_downward"}
              </span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

function PlatformMultiSelect({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  const platformLabel = (value: string) =>
    value === NONE_VALUE ? "לא נבחר" : (PLATFORM_DISPLAY.find((p) => p.key === value)?.label ?? value);

  const label =
    selected.length === 0
      ? "פלטפורמה: הכל"
      : selected.length === 1
        ? `פלטפורמה: ${platformLabel(selected[0])}`
        : `פלטפורמה: ${selected.length} נבחרו`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex cursor-pointer items-center gap-1.5 rounded border border-outline-variant bg-surface-container-lowest px-4 py-2 text-xs text-on-surface shadow-sm"
      >
        {label}
        <span className="material-symbols-outlined text-sm">expand_more</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 max-h-72 w-56 overflow-y-auto rounded border border-outline-variant bg-surface-container-lowest p-2 shadow-lg">
          <button
            onClick={() => onChange([])}
            className="mb-1 w-full rounded px-2 py-1 text-right text-xs font-bold text-primary hover:bg-surface-container"
          >
            נקה בחירה
          </button>
          <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-on-surface hover:bg-surface-container">
            <input
              type="checkbox"
              checked={selected.includes(NONE_VALUE)}
              onChange={() => toggle(NONE_VALUE)}
              className="h-3.5 w-3.5"
            />
            <span className="h-4 w-4 shrink-0 rounded-full border-2 border-dashed border-outline-variant bg-transparent" />
            לא נבחר
          </label>
          {PLATFORM_DISPLAY.map(({ key, label: platName, Icon, color }) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-on-surface hover:bg-surface-container"
            >
              <input
                type="checkbox"
                checked={selected.includes(key)}
                onChange={() => toggle(key)}
                className="h-3.5 w-3.5"
              />
              <Icon className="h-4 w-4" style={{ color }} />
              {platName}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function WardrobeMultiSelect({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  const label =
    selected.length === 0
      ? "צעיף: הכל"
      : selected.length === 1
        ? `צעיף: ${selected[0] === NONE_VALUE ? "לא נבחר" : selected[0]}`
        : `צעיף: ${selected.length} נבחרו`;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex cursor-pointer items-center gap-1.5 rounded border border-outline-variant bg-surface-container-lowest px-4 py-2 text-xs text-on-surface shadow-sm"
      >
        {label}
        <span className="material-symbols-outlined text-sm">expand_more</span>
      </button>

      {open && (
        <div className="absolute z-30 mt-1 max-h-72 w-56 overflow-y-auto rounded border border-outline-variant bg-surface-container-lowest p-2 shadow-lg">
          <button
            onClick={() => onChange([])}
            className="mb-1 w-full rounded px-2 py-1 text-right text-xs font-bold text-primary hover:bg-surface-container"
          >
            נקה בחירה
          </button>
          <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-on-surface hover:bg-surface-container">
            <input
              type="checkbox"
              checked={selected.includes(NONE_VALUE)}
              onChange={() => toggle(NONE_VALUE)}
              className="h-3.5 w-3.5"
            />
            <span className="h-4 w-4 shrink-0 rounded-full border-2 border-dashed border-outline-variant bg-transparent" />
            לא נבחר
          </label>
          {OPTIONS.wardrobe.map((w) => (
            <label
              key={w.value}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-on-surface hover:bg-surface-container"
            >
              <input
                type="checkbox"
                checked={selected.includes(w.value)}
                onChange={() => toggle(w.value)}
                className="h-3.5 w-3.5"
              />
              <span
                style={
                  w.image
                    ? { backgroundImage: `url("${encodeURI(w.image)}")`, backgroundSize: "cover" }
                    : w.colorHex
                      ? { backgroundColor: w.colorHex }
                      : undefined
                }
                className={`h-4 w-4 shrink-0 rounded-full ${
                  w.colorHex || w.image ? "" : "border-2 border-dashed border-outline-variant bg-transparent"
                }`}
              />
              {w.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
