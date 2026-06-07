import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import { sortedOpenTabPaths } from "../../core/workspaceState";
import type {
  AppConfig,
  DirectoryEntry,
  DocumentPayload,
  ViewerWindowOpenRequest,
  WorkspaceEnvironment,
  WorkspacePathResolutionInput,
  WorkspacePathResolution,
  WorkspaceWindowSession,
} from "../../core/types";
import type { SidebarLayoutConfig } from "../../core/layout";
import type { NavigationLocation, PaneId, ViewerPaneSnapshot } from "../types";
import {
  MAIN_WINDOW_SESSION_ID,
  normalizeConfig,
  normalizeSplitSession,
  workspaceSessionFromWorkspace,
  workspaceWithWindowSession,
} from "../lib/config";
import { createEmptyPaneSnapshot } from "../lib/split";
import { fileName, uniquePaths } from "../lib/path";
import {
  perfBasename,
  perfDuration,
  perfNow,
  tracePerf,
} from "../lib/perfTrace";

interface WorkspaceBootHost {
  authorizeDirectory(path: string): Promise<void>;
  loadConfig(): Promise<AppConfig>;
  listDirectory(path: string): Promise<DirectoryEntry[]>;
  openNewWindow(request: ViewerWindowOpenRequest): Promise<void>;
  openDocument(path: string): Promise<DocumentPayload>;
  setWindowTheme(theme: AppConfig["theme"]): Promise<void>;
  takeCurrentViewerWindowOpenRequest?(): Promise<
    ViewerWindowOpenRequest | null
  >;
  resolveWorkspacePaths(
    input: WorkspacePathResolutionInput,
  ): Promise<WorkspacePathResolution>;
}

type ViewerWindowOpenRequestHost = Pick<
  WorkspaceBootHost,
  "takeCurrentViewerWindowOpenRequest"
>;

let cachedViewerWindowOpenRequest:
  | ViewerWindowOpenRequest
  | null
  | undefined;
let pendingViewerWindowOpenRequest:
  | Promise<ViewerWindowOpenRequest | null>
  | null = null;
export const maxRestoredAdditionalWindows = 5;

interface UseWorkspaceBootOptions {
  host: WorkspaceBootHost;
  setWindowSessionId?: (sessionId: string) => void;
  setChildrenByDirectory: Dispatch<
    SetStateAction<Record<string, DirectoryEntry[]>>
  >;
  setConfig: (config: AppConfig) => void;
  setDocumentPayload: (payload: DocumentPayload | null) => void;
  setDirectoryErrors: Dispatch<SetStateAction<Record<string, string>>>;
  setError: (message: string | null) => void;
  setExpandedDirectories: (directories: Set<string>) => void;
  setFocusedPaneId: (paneId: PaneId) => void;
  setIsLoading: (loading: boolean) => void;
  setWorkspaceBootComplete: (complete: boolean) => void;
  setPaneSnapshots: (snapshots: Record<PaneId, ViewerPaneSnapshot>) => void;
  setPendingNavigationLocation: (location: NavigationLocation) => void;
  setQuery: (query: string) => void;
  setRootDirectory: (path: string) => void;
  setSidebarLayout: (layout: SidebarLayoutConfig) => void;
  setSplitEnabled: (enabled: boolean) => void;
  setSplitRatio: (ratio: number) => void;
  setTabQueries: (queries: Record<string, string>) => void;
  setTabs: Dispatch<SetStateAction<DocumentPayload[]>>;
  setWorkspaceEnvironment: (environment: WorkspaceEnvironment | null) => void;
}

