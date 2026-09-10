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
): Promise<{ transcript: string; thumbnail: string | null; videoPath: string }> {
  const mp4Path = path.join(os.tmpdir(), `${clipDetId}.mp4`);
  fs.writeFileSync(mp4Path, buffer);

  const wavPath = path.join(os.tmpdir(), `${clipDetId}.wav`);
  try {
    await extractWav(mp4Path, wavPath);

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error("GEMINI_API_KEY is not set");

    // Upload WAV to Gemini File API (handles files of any length correctly)
    const wavBytes = fs.readFileSync(wavPath);
    const uploadRes = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${geminiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "audio/wav",
          "X-Goog-Upload-Protocol": "raw",
          "X-Goog-Upload-Command": "upload, finalize",
          "X-Goog-Upload-Header-Content-Type": "audio/wav",
        },
        body: wavBytes,
      }
    );
    if (!uploadRes.ok) {
      const body = await uploadRes.text();
      throw new Error(`Gemini file upload failed ${uploadRes.status}: ${body.slice(0, 200)}`);
    }
    const uploadJson = (await uploadRes.json()) as { file?: { uri?: string; name?: string } };
    const fileUri = uploadJson.file?.uri;
    const fileName = uploadJson.file?.name;
    if (!fileUri) throw new Error("Gemini file upload returned no URI");

    try {
      const res = await fetch(
        // gemini-3.8-flash
        // `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { file_data: { mime_type: "audio/wav", file_uri: fileUri } },
                  { text: "Transcribe this audio in full. Return only the transcript text, no commentary." },
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

      return { transcript, thumbnail, videoPath: mp4Path };
    } finally {
      // Delete the uploaded file from Gemini (best-effort)
      if (fileName) {
        fetch(
          `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${geminiKey}`,
          { method: "DELETE" }
        ).catch(() => { /* ignore */ });
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
