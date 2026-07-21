/**
 * Whether a `clips.path` value is an openable link, independent of `source_type` — the
 * ingestion pipeline's own upload/url classification isn't reliable for this (e.g. it may
 * store a full Drive URL while still marking it "upload"), so link-detection goes off the
 * path string itself instead.
 */
export function isUrlPath(path: string): boolean {
  return /^https?:\/\//i.test(path.trim());
}

/**
 * Resolves any copy path to something clickable: a real URL unchanged, or — for a bare
 * filename/folder-breadcrumb (e.g. a Google Drive path with no direct share link) — a Drive
 * filename-search link built from its last `/`-separated segment. Works with just a filename,
 * no share link or file ID needed.
 */
export function resolveCopyLink(path: string): string {
  if (isUrlPath(path)) return path;
  const filename = path.split(/[\\/]/).pop() ?? path;
  return `https://drive.google.com/drive/search?q=${encodeURIComponent(filename)}`;
}

/**
 * Known Google Drive folder breadcrumbs, seeded from folders the user has shared screenshots of.
 * A plain, appendable list — not a migration. Used to suggest a folder when adding a new copy so
 * the user doesn't have to paste the full breadcrumb every time.
 */
export const KNOWN_DRIVE_FOLDERS: string[] = [
  "פריטים ששותפו איתי/מסך יום יהלומים 2026",
  "פריטים ששותפו איתי/מסך יום יהלומים 2026/חגים ומועדים מיוחדים",
  "פריטים ששותפו איתי/מסך יום יהלומים 2026/חגים ומועדים מיוחדים/פסח",
  "פריטים ששותפו איתי/מסך יום יהלומים 2026/3.1.2026",
  "פריטים ששותפו איתי/מסך יום יהלומים 2026/10.1.2026",
  "פריטים ששותפו איתי/מסך יום יהלומים 2026/17.1.2026 מוקטן",
  "פריטים ששותפו איתי/מסך יום יהלומים 2026/28.2.2026",
  "פריטים ששותפו איתי/מסך יום יהלומים 2026/יהלומים -מהוונטסאפ",
  "פריטים ששותפו איתי/מסך יום יהלומים 2026/סרטוני קנווה",
  "פריטים ששותפו איתי/מסך יום יהלומים 2026/תפילות מרץ 2026",
  "פריטים ששותפו איתי/מסך יום יהלומים 2026/tiktok screenshots",
];

/** Longest common `/`-segment prefix shared by every entry in `folders` (empty if they don't share one). */
function commonFolderPrefix(folders: string[]): string {
  if (folders.length === 0) return "";
  const segmentLists = folders.map((f) => f.split("/"));
  const first = segmentLists[0];
  let sharedLength = 0;
  for (let i = 0; i < first.length; i++) {
    if (segmentLists.every((segs) => segs[i] === first[i])) sharedLength = i + 1;
    else break;
  }
  return first.slice(0, sharedLength).join("/");
}

const KNOWN_FOLDERS_ROOT_PREFIX = commonFolderPrefix(KNOWN_DRIVE_FOLDERS);

/** Strips the shared root prefix across known folders for display — selection still uses the full path. */
export function shortenFolderLabel(folder: string): string {
  if (KNOWN_FOLDERS_ROOT_PREFIX && folder.startsWith(KNOWN_FOLDERS_ROOT_PREFIX + "/")) {
    return folder.slice(KNOWN_FOLDERS_ROOT_PREFIX.length + 1);
  }
  return folder;
}
