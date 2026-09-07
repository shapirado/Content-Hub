import path from "path";
import os from "os";
import fs from "fs";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

function extractWav(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioChannels(1)
      .audioFrequency(16000)
      .format("wav")
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err))
      .run();
  });
}

function extractThumbnail(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions(["-ss", "1", "-vframes", "1", "-vf", "scale=320:-1"])
      .output(outputPath)
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err))
      .run();
  });
}

export async function transcribeAndSave(
  buffer: Buffer,
  clipDetId: string
): Promise<{ transcript: string; thumbnail: string | null }> {
  const uploadsDir = path.join(process.cwd(), "uploads");
  fs.mkdirSync(uploadsDir, { recursive: true });

  const mp4Path = path.join(uploadsDir, `${clipDetId}.mp4`);
  fs.writeFileSync(mp4Path, buffer);

  const wavPath = path.join(os.tmpdir(), `${clipDetId}.wav`);
  try {
    await extractWav(mp4Path, wavPath);

    const wavBytes = fs.readFileSync(wavPath);
    const base64Audio = wavBytes.toString("base64");

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error("GEMINI_API_KEY is not set");

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: "audio/wav", data: base64Audio } },
                {
                  text: "Transcribe this audio. Return only the transcript text, no commentary.",
                },
              ],
            },
          ],
        }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const transcript =
      json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    if (!transcript) throw new Error("Gemini returned empty transcript");

    // Extract thumbnail (best-effort — doesn't fail the whole transcription)
    let thumbnail: string | null = null;
    const thumbPath = path.join(os.tmpdir(), `${clipDetId}.jpg`);
    try {
      await extractThumbnail(mp4Path, thumbPath);
      const thumbBytes = fs.readFileSync(thumbPath);
      thumbnail = `data:image/jpeg;base64,${thumbBytes.toString("base64")}`;
    } catch {
      // non-fatal
    } finally {
      try { fs.unlinkSync(thumbPath); } catch { /* ignore */ }
    }

    return { transcript, thumbnail };
  } finally {
    try {
      fs.unlinkSync(wavPath);
    } catch {
      // best-effort cleanup
    }
  }
}
