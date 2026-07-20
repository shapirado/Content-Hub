"use client";

import { useState, useTransition } from "react";
import { mergeClipDetailsAction, updateClipMetadataAction } from "@/app/actions";
import { OPTIONS } from "@/lib/airtable";
import { displayTitle, seasonIcon, type MergedClip } from "@/lib/types";
import type { ClipDetails } from "@/lib/neon";

/**
 * Merges 2+ selected rows into one clip_details record — for marking rows that are actually
 * copies of the same content. mergeClipDetailsAction only repoints copies/performance and
 * deletes the loser; it does NOT carry over the loser's pillar/season/wardrobe/tags, so this
 * modal surfaces what would be discarded and lets the user pick which value survives per field
 * before applying it back onto the survivor via updateClipMetadataAction.
 */
export function MergeCopiesModal({
  items,
  onClose,
  onMerged,
}: {
  items: MergedClip[];
  onClose: () => void;
  onMerged: (survivorId: string, loserIds: string[], updatedSurvivor: ClipDetails | null) => void;
}) {
  const [survivorId, setSurvivorId] = useState(items[0].clip.id);
  const survivor = items.find((i) => i.clip.id === survivorId)!;
  const [pillar, setPillar] = useState(survivor.clip.pillar ?? "");
  const [season, setSeason] = useState(survivor.clip.season ?? "");
  const [wardrobe, setWardrobe] = useState(survivor.clip.wardrobe ?? "");
  const [merging, startMerge] = useTransition();

  function selectSurvivor(id: string) {
    setSurvivorId(id);
    const next = items.find((i) => i.clip.id === id)!;
    setPillar(next.clip.pillar ?? "");
    setSeason(next.clip.season ?? "");
    setWardrobe(next.clip.wardrobe ?? "");
  }

  const contextTags = [...new Set(items.flatMap((i) => i.clip.context_tags ?? []))];
  const postedToTikTok = items.some((i) => i.clip.posted_to_tiktok);

  function confirmMerge() {
    const loserIds = items.map((i) => i.clip.id).filter((id) => id !== survivorId);
    startMerge(async () => {
      for (const loserId of loserIds) {
        await mergeClipDetailsAction(survivorId, loserId);
      }
      const updated = await updateClipMetadataAction(survivorId, {
        pillar: pillar || undefined,
        season: season || undefined,
        wardrobe: wardrobe || undefined,
        contextTags,
        postedToTikTok,
      });
      onMerged(survivorId, loserIds, updated);
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-headline-sm font-headline-sm text-on-surface">
            קישור קליפים כעותקים
          </h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <p className="mb-4 text-xs text-on-surface-variant">
          הרשומה השורדת נשארת; שאר הרשומות יימחקו והעותקים הפיזיים שלהן יועברו אליה. עבור פילר/
          עונה/צעיף — בחירה ידנית לכל שדה. תגיות הקשר וטיקטוק מאוחדים אוטומטית.
        </p>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.clip.id}
              className={`rounded-lg border p-4 ${
                survivorId === item.clip.id ? "border-primary bg-primary/5" : "border-outline-variant"
              }`}
            >
              <button
                onClick={() => selectSurvivor(item.clip.id)}
                className={`mb-3 flex w-full items-center justify-between rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  survivorId === item.clip.id
                    ? "bg-primary text-on-primary"
                    : "border border-outline-variant text-on-surface-variant hover:border-primary/40"
                }`}
              >
                {survivorId === item.clip.id ? "רשומה שורדת" : "בחירה כשורדת"}
                {survivorId === item.clip.id && (
                  <span className="material-symbols-outlined text-sm">check</span>
                )}
              </button>

              <p className="mb-3 truncate font-bold text-on-surface">{displayTitle(item)}</p>

              <div className="space-y-3">
                <RadioField
                  name="pillar"
                  label="פילר"
                  value={item.clip.pillar}
                  checked={pillar === (item.clip.pillar ?? "")}
                  onSelect={() => setPillar(item.clip.pillar ?? "")}
                />
                <RadioField
                  name="season"
                  label="עונה"
                  value={item.clip.season ? `${seasonIcon(item.clip.season)} ${item.clip.season}` : null}
                  checked={season === (item.clip.season ?? "")}
                  onSelect={() => setSeason(item.clip.season ?? "")}
                />
                <RadioField
                  name="wardrobe"
                  label="צעיף"
                  value={OPTIONS.wardrobe.find((w) => w.value === item.clip.wardrobe)?.label ?? item.clip.wardrobe}
                  checked={wardrobe === (item.clip.wardrobe ?? "")}
                  onSelect={() => setWardrobe(item.clip.wardrobe ?? "")}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2 rounded-lg bg-surface-container-low p-4 text-xs text-on-surface-variant">
          <p>
            <span className="font-bold text-on-surface">תגיות הקשר: </span>
            {contextTags.length > 0 ? contextTags.join(", ") : "—"}{" "}
            <span className="text-on-surface-variant/60">(איחוד)</span>
          </p>
          <p>
            <span className="font-bold text-on-surface">פורסם בטיקטוק: </span>
            {postedToTikTok ? "כן" : "לא"} <span className="text-on-surface-variant/60">(אוטומטי — או/או)</span>
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={merging}
            className="rounded-full border border-outline-variant px-5 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface disabled:opacity-60"
          >
            ביטול
          </button>
          <button
            onClick={confirmMerge}
            disabled={merging}
            className="rounded-full bg-primary px-5 py-2 text-xs font-bold text-on-primary hover:opacity-90 disabled:opacity-60"
          >
            {merging ? "ממזגת..." : `מיזוג ${items.length} הרשומות`}
          </button>
        </div>
      </div>
    </div>
  );
}

function RadioField({
  name,
  label,
  value,
  checked,
  onSelect,
}: {
  name: string;
  label: string;
  value: string | null;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-primary">
        {label}
      </label>
      <label className="flex items-center gap-2 text-xs text-on-surface">
        <input type="radio" name={name} checked={checked} onChange={onSelect} />
        {value ?? "—"}
      </label>
    </div>
  );
}
