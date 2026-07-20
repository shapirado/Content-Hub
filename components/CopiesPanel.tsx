"use client";

import { useState, useTransition } from "react";
import {
  attachExistingCopyAction,
  createCopyAction,
  searchCopiesAction,
} from "@/app/actions";
import { OPTIONS } from "@/lib/airtable";
import type { ClipLibraryRow } from "@/lib/neon";

type SearchResult = { id: string; title: string; copyText: string; platform: string | null };

export function CopiesPanel({
  clipId,
  library,
  onChanged,
}: {
  clipId: string;
  library: ClipLibraryRow | null;
  onChanged: (row: ClipLibraryRow | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [newCopy, setNewCopy] = useState({ title: "", copyText: "", platform: "" });
  const [searching, startSearch] = useTransition();
  const [saving, startSaving] = useTransition();

  function runSearch(q: string) {
    setQuery(q);
    startSearch(async () => {
      setResults(await searchCopiesAction(q));
    });
  }

  function attach(copyId: string) {
    startSaving(async () => {
      const row = await attachExistingCopyAction(clipId, copyId);
      onChanged(row);
      setQuery("");
      setResults([]);
    });
  }

  function createNew() {
    if (!newCopy.title.trim()) return;
    startSaving(async () => {
      const row = await createCopyAction(clipId, {
        title: newCopy.title,
        copyText: newCopy.copyText,
        platform: newCopy.platform || undefined,
      });
      onChanged(row);
      setNewCopy({ title: "", copyText: "", platform: "" });
    });
  }

  return (
    <div className="col-span-12 rounded-xl border border-outline-variant bg-surface-container p-8 shadow-sm">
      <h3 className="mb-6 text-headline-sm font-headline-sm text-on-surface">קופי לפרסום</h3>

      {library && library.copies.length > 0 && (
        <div className="mb-6 space-y-2">
          {library.copies.map((c, i) => (
            <div
              key={i}
              className="rounded border border-outline-variant/30 bg-surface-container-low p-4"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-bold text-on-surface">{c.title}</span>
                {c.platform && (
                  <span className="rounded bg-surface-container-highest px-2 py-0.5 text-[10px] font-bold text-on-surface-variant">
                    {c.platform}
                  </span>
                )}
              </div>
              <p className="whitespace-pre-wrap text-xs text-on-surface-variant">
                {c.copyText}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">
            חיפוש קופי קיים
          </p>
          <input
            value={query}
            onChange={(e) => runSearch(e.target.value)}
            placeholder="חיפוש לפי כותרת..."
            className="mb-2 w-full rounded border border-outline-variant bg-surface-container-low px-4 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <div className="max-h-40 space-y-2 overflow-y-auto">
            {searching && <p className="text-xs text-on-surface-variant">מחפשת...</p>}
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => attach(r.id)}
                disabled={saving}
                className="flex w-full items-center justify-between rounded border border-outline-variant/30 bg-surface-container-low p-3 text-right text-sm hover:border-primary/50"
              >
                <span className="truncate pl-2 text-on-surface">{r.title}</span>
                <span className="material-symbols-outlined text-primary">link</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-widest text-primary">
            כתיבת קופי חדש
          </p>
          <input
            value={newCopy.title}
            onChange={(e) => setNewCopy({ ...newCopy, title: e.target.value })}
            placeholder="כותרת"
            className="mb-2 w-full rounded border border-outline-variant bg-surface-container-low px-4 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <textarea
            value={newCopy.copyText}
            onChange={(e) => setNewCopy({ ...newCopy, copyText: e.target.value })}
            placeholder="טקסט הקופי..."
            rows={3}
            className="mb-2 w-full rounded border border-outline-variant bg-surface-container-low px-4 py-2 text-sm focus:border-primary focus:outline-none"
          />
          <select
            value={newCopy.platform}
            onChange={(e) => setNewCopy({ ...newCopy, platform: e.target.value })}
            className="mb-2 w-full rounded border border-outline-variant bg-surface-container-low px-3 py-2 text-xs"
          >
            <option value="">פלטפורמה</option>
            {OPTIONS.copyPlatform.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <button
            onClick={createNew}
            disabled={saving || !newCopy.title.trim()}
            className="w-full rounded bg-primary py-2 text-xs font-bold text-on-primary shadow hover:shadow-lg disabled:opacity-60"
          >
            {saving ? "שומרת..." : "הוספת קופי"}
          </button>
        </div>
      </div>
    </div>
  );
}
