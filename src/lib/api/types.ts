import type { ColorPaletteSetting, AppliedColorPalette } from "../color-palettes";
export interface ProjectView {
  id: string;
  label: string;
  createdAt: string;
  revision: number;
  spriteAcquisitionMode: "generate" | "upload";
  draftFrameSize: number;
  draftSubjectFillPct: number;
  draftColorCount: number | null;
  color_palette?: ColorPaletteSetting;
  colorPaletteNotice?: string;
  appliedColorPalette?: AppliedColorPalette | null;
  animationDraftName: string;
  animationDraftFps: number;
  spritePrompt: string;
  spriteModel: string;
  styleGuides: StyleGuideImageView[];
  styleGuidesChanged: boolean;
  spritePaletteLock: boolean;
  spriteAcquisition: "generated" | "uploaded" | null;
  spriteOriginalFilename: string | null;
  backgroundSuitability: "suitable" | "warning" | "unknown";
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

export interface AnimationView {
  id: string;
  name: string;
  frameIndices: number[];
  frameUrls: string[];
  fps: number;
  spritesheetUrl: string;
  previewGifUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StyleGuideImageView {
  id: string;
  originalFilename: string;
  url: string;
}

export interface VideoModelOption {
  id: string;
  label: string;
  defaultDuration: number;
  inputMode: "first-frame" | "reference";
  minInputWidth: number | null;
  minInputHeight: number | null;
  inputResizeKernel: "nearest";
  constraintNote: string | null;
}

export interface ImageModelOption {
  id: string;
  label: string;
  maxStyleGuideImages: number;
  sizeStrategy: "target-size" | "prompt-only";
}

export interface AcquisitionGeometry {
  frameSize: number;
  subjectFillPct: number;
  colorCount: number | null;
}

export interface ImageModelsResponse {
  models: readonly ImageModelOption[];
  default: string;
}

export interface VideoModelsResponse {
  models: readonly VideoModelOption[];
  default: string;
}

export interface ProjectSummary {
  id: string;
  label: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRequestContext {
  id: string;
  revision: number;
}

export interface ProjectMutation<T extends Partial<ProjectView> = Partial<ProjectView>> {
  revision: number;
  updatedAt: string;
  changes: T;
}
