import type { ClipDetailsListItem, ClipLibraryRow } from "./neon";
import { resolveCopyLink } from "./paths";

export type MergedClip = {
  clip: ClipDetailsListItem;
  library: ClipLibraryRow | null;
};

export function displayTitle(item: MergedClip): string {
  return item.clip.title ?? item.clip.original_filename ?? item.clip.representativePath ?? item.clip.id;
}

/** A real URL if one exists, otherwise a Drive filename-search link resolved from the representative path. */
export function displayLink(item: MergedClip): string | null {
  const path = item.clip.representativeLink ?? item.clip.representativePath;
  return path ? resolveCopyLink(path) : null;
}

/** ☀️ for קיץ, ❄️ for חורף, 🍂 for anything else (מעבר and legacy season values alike). */
export function seasonIcon(season: string | null): string | null {
  if (!season) return null;
  if (season === "קיץ") return "☀️";
  if (season === "חורף") return "❄️";
  return "🍂";
}

/** "מעבר" matches itself and any legacy season value (סתיו/חגים/גם וגם) — anything that isn't קיץ/חורף. */
export function seasonMatches(season: string | null, filterValue: string): boolean {
  if (!season) return false;
  if (filterValue === "מעבר") return season !== "קיץ" && season !== "חורף";
  return season === filterValue;
}

export type SortField = "title" | "season" | "pillar" | "date" | "wardrobe" | "tags";
export type SortState = { field: SortField; direction: "asc" | "desc" };
export const DEFAULT_SORT: SortState = { field: "date", direction: "desc" };

export function sortClips(items: MergedClip[], sort: SortState): MergedClip[] {
  const sign = sort.direction === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    switch (sort.field) {
      case "title":
        return sign * displayTitle(a).localeCompare(displayTitle(b), "he");
      case "season":
        return sign * (a.clip.season ?? "").localeCompare(b.clip.season ?? "", "he");
      case "pillar":
        return sign * (a.clip.pillar ?? "").localeCompare(b.clip.pillar ?? "", "he");
      case "wardrobe":
        return sign * (a.clip.wardrobe ?? "").localeCompare(b.clip.wardrobe ?? "", "he");
      case "tags":
        return (
          sign *
          (a.clip.context_tags ?? []).join(",").localeCompare((b.clip.context_tags ?? []).join(","), "he")
        );
      case "date":
        return sign * (new Date(a.clip.created_at).getTime() - new Date(b.clip.created_at).getTime());
    }
  });
}

export type { ClipDetailsListItem, ClipLibraryRow };
