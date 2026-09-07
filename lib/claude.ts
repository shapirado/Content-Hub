import Anthropic from "@anthropic-ai/sdk";
import type { ClipForPlanning, ReviewForPlanning, Event, ContentTaskInput } from "@/lib/neon";

export type MassarYomContent = {
  hook: string;
  tiktokHashtags: string;
  youtubeTitle: string;
  pillar: string;
  summary: string;
  tag: string | null;
};

function client() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export function buildContentPlanPrompt(
  clips: ClipForPlanning[],
  events: Event[],
  reviews: ReviewForPlanning[],
  from: string,
  to: string
): string {
  const clipsText = clips
    .slice(0, 60)
    .map(
      (c) =>
        `- id:${c.id} title:"${c.title ?? "ללא כותרת"}" pillar:${c.pillar ?? "?"} season:${c.season ?? "?"} wardrobe:${c.wardrobe ?? "?"} tags:${c.context_tags.join(",")} usable:${c.usable ?? "?"} tiktok:${c.posted_to_tiktok ? "yes" : "no"}\n  summary:${c.summary?.slice(0, 200) ?? ""}\n  hooks:${c.hooks.slice(0, 3).join(" | ")}`
    )
    .join("\n");

  const eventsText = events
    .map(
      (e) =>
        `- id:${e.id} name:"${e.name}" type:${e.product_type} date:${e.event_date} location:${e.location ?? "?"} link:${e.registration_link ?? "none"}`
    )
    .join("\n");

  const reviewsText = reviews
    .slice(0, 10)
    .map((r) => `- "${r.text.slice(0, 200)}" (${r.author_name ?? "אנונימי"}, product:${r.product_type ?? "?"})`)
    .join("\n");

  return `את מתכננת תוכנית תוכן חודשית עבור נירית שפירא — מאמנת רוחנית ומנחת סדנאות.

תאריכים: ${from} עד ${to}
תאריך היום: ${new Date().toISOString().slice(0, 10)}

## כללי פלטפורמה

**TikTok** — הרחבת מותג בלבד. בחרי קליפים אמוציונליים ופוטנציאל הוק חזק. ללא קריאות לפעולה לאירועים, מחירים, או שפת דחיפות.

**Instagram** — שלב פאנל לפי קרבה לאירוע:
- 3+ שבועות לפני אירוע: מודעות / השראה
- 1-2 שבועות לפני: המלצות / הוכחה חברתית (השתמשי ב-reviews)
- שבוע האירוע: הזמנה עדינה ("מזמינה אותך להצטרף")

**Newsletter** — 1-2 בחודש; טבילה נושאית מיושרת לסדנה / קורס קרוב.

## קליפים זמינים

${clipsText || "אין קליפים."}

## אירועים בטווח התאריכים (ובסמוך)

${eventsText || "אין אירועים."}

## המלצות WhatsApp

${reviewsText || "אין המלצות."}

## הנחיות

- צרי 3-4 פוסטים TikTok בשבוע
- צרי 3-4 פוסטים Instagram בשבוע
- צרי 1-2 newsletters בחודש
- פזרי את התאריכים באופן אחיד על פני הטווח
- השתמשי ב-clip_det_id מתוך רשימת הקליפים הזמינים (אל תמציאי ids)
- השתמשי ב-event_id מתוך רשימת האירועים (אל תמציאי ids)
- TikTok: clip_det_id חובה, event_id תמיד null
- Instagram ו-Newsletter: event_id לפי הרלוונטיות (null מותר)
- hook: שורה ראשונה מושכת תשומת לב (עברית, עד 80 תווים)
- caption: גוף הפוסט (עברית, בקול של נירית — אישי, שירותי, לא קלינית)
- hashtags: 5-8 hashtags בעברית ובאנגלית

## פורמט פלט

החזירי JSON בלבד — מערך של אובייקטים. ללא טקסט נוסף לפני או אחרי ה-JSON.

\`\`\`json
[
  {
    "platform": "tiktok",
    "scheduled_date": "YYYY-MM-DD",
    "event_id": null,
    "clip_det_id": "<uuid from clips list above>",
    "hook": "...",
    "caption": "...",
    "hashtags": "...",
    "status": "ai_draft"
  }
]
\`\`\`
`;
}

