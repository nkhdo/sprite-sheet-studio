import { describe, expect, it } from "vitest";
import { toServerDraft } from "./draft-persistence";

describe("draft persistence", () => {
  it("maps domain draft names to the server contract", () => {
    expect(toServerDraft({
      frameSize: 64,
      subjectFillPct: 85,
      animationName: "walk",
      color_palette: "count:8",
      colorCount: 32,
    })).toEqual({
      draftFrameSize: 64,
      draftSubjectFillPct: 85,
      animationDraftName: "walk",
      color_palette: "count:8",
      draftColorCount: 32,
    });
  });
});
