import { describe, expect, it } from "vitest";
import { MockHostAdapter } from "../../src/adapters/mockHostAdapter";

describe("MockHostAdapter.getGitDiffPreviews", () => {
  it("returns previews in input order without repeating paths in the wrapper", async () => {
    const host = new MockHostAdapter();

    const result = await host.getGitDiffPreviews("/workspace", [
      "docs/git-modified.md",
      "docs/git-clean.md",
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((entry) => entry.status)).toEqual(["ready", "ready"]);
    expect(result[0]).not.toHaveProperty("path");
    expect(result[1]).not.toHaveProperty("path");
    expect(result[0]).toMatchObject({
      status: "ready",
      preview: { relativePath: "docs/git-modified.md" },
    });
    expect(result[1]).toMatchObject({
      status: "ready",
      preview: { relativePath: "docs/git-clean.md" },
    });
  });

  it("rejects oversized batches and isolates unsafe relative paths", async () => {
    const host = new MockHostAdapter();

    await expect(
      host.getGitDiffPreviews("/workspace", Array(33).fill("docs/guide.md")),
    ).rejects.toThrow("supported limit");
    await expect(
      host.getGitDiffPreviews("/workspace", [
        "docs/git-clean.md",
        "../private.md",
        "docs/git-modified.md",
      ]),
    ).resolves.toMatchObject([
      { status: "ready" },
      { status: "error" },
      { status: "ready" },
    ]);
  });

  it("returns Branch Diff and commit preview batches in input order", async () => {
    const host = new MockHostAdapter();

    await expect(
      host.getGitBranchFileDiffs("/workspace", {
        baseRef: "origin/main",
        headRef: null,
        items: [
          { path: "docs/git-modified.md" },
          { path: "docs/git-clean.md" },
        ],
      }),
    ).resolves.toMatchObject([
      { status: "ready", preview: { relativePath: "docs/git-modified.md" } },
      { status: "ready", preview: { relativePath: "docs/git-clean.md" } },
    ]);
    await expect(
      host.getGitFileCommitDiffs("/workspace", "fixture-revision", [
        "docs/git-modified.md",
        "docs/git-clean.md",
      ]),
    ).resolves.toMatchObject([
      { status: "ready", preview: { relativePath: "docs/git-modified.md" } },
      { status: "ready", preview: { relativePath: "docs/git-clean.md" } },
    ]);
  });

  it("isolates invalid paths and rejects oversized Branch Diff and commit batches", async () => {
    const host = new MockHostAdapter();

    await expect(
      host.getGitBranchFileDiffs("/workspace", {
        baseRef: "origin/main",
        headRef: null,
        items: Array(33).fill({ path: "docs/guide.md" }),
      }),
    ).rejects.toThrow("supported limit");
    await expect(
      host.getGitFileCommitDiffs(
        "/workspace",
        "fixture-revision",
        Array(33).fill("docs/guide.md"),
      ),
    ).rejects.toThrow("supported limit");
    await expect(
      host.getGitBranchFileDiffs("/workspace", {
        baseRef: "origin/main",
        headRef: null,
        items: [{ path: "docs/git-clean.md" }, { path: "../private.md" }],
      }),
    ).resolves.toMatchObject([{ status: "ready" }, { status: "error" }]);
    await expect(
      host.getGitFileCommitDiffs("/workspace", "fixture-revision", [
        "docs/git-clean.md",
        "../private.md",
      ]),
    ).resolves.toMatchObject([{ status: "ready" }, { status: "error" }]);
  });
});
