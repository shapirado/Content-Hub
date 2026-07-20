"use client";

import { useState, useTransition } from "react";
import { mergeRawClipRecordsAction, type RawClipBrowserRecord } from "@/app/actions";
import { seasonIcon } from "@/lib/types";

/**
 * Side-by-side comparison for merging two Raw Clip Library records that describe the same
 * real clip. Usable/context tags/TikTok-posted/Alternate Sources auto-resolve (shown as a
 * read-only preview below); pillar/season/wardrobe are a manual radio-pick since either
 * record's value could be the intended one.
 */
export function MergeRawClipsModal({
  recordA,
  recordB,
  onClose,
  onMerged,
}: {
  recordA: RawClipBrowserRecord;
  recordB: RawClipBrowserRecord;
  onClose: () => void;
  onMerged: () => Promise<void>;
}) {
  const [survivorId, setSurvivorId] = useState(recordA.id);
  const [pillar, setPillar] = useState(recordA.pillar ?? "");
  const [season, setSeason] = useState(recordA.season ?? "");
  const [wardrobe, setWardrobe] = useState(recordA.wardrobe ?? "");
  const [merging, startMerge] = useTransition();

  const survivor = survivorId === recordA.id ? recordA : recordB;
  const loser = survivorId === recordA.id ? recordB : recordA;

  const resolvedUsable = survivor.usable || loser.usable || null;
  const resolvedTags = [...new Set([...recordA.contextTags, ...recordB.contextTags])];
  const resolvedTikTok = recordA.postedToTikTok || recordB.postedToTikTok;
  const loserEntry = loser.youtubeLink ? `${loser.name} — ${loser.youtubeLink}` : loser.name;
  const resolvedAlternateSources = [
    ...new Set([...recordA.alternateSources, ...recordB.alternateSources, loserEntry]),
  ];

  function confirmMerge() {
    startMerge(async () => {
      await mergeRawClipRecordsAction(survivor.id, loser.id, {
        pillar: pillar || undefined,
        season: season || undefined,
        wardrobe: wardrobe || undefined,
      });
      await onMerged();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-headline-sm font-headline-sm text-on-surface">
            מיזוג רשומות כפולות
          </h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <p className="mb-4 text-xs text-on-surface-variant">
          בחירת הרשומה השורדת קובעת את השם שנשאר. עבור פילר/עונה/צעיף — בחירה ידנית לכל שדה. שאר
          המידע (שמיש, תגיות, טיקטוק, ופוסטים קודמים) נשמר אוטומטית ולא הולך לאיבוד.
        </p>

        <div className="grid grid-cols-2 gap-4">
          {[recordA, recordB].map((r) => (
            <div
              key={r.id}
              className={`rounded-lg border p-4 ${
                survivorId === r.id ? "border-primary bg-primary/5" : "border-outline-variant"
              }`}
            >
              <button
                onClick={() => setSurvivorId(r.id)}
                className={`mb-3 flex w-full items-center justify-between rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                  survivorId === r.id
                    ? "bg-primary text-on-primary"
                    : "border border-outline-variant text-on-surface-variant hover:border-primary/40"
                }`}
              >
                {survivorId === r.id ? "רשומה שורדת" : "בחירה כשורדת"}
                {survivorId === r.id && (
                  <span className="material-symbols-outlined text-sm">check</span>
                )}
              </button>

              <p className="mb-1 truncate font-bold text-on-surface">{r.name}</p>
              {r.youtubeLink ? (
                <a
                  href={r.youtubeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-3 block truncate text-[11px] text-primary hover:underline"
                >
                  {r.youtubeLink}
                </a>
              ) : (
                <p className="mb-3 text-[11px] text-on-surface-variant/60">אין קישור יוטיוב</p>
              )}

              <div className="space-y-3">
                <RadioField
                  name="pillar"
                  label="פילר"
                  value={r.pillar}
                  checked={pillar === (r.pillar ?? "")}
                  onSelect={() => setPillar(r.pillar ?? "")}
                />
                <RadioField
                  name="season"
                  label="עונה"
                  value={r.season ? `${seasonIcon(r.season)} ${r.season}` : null}
                  checked={season === (r.season ?? "")}
                  onSelect={() => setSeason(r.season ?? "")}
                />
                <RadioField
                  name="wardrobe"
                  label="צעיף"
                  value={r.wardrobe}
                  checked={wardrobe === (r.wardrobe ?? "")}
                  onSelect={() => setWardrobe(r.wardrobe ?? "")}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-2 rounded-lg bg-surface-container-low p-4 text-xs text-on-surface-variant">
          <p>
            <span className="font-bold text-on-surface">שמיש: </span>
            {resolvedUsable ?? "—"} <span className="text-on-surface-variant/60">(אוטומטי — הערך הלא-ריק גובר)</span>
          </p>
          <p>
            <span className="font-bold text-on-surface">תגיות הקשר: </span>
            {resolvedTags.length > 0 ? resolvedTags.join(", ") : "—"}{" "}
            <span className="text-on-surface-variant/60">(איחוד)</span>
          </p>
          <p>
            <span className="font-bold text-on-surface">פורסם בטיקטוק: </span>
            {resolvedTikTok ? "כן" : "לא"} <span className="text-on-surface-variant/60">(אוטומטי — או/או)</span>
          </p>
          <p>
            <span className="font-bold text-on-surface">מקורות נוספים לאחר המיזוג: </span>
            {resolvedAlternateSources.join(" | ")}
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
            {merging ? "ממזגת..." : "מיזוג ומחיקת הכפולה"}
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
