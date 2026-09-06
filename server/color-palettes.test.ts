import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { ColorPaletteLibrary } from "./color-palettes.js";
import { applyReferenceColors, resolveReferenceColors } from "./reference-colors.js";
import { emptyManifest, reconcileColorPalette, toView } from "./projects.js";
import { applyTargetGeometry } from "./reference-sprite.js";
import { conflictsWithChroma, isColorPaletteSetting, legacyColorPaletteSetting, normalizeColors } from "../src/lib/color-palettes.js";

test("palette validation normalizes, deduplicates, and allows warned greens", () => {
  assert.deepEqual(normalizeColors(["#AbC", "aabbcc", "00b140"]), ["#aabbcc", "#00b140"]);
  assert.equal(conflictsWithChroma("#00b140"), true);
  for (const invalid of [[], ["#12345"], ["#12345678"], ["red"], [null]]) {
    assert.throws(() => normalizeColors(invalid));
  }
  assert.throws(() => normalizeColors(Array.from({ length: 257 }, (_, index) => index.toString(16).padStart(6, "0"))));
  assert.equal(isColorPaletteSetting("palette:../../secret"), false);
  assert.equal(isColorPaletteSetting("count:256"), false);
});

test("migration gives guide colors precedence, otherwise retains count or unrestricted", () => {
  assert.equal(legacyColorPaletteSetting(true, 8), "style-guides");
  assert.equal(legacyColorPaletteSetting(false, 8), "count:8");
  assert.equal(legacyColorPaletteSetting(false, null), "unrestricted");
});

test("library serializes edits and preserves request snapshots across edit and deletion", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "palette-library-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const library = new ColorPaletteLibrary(path.join(directory, "palettes.json"));
  const [forest, night] = await Promise.all([
    library.save({ name: "Forest", colors: ["#123", "#456"] }),
    library.save({ name: "Night", colors: ["#000"] }),
  ]);
  assert.equal((await library.list()).length, 2);
  const frozen = await resolveReferenceColors(`palette:${forest.id}`, [], library);
  const updated = await library.save({ ...forest, colors: ["#fff"] });
  await assert.rejects(library.save({ ...forest, name: "Stale edit" }), /changed in another tab/);
  await library.delete(updated.id, updated.revision);
  assert.deepEqual(frozen.colors, ["#112233", "#445566"]);
  assert.deepEqual(frozen.applied?.colors, frozen.colors);
  assert.deepEqual((await new ColorPaletteLibrary(path.join(directory, "palettes.json")).list()).map(({ id }) => id), [night.id]);
  await assert.rejects(resolveReferenceColors(`palette:${forest.id}`, [], library), /deleted/);

  const manifest = emptyManifest();
  manifest.color_palette = `palette:${forest.id}`;
  manifest.appliedColorPalette = frozen.applied;
  manifest.sprite = "ref/sprite.png";
  manifest.sourceVideo = "source.mp4";
  manifest.frames = ["frames/1.png"];
  const reconciled = await reconcileColorPalette(manifest, library);
  assert.equal(reconciled.color_palette, "unrestricted");
  assert.match(reconciled.colorPaletteNotice, /unavailable/);
  assert.deepEqual(reconciled.appliedColorPalette, frozen.applied);
  assert.equal(toView(reconciled).spriteUrl, `/projects/${manifest.id}/ref/sprite.png`);
  assert.equal(reconciled.sourceVideo, "source.mp4");
  assert.deepEqual(reconciled.frames, manifest.frames);
});

async function pixels(image: Buffer): Promise<string[]> {
  const { data } = await sharp(image).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return Array.from({ length: data.length / 3 }, (_, index) => `#${data.subarray(index * 3, index * 3 + 3).toString("hex")}`);
}

test("exact enforcement runs after geometry and keeps chroma and allowed green intact", async () => {
  const image = await sharp(Buffer.from([0, 177, 64, 220, 30, 20, 30, 30, 230]), { raw: { width: 3, height: 1, channels: 3 } }).png().toBuffer();
  const geometry = await applyTargetGeometry(image, { targetFrameSize: { w: 32, h: 32 }, subjectFillPct: 70, colorCount: null });
  const output = await applyReferenceColors(geometry.buffer, {
    setting: "unrestricted", colors: ["#00b140"], count: null, applied: null,
  });
  assert.deepEqual([...new Set(await pixels(output))], ["#00b140"]);
  assert.equal((await sharp(output).metadata()).width, 32);
  const exact = await applyReferenceColors(geometry.buffer, {
    setting: "unrestricted", colors: ["#ff0000", "#0000ff", "#ffffff"], count: null, applied: null,
  });
  assert.deepEqual(new Set(await pixels(exact)), new Set(["#00b140", "#ff0000", "#0000ff"]));
});

test("count quantization reserves all four entries for subject colors", async () => {
  const values = [0, 177, 64, 255, 0, 0, 0, 0, 255, 255, 255, 255, 0, 0, 0];
  const image = await sharp(Buffer.from(values), { raw: { width: 5, height: 1, channels: 3 } }).png().toBuffer();
  const output = await applyReferenceColors(image, { setting: "count:4", count: 4, applied: null });
  const palette = new Set(await pixels(output));
  assert.equal(palette.size, 5);
  assert.equal(palette.has("#00b140"), true);
});

test("Style Guide mode uses their union of subject colors and rejects missing sources", async () => {
  const guides = await Promise.all(["#ff0000", "#0000ff"].map((background) => sharp({ create: { width: 1, height: 1, channels: 3, background } }).png().toBuffer()));
  const selection = await resolveReferenceColors("style-guides", guides);
  assert.deepEqual(selection.colors, ["#ff0000", "#0000ff"]);
  assert.equal(selection.count, null);
  await assert.rejects(resolveReferenceColors("style-guides", []), /Select Style Guide Images/);
  const background = await sharp({ create: { width: 1, height: 1, channels: 3, background: "#00b140" } }).png().toBuffer();
  await assert.rejects(resolveReferenceColors("style-guides", [background]), /no usable subject colors/);
});
