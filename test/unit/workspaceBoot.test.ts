import { act, createElement, StrictMode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultConfig } from "../../src/core/defaultConfig";
import type {
  AppConfig,
  DirectoryEntry,
  DocumentPayload,
  ViewerWindowOpenRequest,
} from "../../src/core/types";
import { normalizeConfig } from "../../src/ui/lib/config";
import {
  buildAdditionalWindowRestoreRequests,
  maxRestoredAdditionalWindows,
  resetViewerWindowOpenRequestCacheForTest,
  selectWorkspaceBootSession,
  takeViewerWindowOpenRequest,
  useWorkspaceBoot,
  workspaceSessionFromNewWindowRequest,
} from "../../src/ui/hooks/useWorkspaceBoot";
import { createReactRootHarness } from "./helpers/reactHarness";

const rootDirectory = "/workspace";
const expandedDirectory = "/workspace/docs";
const activeDocumentPath = "/workspace/docs/active.md";

const rootEntries: DirectoryEntry[] = [
  {
    kind: "directory",
    name: "docs",
    path: expandedDirectory,
  },
];
const expandedEntries: DirectoryEntry[] = [
  {
    kind: "file",
    name: "active.md",
    path: activeDocumentPath,
  },
];

type WorkspaceBootOptions = Parameters<typeof useWorkspaceBoot>[0];
type WorkspaceBootHost = WorkspaceBootOptions["host"];

