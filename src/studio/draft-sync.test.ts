import { describe, expect, it, vi } from "vitest";
import { DraftSynchronizer } from "./draft-sync";
import type { ProjectDraft } from "./state";

const draft: ProjectDraft = {
  spritePrompt: "", spriteModel: "image", spritePaletteLock: false,
  spriteAcquisitionMode: "generate", frameSize: 128, subjectFillPct: 70,
  colorCount: 16,
  color_palette: "count:16", motionPrompt: "", motionModel: "video",
  paletteLock: false, hardAlphaEdges: false, animationName: "", animationFps: 12,
};

function fakeClock() {
  let callback: (() => void) | null = null;
  return {
    clock: {
      setTimeout(fn: () => void) { callback = fn; return 1; },
      clearTimeout() { callback = null; },
    },
    run() { const fn = callback; callback = null; fn?.(); },
  };
}

describe("DraftSynchronizer", () => {
  it("sends only changed fields with explicit Project identity", async () => {
    const timer = fakeClock();
    const save = vi.fn().mockResolvedValue({ revision: 2 });
    const sync = new DraftSynchronizer(timer.clock, save, 700, () => undefined);
    sync.attach("project-one", 1, draft);
    sync.update({ ...draft, motionPrompt: "walk" });
    await sync.flush();
    expect(save).toHaveBeenCalledWith(
      "project-one", 1, { motionPrompt: "walk" }, draft,
    );
  });

  it("flushes immediately before Project navigation", async () => {
    const timer = fakeClock();
    const save = vi.fn().mockResolvedValue({ revision: 2 });
    const sync = new DraftSynchronizer(timer.clock, save, 700, () => undefined);
    sync.attach("project-one", 1, draft);
    sync.update({ ...draft, spritePrompt: "knight" });
    await sync.flush();
    expect(save).toHaveBeenCalledOnce();
  });

  it("surfaces failure and permits retry", async () => {
    const statuses: string[] = [];
    const save = vi.fn()
      .mockRejectedValueOnce(new Error("conflict"))
      .mockResolvedValueOnce({ revision: 2 });
    const timer = fakeClock();
    const sync = new DraftSynchronizer(timer.clock, save, 700, (value) => statuses.push(value));
    sync.attach("project-one", 1, draft);
    sync.update({ ...draft, animationName: "walk" });
    await expect(sync.flush()).rejects.toThrow("conflict");
    await sync.flush();
    expect(statuses).toContain("error");
    expect(save).toHaveBeenCalledTimes(2);
  });

  it("accepts revisions advanced by immediate Project writes", async () => {
    const timer = fakeClock();
    const save = vi.fn().mockResolvedValue({ revision: 5 });
    const sync = new DraftSynchronizer(timer.clock, save, 700, () => undefined);
    sync.attach("project-one", 1, draft);
    sync.advanceRevision("project-one", 4);
    sync.update({ ...draft, motionPrompt: "run" });
    await sync.flush();
    expect(save).toHaveBeenCalledWith("project-one", 4, expect.anything(), draft);
  });
});
