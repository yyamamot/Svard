import { isSupportedDocumentPath } from "../../core/documentFormat";
import { getGitDiffPreview as getFixtureGitDiffPreview } from "./gitDiffPreview";
import type {
  GitBranchDiff,
  GitBranchDiffPreviewBatchItem,
  GitChanges,
  GitCommitDetails,
  GitCommitGraph,
  GitCommitGraphScope,
  GitDiffPreview,
  GitDiffPreviewBatchEntry,
  GitFileHistory,
  GitFileHistoryItem,
  GitRefItem,
  GitRefKind,
  GitRefList,
  GitStatusEntry,
  HostAdapter,
  RemoteProvidersConfig,
} from "../../core/types";

export type MockGitFacade = Pick<
  HostAdapter,
  | "getGitStatusSummary"
  | "getGitChanges"
  | "getGitBranchDiff"
  | "getGitBranchFileDiff"
  | "getGitBranchFileDiffs"
  | "getGitCommitGraph"
  | "getGitDiffPreview"
  | "getGitDiffPreviews"
  | "getGitFileHistory"
  | "getGitFileRevisionDiff"
  | "getGitFileCommitDiff"
  | "getGitFileCommitDiffs"
  | "getGitFileRevisionPairDiff"
  | "getGitCommitDetails"
  | "listGitRefs"
  | "getGitFileRefDiff"
>;

export function createMockGitFacade(): MockGitFacade {
  return {
    getGitStatusSummary,
    getGitChanges,
    getGitBranchDiff,
    getGitBranchFileDiff,
    getGitBranchFileDiffs,
    getGitCommitGraph,
    getGitDiffPreview,
    getGitDiffPreviews,
    getGitFileHistory,
    getGitFileRevisionDiff,
    getGitFileCommitDiff,
    getGitFileCommitDiffs,
    getGitFileRevisionPairDiff,
    getGitCommitDetails,
    listGitRefs,
    getGitFileRefDiff,
  };
}

export async function getGitStatusSummary(
  paths: string[],
): Promise<GitStatusEntry[]> {
  const statusForPath = (path: string): GitStatusEntry["status"] => {
    if (typeof window !== "undefined") {
      const overrides = (
        window as unknown as {
          __SVARD_GIT_STATUS_OVERRIDES__?: Record<
            string,
            GitStatusEntry["status"]
          >;
        }
      ).__SVARD_GIT_STATUS_OVERRIDES__;
      const override = overrides?.[path];
      if (override) {
        return override;
      }
    }
    if (path.endsWith("/git-clean.md")) {
      return "clean";
    }
    if (
      path.endsWith("/git-untracked.md") ||
      path.endsWith("/git-table-untracked.md")
    ) {
      return "untracked";
    }
    if (
      path.endsWith("/git-modified.md") ||
      path.endsWith("/git-table.md") ||
      path.endsWith("/git-table-cells.md") ||
      path.endsWith("/git-rendered-markdown.md") ||
      path.endsWith("/git-rendered-list-reorder.md") ||
      path.endsWith("/git-rendered-list-deletion.md") ||
      path.endsWith("/git-asciidoc-table.adoc") ||
      path.endsWith("/git-asciidoc-table-complex.adoc") ||
      path.endsWith("/git-large-markdown-scroll.md") ||
      path.endsWith("/git-rendered-asciidoc.adoc") ||
      path.endsWith("/git-rendered-diagram.adoc") ||
      path.endsWith("/git-rendered-unsupported-diagram.adoc") ||
      path.endsWith("/git-rendered-rich-asciidoc.adoc") ||
      path.endsWith("/git-rendered-math.adoc") ||
      path.endsWith("/git-rendered-images.adoc") ||
      path.endsWith("/git-diagram-image-diff.adoc") ||
      path.endsWith("/git-image-placeholder-source-change.adoc") ||
      path.endsWith("/git-backlog-resync.md") ||
      path.endsWith("/diff-regression-gallery.md")
    ) {
      return "modified";
    }
    return "clean";
  };

  return [...new Set(paths)].map((path) => ({
    path,
    status: statusForPath(path),
  }));
}

