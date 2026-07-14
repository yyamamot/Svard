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

const envScreenshotFixture = import.meta.env
  .VITE_SVARD_SITE_SCREENSHOT_FIXTURE as string | undefined;

interface WorkspaceBootHost {
  authorizeDirectory(path: string): Promise<void>;
  loadConfig(): Promise<AppConfig>;
  listDirectory(path: string): Promise<DirectoryEntry[]>;
  openNewWindow(request: ViewerWindowOpenRequest): Promise<void>;
  openDocument(path: string): Promise<DocumentPayload>;
  setWindowTheme(theme: AppConfig["theme"]): Promise<void>;
  takeCurrentViewerWindowOpenRequest?(): Promise<ViewerWindowOpenRequest | null>;
  resolveWorkspacePaths(
    input: WorkspacePathResolutionInput,
  ): Promise<WorkspacePathResolution>;
}

type ViewerWindowOpenRequestHost = Pick<
  WorkspaceBootHost,
  "takeCurrentViewerWindowOpenRequest"
>;

let cachedViewerWindowOpenRequest: ViewerWindowOpenRequest | null | undefined;
let pendingViewerWindowOpenRequest: Promise<ViewerWindowOpenRequest | null> | null =
  null;
export const maxRestoredAdditionalWindows = 5;

interface UseWorkspaceBootOptions {
  host: WorkspaceBootHost;
  workspaceTreeGenerationRef?: { current: number };
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
  workspaceTreeGenerationRef,
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
    const bootTreeGeneration = workspaceTreeGenerationRef?.current ?? 0;

