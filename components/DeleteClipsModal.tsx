"use client";

import { useTransition } from "react";
import { deleteClipDetailsAction } from "@/app/actions";
import { displayTitle, type MergedClip } from "@/lib/types";

export function DeleteClipsModal({
  items,
  onClose,
  onDeleted,
}: {
  items: MergedClip[];
  onClose: () => void;
  onDeleted: (deletedIds: string[]) => void;
}) {
  const [deleting, startDelete] = useTransition();

  function confirmDelete() {
    startDelete(async () => {
      const ids = items.map((i) => i.clip.id);
      for (const id of ids) {
        await deleteClipDetailsAction(id);
      }
      onDeleted(ids);
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-headline-sm font-headline-sm text-on-surface">מחיקת קליפים</h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <p className="mb-4 text-xs text-error">
          פעולה זו תמחק לצמיתות {items.length} קליפים, כולל כל העותקים הפיזיים והנתונים המקושרים
          אליהם. לא ניתן לבטל.
        </p>

        <ul className="mb-4 max-h-48 space-y-1 overflow-y-auto rounded border border-outline-variant/30 bg-surface-container-lowest p-3 text-xs text-on-surface-variant">
          {items.map((item) => (
            <li key={item.clip.id} className="truncate">
              {displayTitle(item)}
            </li>
          ))}
        </ul>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={deleting}
            className="rounded-full border border-outline-variant px-5 py-2 text-xs font-bold text-on-surface-variant hover:text-on-surface disabled:opacity-60"
          >
            ביטול
          </button>
          <button
            onClick={confirmDelete}
            disabled={deleting}
            className="rounded-full bg-error px-5 py-2 text-xs font-bold text-on-error hover:opacity-90 disabled:opacity-60"
          >
            {deleting ? "מוחקת..." : `מחיקת ${items.length} קליפים`}
          </button>
        </div>
      </div>
    </div>
  );
}