export async function getGitChanges(pathOrRoot: string): Promise<GitChanges> {
  if (typeof window !== "undefined") {
    const target = window as unknown as {
      __SVARD_GIT_CHANGES_CALL_COUNT__?: number;
      __SVARD_GIT_CHANGES_OVERRIDE__?: GitChanges;
    };
    target.__SVARD_GIT_CHANGES_CALL_COUNT__ =
      (target.__SVARD_GIT_CHANGES_CALL_COUNT__ ?? 0) + 1;
    if (target.__SVARD_GIT_CHANGES_OVERRIDE__) {
      return target.__SVARD_GIT_CHANGES_OVERRIDE__;
    }
  }
  if (
    pathOrRoot.endsWith("/old-notes.adoc") ||
    pathOrRoot.startsWith("/outside-git")
  ) {
    return {
      status: "not-in-repo",
      repositoryRoot: null,
      currentBranch: null,
      headCommit: null,
      items: [],
      message: "Document is not inside a Git repository.",
    };
  }
  return {
    status: "ok",
    repositoryRoot: "/workspace",
    currentBranch: "main",
    headCommit: {
      revision: "1111111111111111111111111111111111111111",
      shortHash: "1111111",
      summary: "docs: add rendered preview diff goal",
    },
    items: [
      {
        path: "docs/git-modified.md",
        status: "modified",
        documentPath: "/workspace/docs/git-modified.md",
      },
      {
        path: "docs/git-rendered-asciidoc.adoc",
        status: "modified",
        documentPath: "/workspace/docs/git-rendered-asciidoc.adoc",
      },
      {
        path: "docs/git-rendered-rich-asciidoc.adoc",
        status: "modified",
        documentPath: "/workspace/docs/git-rendered-rich-asciidoc.adoc",
      },
      {
        path: "docs/git-rendered-math.adoc",
        status: "modified",
        documentPath: "/workspace/docs/git-rendered-math.adoc",
      },
      {
        path: "docs/git-untracked.md",
        status: "untracked",
        documentPath: "/workspace/docs/git-untracked.md",
      },
      {
        path: "docs/git-table-cells.md",
        status: "modified",
        documentPath: "/workspace/docs/git-table-cells.md",
      },
      {
        path: "docs/git-table-untracked.md",
        status: "untracked",
        documentPath: "/workspace/docs/git-table-untracked.md",
      },
      {
        path: "docs/git-asciidoc-table-complex.adoc",
        status: "modified",
        documentPath: "/workspace/docs/git-asciidoc-table-complex.adoc",
      },
      {
        path: "book/deep/cache-only.md",
        status: "modified",
        documentPath: "/workspace/book/deep/cache-only.md",
      },
      {
        path: "assets/diagram.png",
        status: "binary",
        documentPath: null,
      },
    ],
    message: null,
  };
}

export async function getGitBranchDiff(
  pathOrRoot: string,
  options?: {
    baseRef?: string | null;
    headRef?: string | null;
    remoteProviders?: RemoteProvidersConfig | null;
    network?: unknown;
  },
): Promise<GitBranchDiff> {
  if (typeof window !== "undefined") {
    const target = window as unknown as {
      __SVARD_GIT_BRANCH_DIFF_CALL_COUNT__?: number;
    };
    target.__SVARD_GIT_BRANCH_DIFF_CALL_COUNT__ =
      (target.__SVARD_GIT_BRANCH_DIFF_CALL_COUNT__ ?? 0) + 1;
  }
  if (
    pathOrRoot.endsWith("/old-notes.adoc") ||
    pathOrRoot.startsWith("/outside-git")
  ) {
    return {
      status: "not-in-repo",
      repositoryRoot: null,
      currentBranch: null,
      headCommit: null,
      baseRef: null,
      headRef: options?.headRef ?? "HEAD",
      mergeBase: null,
      baseCandidates: [],
      items: [],
      message: "Path is not inside a Git repository.",
    };
  }
  const baseRef = options?.baseRef ?? "origin/main";
  const providerBaseCandidates =
    options?.remoteProviders?.github.enabled &&
    options.remoteProviders.github.tokenStored
      ? [
          {
            provider: "github" as const,
            label: "PR target: origin/main",
            baseRef: "origin/main",
            sourceBranch: "main",
            targetBranch: "main",
            available: true,
            message: null,
          },
        ]
      : [];
  return {
    status: "ok",
    repositoryRoot: "/workspace",
    currentBranch: "main",
    headCommit: {
      revision: "1111111111111111111111111111111111111111",
      shortHash: "1111111",
      summary: "docs: add rendered preview diff goal",
    },
    baseRef,
    headRef: options?.headRef ?? "HEAD",
    mergeBase: "0000000000000000000000000000000000000000",
    baseCandidates: ["origin/main", "origin/docs-preview", "main"],
    providerBaseCandidates,
    items: [
      {
        path: "docs/git-modified.md",
        status: "modified",
        documentPath: "/workspace/docs/git-modified.md",
      },
      {
        path: "docs/git-rendered-asciidoc.adoc",
        status: "modified",
        documentPath: "/workspace/docs/git-rendered-asciidoc.adoc",
      },
      {
        path: "docs/git-branch-added.md",
        status: "added",
        documentPath: "/workspace/docs/git-branch-added.md",
      },
      {
        path: "docs/git-renamed-new.md",
        oldPath: "docs/git-renamed-old.md",
        status: "renamed",
        documentPath: "/workspace/docs/git-renamed-new.md",
      },
      {
        path: "assets/diagram.png",
        status: "modified",
        documentPath: null,
      },
    ],
    message: null,
  };
}

