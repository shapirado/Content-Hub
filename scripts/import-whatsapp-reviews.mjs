// One-time import: WhatsApp text export → Neon whatsapp_reviews
// Run with: node --env-file=.env.local scripts/import-whatsapp-reviews.mjs

import fs from "fs";
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// Adjust path if the file has moved:
const FILE_PATH = String.raw`C:\Users\User\Downloads\TEMP WHATSAPP\‏צ'אט WhatsApp עם המלצות.txt`;

const PRODUCT_KEYWORDS = [
  ["ראויה וממגנטת", "ראויה וממגנטת"],
  ["התגלות",         "התגלות"],
  ["שאקטי",          "שאקטי"],
  ["פשוט לאהוב",     "פשוט לאהוב"],
  ["לייב",           "live"],
  ["זום",            "live"],
  ["הכשרה",          "life_alignment_course"],
  ["קורס",           "life_alignment_course"],
  ["מטפל",           "life_alignment_course"],
];

function inferProductType(text) {
  for (const [kw, pt] of PRODUCT_KEYWORDS) {
    if (text.includes(kw)) return pt;
  }
  return null;
}

/** Parse a WhatsApp .txt export into message objects {sender, text} */
function parseMessages(raw) {
  const lines = raw.split(/\r?\n/);
  // Line starts with: DD.MM.YYYY, HH:MM - Sender: text
  const MSG_RE = /^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2} - (.+?): (.*)/;
  const SYS_RE = /^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2} - [^:]+$/; // system message (no sender colon)

  const messages = [];
  let current = null;

  for (const line of lines) {
    const m = MSG_RE.exec(line);
    if (m) {
      if (current) messages.push(current);
      current = { sender: m[1], text: m[2] };
    } else if (SYS_RE.test(line) || line.startsWith("\u200e")) {
      // system/encryption notice — flush and ignore
      if (current) { messages.push(current); current = null; }
    } else if (current) {
      // continuation of previous message
      current.text += "\n" + line;
    }
  }
  if (current) messages.push(current);
  return messages;
}

/** Detect if a short message is a name-label (introduces the next review block) */
function isNameLabel(text) {
  const t = text.trim();
  // ends with ":" → "מיכל רוזן מילגרם:"
  if (t.endsWith(":")) return true;
  // "על" phrase: "מקרן כהן על ראויה וממגנטת"
  if (/^[\u05d0-\u05ea\s'"-]{2,30} על .{3,}$/.test(t)) return true;
  // very short (≤ 40 chars) with no URL and no sentence punctuation → likely a label
  if (t.length <= 40 && !t.includes("http") && !/[.!?]/.test(t)) return true;
  return false;
}

function isUrl(text) {
  return /^https?:\/\/\S+$/.test(text.trim());
}

function isTooShort(text) {
  return text.trim().length < 20;
}

async function main() {
  const raw = fs.readFileSync(FILE_PATH, "utf-8");
  const messages = parseMessages(raw);

  // Only Nirit's messages
  const niritMsgs = messages.filter((m) =>
    m.sender.includes("Nirit Shapira")
  );

  const reviews = [];
  let pendingName = null;

  for (const msg of niritMsgs) {
    const text = msg.text.trim();

    if (!text || isUrl(text)) { pendingName = null; continue; }

    if (isNameLabel(text)) {
      // Extract the name part (strip trailing ": " and "על X" suffix)
      let name = text.replace(/:$/, "").trim();
      name = name.replace(/ על .+$/, "").trim();
      pendingName = name;
      continue;
    }

    if (isTooShort(text)) { continue; }

    // This is a review block
    const productType = inferProductType(text);
    reviews.push({ author_name: pendingName ?? null, text, product_type: productType });
    pendingName = null;
  }

  console.log(`Parsed ${reviews.length} reviews. Sample:`);
  if (reviews[0]) console.log(JSON.stringify(reviews[0], null, 2));

  for (const r of reviews) {
    await sql`
      INSERT INTO whatsapp_reviews (author_name, text, product_type)
      VALUES (${r.author_name}, ${r.text}, ${r.product_type})
    `;
  }

  console.log(`Inserted ${reviews.length} reviews into whatsapp_reviews.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
