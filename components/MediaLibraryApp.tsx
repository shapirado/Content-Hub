"use client";

import { useMemo, useState } from "react";
import { getClipDetailAction } from "@/app/actions";
import type { ClipDetails, ClipDetailsListItem, ClipLibraryRow } from "@/lib/neon";
import {
  DEFAULT_SORT,
  displayTitle,
  seasonMatches,
  sortClips,
  type MergedClip,
  type SortState,
} from "@/lib/types";
import { FilterBar, NONE_VALUE, type Filters } from "./FilterBar";
import { AssetTable } from "./AssetTable";
import { AssetGrid } from "./AssetGrid";
import { SearchLinkModal } from "./SearchLinkModal";
import { DeleteClipsModal } from "./DeleteClipsModal";
import { MergeCopiesModal } from "./MergeCopiesModal";

type FullClip = ClipDetails;

export function MediaLibraryApp({
  initialClips,
  contextTagOptions,
  searchQuery = "",
  filters,
  onFiltersChange,
}: {
  initialClips: MergedClip[];
  contextTagOptions: string[];
  searchQuery?: string;
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
}) {
  const [clips, setClips] = useState(initialClips);
  const [tagOptions, setTagOptions] = useState(contextTagOptions);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<FullClip | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchLinkOpen, setSearchLinkOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [pinnedId, setPinnedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return clips.filter((item) => {
      if (q) {
        const titleMatch = displayTitle(item).toLowerCase().includes(q);
        const linkMatch = item.clip.paths.some((p) => p.toLowerCase().includes(q));
        const filenameMatch = (item.clip.original_filename ?? "").toLowerCase().includes(q);
        const copyTitleMatch = item.clip.copyTitles.some((t) => t.toLowerCase().includes(q));
        if (!titleMatch && !linkMatch && !filenameMatch && !copyTitleMatch) return false;
      }
      if (filters.status === "unlinked" && item.library) return false;
      if (filters.status === "draft" && item.library?.status !== "Drafted") return false;
      if (filters.status === "posted" && item.library?.status !== "Posted") return false;
      if (filters.pillar !== "all") {
        const matches = filters.pillar === NONE_VALUE ? item.clip.pillar == null : item.clip.pillar === filters.pillar;
        if (!matches) return false;
      }
      if (filters.season !== "all") {
        const matches =
          filters.season === NONE_VALUE
            ? item.clip.season == null
            : seasonMatches(item.clip.season ?? null, filters.season);
        if (!matches) return false;
      }
      if (filters.platform !== "all") {
        const matches =
          filters.platform === NONE_VALUE
            ? item.clip.platforms.length === 0
            : item.clip.platforms.some((p) => p.toLowerCase() === filters.platform.toLowerCase());
        if (!matches) return false;
      }
      if (filters.wardrobe.length > 0) {
        const matches = item.clip.wardrobe
          ? filters.wardrobe.includes(item.clip.wardrobe)
          : filters.wardrobe.includes(NONE_VALUE);
        if (!matches) return false;
      }
      if (filters.tag !== "all") {
        const matches =
          filters.tag === NONE_VALUE
            ? (item.clip.context_tags ?? []).length === 0
            : (item.clip.context_tags ?? []).includes(filters.tag);
        if (!matches) return false;
      }
      if (filters.copies !== "all") {
        const count = item.clip.paths.length;
        if (filters.copies === "3+" ? count < 3 : count !== Number(filters.copies)) return false;
      }
      if (filters.usable !== "all") {
        const matches = filters.usable === NONE_VALUE ? item.clip.usable == null : item.clip.usable === filters.usable;
        if (!matches) return false;
      }
      return true;
    });
  }, [clips, filters, searchQuery]);

  const sorted = useMemo(() => sortClips(filtered, sort), [filtered, sort]);

  const pinnedItem = pinnedId ? (clips.find((c) => c.clip.id === pinnedId) ?? null) : null;
  const gridItems =
    viewMode === "grid" && pinnedId ? sorted.filter((c) => c.clip.id !== pinnedId) : sorted;

  async function toggleExpand(id: string) {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(id);
    setLoadingDetail(true);
    setExpandedDetail(null);
    const detail = await getClipDetailAction(id);
    setExpandedDetail(detail);
    setLoadingDetail(false);
  }

  function updateLibrary(clipId: string, row: ClipLibraryRow | null) {
    setClips((prev) => prev.map((c) => (c.clip.id === clipId ? { ...c, library: row } : c)));
  }

  function updateClipDetails(clipId: string, updated: ClipDetails | null) {
    if (!updated) return;
    setClips((prev) =>
      prev.map((c) =>
        c.clip.id === clipId
          ? {
              ...c,
              clip: {
                ...c.clip,
                title: updated.title,
                pillar: updated.pillar,
                season: updated.season,
                context_tags: updated.context_tags,
                usable: updated.usable,
                posted_to_tiktok: updated.posted_to_tiktok,
                wardrobe: updated.wardrobe,
              } as ClipDetailsListItem,
            }
          : c
      )
    );
    setTagOptions((prev) => [...new Set([...prev, ...updated.context_tags])].sort((a, b) => a.localeCompare(b, "he")));
  }

  function updateCopyPlatforms(clipId: string, platforms: string[]) {
    setClips((prev) =>
      prev.map((c) => (c.clip.id === clipId ? { ...c, clip: { ...c.clip, platforms } } : c))
    );
  }

  const searchLinkClipId = searchLinkOpen ? expandedId : null;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const selectedItems = selectedIds
    .map((id) => clips.find((c) => c.clip.id === id))
    .filter((c): c is MergedClip => !!c);

  const mergeItems = pinnedItem ? [pinnedItem, ...selectedItems] : selectedItems;

  function handleDeleted(deletedIds: string[]) {
    setClips((prev) => prev.filter((c) => !deletedIds.includes(c.clip.id)));
    setSelectedIds([]);
    if (expandedId && deletedIds.includes(expandedId)) {
      setExpandedId(null);
      setExpandedDetail(null);
    }
    if (pinnedId && deletedIds.includes(pinnedId)) setPinnedId(null);
  }

  function handleMerged(survivorId: string, loserIds: string[], updatedSurvivor: ClipDetails | null) {
    setClips((prev) => prev.filter((c) => !loserIds.includes(c.clip.id)));
    updateClipDetails(survivorId, updatedSurvivor);
    setSelectedIds([]);
    if (pinnedId && loserIds.includes(pinnedId)) setPinnedId(null);
  }

  function togglePin(id: string) {
    setPinnedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="grid grid-cols-12 gap-8">
      <div className="col-span-12">
        <FilterBar
          filters={filters}
          onChange={onFiltersChange}
          sort={sort}
          onSortChange={setSort}
          count={sorted.length}
          contextTagOptions={tagOptions}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />
      </div>

      {viewMode === "list" ? (
        <AssetTable
          items={sorted}
          expandedId={expandedId}
          onToggleExpand={toggleExpand}
          expandedFullClip={expandedDetail}
          loadingDetail={loadingDetail}
          onOpenSearchLink={() => setSearchLinkOpen(true)}
          onLibraryChange={updateLibrary}
          onClipDetailsChange={updateClipDetails}
          onCopyPlatformsChange={updateCopyPlatforms}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          contextTagOptions={tagOptions}
        />
      ) : (
        <AssetGrid
          items={gridItems}
          expandedId={expandedId}
          onToggleExpand={toggleExpand}
          expandedFullClip={expandedDetail}
          loadingDetail={loadingDetail}
          onOpenSearchLink={() => setSearchLinkOpen(true)}
          onLibraryChange={updateLibrary}
          onClipDetailsChange={updateClipDetails}
          onCopyPlatformsChange={updateCopyPlatforms}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          contextTagOptions={tagOptions}
          pinnedId={pinnedId}
          onPin={togglePin}
        />
      )}

      {pinnedItem && (
        <div className="fixed left-8 top-24 z-30 flex w-44 flex-col items-center gap-2 rounded-lg border-2 border-primary bg-surface-container p-3 shadow-2xl">
          <div className="flex w-full items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
              מחפשים התאמה
            </span>
            <button
              onClick={() => setPinnedId(null)}
              aria-label="ביטול חיפוש התאמה"
              className="text-on-surface-variant hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
          <div className="flex h-64 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-high">
            {pinnedItem.clip.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pinnedItem.clip.thumbnail}
                alt={pinnedItem.clip.title ?? "clip thumbnail"}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">
                movie
              </span>
            )}
          </div>
          <p className="w-40 truncate text-center text-xs font-bold text-on-surface">
            {displayTitle(pinnedItem)}
          </p>
        </div>
      )}

      {searchLinkClipId && (
        <SearchLinkModal
          clipId={searchLinkClipId}
          onLinked={(row) => {
            updateLibrary(searchLinkClipId, row);
            setSearchLinkOpen(false);
          }}
          onClose={() => setSearchLinkOpen(false)}
        />
      )}

      {selectedItems.length > 0 && (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 items-center gap-4 rounded-full border border-outline-variant bg-surface-container-lowest px-6 py-3 shadow-2xl">
          <span className="text-sm text-on-surface">{selectedItems.length} קליפים מסומנים</span>
          <button
            onClick={() => setDeleteOpen(true)}
            className="rounded-full border border-error px-4 py-2 text-xs font-bold text-error hover:bg-error/10"
          >
            מחיקה
          </button>
          <button
            onClick={() => setMergeOpen(true)}
            disabled={mergeItems.length < 2}
            title={mergeItems.length < 2 ? "יש לבחור לפחות 2 קליפים" : undefined}
            className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-on-primary hover:opacity-90 disabled:opacity-40"
          >
            קישור כעותקים
          </button>
          <button
            onClick={() => setSelectedIds([])}
            className="text-xs text-on-surface-variant hover:text-on-surface"
          >
            ביטול בחירה
          </button>
        </div>
      )}

      {deleteOpen && (
        <DeleteClipsModal
          items={selectedItems}
          onClose={() => setDeleteOpen(false)}
          onDeleted={handleDeleted}
        />
      )}

      {mergeOpen && mergeItems.length >= 2 && (
        <MergeCopiesModal
          items={mergeItems}
          onClose={() => setMergeOpen(false)}
          onMerged={handleMerged}
        />
      )}
    </div>
  );
}
