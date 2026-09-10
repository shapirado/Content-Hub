import { NextResponse } from "next/server";
import { auth } from "@/auth";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json()) as { image?: string; platform?: string };
  const { image, platform } = body;
  if (!image || !platform) {
    return NextResponse.json({ error: "Missing image or platform" }, { status: 400 });
  }

  const base64 = image.replace(/^data:[^;]+;base64,/, "");
  const mediaTypeMatch = image.match(/^data:([^;]+);/);
  const mediaType = (mediaTypeMatch?.[1] ?? "image/jpeg") as
    | "image/jpeg"
    | "image/png"
    | "image/gif"
    | "image/webp";

  const msg = await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          {
            type: "text",
            text: `This is a ${platform} analytics/insights screenshot (may be in Hebrew). Extract these performance metrics: views (צפיות/plays/views), likes (לייקים/likes), shares (שיתופים/shares), comments (תגובות/comments). Return ONLY a JSON object with keys: views, likes, shares, comments. Use plain integers (convert K/M abbreviations to full numbers). Use null for any metric not visible. Example: {"views":15000,"likes":432,"shares":null,"comments":28}`,
          },
        ],
      },
    ],
  });

  const rawText = msg.content.find((b) => b.type === "text")
    ? (msg.content.find((b) => b.type === "text") as { type: "text"; text: string }).text
    : "";

  // Greedy match to capture the full JSON object (including all fields)
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("extract-performance: no JSON in Claude response:", rawText.slice(0, 300));
    return NextResponse.json({ error: "Could not parse metrics from screenshot", raw: rawText.slice(0, 200) }, { status: 422 });
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      views?: number | null;
      likes?: number | null;
      shares?: number | null;
      comments?: number | null;
    };
    return NextResponse.json({
      views: parsed.views ?? null,
      likes: parsed.likes ?? null,
      shares: parsed.shares ?? null,
      comments: parsed.comments ?? null,
    });
  } catch {
    console.error("extract-performance: invalid JSON from Claude:", jsonMatch[0].slice(0, 300));
    return NextResponse.json({ error: "Invalid JSON from Claude", raw: rawText.slice(0, 200) }, { status: 422 });
  }
}
