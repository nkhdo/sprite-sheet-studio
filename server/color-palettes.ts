import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PROJECTS_DIR } from "./files.js";
import { normalizeColors, type ColorPalette } from "../src/lib/color-palettes.js";

// A single atomic file avoids introducing non-Project directories into migration.
export class ColorPaletteLibrary {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private readonly filename: string) {}

  async list(): Promise<ColorPalette[]> {
    try {
      return JSON.parse(await readFile(this.filename, "utf8")) as ColorPalette[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private mutate<T>(work: (palettes: ColorPalette[]) => T): Promise<T> {
    const result = this.tail.then(async () => {
      const palettes = await this.list();
      const value = work(palettes);
      await mkdir(path.dirname(this.filename), { recursive: true });
      const temporary = `${this.filename}.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, JSON.stringify(palettes, null, 2));
        await rename(temporary, this.filename);
      } finally {
        await rm(temporary, { force: true });
      }
      return value;
    });
    this.tail = result.catch(() => undefined);
    return result;
  }

  save(input: { id?: unknown; name?: unknown; colors?: unknown; revision?: unknown }): Promise<ColorPalette> {
    if (typeof input.name !== "string" || !input.name.trim() || input.name.trim().length > 80) {
      throw new Error("Palette name must contain 1–80 characters.");
    }
    const name = input.name.trim();
    const colors = normalizeColors(input.colors);
    return this.mutate((palettes) => {
      const existing = input.id === undefined ? undefined : palettes.find(({ id }) => id === input.id);
      if (input.id !== undefined && !existing) throw new Error("Color Palette not found.");
      if (existing && input.revision !== existing.revision) {
        throw new Error("Palette changed in another tab. Cancel and reopen it before saving.");
      }
      const palette = { id: existing?.id ?? randomUUID(), name, colors, revision: (existing?.revision ?? 0) + 1 };
      if (existing) palettes.splice(palettes.indexOf(existing), 1, palette);
      else palettes.push(palette);
      return palette;
    });
  }

  delete(id: unknown, revision: unknown): Promise<void> {
    return this.mutate((palettes) => {
      const index = palettes.findIndex((palette) => palette.id === id);
      if (index < 0) throw new Error("Color Palette not found.");
      if (palettes[index].revision !== revision) throw new Error("Palette changed. Refresh before deleting.");
      palettes.splice(index, 1);
    });
  }
}

export const colorPaletteLibrary = new ColorPaletteLibrary(path.join(PROJECTS_DIR, "color-palettes.json"));