export function useWorkspaceBoot({
  host,
  setWindowSessionId,
  setChildrenByDirectory,
  setConfig,
  setDocumentPayload,
  setDirectoryErrors,
  setError,
  setExpandedDirectories,
  setFocusedPaneId,
  setIsLoading,
  setWorkspaceBootComplete,
  setPaneSnapshots,
  setPendingNavigationLocation,
  setQuery,
  setRootDirectory,
  setSidebarLayout,
  setSplitEnabled,
  setSplitRatio,
  setTabQueries,
  setTabs,
  setWorkspaceEnvironment,
}: UseWorkspaceBootOptions) {
  useEffect(() => {
    let cancelled = false;
    let backgroundRestoreTimer: number | null = null;

    async function boot() {
      try {
        const bootStartedAt = perfNow();
        tracePerf("workspaceBoot.start");
        const loadConfigStartedAt = perfNow();
        const loadedConfig = await host.loadConfig();
        tracePerf("workspaceBoot.loadConfig", {
          durationMs: perfDuration(loadConfigStartedAt),
        });
        const normalizeStartedAt = perfNow();
        const nextConfig = normalizeConfig(loadedConfig);
        tracePerf("workspaceBoot.normalizeConfig", {
          durationMs: perfDuration(normalizeStartedAt),
          windowSessionCount: Object.keys(nextConfig.workspace.windowSessions)
            .length,
          restorableWindowSessionCount:
            nextConfig.workspace.restorableWindowSessionIds.length,
        });
        void host.setWindowTheme(nextConfig.theme);
        const takeRequestStartedAt = perfNow();
        const newWindowRequest = await takeViewerWindowOpenRequest(host);
        tracePerf("workspaceBoot.takeViewerWindowOpenRequest", {
          durationMs: perfDuration(takeRequestStartedAt),
          hasRequest: Boolean(newWindowRequest),
        });
        const windowSessionId =
          newWindowRequest?.sessionId ?? MAIN_WINDOW_SESSION_ID;
        setWindowSessionId?.(windowSessionId);
        const baseWorkspace = newWindowRequest
          ? {
              ...nextConfig.workspace,
              bookmarks:
                newWindowRequest.bookmarks ?? nextConfig.workspace.bookmarks,
            }
          : nextConfig.workspace;
        const launchSession = newWindowRequest
          ? workspaceSessionFromNewWindowRequest(
              newWindowRequest,
              baseWorkspace,
            )
          : null;
        const bootSession = selectWorkspaceBootSession({
          baseWorkspace,
          launchSession,
          windowSessionId,
        });
        const bootWorkspace = workspaceWithWindowSession(
          baseWorkspace,
          windowSessionId,
          bootSession,
        );
        const bootConfig = newWindowRequest
          ? {
              ...nextConfig,
              sidebarVisible:
                newWindowRequest.sidebarVisible ?? nextConfig.sidebarVisible,
              rightSidebarVisible:
                newWindowRequest.rightSidebarVisible ??
                nextConfig.rightSidebarVisible,
              layout: newWindowRequest.layout ?? nextConfig.layout,
              workspace: bootWorkspace,
            }
          : { ...nextConfig, workspace: bootWorkspace };
        const splitSession = normalizeSplitSession(
          bootWorkspace.splitSession,
        );
        const restorePaths = uniquePaths([
          ...bootWorkspace.pinnedTabs,
          ...bootWorkspace.openTabs,
          splitSession?.panePaths.left ?? "",
          splitSession?.panePaths.right ?? "",
          bootWorkspace.activePath ?? "",
        ]);
        const initialPath =
          bootWorkspace.activePath ?? restorePaths[0] ?? null;
        if (initialPath) {
          const preResolveStartedAt = perfNow();
          const preResolvedWorkspace = await host
            .resolveWorkspacePaths({
              documentPath: initialPath,
              basePath: null,
              lastDirectory: bootWorkspace.lastDirectory,
              recentDirectories: bootWorkspace.recentDirectories.map(
                (entry) => entry.path,
              ),
              expandedDirectories: [],
            })
            .catch(() => null);
          tracePerf("workspaceBoot.preResolveWorkspacePaths", {
            basename: perfBasename(initialPath),
            durationMs: perfDuration(preResolveStartedAt),
            foundDirectory: Boolean(preResolvedWorkspace?.initialDirectory),
          });
          if (preResolvedWorkspace?.initialDirectory) {
            const preAuthorizeStartedAt = perfNow();
            await host
              .authorizeDirectory(preResolvedWorkspace.initialDirectory)
              .catch(() => undefined);
            tracePerf("workspaceBoot.preAuthorizeDirectory", {
              durationMs: perfDuration(preAuthorizeStartedAt),
            });
          }
        }
        const openDocumentStartedAt = perfNow();
        const nextDocument = initialPath
          ? await host.openDocument(initialPath).catch(() => null)
          : null;
        tracePerf("workspaceBoot.openInitialDocument", {
          basename: perfBasename(initialPath),
          durationMs: perfDuration(openDocumentStartedAt),
          opened: Boolean(nextDocument),
        });
        const documentByPath = new Map<string, DocumentPayload>();
        if (nextDocument) {
          documentByPath.set(nextDocument.path, nextDocument);
        }
        const resolveStartedAt = perfNow();
        const workspacePaths = await host.resolveWorkspacePaths({
          documentPath: nextDocument?.path ?? null,
          basePath: nextDocument?.basePath ?? null,
          lastDirectory: bootWorkspace.lastDirectory,
          recentDirectories: bootWorkspace.recentDirectories.map(
            (entry) => entry.path,
          ),
          expandedDirectories: bootWorkspace.expandedDirectories,
        });
        tracePerf("workspaceBoot.resolveWorkspacePaths", {
          basename: perfBasename(nextDocument?.path ?? initialPath),
          durationMs: perfDuration(resolveStartedAt),
          expandedDirectoryCount: workspacePaths.expandedDirectories.length,
          foundDirectory: Boolean(workspacePaths.initialDirectory),
        });
        const initialDirectory = workspacePaths.initialDirectory ?? null;
        if (initialDirectory) {
          const authorizeStartedAt = perfNow();
          await host
            .authorizeDirectory(initialDirectory)
            .catch(() => undefined);
          tracePerf("workspaceBoot.authorizeDirectory", {
            durationMs: perfDuration(authorizeStartedAt),
          });
        }
        let rootEntries: DirectoryEntry[] = [];
        const nextDirectoryErrors: Record<string, string> = {};
        if (initialDirectory) {
          try {
            const listRootStartedAt = perfNow();
            rootEntries = await host.listDirectory(initialDirectory);
            tracePerf("workspaceBoot.listRootDirectory", {
              durationMs: perfDuration(listRootStartedAt),
              entryCount: rootEntries.length,
            });
          } catch (listError) {
            nextDirectoryErrors[initialDirectory] =
              listError instanceof Error
                ? listError.message
                : "Directory restore failed";
          }
        }
        const restoredExpanded = initialDirectory
          ? uniquePaths(workspacePaths.expandedDirectories)
          : [];
        const listExpandedStartedAt = perfNow();
        const restoredChildren = await Promise.all(
          restoredExpanded.map((path) =>
            host
              .listDirectory(path)
              .then((entries) => [path, entries] as const)
              .catch((listError) => {
                nextDirectoryErrors[path] =
                  listError instanceof Error
                    ? listError.message
                    : "Directory restore failed";
                return [path, []] as const;
              }),
          ),
        );
        tracePerf("workspaceBoot.listExpandedDirectories", {
          durationMs: perfDuration(listExpandedStartedAt),
          expandedDirectoryCount: restoredExpanded.length,
        });
        const tabPaths = sortedOpenTabPaths({
          ...bootWorkspace,
          openTabs: uniquePaths([
            ...bootWorkspace.openTabs,
            ...bootWorkspace.pinnedTabs,
            ...(nextDocument ? [nextDocument.path] : []),
          ]),
        }).slice(0, 12);
        const nextTabs = tabPaths
          .map((path) => documentByPath.get(path) ?? null)
          .filter((tab): tab is DocumentPayload => tab !== null);

        if (!cancelled) {
          setConfig(bootConfig);
          setSidebarLayout(bootConfig.layout);
          setRootDirectory(initialDirectory ?? "");
          setWorkspaceEnvironment(workspacePaths.environment ?? null);
          setChildrenByDirectory(
            initialDirectory
              ? {
                  [initialDirectory]: rootEntries,
                  ...Object.fromEntries(restoredChildren),
                }
              : {},
          );
          setDirectoryErrors(nextDirectoryErrors);
          setExpandedDirectories(new Set(restoredExpanded));
          setDocumentPayload(nextDocument);
          setTabs(nextTabs);
          setQuery(bootWorkspace.pinnedSearch ?? "");
          const leftDocument =
            (splitSession?.panePaths.left
              ? documentByPath.get(splitSession.panePaths.left)
              : null) ?? nextDocument;
          const rightDocument = splitSession?.panePaths.right
            ? (documentByPath.get(splitSession.panePaths.right) ?? null)
            : nextDocument;
          setSplitEnabled(
            Boolean(splitSession && leftDocument && rightDocument),
          );
          setFocusedPaneId(splitSession?.focusedPaneId ?? "left");
          setSplitRatio(splitSession?.splitRatio ?? 0.5);
          setPaneSnapshots({
            left: {
              ...createEmptyPaneSnapshot("left"),
              documentPayload: leftDocument,
              activeHeadingId: leftDocument
                ? (bootWorkspace.activeHeadingByPath[
                    leftDocument.path
                  ] ?? null)
                : null,
              query: bootWorkspace.pinnedSearch ?? "",
            },
            right: {
              ...createEmptyPaneSnapshot("right"),
              documentPayload: rightDocument,
              activeHeadingId: rightDocument
                ? (bootWorkspace.activeHeadingByPath[
                    rightDocument.path
                  ] ?? null)
                : null,
              query: bootWorkspace.pinnedSearch ?? "",
            },
          });
          setTabQueries(
            bootWorkspace.pinnedSearch && nextDocument
              ? { [nextDocument.path]: bootWorkspace.pinnedSearch }
              : {},
          );
          if (nextDocument) {
            const headingId =
              bootWorkspace.activeHeadingByPath[nextDocument.path];
            const scrollTop =
              bootWorkspace.scrollPositions[nextDocument.path];
            if (headingId || typeof scrollTop === "number") {
              setPendingNavigationLocation({
                path: nextDocument.path,
                headingId,
                scrollTop,
                label: headingId ?? fileName(nextDocument.path),
              });
            }
          }
        }

        const backgroundRestorePaths = tabPaths.filter(
          (path) => !documentByPath.has(path),
        );
        if (backgroundRestorePaths.length > 0) {
          backgroundRestoreTimer = window.setTimeout(() => {
            void (async () => {
              const restoredDocuments: DocumentPayload[] = [];
              for (const path of backgroundRestorePaths) {
                if (cancelled) {
                  return;
                }
                const restoredDocument = await host
                  .openDocument(path)
                  .catch(() => null);
                if (restoredDocument) {
                  restoredDocuments.push(restoredDocument);
                }
              }
              return restoredDocuments;
            })().then((restoredDocuments) => {
              if (cancelled) {
                return;
              }
              const restoredTabs = restoredDocuments ?? [];
              if (restoredTabs.length === 0) {
                return;
              }
              setTabs((currentTabs) => {
                const nextByPath = new Map(
                  currentTabs.map((tab) => [tab.path, tab]),
                );
                for (const tab of restoredTabs) {
                  nextByPath.set(tab.path, tab);
                }
                return tabPaths
                  .map((path) => nextByPath.get(path) ?? null)
                  .filter((tab): tab is DocumentPayload => tab !== null);
              });
            });
          }, 1_500);
        }
        if (!newWindowRequest && windowSessionId === MAIN_WINDOW_SESSION_ID) {
          const buildAdditionalStartedAt = perfNow();
          const additionalWindowRequests =
            buildAdditionalWindowRestoreRequests(bootConfig);
          tracePerf("workspaceBoot.buildAdditionalWindowRestoreRequests", {
            durationMs: perfDuration(buildAdditionalStartedAt),
            requestCount: additionalWindowRequests.length,
          });
          for (const request of additionalWindowRequests) {
            const dispatchStartedAt = perfNow();
            void host.openNewWindow(request).catch(() => undefined);
            tracePerf("workspaceBoot.dispatchAdditionalWindowRestore", {
              durationMs: perfDuration(dispatchStartedAt),
            });
          }
        }
        tracePerf("workspaceBoot.done", {
          durationMs: perfDuration(bootStartedAt),
          basename: perfBasename(nextDocument?.path ?? initialPath),
        });
      } catch (bootError) {
        setError(
          bootError instanceof Error
            ? bootError.message
            : "Failed to boot viewer",
        );
      } finally {
        setIsLoading(false);
        if (!cancelled) {
          setWorkspaceBootComplete(true);
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
      if (backgroundRestoreTimer !== null) {
        window.clearTimeout(backgroundRestoreTimer);
      }
    };
  }, []);
}

export function isRestorableAdditionalWindowSession(
  session: WorkspaceWindowSession,
): boolean {
  return Boolean(
    session.activePath || session.openTabs.length > 0 || session.lastDirectory,
  );
}

export function buildAdditionalWindowRestoreRequests(
  config: AppConfig,
): ViewerWindowOpenRequest[] {
  if (!config.experimental.restoreAdditionalWindowsOnStartup) {
    return [];
  }

  return Object.entries(config.workspace.windowSessions)
    .filter(([sessionId]) =>
      config.workspace.restorableWindowSessionIds.includes(sessionId),
    )
    .filter(([sessionId]) => sessionId !== MAIN_WINDOW_SESSION_ID)
    .filter(([, session]) => isRestorableAdditionalWindowSession(session))
    .slice(0, maxRestoredAdditionalWindows)
    .map(([sessionId, session]) => {
      const activePath = session.activePath ?? session.openTabs[0] ?? null;
      return {
        sessionId,
        path: activePath,
        activePath,
        openTabs: session.openTabs,
        pinnedTabs: session.pinnedTabs,
        recentTabs: session.recentTabs,
        scrollPositions: session.scrollPositions,
        activeHeadingByPath: session.activeHeadingByPath,
        splitSession: session.splitSession,
        rootDirectory: session.lastDirectory,
        expandedDirectories: session.expandedDirectories,
        sidebarTab: session.sidebarTab,
        sidebarVisible: config.sidebarVisible,
        rightSidebarVisible: config.rightSidebarVisible,
        layout: config.layout,
        bookmarks: config.workspace.bookmarks,
      };
    });
}

export async function takeViewerWindowOpenRequest(
  host: ViewerWindowOpenRequestHost,
): Promise<ViewerWindowOpenRequest | null> {
  if (cachedViewerWindowOpenRequest !== undefined) {
    return cachedViewerWindowOpenRequest;
  }
  pendingViewerWindowOpenRequest =
    pendingViewerWindowOpenRequest ??
    (host.takeCurrentViewerWindowOpenRequest?.().catch(() => null) ??
      Promise.resolve(null));
  cachedViewerWindowOpenRequest = await pendingViewerWindowOpenRequest;
  return cachedViewerWindowOpenRequest;
}

export function resetViewerWindowOpenRequestCacheForTest() {
  cachedViewerWindowOpenRequest = undefined;
  pendingViewerWindowOpenRequest = null;
}

export function selectWorkspaceBootSession({
  baseWorkspace,
  launchSession,
  windowSessionId,
}: {
  baseWorkspace: AppConfig["workspace"];
  launchSession: WorkspaceWindowSession | null;
  windowSessionId: string;
}): WorkspaceWindowSession {
  return (
    launchSession ??
    baseWorkspace.windowSessions[windowSessionId] ??
    baseWorkspace.windowSessions[MAIN_WINDOW_SESSION_ID] ??
    workspaceSessionFromWorkspace(baseWorkspace)
  );
}

export function workspaceSessionFromNewWindowRequest(
  request: ViewerWindowOpenRequest,
  workspace: AppConfig["workspace"],
): WorkspaceWindowSession {
  const activePath =
    request.activePath !== undefined ? request.activePath : request.path ?? null;
  const openTabs = request.openTabs ?? (request.path ? [request.path] : []);
  const pinnedTabs =
    request.pinnedTabs ?? (request.path && request.pinned ? [request.path] : []);
  const recentTabs = request.recentTabs ?? (request.path ? [request.path] : []);
  return {
    ...workspaceSessionFromWorkspace(workspace),
    activePath,
    openTabs,
    lastDirectory: request.rootDirectory ?? null,
    recentDirectories: request.rootDirectory
      ? [
          {
            path: request.rootDirectory,
            name: fileName(request.rootDirectory),
            lastOpenedAt: new Date(0).toISOString(),
          },
        ]
      : [],
    expandedDirectories: request.expandedDirectories ?? [],
    sidebarTab: request.sidebarTab ?? workspace.sidebarTab,
    recentTabs,
    pinnedTabs,
    scrollPositions: request.scrollPositions ?? {},
    activeHeadingByPath: request.activeHeadingByPath ?? {},
    pinnedSearch: null,
    splitSession: request.splitSession ?? null,
  };
}