interface Deferred<T> {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

function documentPayload(path = activeDocumentPath): DocumentPayload {
  return {
    path,
    basePath: path.slice(0, path.lastIndexOf("/")),
    format: "markdown",
    source: "# Active document\n\nBoot content.",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function bootConfig({
  activePath = activeDocumentPath,
  split = true,
}: {
  activePath?: string;
  split?: boolean;
} = {}): AppConfig {
  return {
    ...defaultConfig,
    workspace: {
      ...defaultConfig.workspace,
      activePath,
      activeHeadingByPath: {
        [activePath]: "overview",
      },
      expandedDirectories: [expandedDirectory],
      lastDirectory: rootDirectory,
      openTabs: [activePath],
      pinnedSearch: "boot query",
      scrollPositions: {
        [activePath]: 96,
      },
      splitSession: split
        ? {
            enabled: true,
            focusedPaneId: "right",
            splitRatio: 0.6,
            panePaths: {
              left: activePath,
              right: activePath,
            },
          }
        : null,
      windowSessions: {},
    },
  };
}

interface BootHostOptions {
  config?: AppConfig;
  documents?: Record<string, DocumentPayload>;
  expandedList?: DirectoryEntry[] | Promise<DirectoryEntry[]>;
  openDocument?: WorkspaceBootHost["openDocument"];
  request?: ViewerWindowOpenRequest | null;
  resolveWorkspacePaths?: WorkspaceBootHost["resolveWorkspacePaths"];
  rootList?: DirectoryEntry[] | Promise<DirectoryEntry[]>;
  setWindowTheme?: WorkspaceBootHost["setWindowTheme"];
}

function createBootHost({
  config = bootConfig(),
  documents = {},
  expandedList = expandedEntries,
  openDocument,
  request = null,
  resolveWorkspacePaths,
  rootList = rootEntries,
  setWindowTheme,
}: BootHostOptions = {}) {
  const host = {
    authorizeDirectory: vi.fn(async (_path: string) => undefined),
    listDirectory: vi.fn((path: string) => {
      if (path === rootDirectory) {
        return Promise.resolve(rootList);
      }
      if (path === expandedDirectory) {
        return Promise.resolve(expandedList);
      }
      return Promise.resolve([]);
    }),
    loadConfig: vi.fn(async () => config),
    openDocument: vi.fn(
      openDocument ??
        (async (path: string) => {
          return documents[path] ?? documentPayload(path);
        }),
    ),
    openNewWindow: vi.fn(
      async (_request: ViewerWindowOpenRequest) => undefined,
    ),
    resolveWorkspacePaths: vi.fn(
      resolveWorkspacePaths ??
        (async (
          input: Parameters<WorkspaceBootHost["resolveWorkspacePaths"]>[0],
        ) => ({
          environment: {
            locationKind: "local" as const,
            performanceMode: "normal" as const,
          },
          expandedDirectories:
            input.expandedDirectories.length > 0 ? [expandedDirectory] : [],
          initialDirectory: rootDirectory,
        })),
    ),
    setWindowTheme: vi.fn(
      setWindowTheme ?? (async (_theme: AppConfig["theme"]) => undefined),
    ),
    takeCurrentViewerWindowOpenRequest: vi.fn(async () => request),
  } satisfies WorkspaceBootHost;

  return host;
}

function createBootSetters() {
  return {
    setChildrenByDirectory: vi.fn(),
    setConfig: vi.fn(),
    setDirectoryErrors: vi.fn(),
    setDocumentPayload: vi.fn(),
    setError: vi.fn(),
    setExpandedDirectories: vi.fn(),
    setFocusedPaneId: vi.fn(),
    setIsLoading: vi.fn(),
    setPaneSnapshots: vi.fn(),
    setPendingNavigationLocation: vi.fn(),
    setQuery: vi.fn(),
    setRootDirectory: vi.fn(),
    setSidebarLayout: vi.fn(),
    setSplitEnabled: vi.fn(),
    setSplitRatio: vi.fn(),
    setTabQueries: vi.fn(),
    setTabs: vi.fn(),
    setWindowSessionId: vi.fn(),
    setWorkspaceBootComplete: vi.fn(),
    setWorkspaceEnvironment: vi.fn(),
  };
}

const mountedBootCleanups = new Set<() => void>();

function mountWorkspaceBoot(
  host: WorkspaceBootHost,
  {
    strictMode = false,
    workspaceTreeGenerationRef,
  }: {
    strictMode?: boolean;
    workspaceTreeGenerationRef?: WorkspaceBootOptions["workspaceTreeGenerationRef"];
  } = {},
) {
  const setters = createBootSetters();
  const options: WorkspaceBootOptions = {
    host,
    ...setters,
    workspaceTreeGenerationRef,
  };
  const reactHarness = createReactRootHarness();

  function Probe() {
    useWorkspaceBoot(options);
    return null;
  }

  reactHarness.render(
    strictMode
      ? createElement(StrictMode, null, createElement(Probe))
      : createElement(Probe),
  );
  let mounted = true;
  const cleanup = () => {
    if (!mounted) {
      return;
    }
    mounted = false;
    mountedBootCleanups.delete(cleanup);
    reactHarness.cleanup();
  };
  mountedBootCleanups.add(cleanup);
  return { cleanup, setters };
}

async function flushAsyncWork() {
  await act(async () => {
    for (let index = 0; index < 20; index += 1) {
      await Promise.resolve();
    }
  });
}

async function resolveDeferred<T>(target: Deferred<T>, value: T) {
  await act(async () => {
    target.resolve(value);
    await Promise.resolve();
  });
  await flushAsyncWork();
}

async function rejectDeferred<T>(target: Deferred<T>, reason: unknown) {
  await act(async () => {
    target.reject(reason);
    await Promise.resolve();
  });
  await flushAsyncWork();
}

function stateFromDispatchCalls<T>(
  mock: ReturnType<typeof vi.fn>,
  initialState: T,
): T {
  return mock.mock.calls.reduce<T>((state, [update]) => {
    return typeof update === "function"
      ? (update as (current: T) => T)(state)
      : (update as T);
  }, initialState);
}

function firstContentCallCounts(setters: ReturnType<typeof createBootSetters>) {
  return {
    config: setters.setConfig.mock.calls.length,
    documentPayload: setters.setDocumentPayload.mock.calls.length,
    focusedPaneId: setters.setFocusedPaneId.mock.calls.length,
    paneSnapshots: setters.setPaneSnapshots.mock.calls.length,
    splitEnabled: setters.setSplitEnabled.mock.calls.length,
    splitRatio: setters.setSplitRatio.mock.calls.length,
    tabQueries: setters.setTabQueries.mock.calls.length,
    tabs: setters.setTabs.mock.calls.length,
  };
}

function treeStateCallCounts(setters: ReturnType<typeof createBootSetters>) {
  return {
    childrenByDirectory: setters.setChildrenByDirectory.mock.calls.length,
    directoryErrors: setters.setDirectoryErrors.mock.calls.length,
    expandedDirectories: setters.setExpandedDirectories.mock.calls.length,
    rootDirectory: setters.setRootDirectory.mock.calls.length,
    workspaceEnvironment: setters.setWorkspaceEnvironment.mock.calls.length,
  };
}

function expectFirstContentCommitted(
  setters: ReturnType<typeof createBootSetters>,
  payload: DocumentPayload,
) {
  expect(setters.setConfig).toHaveBeenCalledTimes(1);
  expect(setters.setDocumentPayload).toHaveBeenCalledWith(payload);
  expect(stateFromDispatchCalls(setters.setTabs, [])).toEqual([payload]);
  expect(setters.setSplitEnabled).toHaveBeenCalledWith(true);
  expect(setters.setFocusedPaneId).toHaveBeenCalledWith("right");
  expect(setters.setSplitRatio).toHaveBeenCalledWith(0.6);
  expect(setters.setPaneSnapshots).toHaveBeenCalledWith({
    left: expect.objectContaining({ documentPayload: payload, id: "left" }),
    right: expect.objectContaining({ documentPayload: payload, id: "right" }),
  });
  expect(setters.setIsLoading).toHaveBeenCalledWith(false);
  expect(setters.setWorkspaceBootComplete).not.toHaveBeenCalledWith(true);
}

describe("workspace boot path semantics", () => {
  afterEach(() => {
    for (const cleanup of [...mountedBootCleanups]) {
      cleanup();
    }
    resetViewerWindowOpenRequestCacheForTest();
  });

  it("commits first content before deferred root and expanded hydration settle", async () => {
    const rootList = deferred<DirectoryEntry[]>();
    const expandedList = deferred<DirectoryEntry[]>();
    const payload = documentPayload();
    const host = createBootHost({
      documents: { [payload.path]: payload },
      expandedList: expandedList.promise,
      rootList: rootList.promise,
    });
    const { setters } = mountWorkspaceBoot(host);

    await flushAsyncWork();

    expect(host.listDirectory).toHaveBeenCalledWith(rootDirectory);
    expectFirstContentCommitted(setters, payload);
    const earlyCommitCounts = firstContentCallCounts(setters);

    await resolveDeferred(rootList, rootEntries);

    expect(host.listDirectory).toHaveBeenCalledWith(expandedDirectory);
    expect(setters.setWorkspaceBootComplete).not.toHaveBeenCalledWith(true);
    expect(firstContentCallCounts(setters)).toEqual(earlyCommitCounts);

    await resolveDeferred(expandedList, expandedEntries);

    expect(
      stateFromDispatchCalls<Record<string, DirectoryEntry[]>>(
        setters.setChildrenByDirectory,
        {},
      ),
    ).toEqual({
      [expandedDirectory]: expandedEntries,
      [rootDirectory]: rootEntries,
    });
    expect(
      stateFromDispatchCalls<Record<string, string>>(
        setters.setDirectoryErrors,
        {},
      ),
    ).toEqual({});
    expect(setters.setExpandedDirectories).toHaveBeenLastCalledWith(
      new Set([expandedDirectory]),
    );
    expect(setters.setRootDirectory).toHaveBeenLastCalledWith(rootDirectory);
    expect(setters.setWorkspaceEnvironment).toHaveBeenLastCalledWith({
      locationKind: "local",
      performanceMode: "normal",
    });
    expect(setters.setWorkspaceBootComplete).toHaveBeenLastCalledWith(true);
    expect(firstContentCallCounts(setters)).toEqual(earlyCommitCounts);
  });

  it("drops stale tree hydration when the directory generation advances", async () => {
    const rootList = deferred<DirectoryEntry[]>();
    const expandedList = deferred<DirectoryEntry[]>();
    const generationRef = { current: 7 };
    const payload = documentPayload();
    const host = createBootHost({
      documents: { [payload.path]: payload },
      expandedList: expandedList.promise,
      rootList: rootList.promise,
    });
    const { setters } = mountWorkspaceBoot(host, {
      workspaceTreeGenerationRef: generationRef,
    });

    await flushAsyncWork();
    expectFirstContentCommitted(setters, payload);
    const earlyContentCalls = firstContentCallCounts(setters);
    const treeCallsBeforeCompetingDirectory = treeStateCallCounts(setters);

    generationRef.current += 1;
    await resolveDeferred(rootList, rootEntries);
    expect(host.listDirectory).toHaveBeenCalledWith(expandedDirectory);
    await resolveDeferred(expandedList, expandedEntries);

    expect(treeStateCallCounts(setters)).toEqual(
      treeCallsBeforeCompetingDirectory,
    );
    expect(firstContentCallCounts(setters)).toEqual(earlyContentCalls);
    expect(setters.setWorkspaceBootComplete).toHaveBeenLastCalledWith(true);
    expect(setters.setError).not.toHaveBeenCalled();
  });

  it("commits an empty document state when the initial open fails", async () => {
    const rootList = deferred<DirectoryEntry[]>();
    const host = createBootHost({
      openDocument: async () => {
        throw new Error("Initial document unavailable");
      },
      rootList: rootList.promise,
    });
    const { setters } = mountWorkspaceBoot(host);

    await flushAsyncWork();

    expect(host.openDocument).toHaveBeenCalledTimes(1);
    expect(setters.setConfig).toHaveBeenCalledTimes(1);
    expect(setters.setDocumentPayload).toHaveBeenCalledWith(null);
    expect(setters.setTabs).toHaveBeenCalledTimes(1);
    expect(stateFromDispatchCalls(setters.setTabs, [])).toEqual([]);
    expect(setters.setSplitEnabled).toHaveBeenCalledWith(false);
    expect(setters.setPaneSnapshots).toHaveBeenCalledWith({
      left: expect.objectContaining({ documentPayload: null, id: "left" }),
      right: expect.objectContaining({ documentPayload: null, id: "right" }),
    });
    expect(setters.setIsLoading).not.toHaveBeenCalled();
    expect(setters.setWorkspaceBootComplete).not.toHaveBeenCalledWith(true);
    expect(setters.setError).not.toHaveBeenCalled();

    await resolveDeferred(rootList, rootEntries);

    expect(setters.setIsLoading).toHaveBeenCalledWith(false);
    expect(setters.setWorkspaceBootComplete).toHaveBeenLastCalledWith(true);
    expect(setters.setDocumentPayload).toHaveBeenCalledTimes(1);
    expect(setters.setSplitEnabled).toHaveBeenCalledTimes(1);
    expect(setters.setError).not.toHaveBeenCalled();
  });

  it("keeps booting when applying the window theme rejects", async () => {
    const rootList = deferred<DirectoryEntry[]>();
    const payload = documentPayload();
    const host = createBootHost({
      documents: { [payload.path]: payload },
      rootList: rootList.promise,
      setWindowTheme: async () => {
        throw new Error("Theme unavailable");
      },
    });
    const { setters } = mountWorkspaceBoot(host);

    await flushAsyncWork();

    expect(host.setWindowTheme).toHaveBeenCalledWith("light");
    expectFirstContentCommitted(setters, payload);
    expect(setters.setError).not.toHaveBeenCalled();

    await resolveDeferred(rootList, rootEntries);

    expect(setters.setWorkspaceBootComplete).toHaveBeenLastCalledWith(true);
    expect(setters.setError).not.toHaveBeenCalled();
  });

  it("finishes loading with a global error when canonical path resolution fails", async () => {
    const payload = documentPayload();
    const host = createBootHost({
      documents: { [payload.path]: payload },
      resolveWorkspacePaths: async (input) => {
        if (input.expandedDirectories.length === 0) {
          return {
            expandedDirectories: [],
            initialDirectory: rootDirectory,
          };
        }
        throw new Error("Workspace path resolution failed");
      },
    });
    const { setters } = mountWorkspaceBoot(host);

    await flushAsyncWork();

    expect(host.resolveWorkspacePaths).toHaveBeenCalledTimes(2);
    expect(host.listDirectory).not.toHaveBeenCalled();
    expect(setters.setConfig).toHaveBeenCalledTimes(1);
    expect(setters.setDocumentPayload).toHaveBeenCalledWith(payload);
    expect(stateFromDispatchCalls(setters.setTabs, [])).toEqual([payload]);
    expect(setters.setError).toHaveBeenCalledWith(
      "Workspace path resolution failed",
    );
    expect(setters.setIsLoading).toHaveBeenLastCalledWith(false);
    expect(setters.setWorkspaceBootComplete).toHaveBeenLastCalledWith(true);
    expect(treeStateCallCounts(setters)).toEqual({
      childrenByDirectory: 0,
      directoryErrors: 0,
      expandedDirectories: 0,
      rootDirectory: 0,
      workspaceEnvironment: 0,
    });
  });

  it("ignores a stale canonical path resolution rejection after the directory generation advances", async () => {
    const canonicalResolution =
      deferred<
        Awaited<ReturnType<WorkspaceBootHost["resolveWorkspacePaths"]>>
      >();
    const generationRef = { current: 11 };
    const payload = documentPayload();
    const host = createBootHost({
      documents: { [payload.path]: payload },
      resolveWorkspacePaths: async (input) => {
        if (input.expandedDirectories.length === 0) {
          return {
            expandedDirectories: [],
            initialDirectory: rootDirectory,
          };
        }
        return canonicalResolution.promise;
      },
    });
    const { setters } = mountWorkspaceBoot(host, {
      workspaceTreeGenerationRef: generationRef,
    });

    await flushAsyncWork();

    expect(host.resolveWorkspacePaths).toHaveBeenCalledTimes(2);
    expectFirstContentCommitted(setters, payload);
    const earlyContentCalls = firstContentCallCounts(setters);
    const treeCallsBeforeCompetingDirectory = treeStateCallCounts(setters);

    generationRef.current += 1;
    await rejectDeferred(
      canonicalResolution,
      new Error("Stale workspace path resolution failed"),
    );

    expect(setters.setError).not.toHaveBeenCalled();
    expect(treeStateCallCounts(setters)).toEqual(
      treeCallsBeforeCompetingDirectory,
    );
    expect(firstContentCallCounts(setters)).toEqual(earlyContentCalls);
    expect(setters.setIsLoading).toHaveBeenLastCalledWith(false);
    expect(setters.setWorkspaceBootComplete).toHaveBeenLastCalledWith(true);
  });

  it("converges to child entries when deferred root hydration fails", async () => {
    const rootList = deferred<DirectoryEntry[]>();
    const host = createBootHost({
      rootList: rootList.promise,
    });
    const { setters } = mountWorkspaceBoot(host);

    await flushAsyncWork();
    await rejectDeferred(rootList, new Error("Root directory unavailable"));

    expect(
      stateFromDispatchCalls<Record<string, DirectoryEntry[]>>(
        setters.setChildrenByDirectory,
        {},
      ),
    ).toEqual({
      [expandedDirectory]: expandedEntries,
      [rootDirectory]: [],
    });
    expect(
      stateFromDispatchCalls<Record<string, string>>(
        setters.setDirectoryErrors,
        {},
      ),
    ).toEqual({
      [rootDirectory]: "Root directory unavailable",
    });
    expect(setters.setError).not.toHaveBeenCalled();
    expect(setters.setWorkspaceBootComplete).toHaveBeenLastCalledWith(true);
  });

  it("keeps root entries when deferred expanded child hydration fails", async () => {
    const expandedList = deferred<DirectoryEntry[]>();
    const host = createBootHost({
      expandedList: expandedList.promise,
    });
    const { setters } = mountWorkspaceBoot(host);

    await flushAsyncWork();
    expect(host.listDirectory).toHaveBeenCalledWith(expandedDirectory);
    await rejectDeferred(
      expandedList,
      new Error("Expanded directory unavailable"),
    );

    expect(
      stateFromDispatchCalls<Record<string, DirectoryEntry[]>>(
        setters.setChildrenByDirectory,
        {},
      ),
    ).toEqual({
      [expandedDirectory]: [],
      [rootDirectory]: rootEntries,
    });
    expect(
      stateFromDispatchCalls<Record<string, string>>(
        setters.setDirectoryErrors,
        {},
      ),
    ).toEqual({
      [expandedDirectory]: "Expanded directory unavailable",
    });
    expect(setters.setError).not.toHaveBeenCalled();
    expect(setters.setWorkspaceBootComplete).toHaveBeenLastCalledWith(true);
  });

  it("does not commit deferred tree state after unmount", async () => {
    const expandedList = deferred<DirectoryEntry[]>();
    const payload = documentPayload();
    const host = createBootHost({
      documents: { [payload.path]: payload },
      expandedList: expandedList.promise,
    });
    const { cleanup, setters } = mountWorkspaceBoot(host);

    await flushAsyncWork();
    expect(host.listDirectory).toHaveBeenCalledWith(expandedDirectory);
    expectFirstContentCommitted(setters, payload);
    const callsBeforeUnmount = Object.fromEntries(
      Object.entries(setters).map(([name, setter]) => [
        name,
        setter.mock.calls.length,
      ]),
    );

    cleanup();
    await rejectDeferred(expandedList, new Error("Cancelled tree request"));

    expect(
      Object.fromEntries(
        Object.entries(setters).map(([name, setter]) => [
          name,
          setter.mock.calls.length,
        ]),
      ),
    ).toEqual(callsBeforeUnmount);
    expect(setters.setError).not.toHaveBeenCalled();
    expect(setters.setWorkspaceBootComplete).not.toHaveBeenCalledWith(true);
  });

  it("restores a new-window session and split snapshot through the mounted hook", async () => {
    const targetPath = "/workspace/docs/new-window.md";
    const payload = documentPayload(targetPath);
    const requestLayout = {
      leftSidebarWidth: 312,
      rightSidebarWidth: 356,
      openFilesHeight: 188,
      openFilesCollapsed: true,
    };
    const request: ViewerWindowOpenRequest = {
      sessionId: "viewer-1",
      path: targetPath,
      activePath: targetPath,
      openTabs: [targetPath],
      pinnedTabs: [targetPath],
      recentTabs: [targetPath],
      scrollPositions: { [targetPath]: 144 },
      activeHeadingByPath: { [targetPath]: "new-window-heading" },
      splitSession: {
        enabled: true,
        focusedPaneId: "right",
        splitRatio: 0.6,
        panePaths: {
          left: targetPath,
          right: targetPath,
        },
      },
      rootDirectory,
      expandedDirectories: [expandedDirectory],
      sidebarTab: "bookmarks",
      sidebarVisible: false,
      rightSidebarVisible: true,
      layout: requestLayout,
      bookmarks: [{ kind: "directory", path: expandedDirectory }],
    };
    const host = createBootHost({
      config: bootConfig({ activePath: "/workspace/docs/stale.md" }),
      documents: { [targetPath]: payload },
      request,
    });
    const { setters } = mountWorkspaceBoot(host);

    await flushAsyncWork();

    expect(setters.setWindowSessionId).toHaveBeenCalledWith("viewer-1");
    expect(setters.setConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        layout: requestLayout,
        sidebarVisible: false,
        workspace: expect.objectContaining({
          activePath: targetPath,
          expandedDirectories: [expandedDirectory],
          lastDirectory: rootDirectory,
          openTabs: [targetPath],
          pinnedTabs: [targetPath],
        }),
      }),
    );
    expect(setters.setDocumentPayload).toHaveBeenCalledWith(payload);
    expect(setters.setSidebarLayout).toHaveBeenCalledWith(requestLayout);
    expect(setters.setSplitEnabled).toHaveBeenCalledWith(true);
    expect(setters.setFocusedPaneId).toHaveBeenCalledWith("right");
    expect(setters.setSplitRatio).toHaveBeenCalledWith(0.6);
    expect(setters.setPendingNavigationLocation).toHaveBeenCalledWith({
      headingId: "new-window-heading",
      label: "new-window-heading",
      path: targetPath,
      scrollTop: 144,
    });
    expect(setters.setWorkspaceBootComplete).toHaveBeenLastCalledWith(true);
    expect(host.openNewWindow).not.toHaveBeenCalled();
  });

  it("defaults omitted optional fields in a minimal new-window request", async () => {
    const targetPath = "/workspace/docs/minimal-window.md";
    const payload = documentPayload(targetPath);
    const request: ViewerWindowOpenRequest = {
      sessionId: "viewer-minimal",
      path: targetPath,
      rootDirectory,
      expandedDirectories: [expandedDirectory],
      sidebarTab: "files",
      bookmarks: [],
    };
    const config = bootConfig({ activePath: "/workspace/docs/stale.md" });
    const host = createBootHost({
      config,
      documents: { [targetPath]: payload },
      request,
    });
    const { setters } = mountWorkspaceBoot(host);

    await flushAsyncWork();

    expect(setters.setWindowSessionId).toHaveBeenCalledWith("viewer-minimal");
    expect(setters.setConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        layout: config.layout,
        rightSidebarVisible: config.rightSidebarVisible,
        sidebarVisible: config.sidebarVisible,
        workspace: expect.objectContaining({
          activePath: targetPath,
          openTabs: [targetPath],
          pinnedTabs: [],
          recentTabs: [targetPath],
          splitSession: null,
        }),
      }),
    );
    expect(setters.setDocumentPayload).toHaveBeenCalledWith(payload);
    expect(setters.setSplitEnabled).toHaveBeenCalledWith(false);
    expect(setters.setFocusedPaneId).toHaveBeenCalledWith("left");
    expect(setters.setSplitRatio).toHaveBeenCalledWith(0.5);
    expect(setters.setPendingNavigationLocation).not.toHaveBeenCalled();
    expect(setters.setWorkspaceBootComplete).toHaveBeenLastCalledWith(true);
  });

