"use client";

import { useState, useTransition, useRef } from "react";
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

export function MassarYomAddForm({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"path" | "file">("path");
  const [localPath, setLocalPath] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [caption, setCaption] = useState("");
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [youtubeWarning, setYoutubeWarning] = useState<string | null>(null);
  const [uploading, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduledDate || !caption.trim()) return;
    if (mode === "path" && !localPath.trim()) return;
    if (mode === "file" && !fileRef.current?.files?.[0]) return;

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
        if (mode === "file") {
          formData.set("videoFile", fileRef.current!.files![0]);
        } else {
          formData.set("localPath", localPath.trim());
        }
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
      {/* Mode toggle */}
      <div className="flex rounded-xl border border-outline-variant overflow-hidden text-sm">
        <button
          type="button"
          onClick={() => setMode("path")}
          className={`flex-1 py-2 font-bold transition-colors ${mode === "path" ? "bg-primary text-on-primary" : "bg-surface text-on-surface-variant hover:bg-surface-container"}`}
        >
          נתיב קובץ
        </button>
        <button
          type="button"
          onClick={() => setMode("file")}
          className={`flex-1 py-2 font-bold transition-colors ${mode === "file" ? "bg-primary text-on-primary" : "bg-surface text-on-surface-variant hover:bg-surface-container"}`}
        >
          העלאת קובץ
        </button>
      </div>

      {/* Video source */}
      {mode === "path" ? (
        <div key="path-input">
          <label className="mb-1 block text-xs font-bold text-on-surface-variant">
            נתיב קובץ מקומי (Shift+לחצן ימני ← Copy as path) *
          </label>
          <input
            type="text"
            value={localPath}
            onChange={(e) => setLocalPath(e.target.value)}
            placeholder={'"G:\\My Drive\\clip.mp4"'}
            dir="ltr"
            required
            className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface outline-none focus:border-primary"
          />
        </div>
      ) : (
        <div key="file-input">
          <label className="mb-1 block text-xs font-bold text-on-surface-variant">
            קובץ וידאו *
          </label>
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/quicktime"
            required
            className="w-full rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2 text-sm text-on-surface"
          />
        </div>
      )}

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
          disabled={uploading}
          className="flex-1 rounded-full bg-primary py-2 text-sm font-bold text-on-primary disabled:opacity-60"
        >
          {uploading ? "מעבדת..." : "הוספת מסר"}
        </button>
      </div>
    </form>
  );
}
