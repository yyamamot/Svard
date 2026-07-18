import { describe, expect, it, vi } from "vitest";
import { createDocumentDiffStreamGitPreviewLoader } from "../../src/ui/components/documentDiffStream/gitPreviewLoader";
import { diffPreview, documentStreamItem } from "./documentDiffStreamTestUtils";

describe("DocumentDiffStreamGitPreviewLoader", () => {
  it("builds route-specific batch requests without mixing Git identities", async () => {
    const getGitDiffPreviews = vi.fn().mockResolvedValue([]);
    const getGitBranchFileDiffs = vi.fn().mockResolvedValue([]);
    const getGitFileCommitDiffs = vi.fn().mockResolvedValue([]);
    const loader = createDocumentDiffStreamGitPreviewLoader({
      getGitDiffPreview: vi.fn(),
      getGitDiffPreviews,
      getGitBranchFileDiffs,
      getGitFileCommitDiffs,
    });
    const renamed = {
      ...documentStreamItem("docs/new.md"),
      oldPath: "docs/old.md",
    };

    await loader.loadBatch({
      items: [documentStreamItem("docs/one.md")],
      preview: {
        source: "git-changes-stream",
        repositoryRoot: "/workspace",
        items: [],
      },
    });
    await loader.loadBatch({
      items: [renamed],
      preview: {
        source: "git-branch-stream",
        repositoryRoot: "/workspace",
        baseRef: "main",
        headRef: "feature",
        items: [],
      },
    });
    await loader.loadBatch({
      items: [documentStreamItem("docs/two.md")],
      preview: {
        source: "git-commit-stream",
        repositoryRoot: "/workspace",
        revision: "revision-a",
        items: [],
      },
    });

    expect(getGitDiffPreviews).toHaveBeenCalledWith("/workspace", [
      "docs/one.md",
    ]);
    expect(getGitBranchFileDiffs).toHaveBeenCalledWith("/workspace", {
      baseRef: "main",
      headRef: "feature",
      items: [{ path: "docs/new.md", oldPath: "docs/old.md" }],
    });
    expect(getGitFileCommitDiffs).toHaveBeenCalledWith(
      "/workspace",
      "revision-a",
      ["docs/two.md"],
    );
  });

  it("declines batch loading when its route identity or callback is unavailable", () => {
    const loader = createDocumentDiffStreamGitPreviewLoader({
      getGitDiffPreview: vi.fn(),
      getGitBranchFileDiffs: vi.fn(),
      getGitFileCommitDiffs: vi.fn(),
    });
    const items = [documentStreamItem("docs/one.md")];

    expect(
      loader.loadBatch({
        items,
        preview: {
          source: "git-changes-stream",
          repositoryRoot: "/workspace",
          items: [],
        },
      }),
    ).toBeNull();
    expect(
      loader.loadBatch({
        items,
        preview: {
          source: "git-branch-stream",
          repositoryRoot: "/workspace",
          items: [],
        },
      }),
    ).toBeNull();
    expect(
      loader.loadBatch({
        items,
        preview: {
          source: "git-commit-stream",
          repositoryRoot: "/workspace",
          items: [],
        },
      }),
    ).toBeNull();
  });

  it("uses route-specific single loading and preserves the generic fallback", async () => {
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValue(diffPreview("/workspace/docs/fallback.md"));
    const getGitBranchFileDiff = vi
      .fn()
      .mockResolvedValue(diffPreview("/workspace/docs/branch.md"));
    const getGitFileCommitDiff = vi
      .fn()
      .mockResolvedValue(diffPreview("/workspace/docs/commit.md"));
    const loader = createDocumentDiffStreamGitPreviewLoader({
      getGitDiffPreview,
      getGitBranchFileDiff,
      getGitFileCommitDiff,
    });

    await loader.loadSingle({
      documentPath: "/workspace/docs/branch.md",
      item: documentStreamItem("docs/branch.md"),
      preview: {
        source: "git-branch-stream",
        repositoryRoot: "/workspace",
        baseRef: "main",
        items: [],
      },
    });
    await loader.loadSingle({
      documentPath: "/workspace/docs/commit.md",
      item: documentStreamItem("docs/commit.md"),
      preview: {
        source: "git-commit-stream",
        revision: "revision-a",
        items: [],
      },
    });
    await loader.loadSingle({
      documentPath: "/workspace/docs/fallback.md",
      item: documentStreamItem("docs/fallback.md"),
      preview: { source: "git-branch-stream", items: [] },
    });

    expect(getGitBranchFileDiff).toHaveBeenCalledTimes(1);
    expect(getGitFileCommitDiff).toHaveBeenCalledWith(
      "/workspace/docs/commit.md",
      "revision-a",
    );
    expect(getGitDiffPreview).toHaveBeenCalledWith(
      "/workspace/docs/fallback.md",
    );
  });
});
