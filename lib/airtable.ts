const BASE_ID = "appjb01XUH9eMP9MA";

const TABLES = {
  rawClipLibrary: "tbl0JHtFGYG75DVOP",
  contentInventory: "tblNNoQN7kG3mGvhR",
  copies: "tblbRlPLJ8tVpOE70",
} as const;

/** Field IDs, kept explicit so renaming a Hebrew/English label in Airtable never breaks the app. */
export const FIELDS = {
  rawClipLibrary: {
    name: "fldmyND3FXmHUVcMC",
    thumbnail: "fldxdkKLD5b3AJidz",
    youtubeLink: "fldx22Z3QViMLdwpS",
    sourceFileName: "fldaKYHPX0yFDXVD1",
    topic: "fldVrOIFv2Y1rOvUW",
    pillar: "fld1VTuI1hv0CpKwh",
    season: "fldXvrRpbpc6xrgXy",
    contextTags: "fld0UcCZb0mTMOqwj",
    wardrobe: "fldU2QxJdgbYiBPoB",
    usable: "fldQ4BRHSSE86yjoB",
    postedToTikTok: "fldydbZfOaHuijjWy",
    alternateSources: "fldunEw9H01PhJHz2",
    status: "fldt7Ctr92NJGqLCb",
    contentInventoryLink: "fldDI3HlDLQ1grNt1",
    copiesLink: "fldygrDZgztnrR9HZ",
  },
  contentInventory: {
    name: "fldDkkeYsuXPFb5zx",
    thumbnail: "fldnS0C1uGiFuYlca",
    contentType: "fldlAb3jcQ3Fz5uQb",
    pillar: "fldAG8ay3Gh5aA14r",
    sourceFileLocation: "fld57APobfLRXs4Kt",
    hookKeyLine: "fldeVDQujI7F84WH8",
    hashtagsUsed: "fldjPS6iRYePustL0",
    datePosted: "fldNGPbvpaHu6fkdT",
    livePostUrl: "fldvDIIdlH78dUpup",
    platforms: "fldPFOQ5HN11ahRbS",
    views: "fldWdhN5FDCedxn74",
    likes: "fldQNVxbxxFfI8y0l",
    shares: "fldadOuUTDw5T37BD",
    comments: "fldHpF03QOcdi2eOe",
    status: "fldL74LxxgelqHKQC",
  },
  copies: {
    title: "fldXvBgdQx67kAW49",
    copyText: "fldHvbq1jVlkP5cn3",
    platform: "fldGXBQaJN0yHeB5z",
    linkedClip: "fldjYVJd29aZBXcbl",
  },
} as const;

/**
 * Controlled vocabularies for the UI. `season` and `usable` map a simplified set of
 * Hebrew labels onto the real Airtable option values — the field still holds the
 * literal Airtable value (so writes stay compatible with the 95 existing tagged
 * clips); the app just narrows which options it *offers* going forward.
 * Legacy season values (סתיו/מעבר/חגים) still display correctly on old records,
 * they're just not offered as choices for new tagging.
 */
export const OPTIONS = {
  pillar: [
    "Body & Sensation",
    "Consciousness Reframes",
    "Professional Identity",
    "Testimonial/Carousel",
  ],
  season: [
    { value: "קיץ", label: "קיץ", icon: "☀️" },
    { value: "חורף", label: "חורף", icon: "❄️" },
    { value: "מעבר", label: "מעבר", icon: "🍂" },
  ],
  usable: [
    { value: "Yes", label: "שמיש" },
    { value: "No", label: "לא לשימוש" },
    { value: "Not Usable", label: "צריך עריכה" },
  ],
  contentInventoryStatus: ["Drafted", "Reviewed", "Posted"],
  contentType: ["TikTok", "Instagram Reel", "Instagram Carousel"],
  platforms: [
    "TikTok",
    "Instagram",
    "WhatsApp – הכל בתדר",
    "WhatsApp – המרחב להגשמה",
  ],
  copyPlatform: [
    "TikTok",
    "Instagram Reel",
    "Instagram Carousel",
    "WhatsApp – הכל בתדר",
    "WhatsApp – המרחב להגשמה",
    "Newsletter",
    "Facebook",
  ],
  /** Distinct values already in use on Raw Clip Library's Scarf/Wardrobe field. גבס excluded — it's a tag, not a color. */
  wardrobe: [
    { value: "בלי", label: "בלי", colorHex: null, image: null },
    { value: "סגול", label: "סגול", colorHex: "#5E4680", image: null },
    { value: "תורכיז", label: "תורכיז", colorHex: "#23A6DA", image: null },
    { value: "כתום בהיר", label: "כתום בהיר", colorHex: "#FDBA74", image: null },
    { value: "כתום כהה", label: "כתום כהה", colorHex: "#FF884E", image: null },
    { value: "תכלת בהיר", label: "תכלת בהיר", colorHex: "#97E0FF", image: null },
    { value: "תכלת מקושקשת", label: "תכלת מקושקשת", colorHex: "#38BDF8", image: null },
    { value: "צהוב זרחני", label: "צהוב זרחני", colorHex: "#EFFF79", image: null },
    { value: "צבעוני", label: "צבעוני", colorHex: "#D946EF", image: null },
    { value: "לבן עם דוגמא", label: "לבן עם דוגמא", colorHex: null, image: "/דוגמא שחור על חום.png" },
    { value: "דוגמא שחור על חום", label: "דוגמא שחור על חום", colorHex: null, image: "/לבן עם דוגמא.png" },
  ],
} as const;

