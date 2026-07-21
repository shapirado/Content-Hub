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
import { DEFAULT_FILTERS, FilterBar, type Filters } from "./FilterBar";
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
}: {
  initialClips: MergedClip[];
  contextTagOptions: string[];
  searchQuery?: string;
}) {
  const [clips, setClips] = useState(initialClips);
  const [tagOptions, setTagOptions] = useState(contextTagOptions);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<FullClip | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [searchLinkOpen, setSearchLinkOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return clips.filter((item) => {
      if (q) {
        const titleMatch = displayTitle(item).toLowerCase().includes(q);
        const linkMatch = item.clip.paths.some((p) => p.toLowerCase().includes(q));
        const filenameMatch = (item.clip.original_filename ?? "").toLowerCase().includes(q);
        if (!titleMatch && !linkMatch && !filenameMatch) return false;
      }
      if (filters.status === "unlinked" && item.library) return false;
      if (filters.status === "draft" && item.library?.status !== "Drafted") return false;
      if (filters.status === "posted" && item.library?.status !== "Posted") return false;
      if (filters.pillar !== "all" && item.clip.pillar !== filters.pillar) return false;
      if (filters.season !== "all" && !seasonMatches(item.clip.season ?? null, filters.season))
        return false;
      if (filters.platform !== "all") {
        const posted = item.clip.platforms.some((p) => p.toLowerCase() === filters.platform.toLowerCase());
        if (!posted) return false;
      }
      if (filters.wardrobe.length > 0 && !(item.clip.wardrobe && filters.wardrobe.includes(item.clip.wardrobe)))
        return false;
      if (filters.tag !== "all" && !(item.clip.context_tags ?? []).includes(filters.tag))
        return false;
      if (filters.copies !== "all") {
        const count = item.clip.paths.length;
        if (filters.copies === "3+" ? count < 3 : count !== Number(filters.copies)) return false;
      }
      if (filters.usable !== "all" && item.clip.usable !== filters.usable) return false;
      return true;
    });
  }, [clips, filters, searchQuery]);

  const sorted = useMemo(() => sortClips(filtered, sort), [filtered, sort]);

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

  function handleDeleted(deletedIds: string[]) {
    setClips((prev) => prev.filter((c) => !deletedIds.includes(c.clip.id)));
    setSelectedIds([]);
    if (expandedId && deletedIds.includes(expandedId)) {
      setExpandedId(null);
      setExpandedDetail(null);
    }
  }

  function handleMerged(survivorId: string, loserIds: string[], updatedSurvivor: ClipDetails | null) {
    setClips((prev) => prev.filter((c) => !loserIds.includes(c.clip.id)));
    updateClipDetails(survivorId, updatedSurvivor);
    setSelectedIds([]);
  }

  return (
    <div className="grid grid-cols-12 gap-8">
      <div className="col-span-12">
        <FilterBar
          filters={filters}
          onChange={setFilters}
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
            disabled={selectedItems.length < 2}
            title={selectedItems.length < 2 ? "יש לבחור לפחות 2 קליפים" : undefined}
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

      {mergeOpen && selectedItems.length >= 2 && (
        <MergeCopiesModal
          items={selectedItems}
          onClose={() => setMergeOpen(false)}
          onMerged={handleMerged}
        />
      )}
    </div>
  );
}
