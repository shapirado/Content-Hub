import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

export default function ReviewPage() {
  return (
    <>
      <Sidebar active="review" />
      <TopBar />
      <main className="mr-64 mt-16 flex min-h-[calc(100vh-64px)] items-center justify-center bg-background">
        <p className="text-on-surface-variant">סקירת ביצועים — בקרוב.</p>
      </main>
    </>
  );
}
