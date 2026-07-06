import { vi } from "vitest";

import { defaultConfig } from "../../../src/core/defaultConfig";
import type {
  AppConfig,
  DocumentPayload,
  HostAdapter,
} from "../../../src/core/types";
import { useSourceControlActions } from "../../../src/ui/hooks/useSourceControlActions";

export const documentPayload: DocumentPayload = {
  path: "/workspace/docs/guide.md",
  basePath: "/workspace/docs",
  format: "markdown",
  source: "# Guide\n",
  updatedAt: "2026-05-20T00:00:00.000Z",
};

export function configWithWorkspace(
  patch: Partial<AppConfig["workspace"]>,
): AppConfig {
  return {
    ...defaultConfig,
    workspace: {
      ...defaultConfig.workspace,
      ...patch,
    },
  };
}

export function createHost() {
  return {
    getGitChanges: vi.fn().mockResolvedValue({
      status: "ok",
      repositoryRoot: "/workspace",
      currentBranch: "main",
      headCommit: null,
      items: [],
      message: null,
    }),
    getGitBranchDiff: vi.fn().mockResolvedValue({
      status: "ok",
      repositoryRoot: "/workspace",
      currentBranch: "main",
      headCommit: null,
      baseRef: "origin/main",
      headRef: "HEAD",
      mergeBase: "1111111",
      baseCandidates: ["origin/main"],
      providerBaseCandidates: [],
      items: [],
      message: null,
    }),
    getGitFileHistory: vi.fn().mockResolvedValue({
      status: "ok",
      relativePath: "docs/guide.md",
      items: [],
      message: null,
    }),
    getGitCommitGraph: vi.fn().mockResolvedValue({
      status: "ok",
      scope: "repository",
      repositoryRoot: "/workspace",
      relativePath: null,
      currentBranch: "main",
      headCommit: null,
      items: [],
      message: null,
    }),
    getGitDiffPreview: vi.fn().mockResolvedValue({
      source: "git",
      repositoryRoot: "/workspace",
      relativePath: "docs/guide.md",
      leftPath: "/workspace/docs/guide.md",
      rightPath: "/workspace/docs/guide.md",
      status: "modified",
      leftLabel: "HEAD",
      rightLabel: "Working Tree",
      hunks: [],
    }),
    watchGitStatus: vi.fn().mockResolvedValue({ dispose: vi.fn() }),
  } as unknown as HostAdapter;
}

export type SourceControlActions = ReturnType<typeof useSourceControlActions>;
export type OpenContextMenu = Parameters<
  typeof useSourceControlActions
>[0]["openContextMenu"];

export function SourceControlHarness({
  config,
  document = documentPayload,
  host,
  onGitChangesRefreshComplete,
  onDocumentReviewNeedsAttention,
  onDocumentReviewReset,
  onDocumentReviewViewed,
  onActions,
  openContextMenu = vi.fn() as unknown as OpenContextMenu,
  rootDirectory = "/workspace",
  setDocumentDiffPreview = vi.fn(),
  workspacePerformanceMode,
}: {
  config: AppConfig;
  document?: DocumentPayload;
  host: HostAdapter;
  onGitChangesRefreshComplete?: Parameters<
    typeof useSourceControlActions
  >[0]["onGitChangesRefreshComplete"];
  onDocumentReviewNeedsAttention?: Parameters<
    typeof useSourceControlActions
  >[0]["onDocumentReviewNeedsAttention"];
  onDocumentReviewReset?: Parameters<
    typeof useSourceControlActions
  >[0]["onDocumentReviewReset"];
  onDocumentReviewViewed?: Parameters<
    typeof useSourceControlActions
  >[0]["onDocumentReviewViewed"];
  onActions?: (actions: SourceControlActions) => void;
  openContextMenu?: OpenContextMenu;
  rootDirectory?: string;
  setDocumentDiffPreview?: Parameters<
    typeof useSourceControlActions
  >[0]["setDocumentDiffPreview"];
  workspacePerformanceMode?: Parameters<
    typeof useSourceControlActions
  >[0]["workspacePerformanceMode"];
}) {
  const actions = useSourceControlActions({
    config,
    copyText: vi.fn(),
    documentPayload: document,
    host,
    openContextMenu,
    onGitChangesRefreshComplete,
    onDocumentReviewNeedsAttention,
    onDocumentReviewReset,
    onDocumentReviewViewed,
    persistWorkspace: vi.fn().mockResolvedValue(undefined),
    rootDirectory,
    setDocumentDiffPreview,
    showInlineNotice: vi.fn(),
    workspacePerformanceMode,
  });
  onActions?.(actions);
  return null;
}

export function contextMenuEvent() {
  return {
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    clientX: 0,
    clientY: 0,
  } as unknown as Parameters<
    SourceControlActions["openTimelineItemContextMenu"]
  >[0];
}

export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

export function mockRequestIdleCallback() {
  const originalRequestIdleCallback = window.requestIdleCallback;
  const originalCancelIdleCallback = window.cancelIdleCallback;
  window.requestIdleCallback = (callback) =>
    window.setTimeout(
      () =>
        callback({
          didTimeout: false,
          timeRemaining: () => 50,
        }),
      0,
    );
  window.cancelIdleCallback = (handle) => window.clearTimeout(handle);
  return () => {
    window.requestIdleCallback = originalRequestIdleCallback;
    window.cancelIdleCallback = originalCancelIdleCallback;
  };
}

export function mockAnimationFrame() {
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const originalCancelAnimationFrame = window.cancelAnimationFrame;
  window.requestAnimationFrame = (callback) =>
    window.setTimeout(() => callback(performance.now()), 0);
  window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
  return () => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
  };
}
