import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { listMassarYomClips } from "@/lib/neon";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { MassarYomPanel } from "@/components/MassarYomPanel";

export default async function DailyPage() {
  const session = await auth();
  if (!session) redirect("/api/auth/signin");

  const clips = await listMassarYomClips();

  return (
    <>
      <Sidebar active="daily" />
      <TopBar />
      <main className="mr-64 mt-16 min-h-[calc(100vh-64px)] bg-background">
        <div className="mx-auto max-w-2xl px-6 py-8">
          <MassarYomPanel initialClips={clips} />
        </div>
      </main>
    </>
  );
}
