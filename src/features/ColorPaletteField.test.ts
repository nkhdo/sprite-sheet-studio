import { flushPromises, mount } from "@vue/test-utils";
import { reactive } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ColorPaletteField from "./ColorPaletteField.vue";
import { listColorPalettes } from "../lib/api/color-palettes";
import type { ProjectView } from "../lib/api";
import { paletteLibrary, refreshColorPalettes } from "../studio/color-palettes";
import { studioKey, type StudioContext } from "../studio/context";
import { createStudioState } from "../studio/state";

vi.mock("../lib/api/color-palettes", () => ({ listColorPalettes: vi.fn() }));
const palette = { id: "123e4567-e89b-42d3-a456-426614174000", name: "Forest", colors: ["#00b140"], revision: 1 };
function render() {
  const state = createStudioState();
  state.project = { id: "one", styleGuides: [], spriteUrl: "/existing.png", animations: [] } as unknown as ProjectView;
  state.draft.color_palette = `palette:${palette.id}`;
  const context = reactive({ state }) as unknown as StudioContext;
  const wrapper = mount(ColorPaletteField, { global: { provide: { [studioKey as symbol]: context } } });
  return { state, wrapper };
}
beforeEach(() => {
  Object.assign(paletteLibrary, { palettes: [], loaded: false, loading: false, error: "" });
  vi.mocked(listColorPalettes).mockResolvedValue([palette]);
});
describe("Reference Sprite Color Palette Setting", () => {
  it("waits for fresh library data, shows swatches and warns without rejecting greens", async () => {
    paletteLibrary.loaded = true;
    const { state, wrapper } = render();
    expect(state.draft.color_palette).toBe(`palette:${palette.id}`);
    await flushPromises();
    expect(wrapper.findAll(".palette-swatch")).toHaveLength(1);
    expect(wrapper.text()).toContain("may disappear during background removal");
    expect(state.draft.color_palette).toBe(`palette:${palette.id}`);
    expect(wrapper.get('option[value="style-guides"]').attributes("disabled")).toBeDefined();
    wrapper.unmount();
  });
  it("falls back after library deletion while preserving upload controls and the Reference Sprite", async () => {
    const { state, wrapper } = render();
    await flushPromises();
    vi.mocked(listColorPalettes).mockResolvedValue([]);
    await refreshColorPalettes();
    await flushPromises();
    expect(state.draft.color_palette).toBe("unrestricted");
    expect(state.draft.colorCount).toBe(16);
    expect(state.project?.spriteUrl).toBe("/existing.png");
    expect(wrapper.text()).toContain("switched to Unrestricted");
    wrapper.unmount();
  });
  it("preserves selection after a failed library refresh and offers retry", async () => {
    vi.mocked(listColorPalettes).mockRejectedValueOnce(new Error("Library unavailable"));
    const { state, wrapper } = render();
    await flushPromises();
    expect(state.draft.color_palette).toBe(`palette:${palette.id}`);
    expect(wrapper.text()).toContain("Retry loading palettes");
    await wrapper.get("button").trigger("click");
    await flushPromises();
    expect(wrapper.text()).not.toContain("Library unavailable");
    wrapper.unmount();
  });
});
