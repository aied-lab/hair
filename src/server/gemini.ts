import type { VercelRequest } from "@vercel/node";
import { GoogleGenAI } from "@google/genai";

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown server error";
}

type HeaderCarrier = Pick<VercelRequest, "headers"> & {
  get?: (name: string) => string | undefined;
};

export function getRequestApiKey(req: HeaderCarrier): string | undefined {
  const directHeader = typeof req.get === "function"
    ? req.get("x-gemini-api-key")
    : req.headers["x-gemini-api-key"];
  const headerValue = Array.isArray(directHeader) ? directHeader[0] : directHeader;
  return headerValue?.trim() || process.env.GEMINI_API_KEY?.trim();
}

export function getAI(req: HeaderCarrier): GoogleGenAI {
  const apiKey = getRequestApiKey(req);
  if (!apiKey) {
    throw new Error("請先輸入 Gemini API key");
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

export function pcmToWav(pcmBuffer: Buffer, sampleRate: number = 24000): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const wavHeader = Buffer.alloc(44);

  wavHeader.write("RIFF", 0);
  wavHeader.writeUInt32LE(36 + pcmBuffer.length, 4);
  wavHeader.write("WAVE", 8);
  wavHeader.write("fmt ", 12);
  wavHeader.writeUInt32LE(16, 16);
  wavHeader.writeUInt16LE(1, 20);
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(byteRate, 28);
  wavHeader.writeUInt16LE(blockAlign, 32);
  wavHeader.writeUInt16LE(bitsPerSample, 34);
  wavHeader.write("data", 36);
  wavHeader.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([wavHeader, pcmBuffer]);
}