export async function getGitBranchFileDiff(
  pathOrRoot: string,
  options: {
    baseRef: string;
    headRef?: string | null;
    path: string;
    oldPath?: string | null;
  },
): Promise<GitDiffPreview> {
  const documentPath = pathOrRoot.startsWith("/workspace/")
    ? `/workspace/${options.path}`
    : options.path;
  const preview = await getGitDiffPreview(documentPath);
  return {
    ...preview,
    relativePath: options.path,
    leftLabel: options.baseRef,
    rightLabel: options.headRef ?? "HEAD",
  };
}

export async function getGitBranchFileDiffs(
  repositoryRoot: string,
  options: {
    baseRef: string;
    headRef?: string | null;
    items: GitBranchDiffPreviewBatchItem[];
  },
): Promise<GitDiffPreviewBatchEntry[]> {
  if (!repositoryRoot.replace(/[\\/]+$/, "")) {
    throw new Error("Git diff preview repository root is required.");
  }
  return batchEntries(
    options.items,
    (item) => getGitBranchFileDiff(repositoryRoot, { ...options, ...item }),
    (item) => item.path,
  );
}

export async function getGitDiffPreview(path: string): Promise<GitDiffPreview> {
  if (typeof window !== "undefined") {
    const overrides = (
      window as unknown as {
        __SVARD_GIT_DIFF_OVERRIDES__?: Record<string, GitDiffPreview>;
      }
    ).__SVARD_GIT_DIFF_OVERRIDES__;
    const override = overrides?.[path];
    if (override) {
      return structuredClone(override);
    }
  }
  return getFixtureGitDiffPreview(path);
}

export async function getGitDiffPreviews(
  repositoryRoot: string,
  relativePaths: string[],
): Promise<GitDiffPreviewBatchEntry[]> {
  if (relativePaths.length > 32) {
    throw new Error("Git diff preview batch exceeds the supported limit.");
  }
  const root = repositoryRoot.replace(/[\\/]+$/, "");
  if (!root) {
    throw new Error("Git diff preview repository root is required.");
  }
  return Promise.all(
    relativePaths.map(async (relativePath) => {
      const normalized = relativePath.replace(/\\/g, "/");
      const segments = normalized.split("/");
      if (
        !normalized ||
        normalized.startsWith("/") ||
        /^[A-Za-z]:\//.test(normalized) ||
        segments.some(
          (segment) => !segment || segment === "." || segment === "..",
        )
      ) {
        return {
          status: "error" as const,
          message: "Git diff preview path is outside the repository.",
        };
      }
      try {
        return {
          status: "ready" as const,
          preview: await getGitDiffPreview(`${root}/${normalized}`),
        };
      } catch {
        return {
          status: "error" as const,
          message: "This file cannot be previewed right now.",
        };
      }
    }),
  );
}

async function batchEntries<T>(
  items: T[],
  load: (item: T) => Promise<GitDiffPreview>,
  getRelativePath?: (item: T) => string,
): Promise<GitDiffPreviewBatchEntry[]> {
  if (items.length > 32) {
    throw new Error("Git diff preview batch exceeds the supported limit.");
  }
  return Promise.all(
    items.map(async (item) => {
      if (
        getRelativePath &&
        !isSafeRepositoryRelativePath(getRelativePath(item))
      ) {
        return {
          status: "error" as const,
          message: "This file cannot be previewed right now.",
        };
      }
      try {
        return { status: "ready" as const, preview: await load(item) };
      } catch {
        return {
          status: "error" as const,
          message: "This file cannot be previewed right now.",
        };
      }
    }),
  );
}

