import { describe, expect, it } from "vitest";

import {
  renderedInlineDiffRanges,
  renderedTextOverlap,
  wordDiffParts,
} from "../../src/ui/lib/gitRenderedDiff";

describe("git rendered diff text", () => {
  it("builds word-level diff parts for changed rendered text", () => {
    expect(wordDiffParts("old stable text", "new stable text")).toEqual([
      { kind: "removed", value: "old" },
      { kind: "added", value: "new" },
      { kind: "unchanged", value: " stable text" },
    ]);
  });

  it("builds side-specific inline diff ranges for changed text", () => {
    expect(
      renderedInlineDiffRanges(
        "This paragraph was stable in HEAD.",
        "This paragraph changed in the working tree.",
        "left",
      ).map((range) => ({
        kind: range.kind,
        value: "This paragraph was stable in HEAD.".slice(
          range.start,
          range.end,
        ),
      })),
    ).toEqual([
      { kind: "removed", value: "was stable" },
      { kind: "removed", value: "HEAD" },
    ]);
    expect(
      renderedInlineDiffRanges(
        "This paragraph was stable in HEAD.",
        "This paragraph changed in the working tree.",
        "right",
      ).map((range) => ({
        kind: range.kind,
        value: "This paragraph changed in the working tree.".slice(
          range.start,
          range.end,
        ),
      })),
    ).toEqual([
      { kind: "added", value: "changed" },
      { kind: "added", value: "the working tree" },
    ]);
  });

  it("builds inline ranges for inserted nested list content", () => {
    const leftText =
      "Local-first rendering: AsciiDoc / Markdown parsing Browser-like viewer: tab history";
    const rightText =
      "Local-first rendering: AsciiDoc / Markdown parsing Browser-like viewer: tab history Preview-based diff: Git compare rendered preview diagram placeholder";

    const ranges = renderedInlineDiffRanges(leftText, rightText, "right").map(
      (range) => rightText.slice(range.start, range.end),
    );

    expect(ranges.join(" ")).toContain("Preview-based diff");
    expect(ranges.join(" ")).toContain("diagram placeholder");
  });

  it("uses character overlap for Japanese text without whitespace", () => {
    expect(
      renderedTextOverlap("差分プレビューを改善する", "差分表示を改善する"),
    ).toBeGreaterThan(0.2);
    expect(renderedTextOverlap("要求仕様", "まったく別の文章")).toBe(0);
  });
});
