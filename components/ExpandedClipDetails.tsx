"use client";

import { useEffect, useState, useTransition } from "react";
import {
  updateClipMetadataAction,
  listClipCopiesAction,
  addClipCopyAction,
  removeClipCopyAction,
  updateClipCopyPlatformAction,
  updateClipCopyPathAction,
  listClipPerformanceAction,
  upsertClipPerformanceAction,
  searchClipPathsAction,
  listKnownDriveFoldersAction,
} from "@/app/actions";
import { OPTIONS } from "@/lib/airtable";
import { PLATFORM_DISPLAY } from "@/lib/platforms";
import { isUrlPath, resolveCopyLink, KNOWN_DRIVE_FOLDERS, shortenFolderLabel } from "@/lib/paths";
import type { ClipCopy, ClipDetails, ClipLibraryRow, ClipPathMatch, ClipPerformance } from "@/lib/neon";
import { displayLink, displayTitle, seasonMatches, type MergedClip } from "@/lib/types";
import { CopiesPanel } from "./CopiesPanel";

type FullClip = ClipDetails;

/** קופי לפרסום — hidden for now per user request, not removed. */
const SHOW_COPIES_PANEL = false;

export function ExpandedClipDetails({
  item,
  fullClip,
  loadingDetail,
  onOpenSearchLink,
  onLibraryChange,
  onClipDetailsChange,
  onCopyPlatformsChange,
  contextTagOptions,
}: {
  item: MergedClip;
  fullClip: FullClip | null;
  loadingDetail: boolean;
  onOpenSearchLink: () => void;
  onLibraryChange: (row: ClipLibraryRow | null) => void;
  onClipDetailsChange: (updated: ClipDetails | null) => void;
  onCopyPlatformsChange: (platforms: string[]) => void;
  contextTagOptions: string[];
}) {
  const [activeTab, setActiveTab] = useState<"details" | "copies">("details");
  const [showTranscript, setShowTranscript] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [saving, startSaving] = useTransition();
  const [copies, setCopies] = useState<ClipCopy[]>([]);
  const [newCopyPath, setNewCopyPath] = useState("");
  const [knownFolders, setKnownFolders] = useState<string[]>(KNOWN_DRIVE_FOLDERS);
  const [editingCopyId, setEditingCopyId] = useState<string | null>(null);
  const [editPathInput, setEditPathInput] = useState("");
  const [performance, setPerformance] = useState<ClipPerformance[]>([]);
  const [addingLinkFor, setAddingLinkFor] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState("");

  const library = item.library;
  const thumbnail = fullClip?.thumbnail ?? item.clip.thumbnail;
  const link = displayLink(item);
  const contextTags = item.clip.context_tags ?? [];

  useEffect(() => {
    listClipCopiesAction(item.clip.id).then(setCopies);
    listClipPerformanceAction(item.clip.id).then(setPerformance);
    listKnownDriveFoldersAction().then((folders) =>
      setKnownFolders([...new Set([...KNOWN_DRIVE_FOLDERS, ...folders])])
    );
  }, [item.clip.id]);

  function notifyPlatforms(nextCopies: ClipCopy[], nextPerformance: ClipPerformance[]) {
    const platforms = new Set<string>();
    nextCopies.forEach((c) => c.platform && platforms.add(c.platform));
    nextPerformance.forEach((p) => p.platform && platforms.add(p.platform));
    if (nextCopies.some((c) => c.source_type === "upload")) platforms.add("googledrive");
    onCopyPlatformsChange([...platforms]);
  }

  function performanceFor(key: string) {
    return performance.find((p) => (p.platform ?? "").toLowerCase() === key.toLowerCase()) ?? null;
  }

  /** A clip whose own copy lives on a platform (e.g. it originated on Instagram, like the YouTube case, or a bare Drive path) counts as posted-with-a-link there too, not just an explicit clip_performance posting. Google Drive is special-cased: any 'upload' copy counts, whether or not its `platform` column is explicitly tagged "googledrive". */
  function platformStatus(key: string) {
    const copy =
      key.toLowerCase() === "googledrive"
        ? copies.find((c) => c.source_type === "upload" || (c.platform ?? "").toLowerCase() === key.toLowerCase())
        : copies.find((c) => (c.platform ?? "").toLowerCase() === key.toLowerCase());
    const perf = performanceFor(key);
    const link = copy ? resolveCopyLink(copy.path) : (perf?.live_post_url ?? null);
    return { posted: !!copy || !!perf, link, perf };
  }

  function markPosted(key: string) {
    startSaving(async () => {
      const created = await upsertClipPerformanceAction({
        clip_det_id: item.clip.id,
        platform: key.toLowerCase(),
        views: null,
        likes: null,
        shares: null,
        comments: null,
        status: null,
        hook_key_line: null,
        hashtags: null,
        live_post_url: null,
        date_posted: null,
      });
      const next = [...performance, created];
      setPerformance(next);
      notifyPlatforms(copies, next);
    });
  }

  function saveLink(row: ClipPerformance) {
    const url = linkInput.trim();
    if (!url) return;
    startSaving(async () => {
      const updated = await upsertClipPerformanceAction({ ...row, live_post_url: url });
      const next = performance.map((p) => (p.id === updated.id ? updated : p));
      setPerformance(next);
      notifyPlatforms(copies, next);
      setAddingLinkFor(null);
      setLinkInput("");
    });
  }

  function copyHook(hook: string, i: number) {
    navigator.clipboard.writeText(hook);
    setCopiedIndex(i);
    setTimeout(() => setCopiedIndex(null), 1500);
  }

  function editField(field: "pillar" | "season" | "usable" | "wardrobe", value: string) {
    startSaving(async () => {
      const updated = await updateClipMetadataAction(item.clip.id, { [field]: value || undefined });
      onClipDetailsChange(updated);
    });
  }

  function saveContextTags(nextTags: string[]) {
    startSaving(async () => {
      const updated = await updateClipMetadataAction(item.clip.id, { contextTags: nextTags });
      onClipDetailsChange(updated);
    });
  }

  function addCopy() {
    const path = newCopyPath.trim();
    if (!path) return;
    const sourceType = isUrlPath(path) ? "url" : "upload";
    startSaving(async () => {
      const copy = await addClipCopyAction(item.clip.id, sourceType, path);
      setCopies((prev) => [...prev, copy]);
      setNewCopyPath("");
    });
  }

  function setCopyPlatform(copyId: string, platform: string) {
    startSaving(async () => {
      const updated = await updateClipCopyPlatformAction(copyId, platform || null);
      const next = copies.map((c) => (c.id === copyId ? updated : c));
      setCopies(next);
      notifyPlatforms(next, performance);
    });
  }

  function removeCopy(copyId: string) {
    startSaving(async () => {
      await removeClipCopyAction(copyId);
      const next = copies.filter((c) => c.id !== copyId);
      setCopies(next);
      notifyPlatforms(next, performance);
    });
  }

  function startEditPath(copy: ClipCopy) {
    setEditingCopyId(copy.id);
    setEditPathInput(copy.path);
  }

  function saveEditPath(copyId: string) {
    const path = editPathInput.trim();
    if (!path) return;
    startSaving(async () => {
      const updated = await updateClipCopyPathAction(copyId, path);
      const next = copies.map((c) => (c.id === copyId ? updated : c));
      setCopies(next);
      notifyPlatforms(next, performance);
      setEditingCopyId(null);
    });
  }

  function addTag() {
    const tag = tagInput.trim();
    if (!tag || contextTags.includes(tag)) {
      setTagInput("");
      return;
    }
    setTagInput("");
    setTagDropdownOpen(false);
    saveContextTags([...contextTags, tag]);
  }

  function selectExistingTag(tag: string) {
    setTagInput("");
    setTagDropdownOpen(false);
    if (contextTags.includes(tag)) return;
    saveContextTags([...contextTags, tag]);
  }

  const tagSuggestions = contextTagOptions.filter(
    (t) => !contextTags.includes(t) && t.toLowerCase().includes(tagInput.trim().toLowerCase())
  );

  function removeTag(tag: string) {
    saveContextTags(contextTags.filter((t) => t !== tag));
  }

  function acceptSuggestedTag(tag: string) {
    saveContextTags([...contextTags, tag]);
  }

  const suggestedTag =
    fullClip?.tag && !contextTags.includes(fullClip.tag) ? fullClip.tag : null;

  const isSeasonActive = (value: string) => seasonMatches(item.clip.season ?? null, value);
  const hasPerformanceData = library && (library.status || library.views !== null);

  return (
    <div className="col-span-12 grid grid-cols-12 gap-16 border-x border-b border-outline-variant bg-surface-container-low p-8">
      {/* Thumbnail + summary / hooks / transcript */}
      <div className="col-span-12 flex flex-col gap-6 sm:flex-row lg:col-span-7 lg:max-w-[calc(100%-200px)]">
        <ClipThumbnail thumbnail={thumbnail} link={link} title={displayTitle(item)} />

        <div className="flex-1">
          {loadingDetail && !fullClip && (
            <p className="text-sm text-on-surface-variant">טוענת פרטי קליפ...</p>
          )}
          {fullClip && (
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 text-headline-sm font-headline-sm text-on-surface">
                  סיכום וידאו
                </h3>
                <p className="text-sm leading-relaxed text-on-surface-variant">
                  {fullClip.summary ?? "אין סיכום זמין עדיין"}
                </p>
                {fullClip.warning && (
                  <p className="mt-2 text-xs font-bold text-error">{fullClip.warning}</p>
                )}
              </div>

              {fullClip.hooks.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary">
                      הצעות הוק
                    </h4>
                    <span className="text-[10px] text-on-surface-variant/60">
                      {fullClip.hooks.length} וריאציות
                    </span>
                  </div>
                  <div className="space-y-2">
                    {fullClip.hooks.map((hook, i) => (
                      <div
                        key={i}
                        className="group flex items-center justify-between rounded border border-outline-variant/30 bg-surface-container-lowest p-3 transition-all hover:border-primary/50"
                      >
                        <p className="pl-4 text-sm text-on-surface">{hook}</p>
                        <button
                          onClick={() => copyHook(hook, i)}
                          className="rounded border border-outline-variant bg-surface-container px-3 py-1 text-[10px] font-bold text-on-surface transition-all hover:border-primary hover:text-primary active:scale-90"
                        >
                          {copiedIndex === i ? "הועתקה!" : "העתקה"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {fullClip.transcript && (
                <button
                  onClick={() => setShowTranscript((v) => !v)}
                  className="flex items-center gap-2 pt-1 text-xs font-bold uppercase tracking-widest text-primary transition-opacity hover:opacity-80"
                >
                  <span className="material-symbols-outlined text-sm">description</span>
                  {showTranscript ? "הסתרת תמלול" : "תמלול מלא"}
                </button>
              )}
              {showTranscript && (
                <p className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded bg-surface-container-lowest p-4 text-xs leading-relaxed text-on-surface-variant">
                  {fullClip.transcript}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Metadata — always editable, linked or not */}
      <div className="col-span-12 lg:col-span-5">
        <div className="mb-4 flex gap-1 rounded-full bg-surface-container-high p-1">
          <button
            onClick={() => setActiveTab("details")}
            className={`flex-1 rounded-full py-2 text-xs font-bold transition-colors ${
              activeTab === "details"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            פרטים
          </button>
          <button
            onClick={() => setActiveTab("copies")}
            className={`flex-1 rounded-full py-2 text-xs font-bold transition-colors ${
              activeTab === "copies"
                ? "bg-primary text-on-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            עותקים ({copies.length})
          </button>
        </div>

        {activeTab === "copies" ? (
          <div className="space-y-4">
            {copies.length > 0 ? (
              <ul className="space-y-2">
                {copies.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-1.5 rounded border border-outline-variant/30 bg-surface-container-lowest p-3 text-xs text-on-surface-variant"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                        {isUrlPath(c.path) ? "קישור" : "קובץ ב-Google Drive"}
                      </p>
                      {editingCopyId === c.id ? (
                        <PathAutocompleteInput
                          value={editPathInput}
                          onChange={setEditPathInput}
                          onCommit={() => saveEditPath(c.id)}
                          onCancel={() => setEditingCopyId(null)}
                          excludeClipDetId={item.clip.id}
                          knownFolders={knownFolders}
                          disabled={saving}
                          autoFocus
                          commitOnBlur
                          inputClassName="w-full rounded border border-outline-variant bg-surface-container px-2 py-1 text-xs text-on-surface disabled:opacity-60"
                        />
                      ) : (
                        <>
                          {c.title && (
                            <span className="block truncate font-bold text-on-surface">{c.title}</span>
                          )}
                          <span className="block truncate" title={c.path}>{c.path}</span>
                        </>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="flex items-center gap-1">
                        {PLATFORM_DISPLAY.map(({ key, label, Icon, color }) => {
                          const active = (c.platform ?? "").toLowerCase() === key.toLowerCase();
                          return (
                            <button
                              key={key}
                              title={label}
                              disabled={saving}
                              onClick={() => setCopyPlatform(c.id, active ? "" : key.toLowerCase())}
                              style={active ? { borderColor: color, backgroundColor: `${color}1A` } : undefined}
                              className={`flex h-6 w-6 items-center justify-center rounded-full border transition-colors disabled:opacity-60 ${
                                active
                                  ? ""
                                  : "border-outline-variant text-on-surface-variant/50 hover:border-primary/40"
                              }`}
                            >
                              <Icon className="h-3.5 w-3.5" style={active ? { color } : undefined} />
                            </button>
                          );
                        })}
                      </div>
                      <a
                        href={resolveCopyLink(c.path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={c.path}
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                      </a>
                      <button
                        onClick={() => startEditPath(c)}
                        disabled={saving}
                        aria-label="עריכת נתיב"
                        className="text-on-surface-variant/60 hover:text-primary disabled:opacity-60"
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                      <button
                        onClick={() => removeCopy(c.id)}
                        disabled={saving}
                        aria-label="הסרת עותק"
                        className="text-on-surface-variant/60 hover:text-error disabled:opacity-60"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-on-surface-variant">אין עותקים</p>
            )}

            <div className="flex items-start gap-2">
              <PathAutocompleteInput
                value={newCopyPath}
                onChange={setNewCopyPath}
                onCommit={addCopy}
                excludeClipDetId={item.clip.id}
                knownFolders={knownFolders}
                disabled={saving}
                placeholder="נתיב ב-Drive או קישור ביוטיוב..."
              />
              <button
                onClick={addCopy}
                disabled={saving || !newCopyPath.trim()}
                className="shrink-0 rounded bg-primary px-3 py-2 text-[11px] font-bold text-on-primary disabled:opacity-60"
              >
                הוספה
              </button>
            </div>
          </div>
        ) : (
        <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {PLATFORM_DISPLAY.map(({ key, label, Icon, color }) => {
            const { posted, link, perf } = platformStatus(key);
            const hasLink = !!link;
            return (
              <div key={key} className="flex flex-col gap-1.5">
                <button
                  onClick={() => {
                    if (!posted) {
                      markPosted(key);
                      return;
                    }
                    if (hasLink) {
                      window.open(link!, "_blank", "noopener,noreferrer");
                      return;
                    }
                    setAddingLinkFor(addingLinkFor === key ? null : key);
                    setLinkInput("");
                  }}
                  disabled={saving}
                  style={posted ? { color, borderColor: color, backgroundColor: `${color}1A` } : undefined}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-colors disabled:opacity-60 ${
                    posted
                      ? "hover:opacity-80"
                      : "border-outline-variant text-on-surface-variant hover:border-primary/40"
                  }`}
                >
                  <Icon className="h-4 w-4" style={posted ? { color } : undefined} />
                  {label}
                  {posted && (
                    <span className="material-symbols-outlined text-xs">
                      {hasLink ? "open_in_new" : "link_off"}
                    </span>
                  )}
                </button>

                {addingLinkFor === key && perf && (
                  <div className="flex items-center gap-1.5">
                    <input
                      value={linkInput}
                      onChange={(e) => setLinkInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          saveLink(perf);
                        }
                      }}
                      placeholder="קישור לפוסט..."
                      autoFocus
                      disabled={saving}
                      className="min-w-0 flex-1 rounded border border-outline-variant bg-surface-container-lowest px-2 py-1 text-[11px] text-on-surface disabled:opacity-60"
                    />
                    <button
                      onClick={() => saveLink(perf)}
                      disabled={saving || !linkInput.trim()}
                      className="shrink-0 rounded bg-primary px-2 py-1 text-[10px] font-bold text-on-primary disabled:opacity-60"
                    >
                      שמירה
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-primary">
            פילר
          </label>
          <select
            value={item.clip.pillar ?? ""}
            disabled={saving}
            onChange={(e) => editField("pillar", e.target.value)}
            className="w-full rounded border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs text-on-surface disabled:opacity-60"
          >
            <option value="">—</option>
            {OPTIONS.pillar.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-primary">
            עונה
          </label>
          <div className="flex gap-2">
            {OPTIONS.season.map((s) => (
              <button
                key={s.value}
                disabled={saving}
                onClick={() => editField("season", s.value)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-full border py-2 text-xs font-bold transition-all disabled:opacity-60 ${
                  isSeasonActive(s.value)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-outline-variant text-on-surface-variant hover:border-primary/40"
                }`}
              >
                <span>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-primary">
            תגיות הקשר <span className="font-normal normal-case text-on-surface-variant/60">(אירועים, חגים, ריטריט ספציפי)</span>
          </label>
          <div className="relative">
            <div className="flex flex-wrap items-center gap-1.5 rounded border border-outline-variant bg-surface-container-lowest p-2">
              {contextTags.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary"
                >
                  {tag}
                  <button onClick={() => removeTag(tag)} disabled={saving} aria-label={`הסרת תגית ${tag}`}>
                    <span className="material-symbols-outlined text-xs leading-none">close</span>
                  </button>
                </span>
              ))}
              {suggestedTag && (
                <button
                  onClick={() => acceptSuggestedTag(suggestedTag)}
                  disabled={saving}
                  title="תגית מוצעת מהניתוח האוטומטי — לחיצה מוסיפה אותה"
                  className="flex items-center gap-1 rounded-full border border-dashed border-primary/50 px-2.5 py-1 text-[11px] font-bold text-primary disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-xs leading-none">add</span>
                  {suggestedTag}
                </button>
              )}
              <input
                value={tagInput}
                disabled={saving}
                onChange={(e) => {
                  setTagInput(e.target.value);
                  setTagDropdownOpen(true);
                }}
                onFocus={() => setTagDropdownOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTag();
                  }
                  if (e.key === "Escape") setTagDropdownOpen(false);
                }}
                onBlur={addTag}
                placeholder="הוספת תגית..."
                className="min-w-[80px] flex-1 border-none bg-transparent p-1 text-xs text-on-surface focus:outline-none disabled:opacity-60"
              />
            </div>

            {tagDropdownOpen && tagSuggestions.length > 0 && (
              <ul className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded border border-outline-variant bg-surface-container-lowest shadow-lg">
                {tagSuggestions.map((tag) => (
                  <li key={tag}>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectExistingTag(tag)}
                      className="block w-full px-3 py-1.5 text-right text-xs text-on-surface hover:bg-surface-container"
                    >
                      {tag}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-primary">
            שמיש
          </label>
          <div className="flex gap-2">
            {OPTIONS.usable.map((u) => (
              <button
                key={u.value}
                disabled={saving}
                onClick={() => editField("usable", u.value)}
                className={`flex-1 rounded-full border py-2 text-xs font-bold transition-all disabled:opacity-60 ${
                  item.clip.usable === u.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-outline-variant text-on-surface-variant hover:border-primary/40"
                }`}
              >
                {u.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-primary">
            צעיף
          </label>
          <div className="flex flex-wrap gap-2">
            {OPTIONS.wardrobe.map((w) => (
              <button
                key={w.value}
                title={w.label}
                disabled={saving}
                onClick={() => editField("wardrobe", w.value)}
                style={
                  w.image
                    ? { backgroundImage: `url("${encodeURI(w.image)}")`, backgroundSize: "cover" }
                    : w.colorHex
                      ? { backgroundColor: w.colorHex }
                      : undefined
                }
                className={`h-6 w-6 rounded-full disabled:opacity-60 ${
                  w.colorHex || w.image ? "" : "border-2 border-dashed border-outline-variant bg-transparent"
                } ${
                  item.clip.wardrobe === w.value
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-surface-container-low"
                    : "ring-1 ring-outline-variant/40"
                }`}
              />
            ))}
          </div>
        </div>

        {hasPerformanceData && library && (
          <>
            <div className="grid grid-cols-3 gap-3">
              <Metric label="חשיפה" value={library.views} />
              <Metric label="לייקים" value={library.likes} />
              <Metric label="שיתופים" value={library.shares} />
            </div>

            {library.status && (
              <span className="rounded-full bg-surface-container-highest px-3 py-1.5 text-[11px] font-bold text-on-surface-variant">
                {library.status}
              </span>
            )}
          </>
        )}

        {/* קופי לפרסום — hidden for now, not removed */}
        {SHOW_COPIES_PANEL && (
          <CopiesPanel clipId={item.clip.id} library={library} onChanged={onLibraryChange} />
        )}

        <button
          onClick={onOpenSearchLink}
          className="text-[11px] font-bold text-primary hover:underline"
        >
          זיהוי כפילות
        </button>
        </div>
        )}
      </div>
    </div>
  );
}

function ClipThumbnail({
  thumbnail,
  link,
  title,
}: {
  thumbnail: string | null;
  link: string | null;
  title: string;
}) {
  const content = (
    <div className="flex h-64 w-40 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container-high">
      {thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumbnail} alt={title} className="h-full w-full object-cover" />
      ) : (
        <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">
          movie
        </span>
      )}
    </div>
  );

  if (!link) return content;

  return (
    <a href={link} target="_blank" rel="noopener noreferrer" title="פתיחת הקליפ ביוטיוב">
      {content}
    </a>
  );
}

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded border border-outline-variant/30 bg-surface-container-lowest p-3">
      <p className="mb-1 text-[10px] text-on-surface-variant">{label}</p>
      <span className="text-lg font-bold text-on-surface">{value ?? "—"}</span>
    </div>
  );
}

/**
 * A Drive-path/URL input with the shared smart dropdown: known-folder suggestions (for a bare
 * path with no `/` yet) and duplicate-path search against other clips — used for both adding a
 * new copy and editing an existing one's path.
 */
function PathAutocompleteInput({
  value,
  onChange,
  onCommit,
  onCancel,
  excludeClipDetId,
  knownFolders,
  disabled,
  placeholder,
  autoFocus,
  commitOnBlur,
  inputClassName,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onCancel?: () => void;
  excludeClipDetId: string;
  knownFolders: string[];
  disabled?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  commitOnBlur?: boolean;
  inputClassName?: string;
}) {
  const [pathMatches, setPathMatches] = useState<ClipPathMatch[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    const query = value.trim();
    const timeout = setTimeout(() => {
      if (query.length < 2) {
        setPathMatches([]);
      } else {
        searchClipPathsAction(query, excludeClipDetId).then(setPathMatches);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [value, excludeClipDetId]);

  const folderMatches =
    !isUrlPath(value) && !value.includes("/")
      ? knownFolders.filter((f) => shortenFolderLabel(f).toLowerCase().includes(value.trim().toLowerCase()))
      : [];

  return (
    <div className="relative min-w-0 flex-1">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setDropdownOpen(true);
        }}
        onFocus={() => setDropdownOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onCommit();
          }
          if (e.key === "Escape") {
            setDropdownOpen(false);
            onCancel?.();
          }
        }}
        onBlur={() => {
          if (commitOnBlur) onCommit();
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
        className={
          inputClassName ??
          "w-full rounded border border-outline-variant bg-surface-container-lowest px-3 py-2 text-xs text-on-surface disabled:opacity-60"
        }
      />

      {dropdownOpen && (folderMatches.length > 0 || pathMatches.length > 0) && (
        <ul className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded border border-outline-variant bg-surface-container-lowest shadow-lg">
          {folderMatches.length > 0 && (
            <>
              <li className="px-3 pt-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant/60">
                תיקיות ידועות
              </li>
              {folderMatches.map((folder) => (
                <li key={folder}>
                  <button
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(folder + "/");
                      setDropdownOpen(true);
                    }}
                    className="block w-full px-3 py-1.5 text-right text-xs text-on-surface hover:bg-surface-container"
                  >
                    {shortenFolderLabel(folder)}
                  </button>
                </li>
              ))}
            </>
          )}
          {pathMatches.map((match) => (
            <li key={match.copyId}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(match.path);
                  setDropdownOpen(false);
                }}
                className="block w-full px-3 py-1.5 text-right text-xs hover:bg-surface-container"
              >
                <span className="block truncate text-on-surface">{match.path}</span>
                <span className="block truncate text-[10px] text-on-surface-variant/60">
                  כבר קיים בקליפ: {match.title ?? "ללא כותרת"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {pathMatches.some((m) => m.path.toLowerCase() === value.trim().toLowerCase()) && (
        <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-error">
          <span className="material-symbols-outlined text-xs">warning</span>
          הנתיב הזה כבר קיים בקליפ אחר
        </p>
      )}
    </div>
  );
}
