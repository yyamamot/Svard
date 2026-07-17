import { describe, expect, it } from "vitest";

import {
  shouldRefreshPostDiffGitMarkersForGitChanges,
  shouldInvalidatePostDiffGitMarkersForGitRefreshReason,
  shouldInvalidatePostDiffGitMarkersForWorkspaceFileChange,
} from "../../src/ui/lib/postDiffGitMarkerRefresh";

describe("post-diff git marker refresh stability", () => {
  it("keeps marker context for unrelated file tree changes", () => {
    const decision = shouldInvalidatePostDiffGitMarkersForWorkspaceFileChange({
      activeDocumentPath: "/workspace/docs/active.md",
      changedPath: "/workspace/docs/other.md",
      reason: "file-tree-directory-watch",
    });

    expect(decision.shouldInvalidate).toBe(false);
    expect(decision.trace).toEqual({
      basename: "active.md",
      changedBasename: "other.md",
      matchedActiveDocument: false,
      reason: "file-tree-directory-watch",
    });
  });

  it("invalidates marker context when the active document changed", () => {
    const decision = shouldInvalidatePostDiffGitMarkersForWorkspaceFileChange({
      activeDocumentPath: "/workspace/docs/active.adoc",
      changedPath: "/workspace/docs/active.adoc",
      reason: "file-tree-directory-watch",
    });

    expect(decision.shouldInvalidate).toBe(true);
    expect(decision.matchedActiveDocument).toBe(true);
    expect(decision.trace).toEqual({
      basename: "active.adoc",
      changedBasename: "active.adoc",
      matchedActiveDocument: true,
      reason: "file-tree-directory-watch",
    });
  });

  it("keeps marker context when the changed path is unknown", () => {
    const decision = shouldInvalidatePostDiffGitMarkersForWorkspaceFileChange({
      activeDocumentPath: "/workspace/docs/active.md",
      changedPath: null,
      reason: "file-tree-directory-watch",
    });

    expect(decision.shouldInvalidate).toBe(false);
    expect(decision.trace).toEqual({
      basename: "active.md",
      changedBasename: "unknown",
      matchedActiveDocument: false,
      reason: "file-tree-directory-watch",
    });
  });

  it("does not let file tree Git refresh perform a second marker invalidation", () => {
    expect(
      shouldInvalidatePostDiffGitMarkersForGitRefreshReason(
        "file-tree-directory-watch",
      ),
    ).toBe(false);
    expect(
      shouldInvalidatePostDiffGitMarkersForGitRefreshReason(
        "file-tree-manual-refresh",
      ),
    ).toBe(false);
  });

  it("keeps explicit Git refresh as a marker invalidation source", () => {
    expect(
      shouldInvalidatePostDiffGitMarkersForGitRefreshReason("manual-refresh"),
    ).toBe(true);
    expect(
      shouldInvalidatePostDiffGitMarkersForGitRefreshReason("toolbar-refresh"),
    ).toBe(true);
  });

  it("refreshes active markers after metadata refresh when active document became clean", () => {
    const decision = shouldRefreshPostDiffGitMarkersForGitChanges({
      activeDocumentPath: "/workspace/docs/active.md",
      hasActiveMarkerContext: true,
      reason: "metadata-event",
      changes: {
        status: "ok",
        repositoryRoot: "/workspace",
        currentBranch: "main",
        headCommit: null,
        items: [],
        message: null,
      },
    });

    expect(decision.shouldRefresh).toBe(true);
    expect(decision.activeDocumentStillDirty).toBe(false);
    expect(decision.trace).toEqual({
      basename: "active.md",
      activeDocumentStillDirty: false,
      changeCount: 0,
      matchedActiveDocument: false,
      reason: "metadata-event",
    });
  });

  it("refreshes active markers after metadata refresh when active document remains dirty", () => {
    const decision = shouldRefreshPostDiffGitMarkersForGitChanges({
      activeDocumentPath: "/workspace/docs/active.md",
      hasActiveMarkerContext: true,
      reason: "metadata-event",
      changes: {
        status: "ok",
        repositoryRoot: "/workspace",
        currentBranch: "main",
        headCommit: null,
        items: [
          {
            path: "docs/active.md",
            status: "modified",
            documentPath: "/workspace/docs/active.md",
          },
        ],
        message: null,
      },
    });

    expect(decision.shouldRefresh).toBe(true);
    expect(decision.activeDocumentStillDirty).toBe(true);
  });

  it("keeps markers untouched for warm refresh and when no marker exists", () => {
    const changes = {
      status: "ok" as const,
      repositoryRoot: "/workspace",
      currentBranch: "main",
      headCommit: null,
      items: [],
      message: null,
    };

    expect(
      shouldRefreshPostDiffGitMarkersForGitChanges({
        activeDocumentPath: "/workspace/docs/active.md",
        hasActiveMarkerContext: true,
        reason: "idle-warm",
        changes,
      }).shouldRefresh,
    ).toBe(false);
    expect(
      shouldRefreshPostDiffGitMarkersForGitChanges({
        activeDocumentPath: "/workspace/docs/active.md",
        hasActiveMarkerContext: false,
        reason: "metadata-event",
        changes,
      }).shouldRefresh,
    ).toBe(false);
  });
});
