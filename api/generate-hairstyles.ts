import type { Request, Response } from "express";
import { Type } from "@google/genai";
import { getAI, getErrorMessage } from "../src/server/gemini";
import { parseMultipart } from "../src/server/upload";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: Request, res: Response) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { photo } = await parseMultipart(req);

    if (!photo) {
      return res.status(400).json({ error: "No photo uploaded" });
    }

    const genAI = getAI(req);
    const imagePart = {
      inlineData: {
        data: photo.buffer.toString("base64"),
        mimeType: photo.mimeType,
      },
    };

    const result = await genAI.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [
        {
          text: `
            Analyze this person's face shape and features.
            Generate exactly 9 different hairstyle suggestions suitable for them.
            For each suggestion, provide:
            1. A short, descriptive prompt for an image generator.
            2. A short, appreciative comment in Traditional Chinese.
          `,
        },
        imagePart,
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            faceShape: {
              type: Type.STRING,
              description: "Detect the face shape and skin characteristics. Short phrase like '鵝蛋臉 · 淺膚色'",
            },
            analysisReport: {
              type: Type.STRING,
              description: "Brief professional analysis report/recommendation in Traditional Chinese based on their face structure.",
            },
            suggestions: {
              type: Type.ARRAY,
              description: "Provide exactly 9 unique hairstyle suggestions.",
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  name: { type: Type.STRING, description: "Name of the hairstyle in Traditional Chinese." },
                  prompt: { type: Type.STRING, description: "Short English prompt for the image generator." },
                  comment: { type: Type.STRING, description: "Short Traditional Chinese explanation about why it fits them." },
                },
                required: ["id", "name", "prompt", "comment"],
              },
            },
          },
          required: ["faceShape", "analysisReport", "suggestions"],
        },
      },
    });

    res.json(JSON.parse(result.text!));
  } catch (error) {
    console.error("Error generating hairstyles:", error);
    res.status(500).json({ error: getErrorMessage(error) });
  }
}
