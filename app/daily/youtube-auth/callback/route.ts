import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) redirect("/api/auth/signin");

  const code = request.nextUrl.searchParams.get("code");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return new Response(
      `<html><body dir="rtl" style="font-family:sans-serif;padding:2rem"><h2>שגיאת OAuth</h2><p>${error}</p></body></html>`,
      { headers: { "Content-Type": "text/html;charset=utf-8" } }
    );
  }

  if (!code) {
    return new Response("Missing code parameter", { status: 400 });
  }

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const redirectUri = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/daily/youtube-auth/callback`;

  if (!clientId || !clientSecret) {
    return new Response("Missing Google OAuth env vars", { status: 500 });
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const json = (await res.json()) as { refresh_token?: string; error?: string };

  if (!res.ok || !json.refresh_token) {
    return new Response(
      `<html><body dir="rtl" style="font-family:sans-serif;padding:2rem"><h2>שגיאה בקבלת Refresh Token</h2><pre>${JSON.stringify(json, null, 2)}</pre></body></html>`,
      { headers: { "Content-Type": "text/html;charset=utf-8" } }
    );
  }

  const html = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><title>YouTube OAuth — הצלחה</title>
<style>
  body { font-family: sans-serif; padding: 2rem; max-width: 600px; margin: 0 auto; }
  .token-box { background: #f0f4f0; border: 1px solid #c0d0c0; border-radius: 8px; padding: 1rem; word-break: break-all; font-family: monospace; font-size: 0.85rem; margin: 1rem 0; }
  .step { margin: 0.5rem 0; }
  button { background: #5a7a5a; color: white; border: none; border-radius: 6px; padding: 0.5rem 1rem; cursor: pointer; font-size: 0.9rem; }
</style>
</head>
<body>
<h2>✅ קיבלת Refresh Token ליוטיוב</h2>
<p>הוסף את השורה הבאה לקובץ <code>.env.local</code>:</p>
<div class="token-box">YOUTUBE_REFRESH_TOKEN=${json.refresh_token}</div>
<button onclick="navigator.clipboard.writeText('YOUTUBE_REFRESH_TOKEN=${json.refresh_token}')">העתקה ללוח</button>
<p class="step" style="margin-top:1.5rem;color:#666">לאחר הוספת המשתנה, הפעל מחדש את שרת הפיתוח.</p>
</body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html;charset=utf-8" },
  });
}
