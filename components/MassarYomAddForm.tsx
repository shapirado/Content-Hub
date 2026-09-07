"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { DatePicker as AntDatePicker, ConfigProvider } from "antd";
import he_IL from "antd/locale/he_IL";
import dayjs, { type Dayjs } from "dayjs";
import "dayjs/locale/he";
import updateLocale from "dayjs/plugin/updateLocale";
import { createMassarYomAction } from "@/app/actions";

dayjs.extend(updateLocale);
dayjs.locale("he");
dayjs.updateLocale("he", { weekStart: 0 });

const LOADING_MESSAGES = [
  "מעלה את הקובץ...",
  "מתמללת...",
  "מעלה ל-YouTube...",
  "מייצרת הוק והאשטגים...",
  "שומרת...",
];

const DIR_HANDLE_KEY = "massarYom_lastDirHandle";

export function MassarYomAddForm({ onDone }: { onDone: () => void }) {
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [caption, setCaption] = useState("");
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [youtubeWarning, setYoutubeWarning] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();

  // Fallback for browsers that don't support showOpenFilePicker
  const fileRef = useRef<HTMLInputElement>(null);
  const supportsFilePicker = typeof window !== "undefined" && "showOpenFilePicker" in window;

  // Persist last-used directory handle in sessionStorage (IndexedDB would survive across tabs
  // but FileSystemDirectoryHandle can't be JSON-serialised — we keep the handle in memory
  // across re-renders via a ref and restore from the browser's own picker memory otherwise)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lastDirHandleRef = useRef<any>(null);

  async function pickFile() {
    try {
      const opts: Record<string, unknown> = {
        types: [{ description: "Video", accept: { "video/*": [".mp4", ".mov", ".m4v"] } }],
        multiple: false,
      };
      if (lastDirHandleRef.current) {
        opts.startIn = lastDirHandleRef.current;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [handle] = await (window as any).showOpenFilePicker(opts);
      // Remember the parent directory for next time
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dir = await (handle as any).getParent?.();
        if (dir) lastDirHandleRef.current = dir;
      } catch { /* ignore */ }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const file = await (handle as any).getFile();
      setPickedFile(file);
    } catch (err) {
      // User cancelled — not an error
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("showOpenFilePicker failed:", err);
    }
  }

  function handleFallbackChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPickedFile(e.target.files?.[0] ?? null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduledDate || !caption.trim()) return;
    if (!pickedFile) return;

    setError(null);
    setYoutubeWarning(null);
    let msgIdx = 0;
    setLoadingMsg(LOADING_MESSAGES[0]);
    const interval = setInterval(() => {
      msgIdx = Math.min(msgIdx + 1, LOADING_MESSAGES.length - 1);
      setLoadingMsg(LOADING_MESSAGES[msgIdx]);
    }, 8000);

    startUpload(async () => {
      try {
        const formData = new FormData();
        formData.set("videoFile", pickedFile);
        if (videoUrl.trim()) formData.set("videoUrl", videoUrl.trim());
        formData.set("scheduledDate", scheduledDate);
        formData.set("niritCaption", caption.trim());

        const result = await createMassarYomAction(formData);
        if (result.youtubeError) {
          setYoutubeWarning(`הקליפ נשמר — העלאה ל-YouTube נכשלה: ${result.youtubeError}`);
        }
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "שגיאה לא ידועה");
      } finally {
        clearInterval(interval);
        setLoadingMsg("");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-right">
      {/* File picker */}
      <div>
        <label className="mb-1 block text-xs font-bold text-on-surface-variant">
          קובץ וידאו *
        </label>
        {supportsFilePicker ? (
          <button
            type="button"
            onClick={pickFile}
            className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-right text-on-surface hover:bg-surface-container transition-colors"
          >
            {pickedFile ? (
              <span className="flex items-center justify-between gap-2">
                <span className="material-symbols-outlined text-sm text-primary">check_circle</span>
                <span className="flex-1 truncate">{pickedFile.name}</span>
              </span>
            ) : (
              <span className="flex items-center justify-between gap-2">
                <span className="material-symbols-outlined text-sm text-on-surface-variant">upload_file</span>
                <span className="text-on-surface-variant">בחירת קובץ...</span>
              </span>
            )}
          </button>
        ) : (
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/quicktime"
            required
            onChange={handleFallbackChange}
            className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface"
          />
        )}
      </div>

      {/* Drive URL (optional) */}
      <div>
        <label className="mb-1 block text-xs font-bold text-on-surface-variant">
          קישור Google Drive (Copy link to clipboard) — אופציונלי
        </label>
        <input
          type="text"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://drive.google.com/open?id=..."
          dir="ltr"
          className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
        />
      </div>

      {/* Date */}
      <div>
        <label className="mb-1 block text-xs font-bold text-on-surface-variant">
          תאריך פרסום *
        </label>
        <ConfigProvider
          direction="rtl"
          locale={he_IL}
          theme={{
            token: {
              borderRadius: 12,
              colorBorder: "var(--color-outline-variant, #E2E8F0)",
              controlHeight: 40,
              colorPrimary: "#5a7a5a",
            },
          }}
        >
          <AntDatePicker
            format="DD/MM/YYYY"
            className="w-full"
            value={scheduledDate ? dayjs(scheduledDate, "YYYY-MM-DD") : null}
            onChange={(d: Dayjs | null) =>
              setScheduledDate(d ? d.format("YYYY-MM-DD") : "")
            }
          />
        </ConfigProvider>
      </div>

      {/* Caption */}
      <div>
        <label className="mb-1 block text-xs font-bold text-on-surface-variant">
          טקסט הפוסט (מהוואטסאפ של נירית) *
        </label>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          required
          rows={5}
          dir="rtl"
          className="w-full resize-none rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-right text-sm text-on-surface outline-none focus:border-primary"
        />
      </div>

      {error && (
        <p className="rounded-xl bg-error/10 px-3 py-2 text-sm text-error">{error}</p>
      )}

      {youtubeWarning && (
        <p className="rounded-xl bg-yellow-100 px-3 py-2 text-sm text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">{youtubeWarning}</p>
      )}

      {uploading && loadingMsg && (
        <p className="flex items-center gap-2 text-sm text-primary">
          <span className="material-symbols-outlined animate-spin text-sm">autorenew</span>
          {loadingMsg}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={uploading || !pickedFile}
          className="flex-1 rounded-full bg-primary py-2 text-sm font-bold text-on-primary disabled:opacity-60"
        >
          {uploading ? "מעבדת..." : "הוספת מסר"}
        </button>
      </div>
    </form>
  );
}
