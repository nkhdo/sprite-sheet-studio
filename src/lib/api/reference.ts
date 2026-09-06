import type { ColorPaletteSetting } from "../color-palettes";
import { getJson, postJson, projectHeaders } from "./transport";
import type { AcquisitionGeometry, ImageModelsResponse, ProjectMutation, ProjectRequestContext, ProjectView } from "./types";

export type StyleGuideMutation = ProjectMutation<Pick<ProjectView, "styleGuides" | "styleGuidesChanged" | "color_palette" | "colorPaletteNotice">>;
export type ReferenceMutation = ProjectMutation<Pick<ProjectView,
  "appliedColorPalette" |
  "spritePrompt" | "spriteModel" | "styleGuides" | "styleGuidesChanged" |
  "spritePaletteLock" | "spriteAcquisition" | "spriteOriginalFilename" |
  "backgroundSuitability" | "spriteUrl" | "transparentReferencePreviewUrl" |
  "spriteDimensions" | "targetFrameSize" |
  "subjectFillPct" | "colorCount" | "subjectFillMeasured" | "sourceVideoUrl" |
  "motionPrompt" | "motionModel" | "frames" | "framesUpdatedAt" | "animations" |
  "preservedOffPalettePixels" | "removedLowAlphaPixels" | "removedChromaFringePixels"
>>;

export interface GenerateSpriteResponse {
  mutation: ReferenceMutation;
  dataUrl: string;
}

export interface PreparedSpriteUpload {
  uploadId: string;
  originalFilename: string;
  dimensions: { w: number; h: number };
  backgroundSuitability: "suitable" | "warning" | "unknown";
  preparedAt: string;
  requiresConfirmation: boolean;
}

export function generateSprite(
  context: ProjectRequestContext,
  prompt: string,
  model?: string,
  geometry?: AcquisitionGeometry,
  spritePaletteLock?: boolean,
  color_palette?: ColorPaletteSetting,
): Promise<GenerateSpriteResponse> {
  return postJson("/api/sprites/generate", {
    prompt,
    model,
    frameSize: geometry?.frameSize,
    subjectFillPct: geometry?.subjectFillPct,
    colorCount: geometry?.colorCount ?? null,
    spritePaletteLock: spritePaletteLock === true,
    ...(color_palette ? { color_palette } : {}),
  }, context);
}

export async function uploadStyleGuide(
  context: ProjectRequestContext,
  file: File,
): Promise<StyleGuideMutation> {
  const body = new FormData();
  body.append("image", file);
  const res = await fetch("/api/sprites/style-guides", {
    method: "POST",
    headers: projectHeaders(context),
    body,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof json.error === "string" ? json.error : `Style guide upload failed (${res.status})`,
    );
  }
  return json as unknown as StyleGuideMutation;
}

export function removeStyleGuide(context: ProjectRequestContext, id: string): Promise<StyleGuideMutation> {
  return postJson("/api/sprites/style-guides/remove", { id }, context);
}

export async function prepareSpriteUpload(
  context: ProjectRequestContext,
  file: File,
  geometry: AcquisitionGeometry,
): Promise<PreparedSpriteUpload> {
  const body = new FormData();
  body.append("image", file);
  body.append("frameSize", String(geometry.frameSize));
  body.append("subjectFillPct", String(geometry.subjectFillPct));
  if (geometry.colorCount !== null) body.append("colorCount", String(geometry.colorCount));
  const res = await fetch("/api/sprites/upload/prepare", {
    method: "POST",
    headers: projectHeaders(context),
    body,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(typeof json.error === "string" ? json.error : `Upload failed (${res.status})`);
  }
  return json as unknown as PreparedSpriteUpload;
}

export function commitSpriteUpload(
  context: ProjectRequestContext,
  uploadId: string,
): Promise<ReferenceMutation> {
  return postJson("/api/sprites/upload/commit", { uploadId }, context);
}

export function discardSpriteUpload(context: ProjectRequestContext): Promise<{ ok: boolean }> {
  return postJson("/api/sprites/upload/discard", {}, context);
}

export function regenerateTransparentReferencePreview(
  context: ProjectRequestContext,
): Promise<ProjectMutation<Pick<ProjectView, "transparentReferencePreviewUrl">>> {
  return postJson("/api/sprites/transparent-preview", {}, context);
}

export function getImageModels(): Promise<ImageModelsResponse> {
  return getJson("/api/models/image");
}
