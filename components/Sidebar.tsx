import Link from "next/link";
import { auth, signOut } from "@/auth";

const STUBBED_NAV = [
  { icon: "insert_chart", label: "אנליטיקה" },
  { icon: "calendar_month", label: "לוח שנה" },
  { icon: "sync", label: "אינטגרציות" },
  { icon: "settings", label: "הגדרות" },
];

export async function Sidebar({
  active = "library",
}: {
  active?: "library" | "rawClips";
}) {
  const session = await auth();

  return (
    <aside className="fixed right-0 top-0 z-50 flex h-screen w-64 flex-col border-l border-outline-variant bg-surface-container px-4 py-8 shadow-sm">
      <div className="mb-10 px-4">
        <h1 className="text-3xl font-bold text-primary">Content Hub</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          נירית שפירא
        </p>
      </div>

      <nav className="flex-grow space-y-1">
        <Link
          className={
            active === "library"
              ? "flex items-center gap-3 rounded bg-primary/10 px-4 py-3 font-bold text-primary transition-colors"
              : "flex items-center gap-3 rounded px-4 py-3 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
          }
          href="/"
        >
          <span className="material-symbols-outlined">photo_library</span>
          <span className="text-sm">ספריית מדיה</span>
        </Link>
        <Link
          className={
            active === "rawClips"
              ? "flex items-center gap-3 rounded bg-primary/10 px-4 py-3 font-bold text-primary transition-colors"
              : "flex items-center gap-3 rounded px-4 py-3 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
          }
          href="/raw-clips"
        >
          <span className="material-symbols-outlined">content_copy</span>
          <span className="text-sm">איתור כפילויות</span>
        </Link>
        {STUBBED_NAV.map((item) => (
          <span
            key={item.label}
            title="בקרוב"
            className="flex cursor-not-allowed items-center gap-3 rounded px-4 py-3 text-on-surface-variant/40"
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="text-sm">{item.label}</span>
          </span>
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-3 border-t border-outline-variant px-4 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-highest ring-1 ring-outline-variant">
          <span className="material-symbols-outlined text-on-surface-variant">
            person
          </span>
        </div>
        <div className="overflow-hidden">
          <p className="truncate text-sm font-bold text-on-surface">
            {session?.user?.email ?? ""}
          </p>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button className="text-xs text-on-surface-variant hover:text-primary">
              התנתקות
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
