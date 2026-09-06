import { reactive } from "vue";
import { listColorPalettes } from "../lib/api/color-palettes";
import type { ColorPalette } from "../lib/color-palettes";

export const paletteLibrary = reactive({
  palettes: [] as ColorPalette[], loaded: false, loading: false, error: "", settingsOpen: false,
});
let pending: Promise<void> | null = null;
export function refreshColorPalettes(): Promise<void> {
  if (pending) return pending;
  paletteLibrary.loading = true;
  pending = listColorPalettes().then((palettes) => {
    paletteLibrary.palettes = palettes;
    paletteLibrary.loaded = true;
    paletteLibrary.error = "";
  }).catch((error: unknown) => {
    paletteLibrary.error = error instanceof Error ? error.message : "Could not load Color Palettes.";
  }).finally(() => { paletteLibrary.loading = false; pending = null; });
  return pending;
}

export async function reloadColorPalettes(): Promise<void> {
  // Wait out an older read before requesting the post-mutation library.
  if (pending) await pending;
  await refreshColorPalettes();
}
