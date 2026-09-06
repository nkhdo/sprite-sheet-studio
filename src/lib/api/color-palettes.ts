import { getJson, postJson } from "./transport";
import type { ColorPalette } from "../color-palettes";

export const listColorPalettes = () => getJson<ColorPalette[]>("/api/color-palettes");
export const saveColorPalette = (palette: { id?: string; revision?: number; name: string; colors: string[] }) =>
  postJson<ColorPalette>("/api/color-palettes/save", palette);
export const deleteColorPalette = (palette: ColorPalette) =>
  postJson<{ ok: boolean }>("/api/color-palettes/delete", { id: palette.id, revision: palette.revision });
export const colorPaletteUsage = (id: string) =>
  getJson<{ count: number }>(`/api/color-palettes/${encodeURIComponent(id)}/usage`);
