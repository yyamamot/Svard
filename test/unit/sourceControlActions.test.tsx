import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AppConfig,
  DocumentPayload,
  HostAdapter,
} from "../../src/core/types";
import type { ContextMenuItem } from "../../src/ui/types";
import {
  configWithWorkspace,
  contextMenuEvent,
  createHost,
  deferred,
  documentPayload,
  mockAnimationFrame,
  mockRequestIdleCallback,
  SourceControlHarness,
  type OpenContextMenu,
  type SourceControlActions,
} from "./helpers/sourceControlHarness";
import { sourceControlWslVisibleRetryDelayMs } from "../../src/ui/hooks/useSourceControlLoaders";

describe("useSourceControlActions", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    vi.useRealTimers();
    localStorage.clear();
    vi.restoreAllMocks();
    container.remove();
  });

  async function render(
    config: AppConfig,
    host: HostAdapter,
    options: {
      document?: DocumentPayload;
      onGitChangesRefreshComplete?: Parameters<
        typeof SourceControlHarness
      >[0]["onGitChangesRefreshComplete"];
      onDocumentReviewNeedsAttention?: Parameters<
        typeof SourceControlHarness
      >[0]["onDocumentReviewNeedsAttention"];
      onDocumentReviewReset?: Parameters<
        typeof SourceControlHarness
      >[0]["onDocumentReviewReset"];
      onDocumentReviewViewed?: Parameters<
        typeof SourceControlHarness
      >[0]["onDocumentReviewViewed"];
      onActions?: (actions: SourceControlActions) => void;
      openContextMenu?: OpenContextMenu;
      rootDirectory?: string;
      setDocumentDiffPreview?: Parameters<
        typeof SourceControlHarness
      >[0]["setDocumentDiffPreview"];
      workspacePerformanceMode?: "normal" | "wsl-mitigated";
    } = {},
  ) {
    await act(async () => {
      root.render(
        <SourceControlHarness config={config} host={host} {...options} />,
      );
    });
    await act(async () => {});
  }

  it("does not foreground fetch Source Control while Source Control is hidden", async () => {
    const host = createHost();

    await render(configWithWorkspace({ sidebarTab: "files" }), host);

    expect(host.getGitFileHistory).not.toHaveBeenCalled();
    expect(host.getGitChanges).not.toHaveBeenCalled();
    expect(host.getGitBranchDiff).not.toHaveBeenCalled();
    expect(host.watchGitStatus).toHaveBeenCalledWith(
      ["/workspace"],
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("warms Changes cache once after idle while Source Control is hidden", async () => {
    vi.useFakeTimers();
    const restoreIdleCallback = mockRequestIdleCallback();
    const host = createHost();
    const onGitChangesRefreshComplete = vi.fn();
    let actions: SourceControlActions | undefined;

    await render(configWithWorkspace({ sidebarTab: "files" }), host, {
      onGitChangesRefreshComplete,
      onActions: (nextActions) => {
        actions = nextActions;
      },
    });

    expect(host.getGitChanges).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
      await vi.runOnlyPendingTimersAsync();
    });
    await act(async () => {});

    expect(host.getGitChanges).toHaveBeenCalledTimes(1);
    expect(host.getGitChanges).toHaveBeenCalledWith("/workspace");
    expect(actions?.gitChanges?.status).toBe("ok");
    expect(actions?.gitChangesLoading).toBe(false);
    expect(onGitChangesRefreshComplete).not.toHaveBeenCalled();
    restoreIdleCallback();
  });

  it("defers hidden Source Control warm and watchers in WSL mitigation mode", async () => {
    vi.useFakeTimers();
    const restoreIdleCallback = mockRequestIdleCallback();
    const host = createHost();

    await render(configWithWorkspace({ sidebarTab: "files" }), host, {
      workspacePerformanceMode: "wsl-mitigated",
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
      await vi.runOnlyPendingTimersAsync();
    });

    expect(host.getGitChanges).not.toHaveBeenCalled();
    expect(host.watchGitStatus).not.toHaveBeenCalled();
    restoreIdleCallback();
  });

  it("retries visible WSL Changes fetch once after an initial failure", async () => {
    vi.useFakeTimers();
    const host = createHost();
    let actions: SourceControlActions | undefined;
    vi.mocked(host.getGitChanges)
      .mockRejectedValueOnce(new Error("WSL metadata is not ready"))
      .mockResolvedValueOnce({
        status: "ok",
        repositoryRoot: "/workspace",
        currentBranch: "main",
        headCommit: null,
        items: [],
        message: null,
      });

    await render(
      configWithWorkspace({
        sidebarTab: "sourceControl",
        sourceControlView: "changes",
      }),
      host,
      {
        onActions: (nextActions) => {
          actions = nextActions;
        },
        workspacePerformanceMode: "wsl-mitigated",
      },
    );
    await act(async () => {});

    expect(host.getGitChanges).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(sourceControlWslVisibleRetryDelayMs);
    });
    await act(async () => {});

    expect(host.getGitChanges).toHaveBeenCalledTimes(2);
    expect(actions?.gitChanges?.status).toBe("ok");
    expect(actions?.gitChangesLoading).toBe(false);
  });

  it("retries visible WSL Changes fetch once after an initial not-in-repo result", async () => {
    vi.useFakeTimers();
    const host = createHost();
    let actions: SourceControlActions | undefined;
    vi.mocked(host.getGitChanges)
      .mockResolvedValueOnce({
        status: "not-in-repo",
        repositoryRoot: null,
        currentBranch: null,
        headCommit: null,
        items: [],
        message: "Path is not inside a Git repository.",
      })
      .mockResolvedValueOnce({
        status: "ok",
        repositoryRoot: "/workspace",
        currentBranch: "main",
        headCommit: null,
        items: [],
        message: null,
      });

    await render(
      configWithWorkspace({
        sidebarTab: "sourceControl",
        sourceControlView: "changes",
      }),
      host,
      {
        onActions: (nextActions) => {
          actions = nextActions;
        },
        workspacePerformanceMode: "wsl-mitigated",
      },
    );
    await act(async () => {});

    expect(host.getGitChanges).toHaveBeenCalledTimes(1);
    expect(actions?.gitChanges).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(sourceControlWslVisibleRetryDelayMs);
    });
    await act(async () => {});

    expect(host.getGitChanges).toHaveBeenCalledTimes(2);
    expect(actions?.gitChanges?.status).toBe("ok");
    expect(actions?.gitChangesLoading).toBe(false);
  });

  it("stops visible WSL Changes retry after one retry failure", async () => {
    vi.useFakeTimers();
    const host = createHost();
    let actions: SourceControlActions | undefined;
    vi.mocked(host.getGitChanges)
      .mockRejectedValueOnce(new Error("WSL metadata is not ready"))
      .mockRejectedValueOnce(new Error("Git changes failed"));

    await render(
      configWithWorkspace({
        sidebarTab: "sourceControl",
        sourceControlView: "changes",
      }),
      host,
      {
        onActions: (nextActions) => {
          actions = nextActions;
        },
        workspacePerformanceMode: "wsl-mitigated",
      },
    );
    await act(async () => {});

    await act(async () => {
      await vi.advanceTimersByTimeAsync(sourceControlWslVisibleRetryDelayMs);
    });
    await act(async () => {});

    expect(host.getGitChanges).toHaveBeenCalledTimes(2);
    expect(actions?.gitChanges?.status).toBe("error");
    expect(actions?.gitChangesLoading).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(
        sourceControlWslVisibleRetryDelayMs * 2,
      );
    });

    expect(host.getGitChanges).toHaveBeenCalledTimes(2);
  });

  it("silently refreshes warmed Changes cache after Git metadata events", async () => {
    vi.useFakeTimers();
    const restoreIdleCallback = mockRequestIdleCallback();
    const firstChanges = {
      status: "ok" as const,
      repositoryRoot: "/workspace",
      currentBranch: "main",
      headCommit: null,
      items: [
        {
          path: "docs/guide.md",
          status: "modified" as const,
          documentPath: documentPayload.path,
        },
      ],
      message: null,
    };
    const emptyChanges = {
      ...firstChanges,
      items: [],
    };
    let triggerWatch: (() => void) | undefined;
    const host = createHost();
    const onGitChangesRefreshComplete = vi.fn();
    vi.mocked(host.getGitChanges)
      .mockResolvedValueOnce(firstChanges)
      .mockResolvedValueOnce(emptyChanges);
    vi.mocked(host.watchGitStatus).mockImplementation(
      async (_paths, onChange) => {
        triggerWatch = () => onChange({ kind: "changed" });
        return { dispose: vi.fn() };
      },
    );
    let actions: SourceControlActions | undefined;

    await render(configWithWorkspace({ sidebarTab: "files" }), host, {
      onGitChangesRefreshComplete,
      onActions: (nextActions) => {
        actions = nextActions;
      },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
      await vi.runOnlyPendingTimersAsync();
    });
    expect(actions?.gitChanges?.items).toHaveLength(1);

    triggerWatch?.();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
      await vi.runOnlyPendingTimersAsync();
    });

    expect(host.getGitChanges).toHaveBeenCalledTimes(2);
    expect(actions?.gitChanges?.items).toHaveLength(0);
    expect(actions?.gitChangesLoading).toBe(false);
    expect(onGitChangesRefreshComplete).toHaveBeenCalledTimes(1);
    expect(onGitChangesRefreshComplete).toHaveBeenCalledWith(
      "metadata-event",
      emptyChanges,
    );
    restoreIdleCallback();
  });

  it("refreshes hidden Changes cache after FileTree workspace changes", async () => {
    const firstChanges = {
      status: "ok" as const,
      repositoryRoot: "/workspace",
      currentBranch: "main",
      headCommit: null,
      items: [
        {
          path: "docs/a.md",
          status: "untracked" as const,
          documentPath: "/workspace/docs/a.md",
        },
      ],
      message: null,
    };
    const emptyChanges = {
      ...firstChanges,
      items: [],
    };
    const host = createHost();
    vi.mocked(host.getGitChanges)
      .mockResolvedValueOnce(firstChanges)
      .mockResolvedValueOnce(emptyChanges);
    let actions: SourceControlActions | undefined;

    await render(configWithWorkspace({ sidebarTab: "files" }), host, {
      onActions: (nextActions) => {
        actions = nextActions;
      },
    });

    await act(async () => {
      actions?.refreshGitChanges("file-tree-directory-watch");
    });
    await act(async () => {});

    expect(host.getGitChanges).toHaveBeenCalledTimes(1);
    expect(actions?.gitChanges?.items).toHaveLength(1);

    await act(async () => {
      actions?.refreshGitChanges("file-tree-directory-watch");
    });
    await act(async () => {});

    expect(host.getGitChanges).toHaveBeenCalledTimes(2);
    expect(actions?.gitChanges?.items).toHaveLength(0);
  });

  it("does not warm Changes cache when there is no workspace root", async () => {
    vi.useFakeTimers();
    const host = createHost();

    await render(configWithWorkspace({ sidebarTab: "files" }), host, {
      rootDirectory: "",
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
      await vi.runOnlyPendingTimersAsync();
    });

    expect(host.getGitChanges).not.toHaveBeenCalled();
  });

  it("defers file history fetch while File History is visible", async () => {
    vi.useFakeTimers();
    const restoreAnimationFrame = mockAnimationFrame();
    const host = createHost();

    await render(
      configWithWorkspace({
        sidebarTab: "sourceControl",
        sourceControlView: "graph",
        sourceControlGraphScope: "file",
      }),
      host,
    );

    expect(host.getGitFileHistory).not.toHaveBeenCalled();

    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    await act(async () => {});

    expect(host.getGitFileHistory).toHaveBeenCalledWith(documentPayload.path, {
      limit: 20,
    });
    expect(host.watchGitStatus).toHaveBeenCalledWith(
      [documentPayload.path],
      expect.any(Function),
      expect.any(Function),
    );
    expect(host.getGitCommitGraph).not.toHaveBeenCalled();
    restoreAnimationFrame();
  });

  it("traces backend file history metrics without private payload data", async () => {
    vi.useFakeTimers();
    localStorage.setItem("SVARD_PERF_TRACE", "1");
    const restoreAnimationFrame = mockAnimationFrame();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const host = createHost();
    vi.mocked(host.getGitFileHistory).mockResolvedValueOnce({
      status: "ok",
      relativePath: "docs/guide.md",
      items: [],
      message: null,
      metrics: {
        cacheStatus: "hit",
        durationMs: 3,
        discoveryMs: 1,
        statusMs: 1,
        headMs: 1,
        walkMs: 0,
        blobLookupMs: 0,
        walkedCommits: 0,
        matchedCommits: 1,
      },
    });

    await render(
      configWithWorkspace({
        sidebarTab: "sourceControl",
        sourceControlView: "graph",
        sourceControlGraphScope: "file",
      }),
      host,
    );
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    await act(async () => {});

    const deferredTracePayload = infoSpy.mock.calls
      .map((call) => call[1])
      .find(
        (payload): payload is Record<string, unknown> =>
          typeof payload === "object" &&
          payload !== null &&
          payload.event === "sourceControl.getGitFileHistory.deferred",
      );
    const tracePayload = infoSpy.mock.calls
      .map((call) => call[1])
      .find(
        (payload): payload is Record<string, unknown> =>
          typeof payload === "object" &&
          payload !== null &&
          payload.event === "sourceControl.getGitFileHistory",
      );
    const initialTracePayload = infoSpy.mock.calls
      .map((call) => call[1])
      .find(
        (payload): payload is Record<string, unknown> =>
          typeof payload === "object" &&
          payload !== null &&
          payload.event === "sourceControl.getGitFileHistory.initial",
      );
    expect(deferredTracePayload).toMatchObject({
      cached: false,
      key: "fileHistory",
    });
    expect(deferredTracePayload).not.toHaveProperty("path");
    expect(deferredTracePayload).not.toHaveProperty("source");
    expect(tracePayload).toMatchObject({
      cacheStatus: "hit",
      walkedCommits: 0,
      matchedCommits: 1,
      backendDurationMs: 3,
      backendWalkMs: 0,
      backendBlobLookupMs: 0,
    });
    expect(initialTracePayload).toMatchObject({
      cacheStatus: "hit",
      limit: 20,
      count: 0,
      walkedCommits: 0,
    });
    expect(tracePayload).not.toHaveProperty("path");
    expect(tracePayload).not.toHaveProperty("relativePath");
    expect(tracePayload).not.toHaveProperty("items");
    expect(tracePayload).not.toHaveProperty("source");
    restoreAnimationFrame();
  });

  it("fetches repository graph without fetching file history", async () => {
    const host = createHost();

    await render(
      configWithWorkspace({
        sidebarTab: "sourceControl",
        sourceControlView: "graph",
        sourceControlGraphScope: "repository",
      }),
      host,
    );

    expect(host.getGitCommitGraph).toHaveBeenCalledWith("/workspace", {
      scope: "repository",
      path: null,
      limit: 20,
    });
    expect(host.getGitFileHistory).not.toHaveBeenCalled();
  });

  it("keeps stale Changes visible while refreshing and debounces metadata events", async () => {
    vi.useFakeTimers();
    const firstChanges = {
      status: "ok" as const,
      repositoryRoot: "/workspace",
      currentBranch: "main",
      headCommit: null,
      items: [
        {
          path: "docs/guide.md",
          status: "modified" as const,
          documentPath: documentPayload.path,
        },
      ],
      message: null,
    };
    const secondChanges = {
      ...firstChanges,
      items: [
        ...firstChanges.items,
        {
          path: "docs/new.md",
          status: "untracked" as const,
          documentPath: "/workspace/docs/new.md",
        },
      ],
    };
    const refresh = deferred<typeof secondChanges>();
    let triggerWatch: (() => void) | undefined;
    const host = createHost();
    vi.mocked(host.getGitChanges)
      .mockResolvedValueOnce(firstChanges)
      .mockReturnValueOnce(refresh.promise);
    vi.mocked(host.watchGitStatus).mockImplementation(
      async (_paths, onChange) => {
        triggerWatch = () => onChange({ kind: "changed" });
        return { dispose: vi.fn() };
      },
    );
    let actions: SourceControlActions | undefined;

    await render(
      configWithWorkspace({
        sidebarTab: "sourceControl",
        sourceControlView: "changes",
      }),
      host,
      {
        onActions: (nextActions) => {
          actions = nextActions;
        },
      },
    );

    expect(actions?.gitChanges?.items).toHaveLength(1);
    triggerWatch?.();
    triggerWatch?.();
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(host.getGitChanges).toHaveBeenCalledTimes(2);
    expect(actions?.gitChanges?.items).toHaveLength(1);
    expect(actions?.gitChangesLoading).toBe(false);

    await act(async () => {
      refresh.resolve(secondChanges);
      await refresh.promise;
    });

    expect(actions?.gitChanges?.items).toHaveLength(2);
    vi.useRealTimers();
  });

  it("deduplicates in-flight Changes refresh requests", async () => {
    vi.useFakeTimers();
    const pending =
      deferred<Awaited<ReturnType<HostAdapter["getGitChanges"]>>>();
    let triggerWatch: (() => void) | undefined;
    const host = createHost();
    vi.mocked(host.getGitChanges).mockReturnValue(pending.promise);
    vi.mocked(host.watchGitStatus).mockImplementation(
      async (_paths, onChange) => {
        triggerWatch = () => onChange({ kind: "changed" });
        return { dispose: vi.fn() };
      },
    );

    await render(
      configWithWorkspace({
        sidebarTab: "sourceControl",
        sourceControlView: "changes",
      }),
      host,
    );
    triggerWatch?.();
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    expect(host.getGitChanges).toHaveBeenCalledTimes(1);
  });

  it("adds review mark actions to Source Control Changes context menu", async () => {
    const host = createHost();
    const markNeedsAttention = vi.fn();
    const markViewed = vi.fn();
    const resetReviewState = vi.fn();
    const openContextMenu = vi.fn() as unknown as OpenContextMenu;
    let actions: SourceControlActions | undefined;

    await render(
      configWithWorkspace({
        sidebarTab: "sourceControl",
        sourceControlView: "changes",
      }),
      host,
      {
        onActions: (nextActions) => {
          actions = nextActions;
        },
        onDocumentReviewNeedsAttention: markNeedsAttention,
        onDocumentReviewReset: resetReviewState,
        onDocumentReviewViewed: markViewed,
        openContextMenu,
      },
    );

    actions?.openSourceControlChangeContextMenu(contextMenuEvent(), {
      path: "docs/guide.md",
      documentPath: "/workspace/docs/guide.md",
      status: "modified",
    });

    const items = vi.mocked(openContextMenu).mock.calls[0]?.[1] as
      | ContextMenuItem[]
      | undefined;
    expect(items?.map((item) => item.label)).toContain("Mark viewed");
    expect(items?.map((item) => item.label)).toContain("Mark needs attention");
    expect(items?.map((item) => item.label)).toContain("Reset review state");

    items?.find((item) => item.label === "Mark needs attention")?.onSelect?.();
    expect(markNeedsAttention).toHaveBeenCalledWith("/workspace/docs/guide.md");
  });

  it("keeps the latest Git diff preview when review navigation requests overlap", async () => {
    const first =
      deferred<Awaited<ReturnType<HostAdapter["getGitDiffPreview"]>>>();
    const second =
      deferred<Awaited<ReturnType<HostAdapter["getGitDiffPreview"]>>>();
    const host = createHost();
    vi.mocked(host.getGitDiffPreview)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const setDocumentDiffPreview = vi.fn();
    const markViewed = vi.fn();
    let actions: SourceControlActions | undefined;

    await render(configWithWorkspace({ sidebarTab: "files" }), host, {
      onActions: (nextActions) => {
        actions = nextActions;
      },
      onDocumentReviewViewed: markViewed,
      setDocumentDiffPreview,
    });

    void actions?.showGitDiff("/workspace/docs/first.md");
    void actions?.showGitDiff("/workspace/docs/second.md");

    expect(setDocumentDiffPreview).toHaveBeenNthCalledWith(1, null);
    expect(setDocumentDiffPreview).toHaveBeenNthCalledWith(2, null);

    await act(async () => {
      second.resolve({
        source: "git",
        repositoryRoot: "/workspace",
        relativePath: "docs/second.md",
        leftPath: "/workspace/docs/second.md",
        rightPath: "/workspace/docs/second.md",
        status: "modified",
        leftLabel: "HEAD",
        rightLabel: "Working Tree",
        hunks: [],
      });
      await second.promise;
    });

    expect(setDocumentDiffPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({ relativePath: "docs/second.md" }),
    );
    expect(markViewed).toHaveBeenCalledWith("/workspace/docs/second.md");

    await act(async () => {
      first.resolve({
        source: "git",
        repositoryRoot: "/workspace",
        relativePath: "docs/first.md",
        leftPath: "/workspace/docs/first.md",
        rightPath: "/workspace/docs/first.md",
        status: "modified",
        leftLabel: "HEAD",
        rightLabel: "Working Tree",
        hunks: [],
      });
      await first.promise;
    });

    expect(setDocumentDiffPreview).toHaveBeenCalledTimes(3);
    expect(setDocumentDiffPreview).toHaveBeenLastCalledWith(
      expect.objectContaining({ relativePath: "docs/second.md" }),
    );
    expect(markViewed).not.toHaveBeenCalledWith("/workspace/docs/first.md");
  });

  it("deduplicates visible Changes fetch with idle warm", async () => {
    vi.useFakeTimers();
    const restoreIdleCallback = mockRequestIdleCallback();
    const pending =
      deferred<Awaited<ReturnType<HostAdapter["getGitChanges"]>>>();
    const host = createHost();
    vi.mocked(host.getGitChanges).mockReturnValue(pending.promise);

    await render(
      configWithWorkspace({
        sidebarTab: "sourceControl",
        sourceControlView: "changes",
      }),
      host,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(900);
      await vi.runOnlyPendingTimersAsync();
    });

    expect(host.getGitChanges).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve({
        status: "ok",
        repositoryRoot: "/workspace",
        currentBranch: "main",
        headCommit: null,
        items: [],
        message: null,
      });
      await pending.promise;
    });
    restoreIdleCallback();
  });

  it("deduplicates visible Changes fetch with silent metadata refresh", async () => {
    vi.useFakeTimers();
    const restoreIdleCallback = mockRequestIdleCallback();
    const pending =
      deferred<Awaited<ReturnType<HostAdapter["getGitChanges"]>>>();
    let triggerWatch: (() => void) | undefined;
    const host = createHost();
    vi.mocked(host.getGitChanges).mockReturnValue(pending.promise);
    vi.mocked(host.watchGitStatus).mockImplementation(
      async (_paths, onChange) => {
        triggerWatch = () => onChange({ kind: "changed" });
        return { dispose: vi.fn() };
      },
    );

    await render(
      configWithWorkspace({
        sidebarTab: "sourceControl",
        sourceControlView: "changes",
      }),
      host,
    );
    triggerWatch?.();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
      await vi.runOnlyPendingTimersAsync();
    });

    expect(host.getGitChanges).toHaveBeenCalledTimes(1);

    await act(async () => {
      pending.resolve({
        status: "ok",
        repositoryRoot: "/workspace",
        currentBranch: "main",
        headCommit: null,
        items: [],
        message: null,
      });
      await pending.promise;
    });
    restoreIdleCallback();
  });

  it("shows cached Branch Diff immediately when the same base is revisited", async () => {
    const firstBranchDiff = {
      status: "ok" as const,
      repositoryRoot: "/workspace",
      currentBranch: "main",
      headCommit: null,
      baseRef: "origin/main",
      headRef: "HEAD",
      mergeBase: "1111111",
      baseCandidates: ["origin/main"],
      providerBaseCandidates: [],
      items: [
        {
          path: "docs/guide.md",
          oldPath: null,
          status: "modified" as const,
          documentPath: documentPayload.path,
        },
      ],
      message: null,
    };
    const refresh = deferred<typeof firstBranchDiff>();
    const host = createHost();
    vi.mocked(host.getGitBranchDiff)
      .mockResolvedValueOnce(firstBranchDiff)
      .mockReturnValueOnce(refresh.promise);
    let actions: SourceControlActions | undefined;

    await render(
      configWithWorkspace({
        sidebarTab: "sourceControl",
        sourceControlView: "branchDiff",
        sourceControlBranchDiffBaseRef: "origin/main",
      }),
      host,
      {
        onActions: (nextActions) => {
          actions = nextActions;
        },
      },
    );
    expect(actions?.gitBranchDiff?.items).toHaveLength(1);

    await render(configWithWorkspace({ sidebarTab: "files" }), host, {
      onActions: (nextActions) => {
        actions = nextActions;
      },
    });
    await render(
      configWithWorkspace({
        sidebarTab: "sourceControl",
        sourceControlView: "branchDiff",
        sourceControlBranchDiffBaseRef: "origin/main",
      }),
      host,
      {
        onActions: (nextActions) => {
          actions = nextActions;
        },
      },
    );

    expect(host.getGitBranchDiff).toHaveBeenCalledTimes(2);
    expect(actions?.gitBranchDiff?.items).toHaveLength(1);
    expect(actions?.gitBranchDiffLoading).toBe(false);
  });

  it("opens a custom Changes context menu without Copy Status", async () => {
    const host = createHost();
    const openContextMenu = vi.fn() as unknown as OpenContextMenu &
      ReturnType<typeof vi.fn>;
    let actions: SourceControlActions | undefined;

    await render(configWithWorkspace({ sidebarTab: "files" }), host, {
      openContextMenu,
      onActions: (nextActions) => {
        actions = nextActions;
      },
    });

    expect(actions).toBeDefined();
    actions!.openSourceControlChangeContextMenu(contextMenuEvent(), {
      path: "docs/guide.md",
      status: "modified",
      documentPath: documentPayload.path,
    });

    const items = openContextMenu.mock.calls[0]?.[1] as ContextMenuItem[];
    expect(items.map((item) => item.label)).toEqual([
      "Open rendered diff",
      "Show File History",
      "Compare with Branch...",
      "Compare with Tag...",
      "Compare with Commit...",
      "Copy Path",
      "Copy Relative Path",
    ]);
  });

  it("opens a Branch Diff context menu with diff range and status copy", async () => {
    const host = createHost();
    const openContextMenu = vi.fn() as unknown as OpenContextMenu &
      ReturnType<typeof vi.fn>;
    let actions: SourceControlActions | undefined;

    await render(configWithWorkspace({ sidebarTab: "files" }), host, {
      openContextMenu,
      onActions: (nextActions) => {
        actions = nextActions;
      },
    });

    expect(actions).toBeDefined();
    actions!.openSourceControlBranchDiffContextMenu(contextMenuEvent(), {
      path: "docs/guide.md",
      oldPath: "docs/old-guide.md",
      status: "renamed",
      documentPath: documentPayload.path,
    });

    const items = openContextMenu.mock.calls[0]?.[1] as ContextMenuItem[];
    expect(items.map((item) => item.label)).toContain("Copy Old Path");
    expect(items.map((item) => item.label)).toContain("Copy Diff Range");
    expect(items.map((item) => item.label)).toContain("Copy Status");
  });

  it("opens a Repo Graph context menu with commit actions", async () => {
    const host = createHost();
    const openContextMenu = vi.fn() as unknown as OpenContextMenu &
      ReturnType<typeof vi.fn>;
    let actions: SourceControlActions | undefined;

    await render(configWithWorkspace({ sidebarTab: "files" }), host, {
      openContextMenu,
      onActions: (nextActions) => {
        actions = nextActions;
      },
    });

    expect(actions).toBeDefined();
    actions!.openSourceControlGraphContextMenu(contextMenuEvent(), {
      revision: "abcdef123456",
      shortHash: "abcdef1",
      parentRevisions: [],
      parentShortHashes: [],
      summary: "Update guide",
      author: "Developer",
      date: "2026-05-20T00:00:00.000Z",
      fileStatus: "modified",
    });

    const items = openContextMenu.mock.calls[0]?.[1] as ContextMenuItem[];
    expect(items.map((item) => item.label)).toEqual([
      "View Commit",
      "Select for Compare",
      "Copy Commit ID",
      "Copy Commit Message",
    ]);
  });
});
