import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { activeProjectDir, activeProjectId, ensureInsideRoot, PROJECT_FILES } from "./files.js";
import {
  pruneUnreferencedStyleGuides,
  readManifest,
  toView,
  updateLatest,
  type ProjectManifest,
  type ProjectView,
} from "./projects.js";
import {
  assertAllowedFormat,
  assertDimensions,
  sanitizeDisplayFilename,
} from "./reference-sprite.js";

export const MAX_STYLE_GUIDE_IMAGES = 3;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export async function addStyleGuideImage(
  source: Buffer,
  originalFilename: string,
): Promise<ProjectView> {
  const displayFilename = sanitizeDisplayFilename(originalFilename);
  try {
    if (source.length === 0) throw new Error("image file is required");
    if (source.length > MAX_UPLOAD_BYTES) {
      throw new Error("image is too large (maximum 10 MB)");
    }

    const manifest = await readManifest(activeProjectId());
    if (manifest.styleGuideSelection.length >= MAX_STYLE_GUIDE_IMAGES) {
      throw new Error(`a project can use up to ${MAX_STYLE_GUIDE_IMAGES} Style Guide Images`);
    }

    const metadata = await sharp(source).metadata();
    assertAllowedFormat(metadata.format);
    assertDimensions(metadata.width, metadata.height);
    const normalized = await sharp(source).rotate().png().toBuffer();

    const id = randomUUID();
    const relativePath = path.posix.join(PROJECT_FILES.styleGuidesDir, `${id}.png`);
    const absolutePath = path.join(activeProjectDir(), relativePath);
    ensureInsideRoot(absolutePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, normalized);

    const updated = await updateLatest({
      styleGuideImages: [
        ...manifest.styleGuideImages,
        { id, originalFilename: displayFilename, path: relativePath },
      ],
      styleGuideSelection: [...manifest.styleGuideSelection, id],
    });
    return toView(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Style Guide Image '${displayFilename}' could not be added: ${message}`);
  }
}

export async function removeStyleGuideImage(id: string): Promise<ProjectView> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("invalid Style Guide Image id");
  const manifest = await readManifest(activeProjectId());
  if (!manifest.styleGuideSelection.includes(id)) {
    throw new Error("Style Guide Image not found in the current selection");
  }

  const updated = await updateLatest({
    ...(manifest.styleGuideSelection.length === 1 && manifest.color_palette === "style-guides"
      ? { color_palette: "unrestricted" as const, colorPaletteNotice: "The last Style Guide Image was removed. Color palette switched to Unrestricted." }
      : {}),
    styleGuideSelection: manifest.styleGuideSelection.filter((candidate) => candidate !== id),
  });
  return toView(await pruneUnreferencedStyleGuides(updated));
}

export async function readSelectedStyleGuideDataUrls(
  manifest: ProjectManifest,
): Promise<string[]> {
  return Promise.all(
    manifest.styleGuideSelection.map(async (id) => {
      const guide = manifest.styleGuideImages.find((candidate) => candidate.id === id);
      if (!guide) throw new Error("Style Guide Image metadata is incomplete");
      const absolutePath = path.join(activeProjectDir(), guide.path);
      ensureInsideRoot(absolutePath);
      try {
        const image = await readFile(absolutePath);
        return `data:image/png;base64,${image.toString("base64")}`;
      } catch {
        throw new Error(`Style Guide Image '${guide.originalFilename}' could not be read`);
      }
    }),
  );
}
