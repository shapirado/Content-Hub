"use client";

import { useState, useTransition } from "react";
import { linkClipToExistingRawClipAction, searchRawClipLibraryAction } from "@/app/actions";
import type { ClipLibraryRow } from "@/lib/neon";

type SearchResult = { id: string; name: string; youtubeLink: string | null };

/**
 * Searches for a matching Raw Clip Library record to identify this clip as a duplicate of
 * one already known — attaching it merges the two into the same record rather than creating
 * a separate one. Not required for tagging: editing pillar/season/usable/tags/copies directly
 * on a clip auto-creates a record if none exists yet.
 */
export function SearchLinkModal({
  clipId,
  onLinked,
  onClose,
}: {
  clipId: string;
  onLinked: (row: ClipLibraryRow | null) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, startSearch] = useTransition();
  const [linking, startLink] = useTransition();

  function runSearch(q: string) {
    setQuery(q);
    startSearch(async () => {
      const r = await searchRawClipLibraryAction(q);
      setResults(r);
    });
  }

  function attach(recordId: string) {
    startLink(async () => {
      const row = await linkClipToExistingRawClipAction(clipId, recordId);
      onLinked(row);
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-headline-sm font-headline-sm text-on-surface">זיהוי כפילות</h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <p className="mb-2 text-xs text-on-surface-variant">
          חיפוש לפי כותרת הקליפ או קישור יוטיוב — למציאת קליפ קיים שזהו העתק שלו
        </p>
        <input
          autoFocus
          value={query}
          onChange={(e) => runSearch(e.target.value)}
          placeholder="חיפוש לפי כותרת או קישור..."
          className="mb-3 w-full rounded border border-outline-variant bg-surface-container-low px-4 py-2 text-sm text-on-surface focus:border-primary focus:outline-none"
        />

        <div className="max-h-72 space-y-2 overflow-y-auto">
          {searching && <p className="text-xs text-on-surface-variant">מחפשת...</p>}
          {!searching && query && results.length === 0 && (
            <p className="text-xs text-on-surface-variant">אין תוצאות תואמות</p>
          )}
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => attach(r.id)}
              disabled={linking}
              className="flex w-full items-center justify-between rounded border border-outline-variant/30 bg-surface-container-low p-3 text-right text-sm hover:border-primary/50"
            >
              <span className="truncate pl-2 text-on-surface">{r.name}</span>
              <span className="material-symbols-outlined text-primary">content_copy</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
