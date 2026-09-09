"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MassarYomClip } from "@/lib/neon";
import {
  uploadToYouTubeAction,
  markTaskPostedAction,
  setChecklistFlagAction,
} from "@/app/actions";
import { MassarYomAddForm } from "./MassarYomAddForm";

const HE_MONTH = [
  "ינואר","פברואר","מרץ","אפריל","מאי","יוני",
  "יולי","אוגוסט","ספטמבר","אוקטובר","נובמבר","דצמבר",
];

function formatDate(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return `${d} ב${HE_MONTH[m - 1]} ${y}`;
}

function CheckStep({
  done,
  label,
  onToggle,
  pending,
}: {
  done: boolean;
  label: string;
  onToggle?: () => void;
  pending?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {onToggle ? (
        <button
          onClick={onToggle}
          disabled={pending || done}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
            done
              ? "border-primary bg-primary text-on-primary"
              : "border-outline-variant bg-surface text-on-surface-variant hover:border-primary"
          } disabled:opacity-60`}
        >
          {done && <span className="material-symbols-outlined text-xs">check</span>}
        </button>
      ) : (
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-bold ${
            done
              ? "border-primary bg-primary text-on-primary"
              : "border-outline-variant text-on-surface-variant"
          }`}
        >
          {done ? <span className="material-symbols-outlined text-xs">check</span> : "○"}
        </span>
      )}
      <span className={done ? "text-on-surface-variant line-through" : "text-on-surface"}>
        {label}
      </span>
    </div>
  );
}

