import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { listEvents, listContentTasksByDateRange } from "@/lib/neon";
import { PlanPageClient } from "@/components/PlanPageClient";

function getDateRange(): { from: string; to: string; weekStartKey: string } {
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1);
  const to = new Date(today.getFullYear(), today.getMonth() + 2, 0);
  const sun = new Date(today);
  sun.setDate(today.getDate() - today.getDay());
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { from: fmt(from), to: fmt(to), weekStartKey: fmt(sun) };
}

export default async function PlanPage() {
  const { from, to, weekStartKey } = getDateRange();
  const [events, tasks] = await Promise.all([
    listEvents(),
    listContentTasksByDateRange(from, to),
  ]);

  return (
    <>
      <Sidebar active="plan" />
      <TopBar />
      <main className="mr-64 mt-16 min-h-[calc(100vh-64px)] bg-background">
        <div className="mx-auto max-w-screen-xl px-6 py-8">
          <PlanPageClient
            initialTasks={tasks}
            initialEvents={events}
            initialWeekStartKey={weekStartKey}
          />
        </div>
      </main>
    </>
  );
}
