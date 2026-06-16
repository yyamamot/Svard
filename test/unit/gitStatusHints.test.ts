import { describe, expect, it } from "vitest";

import {
  collectGitStatusPaths,
  gitStatusEntriesToMap,
  shouldSkipGitStatusHints,
} from "../../src/ui/hooks/useGitStatusHints";
import {
  buildGitDirectoryStatusSummary,
  mergeGitStatusWithChanges,
} from "../../src/ui/lib/gitDirectoryStatusSummary";
import { gitStatusDisplay } from "../../src/ui/lib/gitStatusDisplay";

describe("git status hints", () => {
  it("maps Git status entries into a path keyed summary", () => {
    expect(
      gitStatusEntriesToMap([
        {
          path: "/workspace/docs/a.md",
          status: "modified",
        },
        {
          path: "/workspace/docs/b.md",
          status: "untracked",
        },
      ]),
    ).toEqual({
      "/workspace/docs/a.md": "modified",
      "/workspace/docs/b.md": "untracked",
    });
  });

  it("uses the latest status when duplicate paths are returned", () => {
    expect(
      gitStatusEntriesToMap([
        {
          path: "/workspace/docs/a.md",
          status: "modified",
        },
        {
          path: "/workspace/docs/a.md",
          status: "untracked",
        },
      ]),
    ).toEqual({
      "/workspace/docs/a.md": "untracked",
    });
  });

  it("collects unique supported file paths from tabs, visible tree entries, and file bookmarks", () => {
    const paths = collectGitStatusPaths({
      tabs: [
        {
          path: "/workspace/docs/git-modified.md",
          basePath: "/workspace/docs",
          format: "markdown",
          source: "",
          updatedAt: "2026-05-16T00:00:00.000Z",
        },
        {
          path: "/workspace/docs/asset.png",
          basePath: "/workspace/docs",
          format: "markdown",
          source: "",
          updatedAt: "2026-05-16T00:00:00.000Z",
        },
      ],
      childrenByDirectory: {
        "/workspace/docs": [
          {
            kind: "file",
            name: "git-modified.md",
            path: "/workspace/docs/git-modified.md",
          },
          {
            kind: "file",
            name: "git-untracked.md",
            path: "/workspace/docs/git-untracked.md",
          },
          {
            kind: "directory",
            name: "nested",
            path: "/workspace/docs/nested",
          },
        ],
      },
      bookmarks: [
        { kind: "file", path: "/workspace/docs/git-clean.md" },
        { kind: "directory", path: "/workspace/docs" },
      ],
    });

    expect(paths).toEqual([
      "/workspace/docs/git-clean.md",
      "/workspace/docs/git-modified.md",
      "/workspace/docs/git-untracked.md",
    ]);
  });

  it("treats WSL mitigation mode as a normal no-badge state", () => {
    expect(shouldSkipGitStatusHints("wsl-mitigated")).toBe(true);
    expect(shouldSkipGitStatusHints("normal")).toBe(false);
  });

  it("maps visible statuses to accessible labels and hides clean statuses", () => {
    expect(gitStatusDisplay("modified")).toMatchObject({
      className: "git-status-modified",
      shortLabel: "M",
      label: "Modified in Git",
    });
    expect(gitStatusDisplay("untracked")).toMatchObject({
      className: "git-status-untracked",
      shortLabel: "U",
      label: "Untracked in Git",
    });
    expect(gitStatusDisplay("clean")).toBeNull();
    expect(gitStatusDisplay("not-in-repo")).toBeNull();
  });

  it("aggregates changed documents into ancestor directory summaries", () => {
    const summaries = buildGitDirectoryStatusSummary({
      "/workspace/docs/git-modified.md": "modified",
      "/workspace/docs/nested/git-untracked.md": "untracked",
      "/workspace/docs/nested/git-clean.md": "clean",
      "/workspace/docs/nested/git-error.md": "error",
    });

    expect(summaries["/workspace/docs"]).toMatchObject({
      status: "modified",
      className: "git-status-modified",
      count: 2,
      modifiedCount: 1,
      addedCount: 0,
      deletedCount: 0,
      untrackedCount: 1,
      label: "2 changed documents: 1 modified, 1 untracked",
    });
    expect(summaries["/workspace/docs/nested"]).toMatchObject({
      status: "untracked",
      className: "git-status-untracked",
      count: 1,
      label: "1 changed document: 1 untracked",
    });
  });

  it("uses deleted before modified before added or untracked for directory summaries", () => {
    const summaries = buildGitDirectoryStatusSummary({
      "/workspace/docs/a.md": "untracked",
      "/workspace/docs/b.md": "renamed",
      "/workspace/docs/c.md": "deleted",
      "/workspace/docs/d.md": "added",
    });

    expect(summaries["/workspace/docs"]).toMatchObject({
      status: "deleted",
      className: "git-status-deleted",
      count: 4,
      modifiedCount: 1,
      addedCount: 1,
      deletedCount: 1,
      untrackedCount: 1,
    });
  });

  it("merges supported document paths from cached Source Control changes", () => {
    const merged = mergeGitStatusWithChanges(
      {
        "/workspace/docs/visible.md": "modified",
      },
      {
        status: "ok",
        repositoryRoot: "/workspace",
        currentBranch: "main",
        headCommit: null,
        message: null,
        items: [
          {
            path: "docs/hidden.adoc",
            documentPath: "/workspace/docs/hidden.adoc",
            status: "untracked",
          },
          {
            path: "assets/logo.png",
            documentPath: null,
            status: "binary",
          },
          {
            path: "docs/raw.txt",
            documentPath: "/workspace/docs/raw.txt",
            status: "modified",
          },
        ],
      },
    );

    expect(merged).toEqual({
      "/workspace/docs/visible.md": "modified",
      "/workspace/docs/hidden.adoc": "untracked",
    });
  });

  it("ignores non-ok Source Control changes when merging status hints", () => {
    const base = {
      "/workspace/docs/visible.md": "modified",
    } satisfies Record<string, "modified">;

    expect(
      mergeGitStatusWithChanges(base, {
        status: "error",
        repositoryRoot: null,
        currentBranch: null,
        headCommit: null,
        items: [
          {
            path: "docs/hidden.adoc",
            documentPath: "/workspace/docs/hidden.adoc",
            status: "untracked",
          },
        ],
        message: "failed",
      }),
    ).toBe(base);
  });
});
