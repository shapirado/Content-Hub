import { listTasksAction } from "@/app/actions";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { PlannerCalendar } from "@/components/PlannerCalendar";

export const dynamic = "force-dynamic";

export default async function PlannerPage() {
  const tasks = await listTasksAction();

  return (
    <>
      <Sidebar active="planner" />
      <TopBar />
      <main className="mr-64 mt-16 min-h-[calc(100vh-64px)] bg-background p-8">
        <PlannerCalendar initialTasks={tasks} />
      </main>
    </>
  );
}
