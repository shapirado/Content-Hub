"use client";

import { useState } from "react";
import type { MergedClip } from "@/lib/types";
import { TopBar } from "./TopBar";
import { MediaLibraryApp } from "./MediaLibraryApp";

/**
 * Lifts the top search box's query state above TopBar and MediaLibraryApp — they're siblings
 * under the server-rendered app/page.tsx (Sidebar needs to stay server-side for auth()), so the
 * shared state has to live in a small client wrapper rather than in either leaf component.
 */
export function ContentHubShell({
  initialClips,
  contextTagOptions,
}: {
  initialClips: MergedClip[];
  contextTagOptions: string[];
}) {
  const [query, setQuery] = useState("");

  return (
    <>
      <TopBar value={query} onChange={setQuery} />
      <main className="mr-64 mt-16 min-h-[calc(100vh-64px)] bg-background p-8">
        <MediaLibraryApp
          initialClips={initialClips}
          contextTagOptions={contextTagOptions}
          searchQuery={query}
        />
      </main>
    </>
  );
}
