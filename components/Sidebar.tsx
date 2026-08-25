import Link from "next/link";
import { auth, signOut } from "@/auth";

type ActivePage = "library" | "planner" | "plan" | "create" | "review";

export async function Sidebar({ active = "library" }: { active?: ActivePage }) {
  const session = await auth();

  const links: { href: string; key: ActivePage; icon: string; label: string }[] = [
    { href: "/",       key: "library", icon: "photo_library",  label: "ספריית מדיה" },
    { href: "/planner",key: "planner", icon: "calendar_month", label: "לוח שנה" },
    { href: "/plan",   key: "plan",    icon: "edit_calendar",  label: "תכנון תוכן" },
    { href: "/create", key: "create",  icon: "draw",           label: "יצירת תוכן" },
    { href: "/review", key: "review",  icon: "insert_chart",   label: "סקירת ביצועים" },
  ];

  return (
    <aside className="fixed right-0 top-0 z-50 flex h-screen w-64 flex-col border-l border-outline-variant bg-surface-container px-4 py-8 shadow-sm">
      <div className="mb-10 px-4">
        <h1 className="text-3xl font-bold text-primary">Content Hub</h1>
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          נירית שפירא
        </p>
      </div>

      <nav className="flex-grow space-y-1">
        {links.map(({ href, key, icon, label }) => (
          <Link
            key={key}
            href={href}
            className={
              active === key
                ? "flex items-center gap-3 rounded bg-primary/10 px-4 py-3 font-bold text-primary transition-colors"
                : "flex items-center gap-3 rounded px-4 py-3 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
            }
          >
            <span className="material-symbols-outlined">{icon}</span>
            <span className="text-sm">{label}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-3 border-t border-outline-variant px-4 py-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container-highest ring-1 ring-outline-variant">
          <span className="material-symbols-outlined text-on-surface-variant">person</span>
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
