import {
  listClipDetails,
  listClipLibraryRows,
  listDistinctContextTags,
  updateClipTitle,
} from "@/lib/neon";
import type { MergedClip } from "@/lib/types";
import { Sidebar } from "@/components/Sidebar";
import { ContentHubShell } from "@/components/ContentHubShell";
import { fetchYouTubeTitle, isYouTubeUrl } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [clips, libraryRows, contextTagOptions] = await Promise.all([
    listClipDetails(),
    listClipLibraryRows(),
    listDistinctContextTags(),
  ]);

  // Clips with no title yet whose only known location is a YouTube URL: fetch the real
  // video title once via oEmbed and cache it on clip_details so future loads don't re-fetch.
  await Promise.all(
    clips
      .filter((clip) => !clip.title && clip.representativePath && isYouTubeUrl(clip.representativePath))
      .map(async (clip) => {
        const title = await fetchYouTubeTitle(clip.representativePath!);
        if (title) {
          clip.title = title;
          await updateClipTitle(clip.id, title);
        }
      })
  );

  const merged: MergedClip[] = clips.map((clip) => ({
    clip,
    library: libraryRows[clip.id] ?? null,
  }));

  return (
    <>
      <Sidebar />
      <ContentHubShell initialClips={merged} contextTagOptions={contextTagOptions} />
    </>
  );
}
