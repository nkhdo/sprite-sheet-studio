import { createVfm } from "vue-final-modal";
import { DOMWrapper, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SettingsModal from "./SettingsModal.vue";
import { paletteLibrary } from "../studio/color-palettes";
import { colorPaletteUsage, deleteColorPalette, listColorPalettes, saveColorPalette } from "../lib/api/color-palettes";

vi.mock("../lib/api/color-palettes", () => ({
  listColorPalettes: vi.fn(), saveColorPalette: vi.fn(), deleteColorPalette: vi.fn(), colorPaletteUsage: vi.fn(),
}));
const forest = { id: "123e4567-e89b-42d3-a456-426614174000", name: "Forest", colors: ["#112233"], revision: 1 };
const wrappers: ReturnType<typeof mount>[] = [];
const closed = vi.fn();
function render() {
  const wrapper = mount(SettingsModal, { props: { onClose: closed }, attachTo: document.body, global: { plugins: [createVfm()], stubs: { transition: false } } });
  wrappers.push(wrapper);
  return new DOMWrapper(document.body);
}
function button(wrapper: DOMWrapper<Element>, text: string) {
  return wrapper.findAll("button").find((entry) => entry.text() === text)!;
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(paletteLibrary, { palettes: [], loaded: false, loading: false, error: "" });
  vi.mocked(listColorPalettes).mockResolvedValue([]);
  vi.mocked(saveColorPalette).mockResolvedValue(forest);
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{ width: 10, height: 10 }] as unknown as DOMRectList);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});
afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 60));
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.restoreAllMocks();
});

describe("Color Palettes settings", () => {
  it("keeps invalid pasted values visible and saves normalized colors only on Save", async () => {
    const wrapper = render();
    await flushPromises();
    await button(wrapper, "Create palette").trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 60));
    await wrapper.get('[aria-label="Palette name"]').setValue("Forest");
    await wrapper.get('[aria-label="Paste hex colors"]').setValue("#abc, invalid");
    await button(wrapper, "Add pasted colors").trigger("click");
    expect(wrapper.text()).toContain("Invalid hex color: invalid");
    expect((wrapper.get('[aria-label="Paste hex colors"]').element as HTMLTextAreaElement).value).toContain("invalid");
    expect(saveColorPalette).not.toHaveBeenCalled();
    await wrapper.get('[aria-label="Paste hex colors"]').setValue("#abc #aabbcc #00b140");
    await button(wrapper, "Add pasted colors").trigger("click");
    expect(wrapper.text()).toContain("may disappear during background removal");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(saveColorPalette).toHaveBeenCalledWith({ name: "Forest", colors: ["#000000", "#ffffff", "#aabbcc", "#00b140"] });
    expect(wrapper.text()).toContain("Palette saved.");
    await vi.waitFor(() => expect(wrapper.findAll('[role="dialog"]')).toHaveLength(1));
    expect(wrapper.find("form").exists()).toBe(false);
  });

  it("opens a separate editor and protects unsaved edits on Escape", async () => {
    const wrapper = render();
    await flushPromises();
    const create = button(wrapper, "Create palette");
    (create.element as HTMLButtonElement).focus();
    await create.trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 60));
    await flushPromises();
    expect(wrapper.findAll('[role="dialog"]')).toHaveLength(2);
    expect(wrapper.findAll('[role="dialog"]')[0].find("form").exists()).toBe(false);
    await wrapper.get('[aria-label="Palette name"]').setValue("Unsaved");
    vi.mocked(window.confirm).mockReturnValue(false);
    await wrapper.findAll('[role="dialog"]')[1].trigger("keydown", { key: "Escape" });
    expect(window.confirm).toHaveBeenCalledOnce();
    expect(closed).not.toHaveBeenCalled();
    expect(wrapper.find("form").exists()).toBe(true);
    vi.mocked(window.confirm).mockReturnValue(true);
    await wrapper.findAll('[role="dialog"]')[1].trigger("keydown", { key: "Escape" });
    expect(window.confirm).toHaveBeenCalledTimes(2);
    await new Promise((resolve) => setTimeout(resolve, 100));
    await vi.waitFor(() => expect(wrapper.findAll('[role="dialog"]')).toHaveLength(1));
    expect(closed).not.toHaveBeenCalled();
    expect(saveColorPalette).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(document.activeElement).toBe(create.element));
  });

  it("shows selecting Project count before deleting and supports cancel", async () => {
    vi.mocked(listColorPalettes).mockResolvedValue([forest]);
    vi.mocked(colorPaletteUsage).mockResolvedValue({ count: 2 });
    const wrapper = render();
    await flushPromises();
    vi.mocked(window.confirm).mockReturnValue(false);
    await wrapper.get('[aria-label="Delete Forest"]').trigger("click");
    await flushPromises();
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("2 Projects"));
    expect(deleteColorPalette).not.toHaveBeenCalled();
    vi.mocked(window.confirm).mockReturnValue(true);
    await wrapper.get('[aria-label="Delete Forest"]').trigger("click");
    await flushPromises();
    expect(deleteColorPalette).toHaveBeenCalledWith(forest);
  });

  it("duplicates in a separate modal without editing the original palette", async () => {
    vi.mocked(listColorPalettes).mockResolvedValue([forest]);
    const wrapper = render();
    await flushPromises();
    await wrapper.get('[aria-label="Duplicate Forest"]').trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(wrapper.findAll('[role="dialog"]')).toHaveLength(2);
    expect((wrapper.get('[aria-label="Palette name"]').element as HTMLInputElement).value).toBe("Forest copy");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(saveColorPalette).toHaveBeenCalledWith({ name: "Forest copy", colors: ["#112233"] });
    expect(paletteLibrary.palettes[0]).toEqual(forest);
    await vi.waitFor(() => expect(wrapper.findAll('[role="dialog"]')).toHaveLength(1));
  });

  it("retains the editor on save failure for retry and does not mutate the shared entry", async () => {
    vi.mocked(listColorPalettes).mockResolvedValue([forest]);
    vi.mocked(saveColorPalette).mockRejectedValueOnce(new Error("Could not save"));
    const wrapper = render();
    await flushPromises();
    await wrapper.get('[aria-label="Edit Forest"]').trigger("click");
    await new Promise((resolve) => setTimeout(resolve, 60));
    await wrapper.get('[aria-label="Hex color 1"]').setValue("#fff");
    expect(paletteLibrary.palettes[0].colors).toEqual(["#112233"]);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.text()).toContain("Could not save");
    expect(wrapper.find("form").exists()).toBe(true);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(saveColorPalette).toHaveBeenLastCalledWith({ id: forest.id, revision: 1, name: "Forest", colors: ["#ffffff"] });
  });
});
