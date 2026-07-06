import { describe, expect, it } from "vitest";

import {
  diffPreviewWatchLabel,
  diffPreviewWatchMessage,
  watchedGitDiffPreviewPath,
} from "../../src/ui/lib/diffPreviewWatch";
import type { DocumentDiffPreview } from "../../src/core/types";

const workingTreePreview: DocumentDiffPreview = {
  source: "git",
  repositoryRoot: "/workspace",
  relativePath: "docs/guide.md",
  leftPath: "/workspace/docs/guide.md",
  rightPath: "/workspace/docs/guide.md",
  status: "modified",
  leftLabel: "HEAD",
  rightLabel: "Working Tree",
  hunks: [],
};

describe("diff preview watch", () => {
  it("uses only working tree Git previews as watch targets", () => {
    expect(watchedGitDiffPreviewPath(workingTreePreview)).toBe(
      "/workspace/docs/guide.md",
    );
    expect(
      watchedGitDiffPreviewPath({
        ...workingTreePreview,
        source: "file",
      }),
    ).toBeNull();
    expect(
      watchedGitDiffPreviewPath({
        ...workingTreePreview,
        leftLabel: "main",
        rightLabel: "feature",
      }),
    ).toBeNull();
  });

  it("keeps watch copy canned and path-free", () => {
    expect(diffPreviewWatchLabel({ status: "stale" })).toBe("Stale");
    expect(diffPreviewWatchMessage({ status: "stale" })).toBe(
      "Preview changed on disk",
    );
    expect(diffPreviewWatchLabel({ status: "refreshing" })).toBe(
      "Refreshing",
    );
    expect(diffPreviewWatchLabel({ status: "blocked" })).toBe(
      "Preview refresh blocked",
    );
    expect(diffPreviewWatchMessage({ status: "blocked" })).toBe(
      "Preview refresh blocked",
    );
  });
});
