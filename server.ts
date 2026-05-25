import express from "express";
import path from "path";
import multer from "multer";
import dotenv from "dotenv";
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = 3000;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown server error";
}

function getRequestApiKey(req: express.Request): string | undefined {
  const headerValue = req.get("x-gemini-api-key")?.trim();
  return headerValue || process.env.GEMINI_API_KEY?.trim();
}

function getAI(req: express.Request): GoogleGenAI {
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

app.use(express.json());

// API route to generate hairstyles
app.post("/api/generate-hairstyles", upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No photo uploaded" });
    }

    const photoBuffer = req.file.buffer;
    const photoBase64 = photoBuffer.toString("base64");

    // 1. Analyze the photo and generate suggestions for 9 hairstyles
    const genAI = getAI(req);
    
    // Convert base64 to parts
    const imagePart = {
      inlineData: {
        data: photoBase64,
        mimeType: req.file.mimetype,
      },
    };

    const promptText = `
      Analyze this person's face shape and features. 
      Generate exactly 9 different hairstyle suggestions suitable for them.
      For each suggestion, provide:
      1. A short, descriptive prompt for an image generator (e.g., "A neat bob cut with soft layers").
      2. A short, appreciative comment (in Traditional Chinese) about why this style fits them.
    `;

    const result = await genAI.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ text: promptText }, imagePart],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            faceShape: {
              type: Type.STRING,
              description: "Detect the face shape and skin characteristics. Short phrase like '鵝蛋臉 · 淺膚色'"
            },
            analysisReport: {
              type: Type.STRING,
              description: "Brief professional analysis report/recommendation in Traditional Chinese based on their face structure."
            },
            suggestions: {
              type: Type.ARRAY,
              description: "Provide exactly 9 unique hairstyle suggestions.",
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING, description: "Name of the hairstyle in Traditional Chinese, e.g. '浪漫大波浪', '俐落短髮'" },
                  prompt: { type: Type.STRING, description: "Short English prompt for the image generator to replace their hair style with this suggestion." },
                  comment: { type: Type.STRING, description: "Short, appreciative explanation in Traditional Chinese about why it fits them." }
                },
                required: ["id", "name", "prompt", "comment"]
              }
            }
          },
          required: ["faceShape", "analysisReport", "suggestions"]
        }
      }
    });
    
    const responseText = result.text!;
    const responseData = JSON.parse(responseText);

    res.json(responseData);
  } catch (error) {
    console.error("Error generating hairstyles:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

// API route to generate a single hairstyle image using nano banana 2 ("gemini-3.1-flash-image-preview")
app.post("/api/generate-hairstyle-image", upload.single("photo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No photo uploaded" });
    }
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: "No prompt provided" });
    }

    const photoBuffer = req.file.buffer;
    const photoBase64 = photoBuffer.toString("base64");

    const genAI = getAI(req);

    // Call nano banana 2 model
    const response = await genAI.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: photoBase64,
              mimeType: req.file.mimetype,
            },
          },
          {
            text: `Take this photograph and edit the person's hair to match this specific style: "${prompt}". You MUST retain the exact same human face, identity, expression, pose, skin tone, features, and background. Only seamlessly change the hairstyle to look extremely natural, clean, photorealistic, and well-blended with the photo. Do not add any text, logos, or extra artifacts.`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "512px"
        }
      }
    });

    // Extract base64 image representation
    let base64Image = null;
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          base64Image = part.inlineData.data;
          break;
        }
      }
    }

    if (!base64Image) {
      throw new Error("No image was successfully generated by the nano banana 2 model.");
    }

    res.json({ imageUrl: `data:image/png;base64,${base64Image}` });
  } catch (error) {
    console.error("Error generating hairstyle image via nano banana 2:", error);
    res.status(500).json({ error: (error as Error).message || "Failed to generate image" });
  }
});

// Helper to convert Raw PCM (16-bit, Mono, 24kHz) to a playable WAV file Buffer
function pcmToWav(pcmBuffer: Buffer, sampleRate: number = 24000): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const wavHeader = Buffer.alloc(44);

  // RIFF identifier
  wavHeader.write("RIFF", 0);
  // File length minus 8 bytes
  wavHeader.writeUInt32LE(36 + pcmBuffer.length, 4);
  // RIFF type
  wavHeader.write("WAVE", 8);
  // Format chunk identifier
  wavHeader.write("fmt ", 12);
  // Chunk length (16)
  wavHeader.writeUInt32LE(16, 16);
  // Sample format (1 is PCM)
  wavHeader.writeUInt16LE(1, 20);
  // Channel count (1)
  wavHeader.writeUInt16LE(numChannels, 22);
  // Sample rate
  wavHeader.writeUInt32LE(sampleRate, 24);
  // Byte rate
  wavHeader.writeUInt32LE(byteRate, 28);
  // Block align
  wavHeader.writeUInt16LE(blockAlign, 32);
  // Bits per sample
  wavHeader.writeUInt16LE(bitsPerSample, 34);
  // Data chunk identifier
  wavHeader.write("data", 36);
  // Data chunk length
  wavHeader.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([wavHeader, pcmBuffer]);
}

// API endpoint for High-quality Gemini TTS
app.post("/api/tts", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "No text provided" });
    }

    const genAI = getAI(req);

    console.log("Generating high-quality audio narration via Gemini TTS model for:", text);

    const response = await genAI.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{
        parts: [{
          text: `Say clearly in Traditional Chinese (Taiwanese accent) with a warm and professional tone: ${text}`
        }]
      }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" } // Kore is a warm, pleasant voice
          }
        }
      }
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio was returned from the Gemini TTS model.");
    }

    const pcmBuffer = Buffer.from(base64Audio, "base64");
    // Pack PCM into standard WAV
    const wavBuffer = pcmToWav(pcmBuffer, 24000);

    res.setHeader("Content-Type", "audio/wav");
    res.send(wavBuffer);
  } catch (error) {
    console.error("Error in Gemini TTS generation:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
});

// Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
