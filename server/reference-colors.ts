import sharp from "sharp";
import { conflictsWithChroma, rgb, type ColorPaletteSetting, type AppliedColorPalette } from "../src/lib/color-palettes.js";
import { colorPaletteLibrary } from "./color-palettes.js";
import { extractPalette, remapToPalette } from "./palette-lock.js";

export interface ReferenceColors {
  setting: ColorPaletteSetting;
  colors?: string[];
  count: number | null;
  applied: AppliedColorPalette | null;
}

export async function resolveReferenceColors(setting: ColorPaletteSetting, guides: Buffer[], library = colorPaletteLibrary): Promise<ReferenceColors> {
  if (setting.startsWith("palette:")) {
    const palette = (await library.list()).find(({ id }) => id === setting.slice(8));
    if (!palette) throw new Error("Selected Color Palette was deleted. Select another palette or Unrestricted.");
    const applied = { id: palette.id, name: palette.name, colors: [...palette.colors] };
    return { setting, colors: [...palette.colors], count: null, applied };
  }
  if (setting === "style-guides") {
    if (!guides.length) throw new Error("Select Style Guide Images to use their colors.");
    const colors = new Set<string>();
    for (const guide of guides) {
      for (const channels of await extractPalette(guide)) {
        const hex = `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
        if (!conflictsWithChroma(hex)) colors.add(hex);
      }
    }
    if (!colors.size) throw new Error("Style Guide Images have no usable subject colors.");
    return { setting, colors: [...colors], count: null, applied: null };
  }
  return { setting, count: setting.startsWith("count:") ? Number(setting.slice(6)) : null, applied: null };
}

// Geometry is applied first. Quantize a subject-only strip so the background
// neither consumes a palette entry nor gets shifted by the quantizer.
export async function applyReferenceColors(image: Buffer, selection: ReferenceColors): Promise<Buffer> {
  if (selection.colors) return remapToPalette(image, selection.colors.map(rgb), { preserveChroma: true });
  if (selection.count === null) return image;
  const { data } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixels: number[] = [];
  for (let index = 0; index < data.length; index += 4) {
    const hex = `#${data.subarray(index, index + 3).toString("hex")}`;
    if (data[index + 3] && !conflictsWithChroma(hex)) pixels.push(data[index], data[index + 1], data[index + 2]);
  }
  if (!pixels.length) return image;
  const quantized = await sharp(Buffer.from(pixels), { raw: { width: pixels.length / 3, height: 1, channels: 3 } })
    .png({ palette: true, colours: selection.count, dither: 0 }).toBuffer();
  const colors = await extractPalette(quantized);
  return remapToPalette(image, colors, { preserveChroma: true });
}
