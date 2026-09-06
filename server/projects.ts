import { colorPaletteLibrary } from "./color-palettes.js";
import { isColorPaletteSetting, legacyColorPaletteSetting, type ColorPaletteSetting, type AppliedColorPalette } from "../src/lib/color-palettes.js";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  PROJECTS_DIR,
  PROJECT_FILES,
  activeProjectDir,
  activeProjectId,
  ensureInsideRoot,
  projectDir,
  safeProjectId,
} from "./files.js";
import type { BackgroundSuitability, SpriteAcquisition } from "./reference-sprite.js";

export interface StyleGuideImage {
  id: string;
  originalFilename: string;
  path: string;
}

export interface AnimationManifest {
  id: string;
  name: string;
  frameIndices: number[];
  frames: string[];
  fps: number;
  spritesheet: string;
  previewGif: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnimationView extends Omit<AnimationManifest, "frames" | "spritesheet" | "previewGif"> {
  frameUrls: string[];
  spritesheetUrl: string;
  previewGifUrl: string | null;
}

export interface ProjectManifest {
  id: string;
  label: string;
  createdAt: string;
  revision: number;
  spriteAcquisitionMode: "generate" | "upload";
  draftFrameSize: number;
  draftSubjectFillPct: number;
  draftColorCount: number | null;
  color_palette: ColorPaletteSetting;
  colorPaletteNotice: string;
  appliedColorPalette: AppliedColorPalette | null;
  animationDraftName: string;
  animationDraftFps: number;
  spritePrompt: string;
  spriteModel: string;
  styleGuideImages: StyleGuideImage[];
  styleGuideSelection: string[];
  appliedStyleGuideSet: string[];
  spritePaletteLock: boolean;
  spriteAcquisition: SpriteAcquisition | null;
  spriteOriginalFilename: string | null;
  backgroundSuitability: BackgroundSuitability;
  motionPrompt: string;
  motionModel: string;
  paletteLock: boolean;
  hardAlphaEdges: boolean;
  preservedOffPalettePixels: number | null;
  removedLowAlphaPixels: number | null;
  removedChromaFringePixels: number | null;
  sprite: string | null;
  spriteDimensions: { w: number; h: number } | null;
  targetFrameSize: { w: number; h: number } | null;
  subjectFillPct: number | null;
  colorCount: number | null;
  subjectFillMeasured: number | null;
  sourceVideo: string | null;
  frames: string[];
  framesUpdatedAt: string;
  /** Legacy migration input; never written by current workflows. */
  selectedFrameIndices?: number[];
  /** Legacy migration input; never written by current workflows. */
  spritesheet?: string | null;
  /** Legacy migration input; never written by current workflows. */
  previewGif?: string | null;
  animations: AnimationManifest[];
  updatedAt: string;
}

export interface ProjectView {
  id: string;
  label: string;
  createdAt: string;
  revision: number;
  spriteAcquisitionMode: "generate" | "upload";
  draftFrameSize: number;
  draftSubjectFillPct: number;
  draftColorCount: number | null;
  color_palette: ColorPaletteSetting;
  colorPaletteNotice: string;
  appliedColorPalette: AppliedColorPalette | null;
  animationDraftName: string;
  animationDraftFps: number;
  spritePrompt: string;
  spriteModel: string;
  styleGuides: Array<{
    id: string;
    originalFilename: string;
    url: string;
  }>;
  styleGuidesChanged: boolean;
  spriteAcquisition: SpriteAcquisition | null;
  spriteOriginalFilename: string | null;
  spritePaletteLock: boolean;
  backgroundSuitability: BackgroundSuitability;
  motionPrompt: string;
  motionModel: string;
  paletteLock: boolean;
  hardAlphaEdges: boolean;
  preservedOffPalettePixels: number | null;
  removedLowAlphaPixels: number | null;
  removedChromaFringePixels: number | null;
  spriteUrl: string | null;
  transparentReferencePreviewUrl: string | null;
  spriteDimensions: { w: number; h: number } | null;
  targetFrameSize: { w: number; h: number } | null;
  subjectFillPct: number | null;
  colorCount: number | null;
  subjectFillMeasured: number | null;
  frames: string[];
  framesUpdatedAt: string;
  sourceVideoUrl: string | null;
  animations: AnimationView[];
  updatedAt: string;
}

export interface ProjectMutation {
  revision: number;
  updatedAt: string;
  changes: Partial<ProjectView>;
}

export function toMutation(
  view: ProjectView,
  keys: readonly (keyof ProjectView)[],
): ProjectMutation {
  return {
    revision: view.revision,
    updatedAt: view.updatedAt,
    changes: Object.fromEntries(keys.map((key) => [key, view[key]])),
  };
}

export function emptyManifest(id: string = randomUUID(), label = "Untitled project"): ProjectManifest {
  const now = new Date().toISOString();
  return {
    id,
    label,
    createdAt: now,
    revision: 0,
    spriteAcquisitionMode: "generate",
    draftFrameSize: 128,
    draftSubjectFillPct: 70,
    draftColorCount: 16,
    color_palette: "count:16",
    colorPaletteNotice: "",
    appliedColorPalette: null,
    animationDraftName: "",
    animationDraftFps: 12,
    spritePrompt: "",
    spriteModel: "openai/gpt-image-2",
    styleGuideImages: [],
    styleGuideSelection: [],
    appliedStyleGuideSet: [],
    spritePaletteLock: false,
    spriteAcquisition: null,
    spriteOriginalFilename: null,
    backgroundSuitability: "unknown",
    motionPrompt: "",
    motionModel: "x-ai/grok-imagine-video",
    paletteLock: false,
    hardAlphaEdges: false,
    preservedOffPalettePixels: null,
    removedLowAlphaPixels: null,
    removedChromaFringePixels: null,
    sprite: null,
    spriteDimensions: null,
    targetFrameSize: null,
    subjectFillPct: null,
    colorCount: null,
    subjectFillMeasured: null,
    sourceVideo: null,
    frames: [],
    framesUpdatedAt: now,
    animations: [],
    updatedAt: now,
  };
}

function manifestPath(name: string): string {
  return path.join(projectDir(name), PROJECT_FILES.manifest);
}

export function projectExists(id: string): boolean {
  return existsSync(manifestPath(safeProjectId(id)));
}

export async function readManifest(dirName: string): Promise<ProjectManifest> {
  const p = manifestPath(dirName);
  if (!existsSync(p)) return emptyManifest(dirName);
  try {
    const raw = await readFile(p, "utf8");
    const parsed = JSON.parse(raw) as Partial<ProjectManifest> & { name?: string };
    const hydrated = {
      ...emptyManifest(dirName, parsed.label ?? parsed.name ?? "Untitled project"),
      ...parsed,
      id: dirName,
      label: parsed.label ?? parsed.name ?? "Untitled project",
      createdAt: parsed.createdAt ?? parsed.updatedAt ?? new Date().toISOString(),
      revision: Number.isInteger(parsed.revision) ? parsed.revision! : 0,
      framesUpdatedAt: parsed.framesUpdatedAt ?? parsed.updatedAt ?? new Date().toISOString(),
    };
    delete (hydrated as Partial<ProjectManifest> & { name?: string }).name;
    hydrated.animations = Array.isArray(parsed.animations) ? parsed.animations : [];
    const legacyFrameIndices = hydrated.selectedFrameIndices ?? [];
    if (hydrated.animations.length === 0 && hydrated.spritesheet) {
      hydrated.animations = [{
        id: "legacy",
        name: "animation-1",
        frameIndices: [...legacyFrameIndices],
        frames: legacyFrameIndices.flatMap((index) => hydrated.frames[index] ? [hydrated.frames[index]] : []),
        fps: 12,
        spritesheet: hydrated.spritesheet,
        previewGif: hydrated.previewGif ?? null,
        createdAt: hydrated.updatedAt,
        updatedAt: hydrated.updatedAt,
      }];
    }
    delete hydrated.selectedFrameIndices;
    delete hydrated.spritesheet;
    delete hydrated.previewGif;
    if (!hydrated.spriteAcquisition && hydrated.sprite) hydrated.spriteAcquisition = "generated";
    // Older manifests inferred source.mp4 from the presence of frames.
    if (parsed.sourceVideo === undefined && hydrated.frames.length > 0) {
      hydrated.sourceVideo = PROJECT_FILES.source;
    }
    hydrated.color_palette = parsed.color_palette ?? legacyColorPaletteSetting(hydrated.spritePaletteLock, hydrated.draftColorCount);
    return reconcileColorPalette(hydrated);
  } catch {
    return emptyManifest(dirName);
  }
}

// Resolve removed selections on every read. This does not rewrite a Project
// while its generation holds the write lock or change its acquired artifacts.
export async function reconcileColorPalette(
  manifest: ProjectManifest,
  library = colorPaletteLibrary,
): Promise<ProjectManifest> {
  if ((manifest.color_palette === "style-guides" && !manifest.styleGuideSelection.length) ||
      (manifest.color_palette.startsWith("palette:") &&
        !(await library.list()).some(({ id }) => id === manifest.color_palette.slice(8)))) {
    return {
      ...manifest, color_palette: "unrestricted",
      colorPaletteNotice: "The selected palette is unavailable. Color palette switched to Unrestricted.",
    };
  }
  return manifest;
}

export async function writeManifest(
  dirName: string,
  manifest: ProjectManifest,
): Promise<ProjectManifest> {
  await mkdir(projectDir(dirName), { recursive: true });
  const toWrite: ProjectManifest = {
    ...manifest,
    id: dirName,
    revision: manifest.revision + 1,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(manifestPath(dirName), JSON.stringify(toWrite, null, 2));
  return toWrite;
}

export async function updateLatest(
  patch: Partial<ProjectManifest>,
): Promise<ProjectManifest> {
  const id = activeProjectId();
  const current = await readManifest(id);
  return writeManifest(id, { ...current, ...patch, id });
}


export function toView(m: ProjectManifest): ProjectView {
  const base = `/projects/${m.id}/`;
  return {
    id: m.id,
    label: m.label,
    createdAt: m.createdAt,
    revision: m.revision,
    spriteAcquisitionMode: m.spriteAcquisitionMode,
    draftFrameSize: m.draftFrameSize,
    draftSubjectFillPct: m.draftSubjectFillPct,
    draftColorCount: m.draftColorCount,
    color_palette: m.color_palette,
    colorPaletteNotice: m.colorPaletteNotice,
    appliedColorPalette: m.appliedColorPalette,
    animationDraftName: m.animationDraftName,
    animationDraftFps: m.animationDraftFps,
    spritePrompt: m.spritePrompt,
    spriteModel: m.spriteModel,
    styleGuides: m.styleGuideSelection.flatMap((id) => {
      const guide = m.styleGuideImages.find((candidate) => candidate.id === id);
      return guide
        ? [{ id: guide.id, originalFilename: guide.originalFilename, url: base + guide.path }]
        : [];
    }),
    styleGuidesChanged:
      m.styleGuideSelection.length !== m.appliedStyleGuideSet.length ||
      m.styleGuideSelection.some((id) => !m.appliedStyleGuideSet.includes(id)),
    spriteAcquisition: m.spriteAcquisition,
    spriteOriginalFilename: m.spriteOriginalFilename,
    spritePaletteLock: m.spritePaletteLock,
    backgroundSuitability: m.backgroundSuitability,
    motionPrompt: m.motionPrompt,
    motionModel: m.motionModel,
    paletteLock: m.paletteLock,
    hardAlphaEdges: m.hardAlphaEdges,
    preservedOffPalettePixels: m.preservedOffPalettePixels,
    removedLowAlphaPixels: m.removedLowAlphaPixels,
    removedChromaFringePixels: m.removedChromaFringePixels,
    spriteUrl: m.sprite ? base + m.sprite : null,
    transparentReferencePreviewUrl:
      m.sprite && existsSync(path.join(projectDir(m.id), PROJECT_FILES.transparentRefPreview))
        ? base + PROJECT_FILES.transparentRefPreview
        : null,
    spriteDimensions: m.spriteDimensions,
    targetFrameSize: m.targetFrameSize ?? null,
    subjectFillPct: m.subjectFillPct ?? null,
    colorCount: m.colorCount ?? null,
    subjectFillMeasured: m.subjectFillMeasured ?? null,
    frames: m.frames.map((f) => base + f),
    framesUpdatedAt: m.framesUpdatedAt,
    sourceVideoUrl: m.sourceVideo ? base + m.sourceVideo : null,
    animations: m.animations.map((animation) => ({
      id: animation.id,
      name: animation.name,
      frameIndices: animation.frameIndices,
      frameUrls: animation.frames.map((frame) => base + frame),
      fps: animation.fps,
      spritesheetUrl: base + animation.spritesheet,
      previewGifUrl: animation.previewGif ? base + animation.previewGif : null,
      createdAt: animation.createdAt,
      updatedAt: animation.updatedAt,
    })),
    updatedAt: m.updatedAt,
  };
}

export async function pruneUnreferencedStyleGuides(
  manifest: ProjectManifest,
): Promise<ProjectManifest> {
  const referenced = new Set([
    ...manifest.styleGuideSelection,
    ...manifest.appliedStyleGuideSet,
  ]);
  const retained = manifest.styleGuideImages.filter((guide) => referenced.has(guide.id));
  const removed = manifest.styleGuideImages.filter((guide) => !referenced.has(guide.id));
  if (removed.length === 0) return manifest;

  await Promise.all(
    removed.map(async (guide) => {
      const absolutePath = path.join(activeProjectDir(), guide.path);
      ensureInsideRoot(absolutePath);
      await rm(absolutePath, { force: true });
    }),
  );
  return writeManifest(activeProjectId(), { ...manifest, styleGuideImages: retained });
}

export async function wipeLatestMotionArtifacts(): Promise<void> {
  const sourceVideo = path.join(activeProjectDir(), PROJECT_FILES.source);
  if (existsSync(sourceVideo)) await rm(sourceVideo, { force: true });
  await wipeLatestFramesAndSheet();
}

export async function wipeLatestFramesAndSheet(): Promise<void> {
  const framesDir = path.join(activeProjectDir(), PROJECT_FILES.framesDir);
  if (existsSync(framesDir)) {
    await rm(framesDir, { recursive: true, force: true });
  }
  await wipeLatestSpritesheet();
}

export async function wipeLatestSpritesheet(): Promise<void> {
  const sheet = path.join(activeProjectDir(), PROJECT_FILES.spritesheet);
  if (existsSync(sheet)) await rm(sheet);
  const gif = path.join(activeProjectDir(), PROJECT_FILES.previewGif);
  if (existsSync(gif)) await rm(gif);
}

export async function wipeLatestAnimations(): Promise<void> {
  const animationsDir = path.join(activeProjectDir(), PROJECT_FILES.animationsDir);
  ensureInsideRoot(animationsDir);
  if (existsSync(animationsDir)) {
    await rm(animationsDir, { recursive: true, force: true });
  }
}

export interface ProjectSummary {
  id: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export function compareProjectsByCreatedAt(a: ProjectSummary, b: ProjectSummary): number {
  return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
}

export async function listSavedProjects(): Promise<ProjectSummary[]> {
  await migrateLegacyProjects();
  if (!existsSync(PROJECTS_DIR)) return [];
  const entries = await readdir(PROJECTS_DIR, { withFileTypes: true });
  const out: ProjectSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !isUuid(entry.name)) continue;
    try {
      const m = await readManifest(entry.name);
      out.push({ id: m.id, label: m.label, createdAt: m.createdAt, updatedAt: m.updatedAt });
    } catch {
      // skip malformed
    }
  }
  out.sort(compareProjectsByCreatedAt);
  return out;
}

export async function createProject(label = "Untitled project"): Promise<ProjectView> {
  const id = randomUUID();
  return toView(await writeManifest(id, emptyManifest(id, validateLabel(label))));
}

export async function getProject(id: string): Promise<ProjectView> {
  safeProjectId(id);
  if (!existsSync(manifestPath(id))) throw new Error("project not found");
  return toView(await readManifest(id));
}

export async function renameProject(id: string, label: string): Promise<ProjectView> {
  safeProjectId(id);
  const current = await readManifest(id);
  if (!existsSync(manifestPath(id))) throw new Error("project not found");
  return toView(await writeManifest(id, { ...current, label: validateLabel(label) }));
}

export async function deleteSavedProject(id: string): Promise<void> {
  safeProjectId(id);
  const target = projectDir(id);
  if (!existsSync(target)) throw new Error("project not found");
  await rm(target, { recursive: true, force: true });
}

export async function patchProjectDraft(
  id: string,
  revision: number,
  patch: Partial<Pick<ProjectManifest,
    "spritePrompt" | "spriteModel" | "spritePaletteLock" | "motionPrompt" |
    "motionModel" | "paletteLock" | "hardAlphaEdges" | "spriteAcquisitionMode" |
    "draftFrameSize" | "draftSubjectFillPct" | "draftColorCount" | "color_palette" |
    "animationDraftName" | "animationDraftFps"
  >>,
  base: Record<string, unknown>,
): Promise<ProjectView> {
  safeProjectId(id);
  if (!existsSync(manifestPath(id))) throw new Error("project not found");
  const current = await readManifest(id);
  for (const [key, value] of Object.entries(patch)) {
    const valid = key === "color_palette" ? isColorPaletteSetting(value) : key === "spritePrompt" || key === "spriteModel" || key === "motionPrompt" || key === "motionModel" || key === "animationDraftName"
      ? typeof value === "string"
      : key === "spritePaletteLock" || key === "paletteLock" || key === "hardAlphaEdges"
        ? typeof value === "boolean"
        : key === "spriteAcquisitionMode"
          ? value === "generate" || value === "upload"
        : key === "draftFrameSize" || key === "draftSubjectFillPct" || key === "animationDraftFps"
          ? typeof value === "number" && Number.isFinite(value)
          : key === "draftColorCount"
            ? value === null || (typeof value === "number" && Number.isInteger(value))
            : false;
    if (!valid) throw new Error(`invalid draft field '${key}'`);
  }
  if (current.revision !== revision) {
    const conflict = Object.keys(patch).some((key) =>
      key in base &&
      current[key as keyof ProjectManifest] !== base[key] &&
      current[key as keyof ProjectManifest] !== patch[key as keyof typeof patch],
    );
    if (conflict) {
      const error = new Error("project changed in another tab; reload before retrying");
      Object.assign(error, { statusCode: 409 });
      throw error;
    }
  }
  if (patch.color_palette === "style-guides" && !current.styleGuideSelection.length) {
    throw new Error("Select Style Guide Images to use their colors.");
  }
  if (patch.color_palette?.startsWith("palette:") &&
      !(await colorPaletteLibrary.list()).some(({ id }) => id === patch.color_palette!.slice(8))) {
    throw new Error("Color Palette is unavailable. Select another palette or Unrestricted.");
  }
  return toView(await writeManifest(id, {
    ...current, ...patch, ...(patch.color_palette ? { colorPaletteNotice: "" } : {}),
  }));
}

function validateLabel(label: string): string {
  const value = label.trim();
  if (!value) throw new Error("project label is required");
  if (value.length > 80) throw new Error("project label is too long");
  return value;
}

function isUuid(value: string): boolean {
  try { safeProjectId(value); return true; } catch { return false; }
}

function hasMeaningfulLegacyWork(m: ProjectManifest): boolean {
  return Boolean(m.sprite || m.sourceVideo || m.frames.length || m.animations.length ||
    m.spritePrompt || m.motionPrompt || m.styleGuideImages.length);
}

export async function migrateLegacyProjects(): Promise<void> {
  if (!existsSync(PROJECTS_DIR)) return;
  const entries = await readdir(PROJECTS_DIR, { withFileTypes: true });
  const legacy = entries.filter((entry) => entry.isDirectory() && !isUuid(entry.name));
  if (legacy.length === 0) return;

  const named = legacy.filter((entry) => entry.name !== "latest");
  const created: string[] = [];
  try {
    for (const entry of named) {
      const old = await readManifest(entry.name);
      const id = randomUUID();
      const target = projectDir(id);
      await cp(projectDir(entry.name), target, { recursive: true });
      await writeManifest(id, { ...old, id, label: old.label || entry.name, revision: 0 });
      created.push(target);
    }

    const latestEntry = legacy.find((entry) => entry.name === "latest");
    if (latestEntry) {
      const latest = await readManifest("latest");
      const matching = named.find((entry) => entry.name === latest.label);
      let recover = hasMeaningfulLegacyWork(latest);
      if (matching) {
        const snapshot = await readManifest(matching.name);
        recover = latest.updatedAt > snapshot.updatedAt;
      }
      if (recover) {
        const id = randomUUID();
        const target = projectDir(id);
        await cp(projectDir("latest"), target, { recursive: true });
        const baseLabel = latest.label === "latest" ? "Recovered project" : `${latest.label} (recovered)`;
        await writeManifest(id, { ...latest, id, label: baseLabel, revision: 0 });
        created.push(target);
      }
    }
  } catch (error) {
    await Promise.all(created.map((target) => rm(target, { recursive: true, force: true })));
    throw error;
  }

  for (const entry of legacy) {
    await rm(projectDir(entry.name), { recursive: true, force: true });
  }
}
