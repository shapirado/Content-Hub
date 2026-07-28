import { listTasksAction } from "@/app/actions";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { PlannerCalendar } from "@/components/PlannerCalendar";

export const dynamic = "force-dynamic";

function currentWeekStartKey(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, "0");
  const d = String(start.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default async function PlannerPage() {
  const tasks = await listTasksAction();
  const initialWeekStartKey = currentWeekStartKey();

  return (
    <>
      <Sidebar active="planner" />
      <TopBar />
      <main className="mr-64 mt-16 min-h-[calc(100vh-64px)] bg-background p-8">
        <PlannerCalendar initialTasks={tasks} initialWeekStartKey={initialWeekStartKey} />
      </main>
    </>
  );
}
