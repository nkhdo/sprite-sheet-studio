import type { ProjectView } from "../lib/api";
import type { ProjectDraft } from "./state";

export function toServerDraft(draft: Partial<ProjectDraft>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if ("spritePrompt" in draft) result.spritePrompt = draft.spritePrompt;
  if ("spriteModel" in draft) result.spriteModel = draft.spriteModel;
  if ("spritePaletteLock" in draft) result.spritePaletteLock = draft.spritePaletteLock;
  if ("spriteAcquisitionMode" in draft) {
    result.spriteAcquisitionMode = draft.spriteAcquisitionMode;
  }
  if ("frameSize" in draft) result.draftFrameSize = draft.frameSize;
  if ("subjectFillPct" in draft) result.draftSubjectFillPct = draft.subjectFillPct;
  if ("color_palette" in draft) result.color_palette = draft.color_palette;
  if ("colorCount" in draft) result.draftColorCount = draft.colorCount;
  if ("motionPrompt" in draft) result.motionPrompt = draft.motionPrompt;
  if ("motionModel" in draft) result.motionModel = draft.motionModel;
  if ("paletteLock" in draft) result.paletteLock = draft.paletteLock;
  if ("hardAlphaEdges" in draft) result.hardAlphaEdges = draft.hardAlphaEdges;
  if ("animationName" in draft) result.animationDraftName = draft.animationName;
  if ("animationFps" in draft) result.animationDraftFps = draft.animationFps;
  return result;
}

export function revisionResult(view: ProjectView): { revision: number } {
  return { revision: view.revision };
}
