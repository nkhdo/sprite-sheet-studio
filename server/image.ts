// Image generation via OpenRouter's dedicated Images API.

import { spawn } from "node:child_process";

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

export const IMAGE_MODELS = [
  {
    id: "openai/gpt-image-2",
    label: "OpenAI GPT Image 2",
    maxStyleGuideImages: 16,
    sizeStrategy: "prompt-only",
  },
  {
    id: "x-ai/grok-imagine-image-2.0",
    label: "xAI Grok Imagine Image 2.0",
    maxStyleGuideImages: 3,
    sizeStrategy: "target-size",
  },
] as const;

export type ImageModelId = (typeof IMAGE_MODELS)[number]["id"];

export const DEFAULT_IMAGE_MODEL: ImageModelId = "openai/gpt-image-2";

export function isImageModelId(value: unknown): value is ImageModelId {
  return typeof value === "string" && IMAGE_MODELS.some((model) => model.id === value);
}

const CHROMA_DIRECTIVE =
  "Place the subject on a perfectly flat solid pure chroma green background, " +
  "hex #00b140 (RGB 0, 177, 64). The background must be one uniform color " +
  "with no gradients, no shadows, no lighting variation, and no texture. " +
  "The subject itself must contain no green elements that could conflict " +
  "with chroma keying. Centered, full subject visible.";

const STYLE_GUIDE_DIRECTIVE =
  "Use all attached Style Guide Images collectively and without priority. " +
  "Borrow only their palette, linework, shading, texture, and proportions. " +
  "Do not copy their subjects, identities, clothing, text, poses, or composition.";


function targetSizeDirective(size: { w: number; h: number }): string {
  return (
    `This image will be reduced to a final ${size.w} × ${size.h} pixel game sprite. ` +
    "Use simple, clearly separated shapes, limited fine detail, crisp edges, and a readable " +
    "silhouette so the subject remains legible after downscaling."
  );
}

interface ImageGenerationResponse {
  data?: Array<{
    b64_json?: string;
    media_type?: string;
  }>;
  error?: { message?: string; code?: string | number } | string;
}

export interface SpriteImageGenerationOptions {
  geometry?: { size: { w: number; h: number }; subjectFillPct: number };
  styleGuideDataUrls?: readonly string[];
  subjectColors?: readonly string[];
  subjectColorCount?: number | null;
}

function isPng(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  );
}

function isJpeg(buffer: Buffer): boolean {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

export async function normalizeImageToPng(
  base64: string,
  declaredMediaType?: string,
): Promise<string> {
  const source = Buffer.from(base64, "base64");
  if (isPng(source)) return base64;

  if (!isJpeg(source)) {
    const format = declaredMediaType ?? "unknown format";
    throw new Error(`OpenRouter returned unsupported image format: ${format}`);
  }

  const png = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let stderr = "";
    const child = spawn(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        "pipe:0",
        "-frames:v",
        "1",
        "-f",
        "image2pipe",
        "-vcodec",
        "png",
        "pipe:1",
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );

    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      const message = "code" in err && err.code === "ENOENT" ? "ffmpeg is not installed" : err.message;
      reject(new Error(`JPEG to PNG conversion failed: ${message}`));
    });
    child.stdin.on("error", (err) => {
      if ((err as NodeJS.ErrnoException).code !== "EPIPE") reject(err);
    });
    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `JPEG to PNG conversion failed${stderr.trim() ? `: ${stderr.trim()}` : ` (ffmpeg exited with ${code})`}`,
          ),
        );
        return;
      }
      const output = Buffer.concat(chunks);
      if (!isPng(output)) {
        reject(new Error("JPEG to PNG conversion did not produce a PNG"));
        return;
      }
      resolve(output);
    });

    child.stdin.end(source);
  });

  return png.toString("base64");
}

export async function generateSpriteImage(
  prompt: string,
  model: ImageModelId = DEFAULT_IMAGE_MODEL,
  options: SpriteImageGenerationOptions = {},
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const styleGuideDataUrls = options.styleGuideDataUrls ?? [];
  const modelConfig = IMAGE_MODELS.find((candidate) => candidate.id === model)!;
  if (styleGuideDataUrls.length > modelConfig.maxStyleGuideImages) {
    throw new Error(
      `${modelConfig.label} supports up to ${modelConfig.maxStyleGuideImages} Style Guide Images`,
    );
  }
  const fillDirective = options.geometry
    ? ` The subject occupies about ${options.geometry.subjectFillPct}% of the total image height, vertically centered, with empty margins above and below.`
    : "";
  const styleDirective =
    styleGuideDataUrls.length > 0 ? `\n\n${STYLE_GUIDE_DIRECTIVE}` : "";
  const sizeDirective =
    options.geometry && modelConfig.sizeStrategy === "prompt-only"
      ? `\n\n${targetSizeDirective(options.geometry.size)}`
      : "";
  const paletteDirective = options.subjectColors?.length
    ? `\n\nUse only these exact hex colors for the subject: ${options.subjectColors.join(", ")}. Not every color must appear. These colors take priority over the Style Guide Images' colors. Keep the background separate as #00b140. Any listed green is explicitly allowed on the subject.`
    : options.subjectColorCount
      ? `\n\nUse at most ${options.subjectColorCount} colors for the subject, excluding the chroma-green background.` : "";
  const fullPrompt = `${prompt.trim()}${styleDirective}\n\n${CHROMA_DIRECTIVE}${fillDirective}${sizeDirective}${paletteDirective}`;

  const res = await fetch(`${OPENROUTER_BASE}/images`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: fullPrompt,
      ...(options.geometry && modelConfig.sizeStrategy === "target-size"
        ? { size: `${options.geometry.size.w}x${options.geometry.size.h}` }
        : {}),
      ...(styleGuideDataUrls.length > 0
        ? {
            input_references: styleGuideDataUrls.map((url) => ({
              type: "image_url",
              image_url: { url },
            })),
          }
        : {}),
    }),
  });

  const json = (await res.json().catch(() => ({}))) as ImageGenerationResponse;

  if (!res.ok) {
    const message =
      typeof json.error === "string"
        ? json.error
        : json.error?.message ?? `HTTP ${res.status}`;
    throw new Error(`OpenRouter image generation failed: ${message}`);
  }

  const image = json.data?.[0];
  if (!image?.b64_json) {
    throw new Error("OpenRouter response did not include an image");
  }

  return normalizeImageToPng(image.b64_json, image.media_type);
}
