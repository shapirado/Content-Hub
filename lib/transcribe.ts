import path from "path";
import os from "os";
import fs from "fs";
import ffmpegPath from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import { GoogleGenAI } from "@google/genai";

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
): Promise<{ transcript: string; thumbnail: string | null; videoPath: string }> {
  const mp4Path = path.join(os.tmpdir(), `${clipDetId}.mp4`);
  fs.writeFileSync(mp4Path, buffer);

  const wavPath = path.join(os.tmpdir(), `${clipDetId}.wav`);
  try {
    await extractWav(mp4Path, wavPath);

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error("GEMINI_API_KEY is not set");

    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const wavBytes = fs.readFileSync(wavPath);

    const uploaded = await ai.files.upload({
      file: new Blob([wavBytes], { type: "audio/wav" }),
      config: { mimeType: "audio/wav" },
    });
    if (!uploaded.uri) throw new Error("Gemini file upload returned no URI");

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: [
          {
            parts: [
              { fileData: { mimeType: "audio/wav", fileUri: uploaded.uri } },
              { text: "Transcribe this audio in full. Return only the transcript text, no commentary." },
            ],
          },
        ],
      });

      const transcript = response.text?.trim() ?? "";
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

      return { transcript, thumbnail, videoPath: mp4Path };
    } finally {
      // Delete the uploaded file from Gemini (best-effort)
      if (uploaded.name) {
        ai.files.delete({ name: uploaded.name }).catch(() => { /* ignore */ });
      }
    }
  } finally {
    try {
      fs.unlinkSync(wavPath);
    } catch {
      // best-effort cleanup
    }
  }
}