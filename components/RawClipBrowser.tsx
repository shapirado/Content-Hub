"use client";

import { useMemo, useState } from "react";
import { listAllRawClipRecordsAction, type RawClipBrowserRecord } from "@/app/actions";
import { OPTIONS } from "@/lib/airtable";
import { seasonIcon } from "@/lib/types";
import { MergeRawClipsModal } from "./MergeRawClipsModal";

type SortField = "name" | "season" | "pillar" | "wardrobe" | "tags";
type SortState = { field: SortField; direction: "asc" | "desc" };

const SORT_FIELDS: { key: SortField; label: string }[] = [
  { key: "name", label: "כותרת" },
  { key: "season", label: "עונה" },
  { key: "pillar", label: "פילר" },
  { key: "wardrobe", label: "צעיף" },
  { key: "tags", label: "תגיות" },
];

function sortRecords(records: RawClipBrowserRecord[], sort: SortState): RawClipBrowserRecord[] {
  const sign = sort.direction === "asc" ? 1 : -1;
  return [...records].sort((a, b) => {
    switch (sort.field) {
      case "name":
        return sign * a.name.localeCompare(b.name, "he");
      case "season":
        return sign * (a.season ?? "").localeCompare(b.season ?? "", "he");
      case "pillar":
        return sign * (a.pillar ?? "").localeCompare(b.pillar ?? "", "he");
      case "wardrobe":
        return sign * (a.wardrobe ?? "").localeCompare(b.wardrobe ?? "", "he");
      case "tags":
        return sign * a.contextTags.join(",").localeCompare(b.contextTags.join(","), "he");
    }
  });
}

/**
 * Browses Raw Clip Library records directly (not filtered through Neon clips) so pre-existing
 * duplicate rows — invisible to the main asset table — can be spotted by eye and merged.
 */
export function RawClipBrowser({ initialRecords }: { initialRecords: RawClipBrowserRecord[] }) {
  const [records, setRecords] = useState(initialRecords);
  const [sort, setSort] = useState<SortState>({ field: "name", direction: "asc" });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mergeOpen, setMergeOpen] = useState(false);

  const sorted = useMemo(() => sortRecords(records, sort), [records, sort]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  }

  const selectedRecords = selectedIds
    .map((id) => records.find((r) => r.id === id))
    .filter((r): r is RawClipBrowserRecord => !!r);

  async function refreshAfterMerge() {
    const fresh = await listAllRawClipRecordsAction();
    setRecords(fresh);
    setSelectedIds([]);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-headline-md font-headline-md text-on-surface">
            ספריית קליפים גולמית
          </h2>
          <span className="text-sm text-on-surface-variant">{sorted.length} רשומות</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-on-surface-variant">מיון:</span>
          {SORT_FIELDS.map((f) => (
            <button
              key={f.key}
              onClick={() =>
                setSort((prev) =>
                  prev.field === f.key
                    ? { field: f.key, direction: prev.direction === "asc" ? "desc" : "asc" }
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
      </div>

      <div className="overflow-hidden rounded-xl border border-outline-variant">
        <table className="w-full text-right text-sm">
          <thead className="bg-surface-container-high text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            <tr>
              <th className="w-10 px-4 py-3" />
              <th className="px-4 py-3">קליפ</th>
              <th className="px-4 py-3">פילר</th>
              <th className="px-4 py-3">עונה</th>
              <th className="px-4 py-3">שמיש</th>
              <th className="px-4 py-3">צעיף</th>
              <th className="px-4 py-3">תגיות</th>
              <th className="px-4 py-3">פוסטים</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/40">
            {sorted.map((r) => {
              const wardrobe = OPTIONS.wardrobe.find((w) => w.value === r.wardrobe);
              const checked = selectedIds.includes(r.id);
              return (
                <tr
                  key={r.id}
                  onClick={() => toggleSelect(r.id)}
                  className={`cursor-pointer transition-colors ${
                    checked ? "bg-primary/5" : "hover:bg-surface-container-low"
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelect(r.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="h-4 w-4"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-surface-container-high">
                        {r.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={r.thumbnailUrl}
                            alt={r.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="material-symbols-outlined text-lg text-on-surface-variant/40">
                            movie
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-on-surface">{r.name}</p>
                        {r.youtubeLink && (
                          <a
                            href={r.youtubeLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="block max-w-[220px] truncate text-[11px] text-primary hover:underline"
                          >
                            {r.youtubeLink}
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">{r.pillar ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">
                    {r.season ? `${seasonIcon(r.season)} ${r.season}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">{r.usable ?? "—"}</td>
                  <td className="px-4 py-3">
                    {wardrobe ? (
                      <span
                        title={wardrobe.label}
                        style={
                          wardrobe.image
                            ? {
                                backgroundImage: `url("${encodeURI(wardrobe.image)}")`,
                                backgroundSize: "cover",
                              }
                            : wardrobe.colorHex
                              ? { backgroundColor: wardrobe.colorHex }
                              : undefined
                        }
                        className={`inline-block h-5 w-5 rounded-full ring-1 ring-outline-variant/40 ${
                          wardrobe.colorHex || wardrobe.image
                            ? ""
                            : "border-2 border-dashed border-outline-variant bg-transparent"
                        }`}
                      />
                    ) : (
                      <span className="text-xs text-on-surface-variant">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-[200px] flex-wrap gap-1">
                      {r.contextTags.map((t) => (
                        <span
                          key={t}
                          className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">
                    {r.contentInventoryCount}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedRecords.length === 2 && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-full border border-outline-variant bg-surface-container-lowest px-6 py-3 shadow-2xl">
          <span className="text-sm text-on-surface">2 רשומות מסומנות</span>
          <button
            onClick={() => setMergeOpen(true)}
            className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:opacity-90"
          >
            מיזוג 2 הרשומות המסומנות
          </button>
          <button
            onClick={() => setSelectedIds([])}
            className="text-xs text-on-surface-variant hover:text-on-surface"
          >
            ביטול בחירה
          </button>
        </div>
      )}

      {mergeOpen && selectedRecords.length === 2 && (
        <MergeRawClipsModal
          recordA={selectedRecords[0]}
          recordB={selectedRecords[1]}
          onClose={() => setMergeOpen(false)}
          onMerged={refreshAfterMerge}
        />
      )}
    </div>
  );
}
