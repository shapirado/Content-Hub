"use client";

export function TopBar({
  value = "",
  onChange,
}: {
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <header className="fixed right-64 left-0 top-0 z-40 flex h-16 items-center justify-between border-b border-outline-variant bg-surface-container/80 px-8 backdrop-blur-md">
      <div className="flex w-1/2 items-center">
        <div className="group relative w-full max-w-md">
          <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant transition-colors group-focus-within:text-primary">
            search
          </span>
          <input
            className="w-full rounded border border-outline-variant bg-surface-container-low py-2 pl-4 pr-10 text-sm text-on-surface transition-all placeholder:text-on-surface-variant/50 focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="חיפוש לפי כותרת או קישור יוטיוב..."
            type="text"
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <button className="rounded-full p-2 transition-colors hover:bg-surface-container-high">
          <span className="material-symbols-outlined text-on-surface-variant hover:text-on-surface">
            notifications
          </span>
        </button>
        <button className="rounded-full p-2 transition-colors hover:bg-surface-container-high">
          <span className="material-symbols-outlined text-on-surface-variant hover:text-on-surface">
            help
          </span>
        </button>
      </div>
    </header>
  );
}