  it("keeps an empty new-window request empty instead of restoring its saved session", async () => {
    const stalePath = "/workspace/docs/saved-viewer.md";
    const baseConfig = normalizeConfig(bootConfig({ activePath: stalePath }));
    const config: AppConfig = {
      ...baseConfig,
      workspace: {
        ...baseConfig.workspace,
        windowSessions: {
          ...baseConfig.workspace.windowSessions,
          "viewer-empty": {
            ...baseConfig.workspace.windowSessions.main,
            activePath: stalePath,
            openTabs: [stalePath],
            recentTabs: [stalePath],
          },
        },
      },
    };
    const request: ViewerWindowOpenRequest = {
      sessionId: "viewer-empty",
      path: null,
      rootDirectory,
      expandedDirectories: [expandedDirectory],
      sidebarTab: "bookmarks",
      bookmarks: [],
    };
    const host = createBootHost({ config, request });
    const { setters } = mountWorkspaceBoot(host);

    await flushAsyncWork();

    expect(host.openDocument).not.toHaveBeenCalled();
    expect(setters.setWindowSessionId).toHaveBeenCalledWith("viewer-empty");
    expect(setters.setConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: expect.objectContaining({
          activePath: null,
          openTabs: [],
          recentTabs: [],
        }),
      }),
    );
    expect(setters.setDocumentPayload).toHaveBeenCalledWith(null);
    expect(setters.setTabs).toHaveBeenCalledTimes(1);
    expect(stateFromDispatchCalls(setters.setTabs, [])).toEqual([]);
    expect(setters.setSplitEnabled).toHaveBeenCalledWith(false);
    expect(setters.setWorkspaceBootComplete).toHaveBeenLastCalledWith(true);
  });

  it("reuses the same new-window request across a StrictMode remount", async () => {
    const targetPath = "/workspace/docs/strict-window.md";
    const payload = documentPayload(targetPath);
    const request: ViewerWindowOpenRequest = {
      sessionId: "viewer-strict",
      path: targetPath,
      rootDirectory,
      expandedDirectories: [expandedDirectory],
      sidebarTab: "files",
      bookmarks: [],
    };
    const host = createBootHost({
      config: bootConfig({ activePath: "/workspace/docs/main.md" }),
      documents: { [targetPath]: payload },
      request,
    });
    const { setters } = mountWorkspaceBoot(host, { strictMode: true });

    await flushAsyncWork();

    expect(host.takeCurrentViewerWindowOpenRequest).toHaveBeenCalledTimes(1);
    expect(setters.setConfig).toHaveBeenCalledTimes(1);
    expect(setters.setDocumentPayload).toHaveBeenCalledTimes(1);
    expect(setters.setDocumentPayload).toHaveBeenCalledWith(payload);
    expect(stateFromDispatchCalls(setters.setTabs, [])).toEqual([payload]);
    expect(setters.setIsLoading).toHaveBeenCalledTimes(1);
    expect(setters.setIsLoading).toHaveBeenCalledWith(false);
    expect(setters.setWorkspaceBootComplete).toHaveBeenCalledTimes(1);
    expect(setters.setWorkspaceBootComplete).toHaveBeenCalledWith(true);
    expect(host.openNewWindow).not.toHaveBeenCalled();
  });

  it("caches the viewer window launch request across StrictMode remounts", async () => {
    const request = {
      sessionId: "viewer-1",
      path: "/workspace/docs/target.md",
      rootDirectory: "/workspace",
      expandedDirectories: ["/workspace/docs"],
      sidebarTab: "files" as const,
      sidebarVisible: false,
      rightSidebarVisible: true,
      layout: {
        leftSidebarWidth: 300,
        rightSidebarWidth: 340,
        openFilesHeight: 180,
        openFilesCollapsed: true,
      },
      bookmarks: [],
    };
    const takeCurrentViewerWindowOpenRequest = vi
      .fn()
      .mockResolvedValueOnce(request)
      .mockResolvedValueOnce(null);

    await expect(
      takeViewerWindowOpenRequest({ takeCurrentViewerWindowOpenRequest }),
    ).resolves.toEqual(request);
    await expect(
      takeViewerWindowOpenRequest({ takeCurrentViewerWindowOpenRequest }),
    ).resolves.toEqual(request);
    expect(takeCurrentViewerWindowOpenRequest).toHaveBeenCalledTimes(1);
  });

  it("shares the in-flight viewer window launch request across concurrent boots", async () => {
    const request = {
      sessionId: "viewer-1",
      path: "/workspace/docs/target.md",
      rootDirectory: "/workspace",
      expandedDirectories: ["/workspace/docs"],
      sidebarTab: "files" as const,
      sidebarVisible: false,
      rightSidebarVisible: true,
      layout: {
        leftSidebarWidth: 300,
        rightSidebarWidth: 340,
        openFilesHeight: 180,
        openFilesCollapsed: true,
      },
      bookmarks: [],
    };
    const takeCurrentViewerWindowOpenRequest = vi
      .fn()
      .mockResolvedValue(request);

    await expect(
      Promise.all([
        takeViewerWindowOpenRequest({ takeCurrentViewerWindowOpenRequest }),
        takeViewerWindowOpenRequest({ takeCurrentViewerWindowOpenRequest }),
      ]),
    ).resolves.toEqual([request, request]);
    expect(takeCurrentViewerWindowOpenRequest).toHaveBeenCalledTimes(1);
  });

  it("defaults missing recentTabs to an empty normalized window session field", () => {
    const baseSession =
      normalizeConfig(defaultConfig).workspace.windowSessions.main;
    const normalized = normalizeConfig({
      ...defaultConfig,
      workspace: {
        ...defaultConfig.workspace,
        recentTabs: undefined as unknown as string[],
        windowSessions: {
          main: {
            ...baseSession,
            recentTabs: undefined as unknown as string[],
          },
        },
        restorableWindowSessionIds: ["viewer-restore-1"],
      },
    });

    expect(normalized.workspace.recentTabs).toEqual([]);
    expect(normalized.workspace.windowSessions.main.recentTabs).toEqual([]);
  });

  it("uses an empty launch request instead of restoring a saved viewer session", () => {
    const workspace = normalizeConfig(defaultConfig).workspace;
    const savedSession = {
      ...workspace.windowSessions.main,
      activePath: "/workspace/docs/current.md",
      openTabs: ["/workspace/docs/current.md"],
      recentTabs: ["/workspace/docs/current.md"],
    };
    const baseWorkspace = {
      ...workspace,
      windowSessions: {
        ...workspace.windowSessions,
        "viewer-1": savedSession,
      },
    };
    const launchSession = workspaceSessionFromNewWindowRequest(
      {
        sessionId: "viewer-1",
        path: null,
        rootDirectory: "/workspace",
        expandedDirectories: ["/workspace/docs"],
        sidebarTab: "bookmarks",
        sidebarVisible: false,
        rightSidebarVisible: true,
        layout: {
          leftSidebarWidth: 300,
          rightSidebarWidth: 340,
          openFilesHeight: 180,
          openFilesCollapsed: true,
        },
        bookmarks: [
          {
            kind: "directory",
            path: "/workspace/docs",
          },
        ],
      },
      baseWorkspace,
    );

    expect(
      selectWorkspaceBootSession({
        baseWorkspace,
        launchSession,
        windowSessionId: "viewer-1",
      }),
    ).toMatchObject({
      activePath: null,
      openTabs: [],
      lastDirectory: "/workspace",
      expandedDirectories: ["/workspace/docs"],
      sidebarTab: "bookmarks",
    });
  });

  it("uses the launch target path instead of restoring the current saved document", () => {
    const workspace = normalizeConfig(defaultConfig).workspace;
    const baseWorkspace = {
      ...workspace,
      windowSessions: {
        ...workspace.windowSessions,
        "viewer-1": {
          ...workspace.windowSessions.main,
          activePath: "/workspace/docs/current.md",
          openTabs: ["/workspace/docs/current.md"],
          recentTabs: ["/workspace/docs/current.md"],
        },
      },
    };
    const launchSession = workspaceSessionFromNewWindowRequest(
      {
        sessionId: "viewer-1",
        path: "/workspace/docs/right-click-target.md",
        rootDirectory: "/workspace",
        expandedDirectories: ["/workspace/docs"],
        sidebarTab: "files",
        sidebarVisible: false,
        rightSidebarVisible: true,
        layout: {
          leftSidebarWidth: 300,
          rightSidebarWidth: 340,
          openFilesHeight: 180,
          openFilesCollapsed: true,
        },
        bookmarks: [],
      },
      baseWorkspace,
    );

    expect(
      selectWorkspaceBootSession({
        baseWorkspace,
        launchSession,
        windowSessionId: "viewer-1",
      }),
    ).toMatchObject({
      activePath: "/workspace/docs/right-click-target.md",
      openTabs: ["/workspace/docs/right-click-target.md"],
      recentTabs: ["/workspace/docs/right-click-target.md"],
    });
  });

  it("keeps moved pinned tabs pinned in the new window launch session", () => {
    const workspace = normalizeConfig(defaultConfig).workspace;
    const launchSession = workspaceSessionFromNewWindowRequest(
      {
        sessionId: "viewer-1",
        path: "/workspace/docs/pinned-target.md",
        rootDirectory: "/workspace",
        expandedDirectories: ["/workspace/docs"],
        sidebarTab: "files",
        pinned: true,
        bookmarks: [],
      },
      workspace,
    );

    expect(launchSession).toMatchObject({
      activePath: "/workspace/docs/pinned-target.md",
      openTabs: ["/workspace/docs/pinned-target.md"],
      pinnedTabs: ["/workspace/docs/pinned-target.md"],
      recentTabs: ["/workspace/docs/pinned-target.md"],
    });
  });

  it("uses Duplicate Window session snapshot when provided", () => {
    const workspace = normalizeConfig(defaultConfig).workspace;
    const launchSession = workspaceSessionFromNewWindowRequest(
      {
        sessionId: "viewer-1",
        path: "/workspace/docs/current.md",
        activePath: "/workspace/docs/current.md",
        openTabs: ["/workspace/docs/current.md", "/workspace/docs/other.md"],
        pinnedTabs: ["/workspace/docs/current.md"],
        recentTabs: ["/workspace/docs/current.md", "/workspace/docs/other.md"],
        scrollPositions: {
          "/workspace/docs/current.md": 240,
        },
        activeHeadingByPath: {
          "/workspace/docs/current.md": "overview",
        },
        splitSession: null,
        rootDirectory: "/workspace",
        expandedDirectories: ["/workspace/docs"],
        sidebarTab: "files",
        bookmarks: [],
      },
      workspace,
    );

    expect(launchSession).toMatchObject({
      activePath: "/workspace/docs/current.md",
      openTabs: ["/workspace/docs/current.md", "/workspace/docs/other.md"],
      pinnedTabs: ["/workspace/docs/current.md"],
      recentTabs: ["/workspace/docs/current.md", "/workspace/docs/other.md"],
      scrollPositions: {
        "/workspace/docs/current.md": 240,
      },
      activeHeadingByPath: {
        "/workspace/docs/current.md": "overview",
      },
    });
  });

  it("does not build additional window restore requests when disabled", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      experimental: {
        ...defaultConfig.experimental,
        restoreAdditionalWindowsOnStartup: false,
      },
    });

    expect(buildAdditionalWindowRestoreRequests(config)).toEqual([]);
  });

  it("builds additional window restore requests from non-main sessions", () => {
    const mainSession =
      normalizeConfig(defaultConfig).workspace.windowSessions.main;
    const config = normalizeConfig({
      ...defaultConfig,
      sidebarVisible: false,
      rightSidebarVisible: true,
      layout: {
        ...defaultConfig.layout,
        leftSidebarWidth: 320,
      },
      experimental: {
        ...defaultConfig.experimental,
        restoreAdditionalWindowsOnStartup: true,
      },
      workspace: {
        ...defaultConfig.workspace,
        bookmarks: [
          {
            kind: "file",
            path: "/workspace/docs/current.md",
          },
        ],
        windowSessions: {
          main: {
            ...mainSession,
            activePath: "/workspace/docs/main.md",
            openTabs: ["/workspace/docs/main.md"],
          },
          "viewer-restore-1": {
            ...mainSession,
            activePath: "/workspace/docs/current.md",
            openTabs: [
              "/workspace/docs/current.md",
              "/workspace/docs/other.md",
            ],
            pinnedTabs: ["/workspace/docs/current.md"],
            recentTabs: [
              "/workspace/docs/current.md",
              "/workspace/docs/other.md",
            ],
            scrollPositions: {
              "/workspace/docs/current.md": 240,
            },
            activeHeadingByPath: {
              "/workspace/docs/current.md": "overview",
            },
            splitSession: {
              enabled: true,
              focusedPaneId: "right",
              splitRatio: 0.55,
              panePaths: {
                left: "/workspace/docs/current.md",
                right: "/workspace/docs/other.md",
              },
            },
            lastDirectory: "/workspace",
            expandedDirectories: ["/workspace/docs"],
            sidebarTab: "bookmarks",
          },
        },
        restorableWindowSessionIds: ["viewer-restore-1"],
      },
    });

    expect(buildAdditionalWindowRestoreRequests(config)).toEqual([
      expect.objectContaining({
        sessionId: "viewer-restore-1",
        path: "/workspace/docs/current.md",
        activePath: "/workspace/docs/current.md",
        openTabs: ["/workspace/docs/current.md", "/workspace/docs/other.md"],
        pinnedTabs: ["/workspace/docs/current.md"],
        recentTabs: ["/workspace/docs/current.md", "/workspace/docs/other.md"],
        scrollPositions: {
          "/workspace/docs/current.md": 240,
        },
        activeHeadingByPath: {
          "/workspace/docs/current.md": "overview",
        },
        splitSession: expect.objectContaining({
          enabled: true,
          focusedPaneId: "right",
        }),
        rootDirectory: "/workspace",
        expandedDirectories: ["/workspace/docs"],
        sidebarTab: "bookmarks",
        sidebarVisible: false,
        rightSidebarVisible: true,
        layout: expect.objectContaining({
          leftSidebarWidth: 320,
        }),
        bookmarks: [
          {
            kind: "file",
            path: "/workspace/docs/current.md",
          },
        ],
      }),
    ]);
  });

  it("skips empty additional sessions and caps restore requests", () => {
    const mainSession =
      normalizeConfig(defaultConfig).workspace.windowSessions.main;
    const sessions = Object.fromEntries(
      Array.from({ length: maxRestoredAdditionalWindows + 2 }, (_, index) => [
        `viewer-${index}`,
        {
          ...mainSession,
          activePath: `/workspace/docs/${index}.md`,
          openTabs: [`/workspace/docs/${index}.md`],
        },
      ]),
    );
    const config = normalizeConfig({
      ...defaultConfig,
      experimental: {
        ...defaultConfig.experimental,
        restoreAdditionalWindowsOnStartup: true,
      },
      workspace: {
        ...defaultConfig.workspace,
        windowSessions: {
          main: {
            ...mainSession,
            activePath: "/workspace/docs/main.md",
            openTabs: ["/workspace/docs/main.md"],
          },
          empty: mainSession,
          ...sessions,
        },
        restorableWindowSessionIds: ["main", "empty", ...Object.keys(sessions)],
      },
    });

    const requests = buildAdditionalWindowRestoreRequests(config);

    expect(requests).toHaveLength(maxRestoredAdditionalWindows);
    expect(requests.map((request) => request.sessionId)).not.toContain("main");
    expect(requests.map((request) => request.sessionId)).not.toContain("empty");
  });

  it("does not restore stale non-main sessions outside the restore list", () => {
    const mainSession =
      normalizeConfig(defaultConfig).workspace.windowSessions.main;
    const config = normalizeConfig({
      ...defaultConfig,
      experimental: {
        ...defaultConfig.experimental,
        restoreAdditionalWindowsOnStartup: true,
      },
      workspace: {
        ...defaultConfig.workspace,
        windowSessions: {
          main: mainSession,
          "viewer-stale": {
            ...mainSession,
            activePath: "/workspace/docs/stale.md",
            openTabs: ["/workspace/docs/stale.md"],
          },
        },
        restorableWindowSessionIds: [],
      },
    });

    expect(buildAdditionalWindowRestoreRequests(config)).toEqual([]);
  });
});
