import { beginOperation, finishOperation } from "../state";
import { errorMessage, mergeMutation, requestContext, type WorkflowEnvironment } from "./types";

const ACCEPTED_IMAGES = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function validateImages(files: File[], maximum: number): string | null {
  if (files.length > maximum) return `Choose ${maximum} or fewer images.`;
  for (const file of files) {
    if (file.size > MAX_FILE_SIZE) return `'${file.name}' exceeds 10 MB.`;
    if (file.type && !ACCEPTED_IMAGES.has(file.type)) {
      return `'${file.name}' must be PNG, JPEG, or WebP.`;
    }
  }
  return null;
}

export function createReferenceActions(env: WorkflowEnvironment) {
  const { state, dependencies, run } = env;
  return {
    async generateReference() {
      const prompt = state.draft.spritePrompt.trim();
      if (!prompt) {
        state.operations.reference = { ...state.operations.reference, phase: "error" as const, message: "Enter a sprite prompt first." };
        return;
      }
      if (state.project?.animations.length &&
        !await dependencies.confirmation.confirm("Replace the Reference Sprite? All saved Animations will be removed.")) return;
      await run("reference", "Generating Reference Sprite…", async (project) => {
        const result = await dependencies.server.generateSprite(requestContext(project), prompt,
          state.draft.spriteModel, {
            frameSize: state.draft.frameSize,
            subjectFillPct: state.draft.subjectFillPct,
            colorCount: state.draft.colorCount,
          }, false, state.draft.color_palette);
        return {
          ...result.mutation,
          changes: { ...result.mutation.changes, spriteUrl: result.dataUrl },
        };
      }, "Reference Sprite ready.");
    },

    async uploadReference(files: File[]) {
      const file = files[0];
      const invalid = validateImages(files.slice(0, 1), 1);
      if (!file || invalid) {
        state.operations.reference = { ...state.operations.reference, phase: "error" as const, message: invalid ?? "Choose an image." };
        return;
      }
      const project = state.project;
      if (!project) return;
      const id = beginOperation(state, "reference", project.id, "Preparing Reference Sprite…");
      try {
        const context = requestContext(project);
        const prepared = await dependencies.server.prepareSpriteUpload(context, file, {
          frameSize: state.draft.frameSize,
          subjectFillPct: state.draft.subjectFillPct,
          colorCount: state.draft.colorCount,
        });
        if (prepared.requiresConfirmation &&
          !await dependencies.confirmation.confirm("Replace the Reference Sprite and remove its Downstream Artifacts?")) {
          await dependencies.server.discardSpriteUpload(context);
          finishOperation(state, "reference", id, project.id, "success", "Upload cancelled.");
          return;
        }
        const mutation = await dependencies.server.commitSpriteUpload(context, prepared.uploadId);
        if (finishOperation(state, "reference", id, project.id, "success", "Reference Sprite uploaded.")) {
          env.applyMutation(project, mutation);
          env.notify("Reference Sprite uploaded", "success");
        }
      } catch (error) {
        finishOperation(state, "reference", id, project.id, "error", errorMessage(error, "Upload failed"));
      }
    },

    async regenerateTransparentReferencePreview() {
      await run(
        "reference",
        "Generating transparent preview…",
        (project) => dependencies.server.regenerateTransparentReferencePreview(requestContext(project)),
        "Transparent preview ready.",
        { preserveDraft: true },
      );
    },

    async addStyleGuides(files: File[]) {
      const available = Math.max(0, 3 - (state.project?.styleGuides.length ?? 0));
      const invalid = validateImages(files, available);
      if (invalid) {
        state.operations.styleGuide = { ...state.operations.styleGuide, phase: "error" as const, message: invalid };
        return;
      }
      await run("styleGuide", "Adding Style Guide Images…", async (project) => {
        let current = project;
        let latest = null;
        for (const file of files) {
          latest = await dependencies.server.uploadStyleGuide(requestContext(current), file);
          current = mergeMutation(current, latest);
        }
        return latest ?? { revision: project.revision, updatedAt: project.updatedAt, changes: {} };
      }, "Style Guide Images updated.", { preserveDraft: true });
    },

    async removeStyleGuide(id: string) {
      await run("styleGuide", "Removing Style Guide Image…",
        (project) => dependencies.server.removeStyleGuide(requestContext(project), id),
        "Style Guide Image removed.", { preserveDraft: true });
    },
  };
}
