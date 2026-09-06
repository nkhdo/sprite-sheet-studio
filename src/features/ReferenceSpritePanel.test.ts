import { mount } from "@vue/test-utils";
import { reactive } from "vue";
import { describe, expect, it, vi } from "vitest";
import { studioKey, type StudioContext } from "../studio/context";
import { createStudioState, reconcileProject } from "../studio/state";
import type { ProjectView } from "../lib/api";
import ReferenceSpritePanel from "./ReferenceSpritePanel.vue";

function project(): ProjectView {
  return {
    id: "project-one", label: "Knight", createdAt: "", revision: 1,
    spriteAcquisitionMode: "generate", draftFrameSize: 128,
    draftSubjectFillPct: 70, draftColorCount: 16, animationDraftName: "",
    animationDraftFps: 12, spritePrompt: "", spriteModel: "image",
    styleGuides: [], styleGuidesChanged: false, spritePaletteLock: false,
    spriteAcquisition: null, spriteOriginalFilename: null,
    backgroundSuitability: "unknown", motionPrompt: "", motionModel: "video",
    paletteLock: false, hardAlphaEdges: false, preservedOffPalettePixels: null,
    removedLowAlphaPixels: null, removedChromaFringePixels: null,
    spriteUrl: null, transparentReferencePreviewUrl: null,
    spriteDimensions: null, targetFrameSize: null,
    subjectFillPct: null, colorCount: null, subjectFillMeasured: null,
    frames: [], framesUpdatedAt: "", sourceVideoUrl: null,
    animations: [], updatedAt: "",
  };
}

describe("ReferenceSpritePanel", () => {
  it("defaults to the transparent derivative and can reveal the chroma source", async () => {
    const state = createStudioState();
    const view = project();
    view.spriteUrl = "/source.png";
    view.transparentReferencePreviewUrl = "/transparent.png";
    view.spriteDimensions = { w: 128, h: 128 };
    view.backgroundSuitability = "suitable";
    reconcileProject(state, view);
    const context = reactive({
      state,
      imageModels: [], videoModels: [], projects: [], activePanel: "reference", hasApiKey: true,
      actions: { setPanel: vi.fn(), regenerateTransparentReferencePreview: vi.fn() },
    }) as unknown as StudioContext;
    const wrapper = mount(ReferenceSpritePanel, {
      global: { provide: { [studioKey as symbol]: context } },
    });

    expect(wrapper.get(".preview__box img").attributes("src")).toBe("/transparent.png");
    await wrapper.get(".preview__switch button:last-child").trigger("click");
    expect(wrapper.get(".preview__box img").attributes("src")).toBe("/source.png");
  });

  it("binds prompt edits to the domain draft and submits through its action", async () => {
    const state = createStudioState();
    reconcileProject(state, project());
    const generateReference = vi.fn();
    const context = reactive({
      state,
      imageModels: [{ id: "image", label: "Image", maxStyleGuideImages: 3, sizeStrategy: "target-size" }],
      videoModels: [],
      projects: [],
      activePanel: "reference",
      hasApiKey: true,
      actions: {
        generateReference,
        setPanel: vi.fn(),
        uploadReference: vi.fn(),
        addStyleGuides: vi.fn(),
        removeStyleGuide: vi.fn(),
        regenerateTransparentReferencePreview: vi.fn(),
      },
    }) as unknown as StudioContext;
    const wrapper = mount(ReferenceSpritePanel, {
      global: { provide: { [studioKey as symbol]: context } },
    });
    await wrapper.get("#sprite-prompt").setValue("pixel knight");
    expect(state.draft.spritePrompt).toBe("pixel knight");
    await wrapper.get("button.btn--primary").trigger("click");
    expect(generateReference).toHaveBeenCalledOnce();
  });

  it("renders Style Guide Images beside a compact add button", () => {
    const state = createStudioState();
    const view = project();
    view.styleGuides = [{ id: "guide", originalFilename: "guide.png", url: "/guide.png" }];
    reconcileProject(state, view);
    const context = reactive({
      state,
      imageModels: [{ id: "image", label: "Image", maxStyleGuideImages: 3, sizeStrategy: "target-size" }],
      videoModels: [], projects: [], activePanel: "reference", hasApiKey: true,
      actions: { setPanel: vi.fn(), addStyleGuides: vi.fn(), removeStyleGuide: vi.fn(), regenerateTransparentReferencePreview: vi.fn() },
    }) as unknown as StudioContext;
    const wrapper = mount(ReferenceSpritePanel, {
      global: { provide: { [studioKey as symbol]: context } },
    });
    expect(wrapper.find(".style-guide-dropzone").exists()).toBe(false);
    expect(wrapper.findAll(".style-guide-thumb")).toHaveLength(1);
    expect(wrapper.get(".style-guide-add input[type='file']").attributes("multiple")).toBeDefined();
  });

  it("orders generated Reference Sprite controls by workflow", () => {
    const state = createStudioState();
    reconcileProject(state, project());
    const context = reactive({
      state,
      imageModels: [{ id: "image", label: "Image", maxStyleGuideImages: 3, sizeStrategy: "target-size" }],
      videoModels: [], projects: [], activePanel: "reference", hasApiKey: true,
      actions: { setPanel: vi.fn(), addStyleGuides: vi.fn(), removeStyleGuide: vi.fn(), regenerateTransparentReferencePreview: vi.fn() },
    }) as unknown as StudioContext;
    const wrapper = mount(ReferenceSpritePanel, {
      global: { provide: { [studioKey as symbol]: context } },
    });
    expect(wrapper.findAll("[data-form-row]").map((row) => row.attributes("data-form-row"))).toEqual([
      "prompt", "model", "geometry", "style-guides", "color-palette", "generate",
    ]);
  });
});
