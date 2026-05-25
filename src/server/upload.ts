import fs from "node:fs/promises";
import formidable from "formidable";
import type { VercelRequest } from "@vercel/node";

export interface UploadedPhoto {
  buffer: Buffer;
  mimeType: string;
}

export interface ParsedMultipart {
  fields: Record<string, string>;
  photo?: UploadedPhoto;
}

function firstValue<T>(value: T | T[] | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export async function parseMultipart(req: VercelRequest): Promise<ParsedMultipart> {
  const form = formidable({
    multiples: false,
    maxFileSize: 8 * 1024 * 1024,
  });

  const [rawFields, rawFiles] = await form.parse(req);
  const fields: Record<string, string> = {};

  for (const [key, value] of Object.entries(rawFields)) {
    const fieldValue = firstValue(value);
    if (fieldValue !== undefined) {
      fields[key] = String(fieldValue);
    }
  }

  const photoFile = firstValue(rawFiles.photo);
  if (!photoFile) {
    return { fields };
  }

  return {
    fields,
    photo: {
      buffer: await fs.readFile(photoFile.filepath),
      mimeType: photoFile.mimetype || "image/png",
    },
  };
}