function ClipCard({
  clip,
  onRefresh,
}: {
  clip: MassarYomClip;
  onRefresh: () => void;
}) {
  const tiktokTask = clip.tasks.find((t) => t.platform === "tiktok");
  const youtubeTask = clip.tasks.find((t) => t.platform === "youtube");

  const [tiktokUrl, setTiktokUrl] = useState("");
  const [showTiktokInput, setShowTiktokInput] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleGoogleDrive() {
    startTransition(async () => {
      await setChecklistFlagAction(clip.id, "google_drive_uploaded", true);
      onRefresh();
    });
  }

  function handleWebsite() {
    startTransition(async () => {
      await setChecklistFlagAction(clip.id, "website_added", true);
      onRefresh();
    });
  }

  function handleTiktokSubmit() {
    if (!tiktokTask || !tiktokUrl.trim()) return;
    startTransition(async () => {
      await markTaskPostedAction(tiktokTask.id, tiktokUrl.trim());
      setShowTiktokInput(false);
      setTiktokUrl("");
      onRefresh();
    });
  }

  function handleYouTubeUpload() {
    startTransition(async () => {
      await uploadToYouTubeAction(clip.id);
      onRefresh();
    });
  }

  const scheduledDate = clip.tasks[0]?.scheduled_date;

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4 text-right">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-on-surface">{clip.title ?? "מסר יום"}</p>
          {scheduledDate && (
            <p className="text-xs text-on-surface-variant">
              תאריך פרסום: {formatDate(scheduledDate)}
            </p>
          )}
          <p className="text-[11px] text-on-surface-variant">
            נוצר: {clip.created_at.slice(0, 10)}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {/* Step 1: Content Hub upload — always done */}
        <CheckStep done label="הועלה ל-Content Hub" />

        {/* Step 2: Google Drive */}
        <CheckStep
          done={clip.google_drive_uploaded}
          label="הועלה ל-Google Drive"
          onToggle={handleGoogleDrive}
          pending={pending}
        />

        {/* Step 3: TikTok */}
        <div className="space-y-1">
          <CheckStep
            done={!!tiktokTask?.live_url}
            label={
              tiktokTask?.live_url
                ? "פורסם ל-TikTok"
                : "פרסום ל-TikTok"
            }
          />
          {tiktokTask && !tiktokTask.live_url && (
            <div className="mr-7">
              {showTiktokInput ? (
                <div className="flex items-center gap-1">
                  <input
                    value={tiktokUrl}
                    onChange={(e) => setTiktokUrl(e.target.value)}
                    placeholder="https://www.tiktok.com/..."
                    dir="ltr"
                    className="flex-1 rounded-lg border border-outline-variant bg-surface px-2 py-1 text-sm text-on-surface outline-none focus:border-primary"
                  />
                  <button
                    onClick={handleTiktokSubmit}
                    disabled={pending || !tiktokUrl.trim()}
                    className="rounded-lg bg-primary px-2 py-1 text-xs font-bold text-on-primary disabled:opacity-60"
                  >
                    שמירה
                  </button>
                  <button
                    onClick={() => setShowTiktokInput(false)}
                    className="rounded-lg border border-outline-variant px-2 py-1 text-xs text-on-surface-variant"
                  >
                    ביטול
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowTiktokInput(true)}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  + הוספת קישור TikTok
                </button>
              )}
            </div>
          )}
          {tiktokTask?.live_url && (
            <div className="mr-7">
              <a
                href={tiktokTask.live_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
                dir="ltr"
              >
                {tiktokTask.live_url}
              </a>
            </div>
          )}
        </div>

        {/* Step 4: YouTube */}
        <div className="space-y-1">
          <CheckStep
            done={!!youtubeTask?.live_url}
            label={youtubeTask?.live_url ? "הועלה ל-YouTube (לא רשום)" : "העלאה ל-YouTube"}
          />
          {youtubeTask && !youtubeTask.live_url && (
            <div className="mr-7">
              <button
                onClick={handleYouTubeUpload}
                disabled={pending}
                className="flex items-center gap-1 rounded-lg bg-red-100 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-200 disabled:opacity-60"
              >
                {pending ? (
                  <>
                    <span className="material-symbols-outlined animate-spin text-xs">autorenew</span>
                    מעלה ל-YouTube...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-xs">smart_display</span>
                    העלאה ל-YouTube
                  </>
                )}
              </button>
            </div>
          )}
          {youtubeTask?.live_url && (
            <div className="mr-7">
              <a
                href={youtubeTask.live_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline"
                dir="ltr"
              >
                {youtubeTask.live_url}
              </a>
            </div>
          )}
        </div>

        {/* Step 5: Website */}
        <CheckStep
          done={clip.website_added}
          label="נוסף לאתר"
          onToggle={handleWebsite}
          pending={pending}
        />
      </div>

      {/* Hook preview */}
      {clip.hooks[0] && (
        <div className="mt-3 rounded-xl bg-surface-container p-2">
          <p className="text-[11px] font-bold text-on-surface-variant">הוק:</p>
          <p className="text-xs text-on-surface">{clip.hooks[0]}</p>
        </div>
      )}
    </div>
  );
}


export function MassarYomPanel({
  initialClips,
}: {
  initialClips: MassarYomClip[];
}) {
  const router = useRouter();
  const [clips, setClips] = useState(initialClips);
  const [showForm, setShowForm] = useState(false);

  function handleRefresh() {
    router.refresh();
  }

  function handleDone() {
    setShowForm(false);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-on-surface">מסר יום</h1>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-on-primary"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          הוספת מסר
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-3xl border border-outline-variant bg-surface-container-low p-6">
          <h2 className="mb-4 text-right text-lg font-bold text-on-surface">מסר חדש</h2>
          <MassarYomAddForm onDone={handleDone} />
        </div>
      )}

      {clips.length === 0 && !showForm && (
        <p className="rounded-2xl border border-outline-variant bg-surface-container-low p-8 text-center text-on-surface-variant">
          אין מסרי יום עדיין. לחץ על "הוספת מסר" כדי להתחיל.
        </p>
      )}

      <div className="space-y-4">
        {clips.map((clip) => (
          <ClipCard key={clip.id} clip={clip} onRefresh={handleRefresh} />
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-outline-variant bg-surface-container-low p-4 text-right">
        <p className="mb-1 text-xs font-bold text-on-surface-variant">הגדרת YouTube (חד-פעמי)</p>
        <a
          href="/daily/youtube-auth"
          className="text-xs text-primary hover:underline"
        >
          הרשאת OAuth ל-YouTube ←
        </a>
      </div>
    </div>
  );
}
