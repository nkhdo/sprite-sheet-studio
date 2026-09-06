import { describe, expect, it, vi } from "vitest";
import type { ProjectMutation, ProjectView } from "../../lib/api";
import { createStudioState } from "../state";
import { createAnimationActions } from "./animation";
import { createMovementActions } from "./movement";
import { createProjectActions } from "./projects";
import { createReferenceActions } from "./reference";
import type { WorkflowEnvironment } from "./types";

vi.mock("../../lib/spritesheet", () => ({
  composeSpritesheet: vi.fn().mockResolvedValue({ dataUrl: "data:image/png;base64,AA==" }),
}));

function project(): ProjectView {
  return {
    id: "one", label: "One", createdAt: "", revision: 1,
    frames: ["one.png", "two.png"], framesUpdatedAt: "", animations: [],
    targetFrameSize: { w: 128, h: 128 }, updatedAt: "",
  } as unknown as ProjectView;
}

function environment(server: Record<string, unknown> = {}): WorkflowEnvironment {
  const state = createStudioState();
  state.project = project();
  const mutation: ProjectMutation = { revision: 2, updatedAt: "next", changes: {} };
  return {
    state,
    context: { state, projects: [], activePanel: "frames" } as unknown as WorkflowEnvironment["context"],
    dependencies: {
      server: server as unknown as WorkflowEnvironment["dependencies"]["server"],
      clock: { setTimeout: vi.fn(), clearTimeout: vi.fn() },
      confirmation: { confirm: vi.fn().mockResolvedValue(true), prompt: vi.fn() },
    },
    sync: { flush: vi.fn(), advanceRevision: vi.fn() } as unknown as WorkflowEnvironment["sync"],
    run: async (_name, _progress, task) => { await task(state.project!); },
    apply: vi.fn(), applyMutation: vi.fn(), notify: vi.fn(), refreshProjects: vi.fn(),
    openProject: vi.fn(), setPanel: vi.fn(),
    ...({ mutation } as object),
  };
}

describe("workflow modules", () => {
  it("passes the unified palette independently of upload color count", async () => {
    const generateSprite = vi.fn().mockResolvedValue({ mutation: { revision: 2, updatedAt: "", changes: {} }, dataUrl: "data:image/png;base64,AA==" });
    const env = environment({ generateSprite });
    env.state.draft.spritePrompt = "a hero";
    env.state.draft.color_palette = "count:8";
    env.state.draft.colorCount = 32;
    await createReferenceActions(env).generateReference();
    expect(generateSprite.mock.calls[0][5]).toBe("count:8");
    expect(env.state.draft.colorCount).toBe(32);
  });

  it("Reference Sprite Acquisition rejects an empty prompt locally", async () => {
    const env = environment();
    await createReferenceActions(env).generateReference();
    expect(env.state.operations.reference.message).toBe("Enter a sprite prompt first.");
  });

  it("keeps an unsaved Frame Sequence local", () => {
    const server = {};
    const env = environment(server);
    const actions = createMovementActions(env);
    actions.toggleFrame(1);
    actions.selectAll();
    actions.selectNone();
    expect(env.state.animationDraft.frameSequence).toEqual([]);
    expect(server).toEqual({});
  });

  it("submits the current Frame Sequence when updating an Animation", async () => {
    const updateAnimation = vi.fn().mockResolvedValue({ revision: 2, updatedAt: "", changes: { animations: [] } });
    const env = environment({ updateAnimation });
    env.state.animationDraft.activeAnimationId = "run";
    env.state.animationDraft.frameSequence = [1];
    env.state.draft.animationName = "run";
    await createAnimationActions(env).saveAnimation(true);
    expect(updateAnimation.mock.calls[0][2].frameIndices).toEqual([1]);
  });

  it("flushes drafts before switching Projects", async () => {
    const next = { ...project(), id: "two" };
    const getProject = vi.fn().mockResolvedValue(next);
    const env = environment({ getProject });
    await createProjectActions(env).switchProject("two");
    expect(env.sync.flush).toHaveBeenCalledBefore(env.openProject as ReturnType<typeof vi.fn>);
  });
});
