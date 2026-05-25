import { HairstyleResult } from "./types";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

async function fileToBase64(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });

  return dataUrl.split(",")[1] || "";
}

async function readGeminiError(response: Response, fallback: string) {
  const bodyText = await response.text().catch(() => "");
  if (!bodyText) return `${fallback} (Gemini API ${response.status})`;

  try {
    const body = JSON.parse(bodyText);
    return body.error?.message || body.error || body.message || `${fallback} (Gemini API ${response.status})`;
  } catch {
    return `${fallback} (Gemini API ${response.status}): ${bodyText.replace(/\s+/g, " ").slice(0, 180)}`;
  }
}

function parseJsonText(text: string): HairstyleResult {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleaned);
}

export async function generateHairstyleSuggestions(apiKey: string, photo: File): Promise<HairstyleResult> {
  const imageBase64 = await fileToBase64(photo);

  const response = await fetch(`${GEMINI_API_BASE}/gemini-3.5-flash:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: photo.type,
                data: imageBase64,
              },
            },
            {
              text: `
                Analyze this person's face shape and features.
                Return only valid JSON, with no markdown.
                The JSON must match this exact TypeScript shape:
                {
                  "faceShape": "短句，例如 鵝蛋臉 · 淺膚色",
                  "analysisReport": "繁體中文專業分析，80 字以內",
                  "suggestions": [
                    {
                      "id": "1",
                      "name": "繁體中文髮型名稱",
                      "prompt": "Short English image edit prompt for changing only the hairstyle",
                      "comment": "繁體中文短評，說明為何適合"
                    }
                  ]
                }
                Generate exactly 9 unique hairstyle suggestions.
              `,
            },
          ],
        },
      ],
      generationConfig: {
        response_mime_type: "application/json",
      },
    }),
  });

  if (!response.ok) {
    throw new Error(await readGeminiError(response, "髮型建議生成失敗"));
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.find((part: any) => part.text)?.text;
  if (!text) {
    throw new Error("Gemini 沒有回傳髮型建議文字");
  }

  return parseJsonText(text);
}

export async function generateHairstyleImage(apiKey: string, photo: File, prompt: string) {
  const imageBase64 = await fileToBase64(photo);

  const response = await fetch(`${GEMINI_API_BASE}/gemini-3.1-flash-image-preview:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              inline_data: {
                mime_type: photo.type,
                data: imageBase64,
              },
            },
            {
              text: `Take this photograph and edit the person's hair to match this specific style: "${prompt}". Retain the exact same human face, identity, expression, pose, skin tone, features, and background. Only change the hairstyle. Make it natural, clean, photorealistic, and well blended. Do not add text, logos, or artifacts.`,
            },
          ],
        },
      ],
      generationConfig: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "512px",
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(await readGeminiError(response, "生成模擬圖失敗"));
  }

  const data = await response.json();
  const inlineData = data.candidates?.[0]?.content?.parts?.find((part: any) => part.inline_data || part.inlineData);
  const base64Image = inlineData?.inline_data?.data || inlineData?.inlineData?.data;
  if (!base64Image) {
    throw new Error("Gemini 沒有回傳髮型模擬圖");
  }

  return `data:image/png;base64,${base64Image}`;
}
