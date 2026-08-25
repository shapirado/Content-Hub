import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

export default function RawClipsPage() {
  return (
    <>
      <Sidebar active="library" />
      <TopBar />
      <main className="mr-64 mt-16 flex min-h-[calc(100vh-64px)] items-center justify-center bg-background">
        <p className="text-on-surface-variant">דף זה עובר שדרוג ויחזור בקרוב.</p>
      </main>
    </>
  );
}
