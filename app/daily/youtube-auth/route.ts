import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session) redirect("/api/auth/signin");

  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return new Response("GOOGLE_OAUTH_CLIENT_ID is not set", { status: 500 });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/daily/youtube-auth/callback`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/youtube",
    access_type: "offline",
    prompt: "consent",
  });

  redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
