import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const file = process.argv[2];
if (!file) throw new Error("Usage: node scripts/run-migration.mjs <path-to-sql>");

const envText = readFileSync(".env.local", "utf8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!m) continue;
  let value = m[2].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  process.env[m[1]] = value;
}

const sql = neon(process.env.DATABASE_URL);
const ddlRaw = readFileSync(file, "utf8");
const ddl = ddlRaw
  .split("\n")
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");
const statements = ddl
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

for (const statement of statements) {
  await sql.query(statement);
}
console.log("Migration applied successfully:", file);
