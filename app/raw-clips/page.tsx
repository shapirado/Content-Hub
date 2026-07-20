import { listAllRawClipRecordsAction } from "@/app/actions";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { RawClipBrowser } from "@/components/RawClipBrowser";

export const dynamic = "force-dynamic";

export default async function RawClipsPage() {
  const records = await listAllRawClipRecordsAction();

  return (
    <>
      <Sidebar active="rawClips" />
      <TopBar />
      <main className="mr-64 mt-16 min-h-[calc(100vh-64px)] bg-background p-8">
        <RawClipBrowser initialRecords={records} />
      </main>
    </>
  );
}