    async function boot() {
      let treeHydrationStartedAt: number | null = null;
      let loadingReleased = false;
      try {
        const bootStartedAt = perfNow();
        tracePerf("workspaceBoot.start");
        const loadConfigStartedAt = perfNow();
        const loadedConfig = await host.loadConfig();
        if (cancelled) {
          return;
        }
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
        try {
          void host.setWindowTheme(nextConfig.theme).catch(() => undefined);
        } catch {
          // Theme application is best-effort and must not block first content.
        }
        const takeRequestStartedAt = perfNow();
        const newWindowRequest = await takeViewerWindowOpenRequest(host);
        if (cancelled) {
          return;
        }
        tracePerf("workspaceBoot.takeViewerWindowOpenRequest", {
          durationMs: perfDuration(takeRequestStartedAt),
          hasRequest: Boolean(newWindowRequest),
        });
        const windowSessionId =
          newWindowRequest?.sessionId ?? MAIN_WINDOW_SESSION_ID;
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
        const effectiveBootWorkspace = envScreenshotFixture
          ? {
              ...bootWorkspace,
              activePath: envScreenshotFixture,
              openTabs: [envScreenshotFixture],
              pinnedTabs: [],
            }
          : bootWorkspace;
        const bootConfig = newWindowRequest
          ? {
              ...nextConfig,
              sidebarVisible:
                newWindowRequest.sidebarVisible ?? nextConfig.sidebarVisible,
              rightSidebarVisible:
                newWindowRequest.rightSidebarVisible ??
                nextConfig.rightSidebarVisible,
              layout: newWindowRequest.layout ?? nextConfig.layout,
              workspace: effectiveBootWorkspace,
            }
          : { ...nextConfig, workspace: effectiveBootWorkspace };
        const splitSession = normalizeSplitSession(
          effectiveBootWorkspace.splitSession,
        );
        const restorePaths = uniquePaths([
          ...effectiveBootWorkspace.pinnedTabs,
          ...effectiveBootWorkspace.openTabs,
          splitSession?.panePaths.left ?? "",
          splitSession?.panePaths.right ?? "",
          effectiveBootWorkspace.activePath ?? "",
        ]);
        const initialPath =
          effectiveBootWorkspace.activePath ?? restorePaths[0] ?? null;

        if (cancelled) {
          return;
        }
        setWindowSessionId?.(windowSessionId);
        setConfig(bootConfig);
        setSidebarLayout(bootConfig.layout);

        if (initialPath) {
          const preResolveStartedAt = perfNow();
          const preResolvedWorkspace = await host
            .resolveWorkspacePaths({
              documentPath: initialPath,
              basePath: null,
              lastDirectory: effectiveBootWorkspace.lastDirectory,
              recentDirectories: effectiveBootWorkspace.recentDirectories.map(
                (entry) => entry.path,
              ),
              expandedDirectories: [],
            })
            .catch(() => null);
          if (cancelled) {
            return;
          }
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
            if (cancelled) {
              return;
            }
            tracePerf("workspaceBoot.preAuthorizeDirectory", {
              durationMs: perfDuration(preAuthorizeStartedAt),
            });
          }
        }
        const openDocumentStartedAt = perfNow();
        let initialDocumentStatus: "opened" | "empty" | "error" = "empty";
        let nextDocument: DocumentPayload | null = null;
        if (initialPath) {
          try {
            nextDocument = await host.openDocument(initialPath);
            initialDocumentStatus = "opened";
          } catch {
            initialDocumentStatus = "error";
          }
        }
        if (cancelled) {
          return;
        }
        const initialDocumentOpenDurationMs = perfDuration(
          openDocumentStartedAt,
        );
        tracePerf("workspaceBoot.openInitialDocument", {
          basename: perfBasename(initialPath),
          durationMs: initialDocumentOpenDurationMs,
          opened: Boolean(nextDocument),
        });
        tracePerf("workspaceBoot.initialDocumentOpened", {
          durationMs: initialDocumentOpenDurationMs,
          status: initialDocumentStatus,
        });
        const documentByPath = new Map<string, DocumentPayload>();
        if (nextDocument) {
          documentByPath.set(nextDocument.path, nextDocument);
        }
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
        const leftDocument =
          (splitSession?.panePaths.left
            ? documentByPath.get(splitSession.panePaths.left)
            : null) ?? nextDocument;
        const rightDocument = splitSession?.panePaths.right
          ? (documentByPath.get(splitSession.panePaths.right) ?? null)
          : nextDocument;

        if (cancelled) {
          return;
        }
        setDocumentPayload(nextDocument);
        setTabs(nextTabs);
        setQuery(bootWorkspace.pinnedSearch ?? "");
        setSplitEnabled(Boolean(splitSession && leftDocument && rightDocument));
        setFocusedPaneId(splitSession?.focusedPaneId ?? "left");
        setSplitRatio(splitSession?.splitRatio ?? 0.5);
        setPaneSnapshots({
          left: {
            ...createEmptyPaneSnapshot("left"),
            documentPayload: leftDocument,
            activeHeadingId: leftDocument
              ? (bootWorkspace.activeHeadingByPath[leftDocument.path] ?? null)
              : null,
            query: bootWorkspace.pinnedSearch ?? "",
          },
          right: {
            ...createEmptyPaneSnapshot("right"),
            documentPayload: rightDocument,
            activeHeadingId: rightDocument
              ? (bootWorkspace.activeHeadingByPath[rightDocument.path] ?? null)
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
          const scrollTop = bootWorkspace.scrollPositions[nextDocument.path];
          if (headingId || typeof scrollTop === "number") {
            setPendingNavigationLocation({
              path: nextDocument.path,
              headingId,
              scrollTop,
              label: headingId ?? fileName(nextDocument.path),
            });
          }
          setIsLoading(false);
          loadingReleased = true;
        }

        treeHydrationStartedAt = perfNow();
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
        if (cancelled) {
          return;
        }
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
          if (cancelled) {
            return;
          }
          tracePerf("workspaceBoot.authorizeDirectory", {
            durationMs: perfDuration(authorizeStartedAt),
          });
        }
        let rootEntries: DirectoryEntry[] = [];
        const nextDirectoryErrors: Record<string, string> = {};
        const listRootStartedAt = perfNow();
        let rootDirectoryStatus: "ok" | "error" | "skipped" = "skipped";
        if (initialDirectory) {
          try {
            rootEntries = await host.listDirectory(initialDirectory);
            if (cancelled) {
              return;
            }
            rootDirectoryStatus = "ok";
            tracePerf("workspaceBoot.listRootDirectory", {
              durationMs: perfDuration(listRootStartedAt),
              entryCount: rootEntries.length,
            });
          } catch (listError) {
            rootDirectoryStatus = "error";
            nextDirectoryErrors[initialDirectory] =
              listError instanceof Error
                ? listError.message
                : "Directory restore failed";
          }
        }
        if (cancelled) {
          return;
        }
        tracePerf("workspaceBoot.rootDirectoryReady", {
          durationMs: perfDuration(listRootStartedAt),
          entryCount: rootEntries.length,
          status: rootDirectoryStatus,
        });
        const restoredExpanded = initialDirectory
          ? uniquePaths(workspacePaths.expandedDirectories)
          : [];
        const listExpandedStartedAt = perfNow();
        let expandedDirectoryErrorCount = 0;
        const restoredChildren = await Promise.all(
          restoredExpanded.map((path) =>
            host
              .listDirectory(path)
              .then((entries) => [path, entries] as const)
              .catch((listError) => {
                expandedDirectoryErrorCount += 1;
                nextDirectoryErrors[path] =
                  listError instanceof Error
                    ? listError.message
                    : "Directory restore failed";
                return [path, []] as const;
              }),
          ),
        );
        if (cancelled) {
          return;
        }
        tracePerf("workspaceBoot.listExpandedDirectories", {
          durationMs: perfDuration(listExpandedStartedAt),
          expandedDirectoryCount: restoredExpanded.length,
        });
        tracePerf("workspaceBoot.expandedDirectoriesReady", {
          durationMs: perfDuration(listExpandedStartedAt),
          errorCount: expandedDirectoryErrorCount,
          expandedDirectoryCount: restoredExpanded.length,
          status:
            restoredExpanded.length === 0
              ? "skipped"
              : expandedDirectoryErrorCount > 0
                ? "partial-error"
                : "ok",
        });

        if (cancelled) {
          return;
        }
        const treeResultIsCurrent =
          !workspaceTreeGenerationRef ||
          workspaceTreeGenerationRef.current === bootTreeGeneration;
        if (treeResultIsCurrent) {
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
        }
        tracePerf("workspaceBoot.treeSettled", {
          durationMs: perfDuration(treeHydrationStartedAt),
          errorCount: Object.keys(nextDirectoryErrors).length,
          expandedDirectoryCount: restoredExpanded.length,
          rootEntryCount: rootEntries.length,
          status: treeResultIsCurrent
            ? Object.keys(nextDirectoryErrors).length > 0
              ? "partial-error"
              : "ok"
            : "superseded",
        });
        if (!nextDocument) {
          setIsLoading(false);
          loadingReleased = true;
        }
        setWorkspaceBootComplete(true);

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
                if (cancelled) {
                  return;
                }
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
        if (cancelled) {
          return;
        }
        const failedTreeStartedAt = treeHydrationStartedAt;
        const staleTreeFailure =
          failedTreeStartedAt !== null &&
          workspaceTreeGenerationRef !== undefined &&
          workspaceTreeGenerationRef.current !== bootTreeGeneration;
        if (staleTreeFailure) {
          if (!loadingReleased) {
            setIsLoading(false);
          }
          setWorkspaceBootComplete(true);
          tracePerf("workspaceBoot.treeSettled", {
            durationMs: perfDuration(failedTreeStartedAt),
            errorCount: 0,
            expandedDirectoryCount: 0,
            rootEntryCount: 0,
            status: "superseded",
          });
          return;
        }
        setError(
          bootError instanceof Error
            ? bootError.message
            : "Failed to boot viewer",
        );
        if (!loadingReleased) {
          setIsLoading(false);
        }
        setWorkspaceBootComplete(true);
        tracePerf("workspaceBoot.treeSettled", {
          durationMs:
            treeHydrationStartedAt === null
              ? 0
              : perfDuration(treeHydrationStartedAt),
          errorCount: 1,
          expandedDirectoryCount: 0,
          rootEntryCount: 0,
          status: "error",
        });
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
    host.takeCurrentViewerWindowOpenRequest?.().catch(() => null) ??
    Promise.resolve(null);
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
    request.activePath !== undefined
      ? request.activePath
      : (request.path ?? null);
  const openTabs = request.openTabs ?? (request.path ? [request.path] : []);
  const pinnedTabs =
    request.pinnedTabs ??
    (request.path && request.pinned ? [request.path] : []);
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
