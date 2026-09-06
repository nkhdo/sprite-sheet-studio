import "dotenv/config";
import { colorPaletteLibrary } from "./color-palettes.js";
import { resolveReferenceColors, applyReferenceColors } from "./reference-colors.js";
import { isColorPaletteSetting, legacyColorPaletteSetting } from "../src/lib/color-palettes.js";
import express, { type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import path from "node:path";
import { mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import {
  DEFAULT_IMAGE_MODEL,
  IMAGE_MODELS,
  generateSpriteImage,
  isImageModelId,
} from "./image.js";
import {
  addStyleGuideImage,
  readSelectedStyleGuideDataUrls,
  removeStyleGuideImage,
} from "./style-guides.js";
import {
  DEFAULT_VIDEO_MODEL,
  VIDEO_MODELS,
  defaultDurationFor,
  generateSpriteMotionVideo,
  isVideoModelId,
  normalizeVideoInput,
} from "./video.js";
import { extractFrames } from "./extract-frames.js";
import {
  PROJECTS_DIR,
  PROJECT_FILES,
  activeProjectDir,
  activeProjectId,
  downloadVideo,
  ensureInsideRoot,
  readPngDims,
  runInProject,
  saveBase64Image,
  safeProjectId,
} from "./files.js";
import {
  createProject,
  deleteSavedProject,
  getProject,
  listSavedProjects,
  patchProjectDraft,
  projectExists,
  readManifest,
  renameProject,
  pruneUnreferencedStyleGuides,
  toView,
  toMutation,
  updateLatest,
  wipeLatestAnimations,
  wipeLatestFramesAndSheet,
  wipeLatestMotionArtifacts,
  wipeLatestSpritesheet,
} from "./projects.js";
import {
  TARGET_FRAME_SIZES,
  commitReferenceUpload,
  discardPreparedUpload,
  normalizeReferenceImage,
  assessBackground,
  prepareReferenceUpload,
  applyTargetGeometry,
  parseTargetGeometry,
  regenerateTransparentReferencePreview,
  removeTransparentReferencePreview,
} from "./reference-sprite.js";
import { dataUrlToBuffer } from "./palette-lock.js";
import { createAnimation, deleteAnimation, updateAnimation } from "./animations.js";

const PORT = Number(process.env.PORT ?? 8787);
const HAS_KEY = Boolean(process.env.OPENROUTER_API_KEY);

const app = express();
app.use(express.json({ limit: "50mb" }));
app.use("/projects", express.static(PROJECTS_DIR, { fallthrough: false }));
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 10 * 1024 * 1024 },
});
const projectWriteTails = new Map<string, Promise<void>>();

const STYLE_GUIDE_FIELDS = ["styleGuides", "styleGuidesChanged", "color_palette", "colorPaletteNotice"] as const;
const REFERENCE_FIELDS = [
  "appliedColorPalette",
  "spritePrompt", "spriteModel", "styleGuides", "styleGuidesChanged",
  "spritePaletteLock", "spriteAcquisition", "spriteOriginalFilename",
  "backgroundSuitability", "spriteUrl", "transparentReferencePreviewUrl",
  "spriteDimensions", "targetFrameSize",
  "subjectFillPct", "colorCount", "subjectFillMeasured", "sourceVideoUrl",
  "motionPrompt", "motionModel", "frames", "framesUpdatedAt", "animations",
  "preservedOffPalettePixels", "removedLowAlphaPixels", "removedChromaFringePixels",
] as const;
const VIDEO_FIELDS = [
  "motionPrompt", "motionModel", "sourceVideoUrl", "frames", "framesUpdatedAt",
  "preservedOffPalettePixels", "removedLowAlphaPixels", "removedChromaFringePixels",
] as const;
const FRAME_FIELDS = [
  "frames", "framesUpdatedAt", "paletteLock", "hardAlphaEdges",
  "preservedOffPalettePixels", "removedLowAlphaPixels", "removedChromaFringePixels",
] as const;
const ANIMATION_FIELDS = ["animations"] as const;
const PROJECT_LABEL_FIELDS = ["label"] as const;