function isSafeRepositoryRelativePath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/");
  const segments = normalized.split("/");
  return Boolean(
    normalized &&
    !normalized.startsWith("/") &&
    !/^[A-Za-z]:\//.test(normalized) &&
    !segments.some(
      (segment) => !segment || segment === "." || segment === "..",
    ),
  );
}

export async function getGitCommitGraph(
  pathOrRoot: string,
  options?: {
    scope?: GitCommitGraphScope;
    path?: string | null;
    limit?: number;
    cursor?: string | null;
  },
): Promise<GitCommitGraph> {
  if (typeof window !== "undefined") {
    const target = window as unknown as {
      __SVARD_GIT_COMMIT_GRAPH_CALL_COUNT__?: number;
    };
    target.__SVARD_GIT_COMMIT_GRAPH_CALL_COUNT__ =
      (target.__SVARD_GIT_COMMIT_GRAPH_CALL_COUNT__ ?? 0) + 1;
  }
  if (pathOrRoot.startsWith("/outside-git")) {
    return {
      status: "not-in-repo",
      scope: options?.scope ?? "repository",
      repositoryRoot: null,
      relativePath: null,
      currentBranch: null,
      headCommit: null,
      items: [],
      message: "Path is not inside a Git repository.",
    };
  }
  const scope = options?.scope ?? "repository";
  const history =
    scope === "file"
      ? await getGitFileHistory(options?.path ?? pathOrRoot, options)
      : await getGitFileHistory("/workspace/docs/git-modified.md", options);
  const items = history.items.map((item) => ({
    ...item,
    parentRevisions: item.parentRevision ? [item.parentRevision] : [],
    parentShortHashes: item.parentShortHash ? [item.parentShortHash] : [],
  }));
  return {
    status: history.status,
    scope,
    repositoryRoot: history.status === "not-in-repo" ? null : "/workspace",
    relativePath: scope === "file" ? history.relativePath : null,
    currentBranch: "main",
    headCommit: {
      revision: "1111111111111111111111111111111111111111",
      shortHash: "1111111",
      summary: "docs: add rendered preview diff goal",
    },
    items,
    message: history.message,
    hasMore: history.hasMore,
    nextCursor: history.nextCursor,
  };
}

