import { describe, expect, it } from "vitest";

import {
  buildFileDocumentDiffPreview,
  diffHunksFromText,
} from "../../src/core/documentDiff";

describe("document diff", () => {
  it("converts source text differences into shared hunk lines", () => {
    const hunks = diffHunksFromText("one\ntwo\nthree\n", "one\n2\nthree\n");

    expect(hunks).toHaveLength(1);
    expect(hunks[0]?.lines.some((line) => line.kind === "removed")).toBe(true);
    expect(hunks[0]?.lines.some((line) => line.kind === "added")).toBe(true);
    expect(hunks[0]?.lines.map((line) => line.text)).toContain("2");
  });

  it("builds file-to-file previews with file labels", () => {
    const preview = buildFileDocumentDiffPreview({
      leftPath: "/workspace/docs/file-diff-left.md",
      leftText: "# Title\n\nOld text\n",
      rightPath: "/workspace/docs/file-diff-right.md",
      rightText: "# Title\n\nNew text\n",
    });

    expect(preview.source).toBe("file");
    expect(preview.status).toBe("modified");
    expect(preview.leftLabel).toBe("file-diff-left.md");
    expect(preview.rightLabel).toBe("file-diff-right.md");
    expect(preview.hunks[0]?.lines.map((line) => line.kind)).toContain("added");
  });

  it("rejects same file, unsupported files, and mixed formats", () => {
    expect(() =>
      buildFileDocumentDiffPreview({
        leftPath: "/workspace/docs/a.md",
        leftText: "",
        rightPath: "/workspace/docs/a.md",
        rightText: "",
      }),
    ).toThrow(/different document/);

    expect(() =>
      buildFileDocumentDiffPreview({
        leftPath: "/workspace/docs/a.md",
        leftText: "",
        rightPath: "/workspace/docs/a.txt",
        rightText: "",
      }),
    ).toThrow(/markup documents/);

    expect(() =>
      buildFileDocumentDiffPreview({
        leftPath: "/workspace/docs/a.md",
        leftText: "",
        rightPath: "/workspace/docs/a.adoc",
        rightText: "",
      }),
    ).toThrow(/same format/);
  });
});
