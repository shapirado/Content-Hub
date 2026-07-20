"use client";

import type { ClipDetails, ClipLibraryRow } from "@/lib/neon";
import { displayLink, displayTitle, seasonIcon, type MergedClip } from "@/lib/types";
import { PLATFORM_DISPLAY } from "@/lib/platforms";
import { ExpandedClipDetails } from "./ExpandedClipDetails";

type FullClip = ClipDetails;

export function AssetGrid({
  items,
  expandedId,
  onToggleExpand,
  expandedFullClip,
  loadingDetail,
  onOpenSearchLink,
  onLibraryChange,
  onClipDetailsChange,
  onCopyPlatformsChange,
  selectedIds,
  onToggleSelect,
  contextTagOptions,
}: {
  items: MergedClip[];
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  expandedFullClip: FullClip | null;
  loadingDetail: boolean;
  onOpenSearchLink: (clipId: string) => void;
  onLibraryChange: (clipId: string, row: ClipLibraryRow | null) => void;
  onClipDetailsChange: (clipId: string, updated: ClipDetails | null) => void;
  onCopyPlatformsChange: (clipId: string, platforms: string[]) => void;
  selectedIds: string[];
  onToggleSelect: (clipId: string) => void;
  contextTagOptions: string[];
}) {
  const expandedItem = items.find((item) => item.clip.id === expandedId) ?? null;

  return (
    <div className="col-span-12 mt-4">
      <h3 className="mb-8 text-headline-sm font-headline-sm text-on-surface">
        כל נכסי המדיה
      </h3>

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item) => {
          const isExpanded = expandedId === item.clip.id;
          const isSelected = selectedIds.includes(item.clip.id);
          const link = displayLink(item);
          return (
            <button
              key={item.clip.id}
              onClick={() => onToggleExpand(item.clip.id)}
              className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-right transition-colors hover:bg-surface-container-highest ${
                isExpanded ? "border-primary bg-primary/10" : "border-outline-variant bg-surface-container"
              }`}
            >
              <div className="relative">
                <div className="flex h-64 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-high">
                  {item.clip.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.clip.thumbnail}
                      alt={item.clip.title ?? "clip thumbnail"}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">
                      movie
                    </span>
                  )}
                </div>

                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleSelect(item.clip.id)}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-2 top-2 h-4 w-4"
                  aria-label="בחירת קליפ"
                />

                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title="פתיחת הקליפ ביוטיוב"
                    className="absolute bottom-2 left-2 flex h-6 w-6 items-center justify-center rounded-full bg-surface-container-lowest/90 text-on-surface-variant hover:text-primary"
                  >
                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                  </a>
                )}
              </div>

              <div className="w-40">
                <p className="truncate text-sm font-bold text-on-surface">{displayTitle(item)}</p>
                {item.clip.season && (
                  <span className="text-[10px] text-on-surface-variant/60">
                    {seasonIcon(item.clip.season)} {item.clip.season}
                  </span>
                )}
                {item.clip.pillar && (
                  <p className="truncate text-[10px] font-bold text-tertiary">{item.clip.pillar}</p>
                )}
                <div className="mt-1 flex gap-1.5">
                  {PLATFORM_DISPLAY.map(({ key, label, Icon, color }) => {
                    const posted = item.clip.platforms.some((p) => p.toLowerCase() === key.toLowerCase());
                    return (
                      <Icon
                        key={key}
                        title={label}
                        className={`h-4 w-4 ${posted ? "" : "text-on-surface-variant/30"}`}
                        style={posted ? { color } : undefined}
                      />
                    );
                  })}
                </div>
              </div>
            </button>
          );
        })}

        {items.length === 0 && (
          <div className="col-span-full rounded-xl border border-outline-variant bg-surface-container px-6 py-10 text-center text-sm text-on-surface-variant">
            אין פריטים תואמים לסינון הנוכחי
          </div>
        )}
      </div>

      {expandedItem && (
        <div className="mt-4 grid grid-cols-12">
          <ExpandedClipDetails
            item={expandedItem}
            fullClip={expandedFullClip}
            loadingDetail={loadingDetail}
            onOpenSearchLink={() => onOpenSearchLink(expandedItem.clip.id)}
            onLibraryChange={(row) => onLibraryChange(expandedItem.clip.id, row)}
            onClipDetailsChange={(updated) => onClipDetailsChange(expandedItem.clip.id, updated)}
            onCopyPlatformsChange={(platforms) => onCopyPlatformsChange(expandedItem.clip.id, platforms)}
            contextTagOptions={contextTagOptions}
          />
        </div>
      )}
    </div>
  );
}
