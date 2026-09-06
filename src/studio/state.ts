import { legacyColorPaletteSetting, type ColorPaletteSetting } from "../lib/color-palettes";
import { computed, reactive, type ComputedRef } from "vue";
import type { AnimationView, ProjectView } from "../lib/api";

export type Operation =
  | "styleGuide"
  | "reference"
  | "video"
  | "frames"
  | "animation"
  | "project";
export type OperationPhase = "idle" | "running" | "success" | "error";

export interface OperationState {
  phase: OperationPhase;
  message: string;
  operationId: number;
  projectId: string | null;
}

export interface ProjectDraft {
  spritePrompt: string;
  spriteModel: string;
  spritePaletteLock: boolean;
  spriteAcquisitionMode: "generate" | "upload";
  frameSize: number;
  subjectFillPct: number;
  colorCount: number | null;
  color_palette: ColorPaletteSetting;
  motionPrompt: string;
  motionModel: string;
  paletteLock: boolean;
  hardAlphaEdges: boolean;
  animationName: string;
  animationFps: number;
}

export interface AnimationDraft {
  activeAnimationId: string | null;
  frameSequence: number[];
  frozenFrameUrls: string[] | null;
}

export interface StudioState {
  project: ProjectView | null;
  draft: ProjectDraft;
  animationDraft: AnimationDraft;
  operations: Record<Operation, OperationState>;
  save: { phase: "idle" | "saving" | "saved" | "error"; message: string };
}

const operationNames: Operation[] = [
  "styleGuide", "reference", "video", "frames", "animation", "project",
];

function idleOperation(): OperationState {
  return { phase: "idle", message: "", operationId: 0, projectId: null };
}

export function draftFromProject(project: ProjectView): ProjectDraft {
  return {
    spritePrompt: project.spritePrompt,
    spriteModel: project.spriteModel,
    spritePaletteLock: project.spritePaletteLock,
    spriteAcquisitionMode: project.spriteAcquisitionMode,
    frameSize: project.draftFrameSize,
    subjectFillPct: project.draftSubjectFillPct,
    colorCount: project.draftColorCount,
    color_palette: project.color_palette ?? legacyColorPaletteSetting(project.spritePaletteLock, project.draftColorCount),
    motionPrompt: project.motionPrompt,
    motionModel: project.motionModel,
    paletteLock: project.paletteLock,
    hardAlphaEdges: project.hardAlphaEdges,
    animationName: project.animationDraftName,
    animationFps: project.animationDraftFps,
  };
}

export function createStudioState(): StudioState {
  return reactive({
    project: null,
    draft: {
      spritePrompt: "",
      spriteModel: "openai/gpt-image-2",
      spritePaletteLock: false,
      spriteAcquisitionMode: "generate",
      frameSize: 128,
      subjectFillPct: 70,
      colorCount: 16,
      color_palette: "count:16",
      motionPrompt: "",
      motionModel: "x-ai/grok-imagine-video",
      paletteLock: false,
      hardAlphaEdges: false,
      animationName: "",
      animationFps: 12,
    },
    animationDraft: {
      activeAnimationId: null,
      frameSequence: [],
      frozenFrameUrls: null,
    },
    operations: Object.fromEntries(
      operationNames.map((name) => [name, idleOperation()]),
    ) as Record<Operation, OperationState>,
    save: { phase: "idle", message: "" },
  });
}

export function reconcileProject(
  state: StudioState,
  project: ProjectView,
  options: { preserveDraft?: boolean } = {},
): void {
  const changedProject = state.project?.id !== project.id;
  state.project = project;
  if (changedProject || !options.preserveDraft) state.draft = draftFromProject(project);
  if (
    state.animationDraft.activeAnimationId &&
    !project.animations.some(({ id }) => id === state.animationDraft.activeAnimationId)
  ) {
    newAnimationDraft(state);
  }
  if (!state.animationDraft.activeAnimationId && !options.preserveDraft) {
    state.animationDraft.frameSequence = [];
    state.animationDraft.frozenFrameUrls = null;
  }
}

export function beginOperation(
  state: StudioState,
  name: Operation,
  projectId: string,
  message: string,
): number {
  const operationId = state.operations[name].operationId + 1;
  state.operations[name] = { phase: "running", message, operationId, projectId };
  return operationId;
}

export function finishOperation(
  state: StudioState,
  name: Operation,
  operationId: number,
  projectId: string,
  phase: "success" | "error",
  message: string,
): boolean {
  const current = state.operations[name];
  if (
    current.operationId !== operationId ||
    current.projectId !== projectId ||
    state.project?.id !== projectId
  ) return false;
  state.operations[name] = { ...current, phase, message };
  return true;
}

export function editAnimation(state: StudioState, animation: AnimationView): void {
  state.animationDraft = {
    activeAnimationId: animation.id,
    frameSequence: [...animation.frameIndices],
    frozenFrameUrls: [...animation.frameUrls],
  };
  state.draft.animationName = animation.name;
  state.draft.animationFps = animation.fps;
}

export function newAnimationDraft(state: StudioState): void {
  state.animationDraft = {
    activeAnimationId: null,
    frameSequence: [],
    frozenFrameUrls: null,
  };
  state.draft.animationName = "";
}

export function toggleFrame(state: StudioState, index: number): void {
  state.animationDraft.frozenFrameUrls = null;
  const at = state.animationDraft.frameSequence.indexOf(index);
  if (at >= 0) state.animationDraft.frameSequence.splice(at, 1);
  else {
    state.animationDraft.frameSequence.push(index);
    state.animationDraft.frameSequence.sort((a, b) => a - b);
  }
}

export function useStudioProjections(state: StudioState): {
  busy: ComputedRef<boolean>;
  frameUrls: ComputedRef<string[]>;
} {
  return {
    busy: computed(() =>
      Object.values(state.operations).some(({ phase }) => phase === "running")),
    frameUrls: computed(() => {
      if (state.animationDraft.frozenFrameUrls) return state.animationDraft.frozenFrameUrls;
      return state.animationDraft.frameSequence.flatMap((index) =>
        state.project?.frames[index] ? [state.project.frames[index]] : []);
    }),
  };
}
