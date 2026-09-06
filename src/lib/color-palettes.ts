export type ColorPaletteSetting = "unrestricted" | "style-guides" | `count:${4 | 8 | 16 | 32}` | `palette:${string}`;

export interface ColorPalette {
  id: string;
  name: string;
  colors: string[];
  revision: number;
}

export interface AppliedColorPalette {
  id: string;
  name: string;
  colors: string[];
}

export function isColorPaletteSetting(value: unknown): value is ColorPaletteSetting {
  return typeof value === "string" && (
    ["unrestricted", "style-guides", "count:4", "count:8", "count:16", "count:32"].includes(value) ||
    /^palette:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
  );
}

export function normalizeColors(input: unknown): string[] {
  if (!Array.isArray(input)) throw new Error("Colors must be a list of hex values.");
  const colors = input.map((value: unknown) => {
    if (typeof value !== "string" || !/^#?(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim())) {
      throw new Error(`Invalid hex color: ${String(value).slice(0, 80)}`);
    }
    const hex = value.trim().replace(/^#/, "").toLowerCase();
    return `#${hex.length === 3 ? [...hex].map((digit) => digit + digit).join("") : hex}`;
  });
  const unique = [...new Set(colors)];
  if (unique.length < 1 || unique.length > 256) throw new Error("Use 1–256 unique colors.");
  return unique;
}

export function rgb(color: string): [number, number, number] {
  return [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16)) as [number, number, number];
}

export function conflictsWithChroma(color: string): boolean {
  const [r, g, b] = rgb(color);
  return Math.abs(r) <= 24 && Math.abs(g - 177) <= 24 && Math.abs(b - 64) <= 24;
}

export const CHROMA_WARNING = "These greens may disappear during background removal, even if they look intact in the preview. Other nearby greens may also be affected.";

export function legacyColorPaletteSetting(lock: boolean, count: number | null): ColorPaletteSetting {
  return lock ? "style-guides" : [4, 8, 16, 32].includes(count ?? 0)
    ? `count:${count}` as ColorPaletteSetting : "unrestricted";
}
