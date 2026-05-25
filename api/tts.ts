import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Modality } from "@google/genai";
import { getAI, getErrorMessage, pcmToWav } from "../src/server/gemini";

async function readJsonBody(req: VercelRequest): Promise<any> {
  if (req.body) return typeof req.body === "string" ? JSON.parse(req.body) : req.body;

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const bodyText = Buffer.concat(chunks).toString("utf8");
  return bodyText ? JSON.parse(bodyText) : {};
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text } = await readJsonBody(req);
    if (!text) {
      return res.status(400).json({ error: "No text provided" });
    }

    const genAI = getAI(req);
    const response = await genAI.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [
        {
          parts: [
            {
              text: `Say clearly in Traditional Chinese (Taiwanese accent) with a warm and professional tone: ${text}`,
            },
          ],
        },
      ],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio was returned from the Gemini TTS model.");
    }

    res.setHeader("Content-Type", "audio/wav");
    res.send(pcmToWav(Buffer.from(base64Audio, "base64"), 24000));
  } catch (error) {
    console.error("Error in Gemini TTS generation:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
}