app.use(async (req, res, next) => {
  const raw = req.header("X-Project-ID");
  const requiresProject = req.path.startsWith("/api/sprites/") ||
    req.path === "/api/projects/draft" ||
    req.path.startsWith("/api/projects/animations");
  if (!requiresProject) { next(); return; }
  if (!raw) { handleError(new Error("project id is required"), res); return; }
  try {
    const id = safeProjectId(raw);
    if (!projectExists(id)) throw new Error("project not found");
    const isManagedWrite = req.method !== "GET" && ![
      "/api/projects",
      "/api/projects/rename",
      "/api/projects/delete",
    ].includes(req.path);
    if (!isManagedWrite) {
      runInProject(id, next);
      return;
    }

    const previous = projectWriteTails.get(id) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const tail = previous.then(() => gate);
    projectWriteTails.set(id, tail);
    await previous;

    const finish = () => {
      release();
      if (projectWriteTails.get(id) === tail) projectWriteTails.delete(id);
    };
    res.once("finish", finish);
    res.once("close", finish);
    await runInProject(id, async () => {
      const expected = Number(req.header("X-Project-Revision"));
      const current = await readManifest(id);
      if (req.path !== "/api/projects/draft" &&
          (!Number.isInteger(expected) || expected !== current.revision)) {
        const error = new Error("project changed in another tab; reload before retrying");
        Object.assign(error, { statusCode: 409 });
        throw error;
      }
      next();
    });
  } catch (error) {
    handleError(error, res);
  }
});

function requireKey(_req: Request, res: Response, next: NextFunction) {
  if (!HAS_KEY) {
    res.status(500).json({
      error: "OPENROUTER_API_KEY is not configured. Add it to .env and restart the server.",
    });
    return;
  }
  next();
}

function asString(v: unknown, name: string, max = 2_000): string {
  if (typeof v !== "string" || v.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  if (v.length > max) throw new Error(`${name} is too long`);
  return v.trim();
}

app.get("/api/color-palettes", async (_req, res) => {
  try { res.json(await colorPaletteLibrary.list()); } catch (error) { handleError(error, res); }
});

app.post("/api/color-palettes/save", async (req, res) => {
  try { res.json(await colorPaletteLibrary.save(req.body ?? {})); } catch (error) { handleError(error, res); }
});

app.get("/api/color-palettes/:id/usage", async (req, res) => {
  try {
    const id = safeProjectId(req.params.id);
    const projects = await listSavedProjects();
    const manifests = await Promise.all(projects.map((project) => readManifest(project.id)));
    res.json({ count: manifests.filter((project) => project.color_palette === `palette:${id}`).length });
  } catch (error) { handleError(error, res); }
});

app.post("/api/color-palettes/delete", async (req, res) => {
  try {
    await colorPaletteLibrary.delete(req.body?.id, req.body?.revision);
    // Project hydration resolves deleted selections without racing an in-flight
    // generation's manifest write. Its applied snapshot remains independent.
    res.json({ ok: true });
  } catch (error) { handleError(error, res); }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, hasApiKey: HAS_KEY });
});

app.get("/api/models/video", (_req, res) => {
  res.json({ models: VIDEO_MODELS, default: DEFAULT_VIDEO_MODEL });
});

app.get("/api/models/image", (_req, res) => {
  res.json({ models: IMAGE_MODELS, default: DEFAULT_IMAGE_MODEL });
});

app.get("/api/projects/:id", async (req, res) => {
  try {
    let view = await getProject(req.params.id);
    if (view.spriteUrl && view.backgroundSuitability === "suitable" &&
        !view.transparentReferencePreviewUrl) {
      await runInProject(view.id, () => regenerateTransparentReferencePreview()).catch(() => undefined);
      view = await getProject(view.id);
    }
    res.json(view);
  } catch (err) {
    handleError(err, res);
  }
});

