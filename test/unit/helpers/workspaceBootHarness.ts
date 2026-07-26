import { act, createElement, StrictMode } from "react";
import { expect, vi, type Mock } from "vitest";

import { defaultConfig } from "../../../src/core/defaultConfig";
import type {
  AppConfig,
  DirectoryEntry,
  DocumentPayload,
  ViewerWindowOpenRequest,
} from "../../../src/core/types";
import { normalizeConfig } from "../../../src/ui/lib/config";
import {
  buildAdditionalWindowRestoreRequests,
  maxRestoredAdditionalWindows,
  resetViewerWindowOpenRequestCacheForTest,
  selectWorkspaceBootSession,
  takeViewerWindowOpenRequest,
  useWorkspaceBoot,
  workspaceSessionFromNewWindowRequest,
} from "../../../src/ui/hooks/useWorkspaceBoot";
import { createReactRootHarness } from "./reactHarness";

export {
  buildAdditionalWindowRestoreRequests,
  defaultConfig,
  maxRestoredAdditionalWindows,
  normalizeConfig,
  resetViewerWindowOpenRequestCacheForTest,
  selectWorkspaceBootSession,
  takeViewerWindowOpenRequest,
  workspaceSessionFromNewWindowRequest,
};
export type {
  AppConfig,
  DirectoryEntry,
  DocumentPayload,
  ViewerWindowOpenRequest,
};

export const rootDirectory = "/workspace";
export const expandedDirectory = "/workspace/docs";
export const activeDocumentPath = "/workspace/docs/active.md";

export const rootEntries: DirectoryEntry[] = [
  {
    kind: "directory",
    name: "docs",
    path: expandedDirectory,
  },
];
export const expandedEntries: DirectoryEntry[] = [
  {
    kind: "file",
    name: "active.md",
    path: activeDocumentPath,
  },
];

export type WorkspaceBootOptions = Parameters<typeof useWorkspaceBoot>[0];
export type WorkspaceBootHost = WorkspaceBootOptions["host"];
type BootSetterKey =
  | "setChildrenByDirectory"
  | "setConfig"
  | "setDirectoryErrors"
  | "setDocumentPayload"
  | "setError"
  | "setExpandedDirectories"
  | "setFocusedPaneId"
  | "setIsLoading"
  | "setPaneSnapshots"
  | "setPendingNavigationLocation"
  | "setQuery"
  | "setRootDirectory"
  | "setSidebarLayout"
  | "setSplitEnabled"
  | "setSplitRatio"
  | "setTabQueries"
  | "setTabs"
  | "setWindowSessionId"
  | "setWorkspaceBootComplete"
  | "setWorkspaceEnvironment";
export type BootSetters = {
  [Key in BootSetterKey]: WorkspaceBootOptions[Key] & Mock;
};

export interface MountedWorkspaceBoot {
  cleanup: () => void;
  setters: BootSetters;
}

export interface Deferred<T> {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
}

export function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

export function documentPayload(path = activeDocumentPath): DocumentPayload {
  return {
    path,
    basePath: path.slice(0, path.lastIndexOf("/")),
    format: "markdown",
    source: "# Active document\n\nBoot content.",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

export function bootConfig({
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

export interface BootHostOptions {
  config?: AppConfig;
  documents?: Record<string, DocumentPayload>;
  expandedList?: DirectoryEntry[] | Promise<DirectoryEntry[]>;
  openDocument?: WorkspaceBootHost["openDocument"];
  request?: ViewerWindowOpenRequest | null;
  resolveWorkspacePaths?: WorkspaceBootHost["resolveWorkspacePaths"];
  rootList?: DirectoryEntry[] | Promise<DirectoryEntry[]>;
  setWindowTheme?: WorkspaceBootHost["setWindowTheme"];
}

export function createBootHost({
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

export function createBootSetters(): BootSetters {
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

export const mountedBootCleanups = new Set<() => void>();

export function mountWorkspaceBoot(
  host: WorkspaceBootHost,
  {
    strictMode = false,
    workspaceTreeGenerationRef,
  }: {
    strictMode?: boolean;
    workspaceTreeGenerationRef?: WorkspaceBootOptions["workspaceTreeGenerationRef"];
  } = {},
): MountedWorkspaceBoot {
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

export async function flushAsyncWork() {
  await act(async () => {
    for (let index = 0; index < 20; index += 1) {
      await Promise.resolve();
    }
  });
}

export async function resolveDeferred<T>(target: Deferred<T>, value: T) {
  await act(async () => {
    target.resolve(value);
    await Promise.resolve();
  });
  await flushAsyncWork();
}

export async function rejectDeferred<T>(target: Deferred<T>, reason: unknown) {
  await act(async () => {
    target.reject(reason);
    await Promise.resolve();
  });
  await flushAsyncWork();
}

export function stateFromDispatchCalls<T>(
  mock: ReturnType<typeof vi.fn>,
  initialState: T,
): T {
  return mock.mock.calls.reduce<T>((state, [update]) => {
    return typeof update === "function"
      ? (update as (current: T) => T)(state)
      : (update as T);
  }, initialState);
}

export function firstContentCallCounts(
  setters: ReturnType<typeof createBootSetters>,
) {
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

export function treeStateCallCounts(
  setters: ReturnType<typeof createBootSetters>,
) {
  return {
    childrenByDirectory: setters.setChildrenByDirectory.mock.calls.length,
    directoryErrors: setters.setDirectoryErrors.mock.calls.length,
    expandedDirectories: setters.setExpandedDirectories.mock.calls.length,
    rootDirectory: setters.setRootDirectory.mock.calls.length,
    workspaceEnvironment: setters.setWorkspaceEnvironment.mock.calls.length,
  };
}

export function expectFirstContentCommitted(
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
