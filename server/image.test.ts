import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { generateSpriteImage, IMAGE_MODELS } from "./image.js";

const PNG_SIGNATURE_BASE64 = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString(
  "base64",
);
const FRAME_SIZES = [32, 64, 128, 192, 256, 384, 512] as const;

test("named subject colors override guide colors in the OpenRouter prompt", async (t) => {
  const bodies = mockImageFetch(t);
  await generateSpriteImage("a hero", "openai/gpt-image-2", {
    subjectColors: ["#ff0000", "#00b140"],
    styleGuideDataUrls: ["data:image/png;base64,guide"],
  });
  assert.match(String(bodies[0].prompt), /only these exact hex colors for the subject: #ff0000, #00b140/);
  assert.match(String(bodies[0].prompt), /take priority over the Style Guide Images' colors/);
  assert.match(String(bodies[0].prompt), /listed green is explicitly allowed/);
});

function mockImageFetch(t: TestContext): Array<Record<string, unknown>> {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENROUTER_API_KEY;
  const bodies: Array<Record<string, unknown>> = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalApiKey;
  });
  process.env.OPENROUTER_API_KEY = "test-api-key";
  globalThis.fetch = (async (_input, init) => {
    bodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
    return new Response(
      JSON.stringify({ data: [{ b64_json: PNG_SIGNATURE_BASE64, media_type: "image/png" }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;
  return bodies;
}

test("declares an explicit size strategy for every image model", () => {
  assert.deepEqual(
    IMAGE_MODELS.map(({ id, sizeStrategy }) => ({ id, sizeStrategy })),
    [
      { id: "openai/gpt-image-2", sizeStrategy: "prompt-only" },
      { id: "x-ai/grok-imagine-image-2.0", sizeStrategy: "target-size" },
    ],
  );
});

test("target-size models send every supported final frame size directly", async (t) => {
  const bodies = mockImageFetch(t);
  for (const size of FRAME_SIZES) {
    await generateSpriteImage("a readable hero", "x-ai/grok-imagine-image-2.0", {
      geometry: { size: { w: size, h: size }, subjectFillPct: 70 },
    });
  }
  assert.deepEqual(
    bodies.map((body) => body.size),
    FRAME_SIZES.map((size) => `${size}x${size}`),
  );
  for (const body of bodies) assert.doesNotMatch(String(body.prompt), /after downscaling/);
});

test("prompt-only models omit size and describe every supported final frame size", async (t) => {
  const bodies = mockImageFetch(t);
  for (const size of FRAME_SIZES) {
    await generateSpriteImage("a readable hero", "openai/gpt-image-2", {
      geometry: { size: { w: size, h: size }, subjectFillPct: 70 },
    });
  }
  for (const [index, body] of bodies.entries()) {
    const size = FRAME_SIZES[index];
    assert.equal("size" in body, false);
    assert.match(String(body.prompt), new RegExp(`final ${size} × ${size} pixel`));
    assert.match(String(body.prompt), /limited fine detail/);
    assert.match(String(body.prompt), /after downscaling/);
  }
});

test("provider size errors surface without retrying", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalApiKey = process.env.OPENROUTER_API_KEY;
  let calls = 0;
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalApiKey;
  });
  process.env.OPENROUTER_API_KEY = "test-api-key";
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response(
      JSON.stringify({ error: { message: "Invalid size '192x192'" } }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }) as typeof fetch;

  await assert.rejects(
    generateSpriteImage("a hero", "x-ai/grok-imagine-image-2.0", {
      geometry: { size: { w: 192, h: 192 }, subjectFillPct: 70 },
    }),
    /OpenRouter image generation failed: Invalid size '192x192'/,
  );
  assert.equal(calls, 1);
});

test("style guides always send the style directive and input_references", async (t) => {
  const bodies = mockImageFetch(t);
  await generateSpriteImage("a readable hero", "openai/gpt-image-2", {
    styleGuideDataUrls: ["data:image/png;base64,guide"],
  });
  const references = (
    bodies[0].input_references as Array<{ image_url: { url: string } }>
  ).map((reference) => reference.image_url.url);
  assert.deepEqual(references, ["data:image/png;base64,guide"]);
  assert.match(String(bodies[0].prompt), /palette, linework, shading, texture/);
  assert.match(String(bodies[0].prompt), /Do not copy their subjects/);
  assert.match(String(bodies[0].prompt), /#00b140/);
  assert.doesNotMatch(String(bodies[0].prompt), /The first attached image is the Reference Sprite/);
});

test("omits reference directive and input_reference when no reference is passed", async (t) => {
  const bodies = mockImageFetch(t);
  await generateSpriteImage("a readable hero", "openai/gpt-image-2");
  assert.equal("input_references" in bodies[0], false);
  assert.doesNotMatch(String(bodies[0].prompt), /color palette, outline weight/);
});

test("rejects style guides beyond the model's reference budget", async (t) => {
  mockImageFetch(t);
  await assert.rejects(
    generateSpriteImage("a hero", "x-ai/grok-imagine-image-2.0", {
      styleGuideDataUrls: ["one", "two", "three", "four"],
    }),
    /up to 3 Style Guide Images/,
  );
});