app.get("/api/projects", async (_req, res) => {
  try {
    res.json(await listSavedProjects());
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/projects", async (req, res) => {
  try {
    const label = typeof req.body?.label === "string" ? req.body.label : "Untitled project";
    res.json(await createProject(label));
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/projects/rename", async (req, res) => {
  try {
    const id = asString(req.body?.id, "project id", 40);
    const label = asString(req.body?.label, "project label", 80);
    res.json(toMutation(await renameProject(id, label), PROJECT_LABEL_FIELDS));
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/projects/draft", async (req, res) => {
  try {
    const id = activeProjectId();
    const revision = Number(req.body?.revision);
    if (!Number.isInteger(revision) || revision < 0) throw new Error("revision is required");
    const allowed = ["spritePrompt", "spriteModel", "spritePaletteLock", "motionPrompt", "motionModel", "paletteLock", "hardAlphaEdges", "spriteAcquisitionMode", "draftFrameSize", "draftSubjectFillPct", "draftColorCount", "color_palette", "animationDraftName", "animationDraftFps"] as const;
    const patch = Object.fromEntries(allowed.filter((key) => key in (req.body?.patch ?? {})).map((key) => [key, req.body.patch[key]]));
    const base = req.body?.base && typeof req.body.base === "object" ? req.body.base : {};
    const view = await patchProjectDraft(id, revision, patch, base);
    res.json(toMutation(view, []));
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/projects/delete", async (req, res) => {
  try {
    const id = asString(req.body?.id, "project id", 40);
    await deleteSavedProject(id);
    res.json({ ok: true });
  } catch (err) {
    handleError(err, res);
  }
});

function animationInput(body: Record<string, unknown>) {
  return {
    name: typeof body.name === "string" ? body.name : "",
    frameIndices: Array.isArray(body.frameIndices) ? body.frameIndices as number[] : [],
    fps: Number(body.fps),
    dataUrl: typeof body.dataUrl === "string" ? body.dataUrl : "",
  };
}

app.post("/api/projects/animations", async (req, res) => {
  try {
    res.json(toMutation(await createAnimation(animationInput(req.body ?? {})), ANIMATION_FIELDS));
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/projects/animations/update", async (req, res) => {
  try {
    const id = asString(req.body?.id, "animation id", 80);
    res.json(toMutation(await updateAnimation(id, animationInput(req.body ?? {})), ANIMATION_FIELDS));
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/projects/animations/delete", async (req, res) => {
  try {
    const id = asString(req.body?.id, "animation id", 80);
    res.json(toMutation(await deleteAnimation(id), ANIMATION_FIELDS));
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/sprites/style-guides", imageUpload.single("image"), async (req, res) => {
  try {
    if (!req.file) throw new Error("image file is required");
    res.json(toMutation(
      await addStyleGuideImage(req.file.buffer, req.file.originalname),
      STYLE_GUIDE_FIELDS,
    ));
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/sprites/style-guides/remove", async (req, res) => {
  try {
    const id = asString(req.body?.id, "id", 64);
    res.json(toMutation(await removeStyleGuideImage(id), STYLE_GUIDE_FIELDS));
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/sprites/generate", requireKey, async (req, res) => {
  try {
    const prompt = asString(req.body?.prompt, "prompt");
    const requestedModel = req.body?.model;
    if (requestedModel !== undefined && !isImageModelId(requestedModel)) {
      throw new Error("unsupported image model");
    }
    const model = requestedModel ?? DEFAULT_IMAGE_MODEL;
    const setting = req.body?.color_palette ?? legacyColorPaletteSetting(req.body?.spritePaletteLock === true, req.body?.colorCount ?? null);
    if (!isColorPaletteSetting(setting)) throw new Error("Invalid Color Palette setting.");
    const spritePaletteLock = setting === "style-guides";
    const geometry = parseTargetGeometry({
      frameSize: req.body?.frameSize,
      subjectFillPct: req.body?.subjectFillPct,
      colorCount: null,
    });
    const projectBeforeGeneration = await readManifest(activeProjectId());
    const styleGuideDataUrls = await readSelectedStyleGuideDataUrls(projectBeforeGeneration);
    const colors = await resolveReferenceColors(setting, styleGuideDataUrls.map(dataUrlToBuffer));
    let generatedBase64: string;
    try {
      generatedBase64 = await generateSpriteImage(prompt, model, {
        geometry: {
          size: geometry.targetFrameSize,
          subjectFillPct: geometry.subjectFillPct,
        },
        styleGuideDataUrls,
        subjectColors: colors.applied?.colors,
        subjectColorCount: colors.count,
      });
    } catch (error) {
      if (projectBeforeGeneration.styleGuideSelection.length === 0) throw error;
      const filenames = projectBeforeGeneration.styleGuideSelection.flatMap((id) => {
        const guide = projectBeforeGeneration.styleGuideImages.find(
          (candidate) => candidate.id === id,
        );
        return guide ? [`'${guide.originalFilename}'`] : [];
      });
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Generation with Style Guide Images ${filenames.join(", ")} failed: ${message}`,
      );
    }
    const normalized = await normalizeReferenceImage(Buffer.from(generatedBase64, "base64"));
    const applied = await applyTargetGeometry(normalized.buffer, geometry);
    applied.buffer = await applyReferenceColors(applied.buffer, colors);
    applied.backgroundSuitability = await assessBackground(applied.buffer);
    const base64 = applied.buffer.toString("base64");

    // A replacement sprite invalidates its video and every downstream artifact.
    await wipeLatestMotionArtifacts();
    await wipeLatestAnimations();
    await removeTransparentReferencePreview();

    const refAbs = path.join(activeProjectDir(), PROJECT_FILES.ref);
    await saveBase64Image(base64, refAbs);
    const buf = await readFile(refAbs);
    const dims = readPngDims(buf);

    let m = await updateLatest({
      spritePrompt: prompt,
      spriteModel: model,
      appliedStyleGuideSet: [...projectBeforeGeneration.styleGuideSelection],
      spritePaletteLock,
      appliedColorPalette: colors.applied,
      spriteAcquisition: "generated",
      spriteOriginalFilename: null,
      backgroundSuitability: applied.backgroundSuitability,
      sprite: PROJECT_FILES.ref,
      spriteDimensions: dims ?? applied.dimensions,
      targetFrameSize: geometry.targetFrameSize,
      subjectFillPct: geometry.subjectFillPct,
      colorCount: colors.count,
      subjectFillMeasured: applied.subjectFillMeasured,
      sourceVideo: null,
      motionPrompt: "",
      motionModel: DEFAULT_VIDEO_MODEL,
      frames: [],
      animations: [],
      preservedOffPalettePixels: null,
      removedLowAlphaPixels: null,
      removedChromaFringePixels: null,
    });
    m = await pruneUnreferencedStyleGuides(m);
    if (applied.backgroundSuitability === "suitable") {
      await regenerateTransparentReferencePreview().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.warn("[reference-preview] failed to generate:", message);
      });
    }

    res.json({
      mutation: toMutation(toView(m), REFERENCE_FIELDS),
      dataUrl: `data:image/png;base64,${base64}`,
    });
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/sprites/upload/prepare", imageUpload.single("image"), async (req, res) => {
  try {
    if (!req.file) throw new Error("image file is required");
    const geometry = parseTargetGeometry({
      frameSize: req.body?.frameSize === undefined ? undefined : Number(req.body.frameSize),
      subjectFillPct:
        req.body?.subjectFillPct === undefined ? undefined : Number(req.body.subjectFillPct),
      colorCount:
        req.body?.colorCount === undefined || req.body.colorCount === ""
          ? null
          : Number(req.body.colorCount),
    });
    res.json(
      await prepareReferenceUpload(req.file.buffer, req.file.originalname, geometry),
    );
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/sprites/upload/commit", async (req, res) => {
  try {
    const uploadId = asString(req.body?.uploadId, "uploadId", 64);
    res.json(toMutation(await commitReferenceUpload(uploadId), REFERENCE_FIELDS));
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/sprites/upload/discard", async (_req, res) => {
  try {
    await discardPreparedUpload();
    res.json({ ok: true });
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/sprites/transparent-preview", async (_req, res) => {
  try {
    await regenerateTransparentReferencePreview();
    const manifest = await readManifest(activeProjectId());
    res.json(toMutation(toView(manifest), ["transparentReferencePreviewUrl"]));
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/sprites/video", requireKey, async (req, res) => {
  try {
    const text = asString(req.body?.text, "text");
    const model = isVideoModelId(req.body?.model) ? req.body.model : DEFAULT_VIDEO_MODEL;
    const duration =
      typeof req.body?.duration === "number" ? req.body.duration : defaultDurationFor(model);

    const current = await readManifest(activeProjectId());
    if (!current.sprite || !current.targetFrameSize) {
      throw new Error("current Reference Sprite is missing applied target geometry");
    }
    if (
      current.targetFrameSize.w !== current.targetFrameSize.h ||
      !(TARGET_FRAME_SIZES as readonly number[]).includes(current.targetFrameSize.w)
    ) {
      throw new Error("current Reference Sprite has invalid applied target geometry");
    }
    const spriteAbs = path.join(activeProjectDir(), current.sprite);
    ensureInsideRoot(spriteAbs);
    if (!existsSync(spriteAbs)) throw new Error("Reference Sprite not found on disk");
    const spriteBuffer = await readFile(spriteAbs);
    const imageInput = await normalizeVideoInput(spriteBuffer, model);

    const video = await generateSpriteMotionVideo(
      imageInput.dataUrl,
      text,
      duration,
      model,
      false,
    );
    const videoAbs = path.join(activeProjectDir(), PROJECT_FILES.source);
    await mkdir(activeProjectDir(), { recursive: true });
    const tempDir = await mkdtemp(path.join(activeProjectDir(), ".tmp-video-"));
    const tempVideo = path.join(tempDir, PROJECT_FILES.source);
    try {
      await downloadVideo(video.url, tempVideo, video.headers);
      await rename(tempVideo, videoAbs);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }

    await wipeLatestFramesAndSheet();

    const m = await updateLatest({
      motionPrompt: text,
      motionModel: model,
      sourceVideo: PROJECT_FILES.source,
      frames: [],
      preservedOffPalettePixels: null,
      removedLowAlphaPixels: null,
      removedChromaFringePixels: null,
    });

    res.json(toMutation(toView(m), VIDEO_FIELDS));
  } catch (err) {
    handleError(err, res);
  }
});

app.post("/api/sprites/frames", async (req, res) => {
  try {
    const paletteLock = req.body?.paletteLock === true;
    const hardAlphaEdges = req.body?.hardAlphaEdges === true;
    const current = await readManifest(activeProjectId());
    if (!current.sprite || !current.targetFrameSize) {
      throw new Error("current Reference Sprite is missing applied target geometry");
    }
    if (
      current.targetFrameSize.w !== current.targetFrameSize.h ||
      !(TARGET_FRAME_SIZES as readonly number[]).includes(current.targetFrameSize.w)
    ) {
      throw new Error("current Reference Sprite has invalid applied target geometry");
    }

    if (!current.sourceVideo) throw new Error("generate a video before generating frames");
    const videoAbs = path.join(activeProjectDir(), current.sourceVideo);
    const spriteAbs = path.join(activeProjectDir(), current.sprite);
    ensureInsideRoot(videoAbs);
    ensureInsideRoot(spriteAbs);
    if (!existsSync(videoAbs)) throw new Error("generated source video not found on disk");
    if (!existsSync(spriteAbs)) throw new Error("Reference Sprite not found on disk");

    const spriteBuffer = await readFile(spriteAbs);
    const framesAbs = path.join(activeProjectDir(), PROJECT_FILES.framesDir);
    const tempRoot = await mkdtemp(path.join(activeProjectDir(), ".tmp-frames-"));
    const pendingFrames = path.join(tempRoot, "pending");
    const previousFrames = path.join(tempRoot, "previous");
    let extraction;
    try {
      extraction = await extractFrames(videoAbs, pendingFrames, current.targetFrameSize.w, {
        referenceSprite: paletteLock ? spriteBuffer : undefined,
        hardAlphaEdges,
      });
      const hadPreviousFrames = existsSync(framesAbs);
      if (hadPreviousFrames) await rename(framesAbs, previousFrames);
      try {
        await rename(pendingFrames, framesAbs);
      } catch (error) {
        if (hadPreviousFrames && existsSync(previousFrames)) {
          await rename(previousFrames, framesAbs);
        }
        throw error;
      }
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
    await wipeLatestSpritesheet();
    const frames = extraction.files.map((file) => `${PROJECT_FILES.framesDir}/${file}`);
    const manifest = await updateLatest({
      frames,
      framesUpdatedAt: new Date().toISOString(),
      paletteLock,
      hardAlphaEdges,
      preservedOffPalettePixels: extraction.preservedOffPalettePixels,
      removedLowAlphaPixels: extraction.removedLowAlphaPixels,
      removedChromaFringePixels: extraction.removedChromaFringePixels,
    });
    res.json(toMutation(toView(manifest), FRAME_FIELDS));
  } catch (err) {
    handleError(err, res);
  }
});

function handleError(err: unknown, res: Response) {
  const message =
    err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
      ? "image is too large (maximum 10 MB)"
      : err instanceof Error
        ? err.message
        : "Unknown error";
  const safe = redact(message);
  console.error("[api error]", safe);
  const maxClientErrorLength = 8_000;
  const clientMessage = safe.length > maxClientErrorLength
    ? `${safe.slice(0, maxClientErrorLength)}… [truncated]`
    : safe;
  const status = err && typeof err === "object" && "statusCode" in err
    ? Number((err as { statusCode: unknown }).statusCode)
    : 400;
  res.status(Number.isInteger(status) ? status : 400).json({ error: clientMessage });
}

function redact(msg: string): string {
  return msg
    .replace(/sk-or-[A-Za-z0-9_-]+/g, "***")
    .replace(/xai-[A-Za-z0-9_-]+/g, "***");
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  handleError(err, res);
});

app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`);
  if (!HAS_KEY) {
    console.warn("[server] WARNING: OPENROUTER_API_KEY is missing — endpoints will return 500");
  }
});