export async function getGitFileHistory(
  path: string,
  options?: {
    limit?: number;
    cursor?: string | null;
  },
): Promise<GitFileHistory> {
  if (typeof window !== "undefined") {
    const target = window as unknown as {
      __SVARD_GIT_FILE_HISTORY_CALL_COUNT__?: number;
    };
    target.__SVARD_GIT_FILE_HISTORY_CALL_COUNT__ =
      (target.__SVARD_GIT_FILE_HISTORY_CALL_COUNT__ ?? 0) + 1;
  }
  if (!isSupportedDocumentPath(path)) {
    return {
      status: "unsupported",
      relativePath: null,
      items: [],
      message: "File History is available for markup documents only.",
    };
  }
  if (path.endsWith("/git-untracked.md")) {
    return {
      status: "untracked",
      relativePath: path.replace(/^\/workspace\//, ""),
      items: [],
      message: "This document is not tracked by Git yet.",
    };
  }
  if (path.endsWith("/old-notes.adoc")) {
    return {
      status: "not-in-repo",
      relativePath: null,
      items: [],
      message: "Document is not inside a Git repository.",
    };
  }
  const historyItems: GitFileHistoryItem[] = [
    {
      revision: "1111111111111111111111111111111111111111",
      shortHash: "1111111",
      parentRevision: "0000000000000000000000000000000000000000",
      parentShortHash: "0000000",
      summary: "docs: add rendered preview diff goal",
      author: "Svard",
      date: "2026-05-16T08:00:00Z",
      fileStatus: "modified",
    },
    {
      revision: "0000000000000000000000000000000000000000",
      shortHash: "0000000",
      parentRevision: null,
      parentShortHash: null,
      summary: "docs: create Git diff fixture",
      author: "Svard",
      date: "2026-05-15T08:00:00Z",
      fileStatus: "added",
    },
    ...Array.from({ length: 50 }, (_, index) => {
      const revision = `${index + 2}`.repeat(40).slice(0, 40);
      return {
        revision,
        shortHash: revision.slice(0, 7),
        parentRevision: null,
        parentShortHash: null,
        summary: `docs: older fixture commit ${index + 1}`,
        author: "Svard",
        date: `2026-04-${String(29 - (index % 20)).padStart(2, "0")}T08:00:00Z`,
        fileStatus: "modified",
      } satisfies GitFileHistoryItem;
    }),
  ];
  const page = pageItems(historyItems, options?.limit, options?.cursor);
  return {
    status: "ok",
    relativePath: path.replace(/^\/workspace\//, ""),
    items: page.items,
    message: null,
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  };
}

function pageItems<T extends { revision: string }>(
  items: T[],
  limit = 50,
  cursor?: string | null,
) {
  const cursorIndex =
    cursor === null || cursor === undefined
      ? -1
      : items.findIndex((item) => item.revision === cursor);
  const start = cursorIndex >= 0 ? cursorIndex + 1 : 0;
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const page = items.slice(start, start + safeLimit);
  const hasMore = start + safeLimit < items.length;
  return {
    items: page,
    hasMore,
    nextCursor: hasMore ? page.at(-1)?.revision : null,
  };
}

export async function getGitFileCommitDiff(
  path: string,
  revision: string,
): Promise<GitDiffPreview> {
  const preview = await getGitDiffPreview(path);
  const shortHash = revision.slice(0, 7);
  return {
    ...preview,
    leftLabel: shortHash === "0000000" ? "Previous" : "0000000",
    rightLabel: shortHash,
  };
}

export async function getGitFileCommitDiffs(
  repositoryRoot: string,
  revision: string,
  relativePaths: string[],
): Promise<GitDiffPreviewBatchEntry[]> {
  const root = repositoryRoot.replace(/[\\/]+$/, "");
  if (!root) {
    throw new Error("Git diff preview repository root is required.");
  }
  return batchEntries(
    relativePaths,
    (relativePath) => getGitFileCommitDiff(`${root}/${relativePath}`, revision),
    (relativePath) => relativePath,
  );
}

export async function getGitFileRevisionPairDiff(
  path: string,
  leftRevision: string,
  rightRevision: string,
): Promise<GitDiffPreview> {
  const preview = await getGitDiffPreview(path);
  return {
    ...preview,
    leftLabel: leftRevision.slice(0, 7),
    rightLabel: rightRevision.slice(0, 7),
  };
}

export async function getGitCommitDetails(
  path: string,
  revision: string,
): Promise<GitCommitDetails> {
  const shortHash = revision.slice(0, 7);
  const relativePath = path.replace(/^\/workspace\//, "");
  return {
    repositoryRoot: "/workspace",
    revision,
    shortHash,
    summary:
      shortHash === "0000000"
        ? "docs: create Git diff fixture"
        : "docs: add rendered preview diff goal",
    author: "Svard",
    date:
      shortHash === "0000000" ? "2026-05-15T08:00:00Z" : "2026-05-16T08:00:00Z",
    files: [
      {
        path: relativePath,
        status: shortHash === "0000000" ? "added" : "modified",
        documentPath: path,
      },
      {
        path: "docs/git-table.md",
        status: "modified",
        documentPath: "/workspace/docs/git-table.md",
      },
    ],
    message: null,
  };
}

export async function listGitRefs(
  path: string,
  kind: GitRefKind,
  options: {
    limit?: number;
    cursor?: string | null;
    query?: string | null;
  } = {},
): Promise<GitRefList> {
  if (!isSupportedDocumentPath(path)) {
    return {
      status: "unsupported",
      relativePath: null,
      items: [],
      message: "Git ref compare is available for markup documents only.",
    };
  }
  if (path.endsWith("/git-untracked.md")) {
    return {
      status: "untracked",
      relativePath: path.replace(/^\/workspace\//, ""),
      items: [],
      message: "This document is not tracked by Git yet.",
    };
  }
  if (path.endsWith("/old-notes.adoc")) {
    return {
      status: "not-in-repo",
      relativePath: null,
      items: [],
      message: "Document is not inside a Git repository.",
    };
  }
  const startedAt = performance.now();
  const allItems = mockGitRefItems(kind);
  const query = options.query?.trim().toLowerCase() ?? "";
  const filteredItems = query
    ? allItems.filter((item) =>
        [item.name, item.revision, item.shortRevision, item.summary ?? ""].some(
          (value) => value.toLowerCase().includes(query),
        ),
      )
    : allItems;
  const limit = Math.min(Math.max(options.limit ?? 20, 1), 50);
  const cursor = options.cursor ?? null;
  const cursorIndex = cursor
    ? filteredItems.findIndex((item) =>
        kind === "commit" ? item.revision === cursor : item.name === cursor,
      )
    : -1;
  const start = cursor ? Math.max(cursorIndex + 1, 0) : 0;
  const page = filteredItems.slice(start, start + limit + 1);
  const hasMore = page.length > limit;
  const items = hasMore ? page.slice(0, limit) : page;
  return {
    status: "ok",
    relativePath: path.replace(/^\/workspace\//, ""),
    items,
    message: null,
    hasMore,
    nextCursor: hasMore
      ? kind === "commit"
        ? items.at(-1)?.revision
        : items.at(-1)?.name
      : null,
    metrics: {
      kind,
      durationMs: performance.now() - startedAt,
      returnedRefs: items.length,
      walkedCommits: kind === "commit" ? start + items.length : 0,
      hasMore,
      cursorPresent: Boolean(cursor),
      staleCursor: Boolean(cursor && cursorIndex < 0),
    },
  };
}

function mockGitRefItems(kind: GitRefKind): GitRefItem[] {
  if (kind === "branch") {
    return [
      {
        kind,
        name: "main",
        revision: "1111111111111111111111111111111111111111",
        shortRevision: "1111111",
        summary: "docs: add rendered preview diff goal",
      },
      {
        kind,
        name: "origin/docs-preview",
        revision: "0000000000000000000000000000000000000000",
        shortRevision: "0000000",
        summary: "docs: create Git diff fixture",
      },
      ...Array.from({ length: 28 }, (_, index) =>
        mockRefItem(
          kind,
          `origin/feature-${String(index + 1).padStart(2, "0")}`,
        ),
      ),
    ];
  }
  if (kind === "tag") {
    return [
      {
        kind,
        name: "v0.1.0",
        revision: "0000000000000000000000000000000000000000",
        shortRevision: "0000000",
        summary: "docs: create Git diff fixture",
      },
      ...Array.from({ length: 24 }, (_, index) =>
        mockRefItem(kind, `v0.${index + 2}.0`),
      ),
    ];
  }
  return [
    {
      kind,
      name: "1111111",
      revision: "1111111111111111111111111111111111111111",
      shortRevision: "1111111",
      summary: "docs: add rendered preview diff goal",
    },
    {
      kind,
      name: "0000000",
      revision: "0000000000000000000000000000000000000000",
      shortRevision: "0000000",
      summary: "docs: create Git diff fixture",
    },
    ...Array.from({ length: 58 }, (_, index) => {
      const hex = (index + 2).toString(16).padStart(40, "0");
      return {
        kind,
        name: hex.slice(0, 7),
        revision: hex,
        shortRevision: hex.slice(0, 7),
        summary:
          index === 54
            ? "docs: add older ref picker pagination fixture"
            : `docs: historical fixture commit ${index + 1}`,
      };
    }),
  ];
}

function mockRefItem(
  kind: Exclude<GitRefKind, "commit">,
  name: string,
): GitRefItem {
  const seed = Array.from(name).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );
  const revision = seed.toString(16).padStart(40, "0").slice(0, 40);
  return {
    kind,
    name,
    revision,
    shortRevision: revision.slice(0, 7),
    summary: `docs: fixture ${name}`,
  };
}

export async function getGitFileRefDiff(
  path: string,
  ref: GitRefItem,
): Promise<GitDiffPreview> {
  const preview = await getGitDiffPreview(path);
  return {
    ...preview,
    leftLabel:
      ref.kind === "commit" ? ref.shortRevision : `${ref.kind}:${ref.name}`,
    rightLabel: "Working Tree",
  };
}

export async function getGitFileRevisionDiff(
  path: string,
  revision: string,
): Promise<GitDiffPreview> {
  const preview = await getGitDiffPreview(path);
  return {
    ...preview,
    leftLabel: revision.slice(0, 7),
    rightLabel: "Working Tree",
  };
}