export function parseContentPlanResponse(text: string): ContentTaskInput[] {
  const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Claude response is not valid JSON: ${cleaned.slice(0, 200)}`);
  }
  if (!Array.isArray(parsed)) throw new Error("Claude response is not a JSON array");

  const PLATFORMS = ["tiktok", "instagram", "newsletter", "youtube"] as const;
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  return (parsed as unknown[]).map((raw, i) => {
    if (typeof raw !== "object" || raw === null)
      throw new Error(`Item ${i}: not an object`);
    const item = raw as Record<string, unknown>;
    if (typeof item.platform !== "string" || !PLATFORMS.includes(item.platform as (typeof PLATFORMS)[number]))
      throw new Error(`Item ${i}: invalid platform "${String(item.platform)}"`);
    if (typeof item.scheduled_date !== "string" || !DATE_RE.test(item.scheduled_date))
      throw new Error(`Item ${i}: invalid scheduled_date "${String(item.scheduled_date)}"`);
    return {
      platform: item.platform as ContentTaskInput["platform"],
      scheduled_date: item.scheduled_date,
      status: "ai_draft" as const,
      event_id: typeof item.event_id === "string" && UUID_RE.test(item.event_id) ? item.event_id : null,
      clip_det_id: typeof item.clip_det_id === "string" && UUID_RE.test(item.clip_det_id) ? item.clip_det_id : null,
      hook: typeof item.hook === "string" ? item.hook : null,
      caption: typeof item.caption === "string" ? item.caption : null,
      hashtags: typeof item.hashtags === "string" ? item.hashtags : null,
      canva_url: null,
      live_url: null,
    };
  });
}

export async function generateMassarYomContent(
  transcript: string,
  niritCaption: string
): Promise<MassarYomContent> {
  const anthropic = client();
  const prompt = `יש לך תמלול של קליפ רוחני קצר של נירית שפירא ואת הפוסט המקורי שלה.

תמלול הקליפ:
"""
${transcript}
"""

פוסט מקורי של נירית:
"""
${niritCaption}
"""

צרי פלט JSON בלבד עם השדות הבאים:
- hook: שתי שורות פתיחה מושכות לטיקטוק (עד 80 תווים, עברית, pattern-interrupt)
- tiktokHashtags: 5-7 האשטגים לטיקטוק (עברית ואנגלית, מופרדים ברווח)
- youtubeTitle: כותרת קצרה ליוטיוב (עברית, עד 60 תווים)
- pillar: עמוד תוכן אחד מהרשימה הבאה בדיוק כפי שכתוב: "Body & Sensation", "Consciousness Reframes", "Professional Identity", "Testimonial/Carousel"
- summary: סיכום קצר של הסרטון במשפט אחד-שניים בעברית (מה הוא עוסק, לא לשחזר את ה-hook)
- tag: אם התוכן קשור לחג, עונה, אירוע עם תאריך, או הזדמנות מוגבלת בזמן — ספקי תגית בפורמט "קטגוריה-פירוט" (דוגמאות: "חגים-ראש השנה", "חגים-פסח", "עונתי-קיץ", "אירועים-ריטריט"). אם התוכן כללי ועל-זמני — החזירי null.

ללא טקסט נוסף לפני או אחרי ה-JSON.

\`\`\`json
{ "hook": "...", "tiktokHashtags": "...", "youtubeTitle": "...", "pillar": "...", "summary": "...", "tag": null }
\`\`\``;

  const message = await anthropic.messages
    .stream({
      model: "claude-sonnet-5",
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    })
    .finalMessage();

  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no text block for מסר יום content generation");
  }

  const cleaned = block.text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Claude response is not valid JSON: ${cleaned.slice(0, 200)}`);
  }

  const p = parsed as Record<string, unknown>;
  const VALID_PILLARS = ["Body & Sensation", "Consciousness Reframes", "Professional Identity", "Testimonial/Carousel"];
  if (
    typeof p.hook !== "string" ||
    typeof p.tiktokHashtags !== "string" ||
    typeof p.youtubeTitle !== "string" ||
    typeof p.pillar !== "string" ||
    typeof p.summary !== "string"
  ) {
    throw new Error(`Claude response missing required fields: ${cleaned.slice(0, 200)}`);
  }

  return {
    hook: p.hook,
    tiktokHashtags: p.tiktokHashtags,
    youtubeTitle: p.youtubeTitle,
    pillar: VALID_PILLARS.includes(p.pillar) ? p.pillar : "Consciousness Reframes",
    summary: p.summary,
    tag: typeof p.tag === "string" && p.tag.trim().length > 0 ? p.tag.trim() : null,
  };
}

export async function callContentPlannerClaude(prompt: string): Promise<string> {
  const anthropic = client();
  const message = await anthropic.messages
    .stream({
      model: "claude-sonnet-5",
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      messages: [{ role: "user", content: prompt }],
    })
    .finalMessage();
  const block = message.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    const types = message.content.map((b) => b.type).join(", ");
    throw new Error(`Claude returned no text block (stop_reason: ${message.stop_reason}, blocks: [${types}])`);
  }
  return block.text;
}
