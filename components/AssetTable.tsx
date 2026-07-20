"use client";

import type { ClipDetails, ClipLibraryRow } from "@/lib/neon";
import { displayLink, displayTitle, seasonIcon, type MergedClip } from "@/lib/types";
import { PLATFORM_DISPLAY } from "@/lib/platforms";
import { ExpandedClipDetails } from "./ExpandedClipDetails";

type FullClip = ClipDetails;

function statusBadge(item: MergedClip) {
  if (!item.library) {
    return (
      <span className="rounded bg-error/10 px-2 py-0.5 text-[10px] font-bold text-error">
        טרם תויג
      </span>
    );
  }
  return (
    <span className="rounded bg-surface-container-highest px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">
      {item.library.status ?? "—"}
    </span>
  );
}

export function AssetTable({
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
  return (
    <div className="col-span-12 mt-4">
      <h3 className="mb-8 text-headline-sm font-headline-sm text-on-surface">
        כל נכסי המדיה
      </h3>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-[repeat(13,minmax(0,1fr))] gap-4 rounded-t-xl border-x border-t border-outline-variant bg-surface-container-high px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          <div className="col-span-5">קובץ</div>
          <div className="col-span-2">סטטוס</div>
          <div className="col-span-2">פילר</div>
          <div className="col-span-1">ביצועים</div>
          <div className="col-span-2">פלטפורמות</div>
          <div className="col-span-1" />
        </div>

        {items.map((item) => {
          const isExpanded = expandedId === item.clip.id;
          const isSelected = selectedIds.includes(item.clip.id);
          const link = displayLink(item);
          return (
            <div key={item.clip.id}>
              <button
                onClick={() => onToggleExpand(item.clip.id)}
                className={`grid w-full grid-cols-[repeat(13,minmax(0,1fr))] items-center gap-4 border border-outline-variant px-6 py-4 text-right transition-colors hover:bg-surface-container-highest ${
                  isExpanded ? "bg-primary/10" : "bg-surface-container"
                }`}
              >
                <div className="col-span-5 flex items-center gap-3">
                  <span
                    className={`material-symbols-outlined shrink-0 text-lg text-on-surface-variant transition-transform ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                  >
                    chevron_left
                  </span>

                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="פתיחת הקליפ ביוטיוב"
                      className="shrink-0 overflow-hidden rounded border border-outline-variant/30 bg-surface-container-high"
                    >
                      <Thumbnail clip={item.clip} />
                    </a>
                  ) : (
                    <div className="shrink-0 overflow-hidden rounded border border-outline-variant/30 bg-surface-container-high">
                      <Thumbnail clip={item.clip} />
                    </div>
                  )}

                  <div className="flex flex-col overflow-hidden">
                    {link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="truncate text-sm font-bold text-on-surface hover:text-primary hover:underline"
                      >
                        {displayTitle(item)}
                      </a>
                    ) : (
                      <span className="truncate text-sm font-bold text-on-surface">
                        {displayTitle(item)}
                      </span>
                    )}
                    {item.clip.season && (
                      <span className="text-[10px] text-on-surface-variant/60">
                        {seasonIcon(item.clip.season)} {item.clip.season}
                      </span>
                    )}
                  </div>
                </div>

                <div className="col-span-2">{statusBadge(item)}</div>

                <div className="col-span-2">
                  <span className="text-[10px] font-bold text-tertiary">
                    {item.clip.pillar ?? "—"}
                  </span>
                </div>

                <div className="col-span-1">
                  <span className="text-[10px] font-bold text-on-surface-variant/60">
                    {item.library?.views ? `${item.library.views} views` : "—"}
                  </span>
                </div>

                <div className="col-span-2 flex gap-2">
                  {PLATFORM_DISPLAY.map(({ key, label, Icon, color }) => {
                    const posted = item.clip.platforms.some((p) => p.toLowerCase() === key.toLowerCase());
                    return (
                      <Icon
                        key={key}
                        title={label}
                        className={`h-5 w-5 ${posted ? "" : "text-on-surface-variant/30"}`}
                        style={posted ? { color } : undefined}
                      />
                    );
                  })}
                </div>

                <div className="col-span-1 flex justify-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleSelect(item.clip.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="h-4 w-4"
                    aria-label="בחירת קליפ"
                  />
                </div>
              </button>

              {isExpanded && (
                <ExpandedClipDetails
                  item={item}
                  fullClip={expandedFullClip}
                  loadingDetail={loadingDetail}
                  onOpenSearchLink={() => onOpenSearchLink(item.clip.id)}
                  onLibraryChange={(row) => onLibraryChange(item.clip.id, row)}
                  onClipDetailsChange={(updated) => onClipDetailsChange(item.clip.id, updated)}
                  onCopyPlatformsChange={(platforms) => onCopyPlatformsChange(item.clip.id, platforms)}
                  contextTagOptions={contextTagOptions}
                />
              )}
            </div>
          );
        })}

        {items.length === 0 && (
          <div className="rounded-b-xl border border-outline-variant bg-surface-container px-6 py-10 text-center text-sm text-on-surface-variant">
            אין פריטים תואמים לסינון הנוכחי
          </div>
        )}
      </div>
    </div>
  );
}

function Thumbnail({ clip }: { clip: FullClip | MergedClip["clip"] }) {
  const thumb = "thumbnail" in clip ? clip.thumbnail : null;
  return (
    <div className="flex h-16 w-10 items-center justify-center">
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt={"title" in clip ? clip.title ?? "clip thumbnail" : "clip thumbnail"}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="material-symbols-outlined text-base text-on-surface-variant/40">
          movie
        </span>
      )}
    </div>
  );
}
