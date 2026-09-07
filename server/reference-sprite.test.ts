import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  applyTargetGeometry,
  assessBackground,
  createTransparentReferencePreview,
  normalizeReferenceImage,
  parseTargetGeometry,
} from "./reference-sprite.js";

test("transparent preview removes exterior and enclosed chroma while preserving the subject", async () => {
  const redRing = await sharp({
    create: { width: 3, height: 3, channels: 3, background: { r: 200, g: 30, b: 30 } },
  }).composite([{
    input: await sharp({
      create: { width: 1, height: 1, channels: 3, background: { r: 0, g: 177, b: 64 } },
    }).png().toBuffer(),
    left: 1,
    top: 1,
  }]).png().toBuffer();
  const source = await sharp({
    create: { width: 5, height: 5, channels: 3, background: { r: 0, g: 177, b: 64 } },
  }).composite([{ input: redRing, left: 1, top: 1 }]).png().toBuffer();
  const result = await createTransparentReferencePreview(source);
  const { data, info } = await sharp(result).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  assert.equal(info.width, 5);
  assert.equal(info.height, 5);
  assert.equal(data[3], 0);
  assert.equal(data[(2 * 5 + 2) * 4 + 3], 0);
  assert.deepEqual([...data.subarray((1 * 5 + 1) * 4, (1 * 5 + 1) * 4 + 4)], [200, 30, 30, 255]);
});

test("recognizes a uniform chroma-green border as suitable", async () => {
  const image = await sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 0, g: 177, b: 64 } },
  })
    .png()
    .toBuffer();

  assert.equal(await assessBackground(image), "suitable");
});

test("warns when the border is not chroma green", async () => {
  const image = await sharp({
    create: { width: 64, height: 64, channels: 3, background: { r: 30, g: 40, b: 80 } },
  })
    .png()
    .toBuffer();

  assert.equal(await assessBackground(image), "warning");
});

test("normalizes WebP transparency onto chroma green as an opaque PNG", async () => {
  const source = await sharp({
    create: { width: 48, height: 32, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .webp()
    .toBuffer();

  const normalized = await normalizeReferenceImage(source);
  const metadata = await sharp(normalized.buffer).metadata();
  const corner = await sharp(normalized.buffer).extract({ left: 0, top: 0, width: 1, height: 1 }).raw().toBuffer();

  assert.equal(metadata.format, "png");
  assert.equal(metadata.hasAlpha, false);
  assert.deepEqual(normalized.dimensions, { w: 48, h: 32 });
  assert.deepEqual([...corner], [0, 177, 64]);
  assert.equal(normalized.backgroundSuitability, "suitable");
});

test("rejects decoded images beyond the dimension limit", async () => {
  const source = await sharp({
    create: { width: 4097, height: 1, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();

  await assert.rejects(
    normalizeReferenceImage(source),
    /maximum 4096 px per side and 16 megapixels/,
  );
});

test("forces the exact target frame size with nearest-neighbor fit and green letterbox", async () => {
  const red = await sharp({
    create: { width: 32, height: 16, channels: 3, background: { r: 200, g: 30, b: 30 } },
  })
    .png()
    .toBuffer();
  const source = await sharp({
    create: { width: 64, height: 32, channels: 3, background: { r: 0, g: 177, b: 64 } },
  })
    .composite([{ input: red, top: 8, left: 16 }])
    .png()
    .toBuffer();

  const applied = await applyTargetGeometry(source, {
    targetFrameSize: { w: 128, h: 128 },
    subjectFillPct: 70,
    colorCount: null,
  });

  const metadata = await sharp(applied.buffer).metadata();
  const corner = await sharp(applied.buffer)
    .extract({ left: 0, top: 0, width: 1, height: 1 })
    .raw()
    .toBuffer();
  const center = await sharp(applied.buffer)
    .extract({ left: 64, top: 64, width: 1, height: 1 })
    .raw()
    .toBuffer();

  assert.deepEqual(applied.dimensions, { w: 128, h: 128 });
  assert.equal(metadata.width, 128);
  assert.equal(metadata.height, 128);
  // Letterbox strips stay chroma green; the subject lands centered, unstretched.
  assert.deepEqual([...corner], [0, 177, 64]);
  assert.equal(center[0], 200);
  assert.equal(applied.backgroundSuitability, "suitable");
  // Subject is 32 px of the 128 px frame height after the 2:1 → 1:1 contain fit.
  assert.equal(applied.subjectFillMeasured, 25);
});

test("quantizes to the requested color count", async () => {
  const source = await sharp({
    create: {
      width: 128,
      height: 128,
      channels: 3,
      background: { r: 40, g: 90, b: 200 },
    },
  })
    .composite([
      {
        input: await sharp({
          create: { width: 64, height: 64, channels: 3, background: { r: 220, g: 40, b: 90 } },
        })
          .png()
          .toBuffer(),
        top: 0,
        left: 0,
      },
      {
        input: await sharp({
          create: { width: 64, height: 64, channels: 3, background: { r: 250, g: 210, b: 60 } },
        })
          .png()
          .toBuffer(),
        top: 64,
        left: 64,
      },
      {
        input: await sharp({
          create: { width: 64, height: 64, channels: 3, background: { r: 20, g: 160, b: 120 } },
        })
          .png()
          .toBuffer(),
        top: 64,
        left: 0,
      },
    ])
    .png()
    .toBuffer();

  const applied = await applyTargetGeometry(source, {
    targetFrameSize: { w: 128, h: 128 },
    subjectFillPct: 70,
    colorCount: 4,
  });

  const { data, info } = await sharp(applied.buffer).removeAlpha().raw().toBuffer({
    resolveWithObject: true,
  });
  const colors = new Set<string>();
  for (let i = 0; i < data.length; i += info.channels) {
    colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
  }
  assert.ok(colors.size <= 4, `expected at most 4 colors, got ${colors.size}`);
});

test("rejects target geometry outside the preset allowlists", () => {
  assert.throws(
    () => parseTargetGeometry({ frameSize: 100, subjectFillPct: 70, colorCount: null }),
    /unsupported target frame size/,
  );
  assert.throws(
    () => parseTargetGeometry({ frameSize: 128, subjectFillPct: 60, colorCount: null }),
    /unsupported subject fill/,
  );
  assert.throws(
    () => parseTargetGeometry({ frameSize: 128, subjectFillPct: 70, colorCount: 5 }),
    /unsupported color count/,
  );
  assert.deepEqual(
    parseTargetGeometry({ frameSize: 128, subjectFillPct: 70, colorCount: null }),
    { targetFrameSize: { w: 128, h: 128 }, subjectFillPct: 70, colorCount: null },
  );
});
