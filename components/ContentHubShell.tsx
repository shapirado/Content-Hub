"use client";

import { useState } from "react";
import type { MergedClip } from "@/lib/types";
import { TopBar } from "./TopBar";
import { MediaLibraryApp } from "./MediaLibraryApp";
import { DEFAULT_FILTERS, type Filters } from "./FilterBar";

/**
 * Lifts the top search box's query state (and, for the "clear filters" button next to it, the
 * filters state too) above TopBar and MediaLibraryApp — they're siblings under the server-rendered
 * app/page.tsx (Sidebar needs to stay server-side for auth()), so the shared state has to live in a
 * small client wrapper rather than in either leaf component.
 */
export function ContentHubShell({
  initialClips,
  contextTagOptions,
}: {
  initialClips: MergedClip[];
  contextTagOptions: string[];
}) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const hasActiveFilters = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <>
      <TopBar
        value={query}
        onChange={setQuery}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={() => setFilters(DEFAULT_FILTERS)}
      />
      <main className="mr-64 mt-16 min-h-[calc(100vh-64px)] bg-background p-8">
        <MediaLibraryApp
          initialClips={initialClips}
          contextTagOptions={contextTagOptions}
          searchQuery={query}
          filters={filters}
          onFiltersChange={setFilters}
        />
      </main>
    </>
  );
}
