import { describe, expect, it } from "vitest";

import { sourceControlPayloadEqual } from "../../src/ui/hooks/useSourceControlLoaders";
import type {
  GitBranchDiff,
  GitChanges,
  GitCommitGraph,
  GitFileHistory,
} from "../../src/core/types";

const changes: GitChanges = {
  status: "ok",
  repositoryRoot: "/workspace",
  currentBranch: "main",
  headCommit: {
    revision: "abc123",
    shortHash: "abc123",
    summary: "Initial",
  },
  items: [
    {
      path: "docs/a.adoc",
      status: "modified",
      documentPath: "/workspace/docs/a.adoc",
    },
  ],
};

describe("sourceControlPayloadEqual", () => {
  it("ignores metrics-only changes for commit history payloads", () => {
    const history: GitFileHistory = {
      status: "ok",
      relativePath: "docs/a.adoc",
      items: [
        {
          revision: "abc123",
          shortHash: "abc123",
          summary: "Initial",
          author: "User",
          date: "2026-06-03T00:00:00.000Z",
          fileStatus: "modified",
        },
      ],
      hasMore: false,
      nextCursor: null,
      metrics: {
        cacheStatus: "miss",
        durationMs: 10,
        discoveryMs: 1,
        statusMs: 1,
        headMs: 1,
        walkMs: 1,
        blobLookupMs: 1,
        walkedCommits: 1,
        matchedCommits: 1,
      },
    };
    const nextHistory: GitFileHistory = {
      ...history,
      metrics: {
        ...history.metrics!,
        durationMs: 99,
        walkMs: 88,
      },
    };

    expect(sourceControlPayloadEqual(history, nextHistory)).toBe(true);
  });

  it("detects visible changes in changes and branch diff payloads", () => {
    expect(
      sourceControlPayloadEqual(changes, {
        ...changes,
        items: [{ ...changes.items[0]!, status: "added" }],
      }),
    ).toBe(false);

    const branchDiff: GitBranchDiff = {
      status: "ok",
      repositoryRoot: "/workspace",
      currentBranch: "feature",
      headCommit: changes.headCommit,
      baseRef: "origin/main",
      headRef: "HEAD",
      mergeBase: "base123",
      baseCandidates: ["origin/main"],
      items: [
        {
          path: "docs/a.adoc",
          oldPath: null,
          status: "modified",
          documentPath: "/workspace/docs/a.adoc",
        },
      ],
    };

    expect(
      sourceControlPayloadEqual(branchDiff, {
        ...branchDiff,
        baseRef: "origin/develop",
      }),
    ).toBe(false);
  });

  it("ignores commit graph metrics but detects cursor changes", () => {
    const graph: GitCommitGraph = {
      status: "ok",
      scope: "repository",
      repositoryRoot: "/workspace",
      currentBranch: "main",
      headCommit: changes.headCommit,
      items: [
        {
          revision: "abc123",
          shortHash: "abc123",
          parentRevisions: [],
          parentShortHashes: [],
          summary: "Initial",
          author: "User",
          date: "2026-06-03T00:00:00.000Z",
          fileStatus: "modified",
        },
      ],
      hasMore: true,
      nextCursor: "cursor-1",
      metrics: {
        cacheStatus: "miss",
        durationMs: 10,
        walkedCommits: 1,
        returnedCommits: 1,
        hasMore: true,
      },
    };

    expect(
      sourceControlPayloadEqual(graph, {
        ...graph,
        metrics: { ...graph.metrics!, durationMs: 99 },
      }),
    ).toBe(true);
    expect(
      sourceControlPayloadEqual(graph, {
        ...graph,
        nextCursor: "cursor-2",
      }),
    ).toBe(false);
  });
});