type AirtableRecord<Fields extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  createdTime: string;
  fields: Fields;
};

function apiKey() {
  if (!process.env.AIRTABLE_API_KEY) {
    throw new Error("AIRTABLE_API_KEY is not set");
  }
  return process.env.AIRTABLE_API_KEY;
}

async function airtableFetch<T>(
  tableId: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const url = `https://api.airtable.com/v0/${BASE_ID}/${tableId}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Airtable request failed (${res.status}): ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

/** Escapes a user-supplied string for safe interpolation into an Airtable formula string literal. */
function escapeFormulaString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function withFieldIdParams(extra: string[] = []): string {
  return `returnFieldsByFieldId=true${extra.length ? "&" + extra.join("&") : ""}`;
}

// ---------- Raw Clip Library ----------

type AirtableAttachment = {
  url: string;
  thumbnails?: { small?: { url: string }; large?: { url: string } };
};

export type RawClipLibraryFields = {
  [FIELDS.rawClipLibrary.name]: string;
  [FIELDS.rawClipLibrary.thumbnail]?: AirtableAttachment[];
  [FIELDS.rawClipLibrary.youtubeLink]?: string;
  [FIELDS.rawClipLibrary.sourceFileName]?: string;
  [FIELDS.rawClipLibrary.topic]?: string;
  [FIELDS.rawClipLibrary.pillar]?: string;
  [FIELDS.rawClipLibrary.season]?: string;
  [FIELDS.rawClipLibrary.contextTags]?: string[];
  [FIELDS.rawClipLibrary.wardrobe]?: string;
  [FIELDS.rawClipLibrary.usable]?: string;
  [FIELDS.rawClipLibrary.postedToTikTok]?: boolean;
  [FIELDS.rawClipLibrary.alternateSources]?: string;
  [FIELDS.rawClipLibrary.status]?: string;
  [FIELDS.rawClipLibrary.contentInventoryLink]?: string[];
  [FIELDS.rawClipLibrary.copiesLink]?: string[];
};

/** Search Raw Clip Library by title text or YouTube link — the manual link flow (no auto-match). */
export async function searchRawClipLibrary(
  query: string
): Promise<AirtableRecord<RawClipLibraryFields>[]> {
  const q = escapeFormulaString(query.toLowerCase());
  const formula = `OR(SEARCH("${q}", LOWER({${FIELDS.rawClipLibrary.name}})), SEARCH("${q}", LOWER({${FIELDS.rawClipLibrary.youtubeLink}})))`;
  const res = await airtableFetch<{ records: AirtableRecord<RawClipLibraryFields>[] }>(
    TABLES.rawClipLibrary,
    `?${withFieldIdParams([`filterByFormula=${encodeURIComponent(formula)}`, "maxRecords=25"])}`
  );
  return res.records;
}

export async function getRawClipLibraryRecord(
  recordId: string
): Promise<AirtableRecord<RawClipLibraryFields>> {
  return airtableFetch<AirtableRecord<RawClipLibraryFields>>(
    TABLES.rawClipLibrary,
    `/${recordId}?${withFieldIdParams()}`
  );
}

export async function createRawClipLibraryRecord(
  fields: Partial<RawClipLibraryFields>
): Promise<AirtableRecord<RawClipLibraryFields>> {
  return airtableFetch<AirtableRecord<RawClipLibraryFields>>(
    TABLES.rawClipLibrary,
    `?${withFieldIdParams()}`,
    { method: "POST", body: JSON.stringify({ fields, typecast: true }) }
  );
}

export async function updateRawClipLibraryRecord(
  recordId: string,
  fields: Partial<RawClipLibraryFields>
): Promise<AirtableRecord<RawClipLibraryFields>> {
  return airtableFetch<AirtableRecord<RawClipLibraryFields>>(
    TABLES.rawClipLibrary,
    `/${recordId}?${withFieldIdParams()}`,
    { method: "PATCH", body: JSON.stringify({ fields, typecast: true }) }
  );
}

export async function deleteRawClipLibraryRecord(recordId: string): Promise<void> {
  await airtableFetch<unknown>(TABLES.rawClipLibrary, `/${recordId}`, { method: "DELETE" });
}

/** All Raw Clip Library records, independent of any Neon clip — for the duplicate browser. Paginates past Airtable's 100-per-page limit. */
export async function listAllRawClipLibraryRecords(): Promise<
  AirtableRecord<RawClipLibraryFields>[]
> {
  const all: AirtableRecord<RawClipLibraryFields>[] = [];
  let offset: string | undefined;
  do {
    const params = [withFieldIdParams(["pageSize=100"])];
    if (offset) params.push(`offset=${offset}`);
    const res = await airtableFetch<{
      records: AirtableRecord<RawClipLibraryFields>[];
      offset?: string;
    }>(TABLES.rawClipLibrary, `?${params.join("&")}`);
    all.push(...res.records);
    offset = res.offset;
  } while (offset);
  return all;
}

// ---------- Content Inventory ----------

export type ContentInventoryFields = {
  [FIELDS.contentInventory.name]: string;
  [FIELDS.contentInventory.contentType]?: string;
  [FIELDS.contentInventory.pillar]?: string;
  [FIELDS.contentInventory.hookKeyLine]?: string;
  [FIELDS.contentInventory.hashtagsUsed]?: string;
  [FIELDS.contentInventory.livePostUrl]?: string;
  [FIELDS.contentInventory.platforms]?: string[];
  [FIELDS.contentInventory.views]?: number;
  [FIELDS.contentInventory.likes]?: number;
  [FIELDS.contentInventory.shares]?: number;
  [FIELDS.contentInventory.comments]?: number;
  [FIELDS.contentInventory.status]?: string;
};

/** Batch-fetch Content Inventory records by ID (reached via a Raw Clip Library record's link field). */
export async function getContentInventoryRecords(
  ids: string[]
): Promise<AirtableRecord<ContentInventoryFields>[]> {
  if (ids.length === 0) return [];
  const formula = `OR(${ids.map((id) => `RECORD_ID()="${id}"`).join(",")})`;
  const res = await airtableFetch<{ records: AirtableRecord<ContentInventoryFields>[] }>(
    TABLES.contentInventory,
    `?${withFieldIdParams([`filterByFormula=${encodeURIComponent(formula)}`])}`
  );
  return res.records;
}

// ---------- Copies ----------

export type CopiesFields = {
  [FIELDS.copies.title]: string;
  [FIELDS.copies.copyText]?: string;
  [FIELDS.copies.platform]?: string;
  [FIELDS.copies.linkedClip]?: string[];
};

export async function searchCopies(
  query: string
): Promise<AirtableRecord<CopiesFields>[]> {
  const q = escapeFormulaString(query.toLowerCase());
  const formula = `SEARCH("${q}", LOWER({${FIELDS.copies.title}}))`;
  const res = await airtableFetch<{ records: AirtableRecord<CopiesFields>[] }>(
    TABLES.copies,
    `?${withFieldIdParams([`filterByFormula=${encodeURIComponent(formula)}`, "maxRecords=25"])}`
  );
  return res.records;
}

export async function getCopiesRecords(
  ids: string[]
): Promise<AirtableRecord<CopiesFields>[]> {
  if (ids.length === 0) return [];
  const formula = `OR(${ids.map((id) => `RECORD_ID()="${id}"`).join(",")})`;
  const res = await airtableFetch<{ records: AirtableRecord<CopiesFields>[] }>(
    TABLES.copies,
    `?${withFieldIdParams([`filterByFormula=${encodeURIComponent(formula)}`])}`
  );
  return res.records;
}

/** Creates a brand-new Copies record and links it to the given Raw Clip Library record. */
export async function createCopyRecord(
  rawClipRecordId: string,
  fields: { title: string; copyText: string; platform?: string }
): Promise<AirtableRecord<CopiesFields>> {
  return airtableFetch<AirtableRecord<CopiesFields>>(
    TABLES.copies,
    `?${withFieldIdParams()}`,
    {
      method: "POST",
      body: JSON.stringify({
        fields: {
          [FIELDS.copies.title]: fields.title,
          [FIELDS.copies.copyText]: fields.copyText,
          ...(fields.platform ? { [FIELDS.copies.platform]: fields.platform } : {}),
          [FIELDS.copies.linkedClip]: [rawClipRecordId],
        },
        typecast: true,
      }),
    }
  );
}

/** Attaches an existing Copies record (found via search) to a Raw Clip Library record. */
export async function linkCopyToRawClip(
  copyRecordId: string,
  rawClipRecordId: string
): Promise<AirtableRecord<CopiesFields>> {
  const existing = await airtableFetch<AirtableRecord<CopiesFields>>(
    TABLES.copies,
    `/${copyRecordId}?${withFieldIdParams()}`
  );
  const current = existing.fields[FIELDS.copies.linkedClip] ?? [];
  const next = current.includes(rawClipRecordId) ? current : [...current, rawClipRecordId];
  return airtableFetch<AirtableRecord<CopiesFields>>(
    TABLES.copies,
    `/${copyRecordId}?${withFieldIdParams()}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        fields: { [FIELDS.copies.linkedClip]: next },
        typecast: true,
      }),
    }
  );
}
