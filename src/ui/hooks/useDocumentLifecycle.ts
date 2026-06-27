import { useEffect, useMemo, useRef } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { isSupportedDocumentPath } from "../../core/documentFormat";
import {
  planDesktopOpenRequest,
  type DesktopOpenAction,
} from "../../core/desktopOpen";
import {
  addRecentDirectory,
  addRecentDocument,
  updateRecentTabs,
  upsertOpenTab,
} from "../../core/workspaceState";
import type {
  AppConfig,
  DesktopOpenRequest,
  DirectoryEntry,
  DocumentPayload,
  HostAdapter,
  RenderResult,
  WatchHandle,
  WorkspaceEnvironment,
} from "../../core/types";
import { fileName } from "../lib/path";
import {
  perfBasename,
  perfDuration,
  perfNow,
  tracePerf,
} from "../lib/perfTrace";
import { captureSmartScrollAnchor } from "../lib/smartScrollRestore";
import type {
  InlineNoticeOptions,
  OpenFileReloadState,
  PaneId,
  SmartScrollAnchor,
} from "../types";

interface UseDocumentLifecycleOptions {
  activeHeadingId: string | null;
  articleRef: RefObject<HTMLElement | null>;
  config: AppConfig | null;
  dismissInlineNotice: () => void;
  documentPayload: DocumentPayload | null;
  focusedPaneId: PaneId;
  host: HostAdapter;
  selectedAntoraContextId?: string | null;
  persistWorkspace: (partial: Partial<AppConfig["workspace"]>) => Promise<void>;
  recordNavigation: (location: { path: string; label?: string }) => void;
  searchQueryForPath: (path: string, fallbackQuery?: string) => string;
  setChildrenByDirectory: Dispatch<
    SetStateAction<Record<string, DirectoryEntry[]>>
  >;
  setDirectoryErrors: Dispatch<SetStateAction<Record<string, string>>>;
  setDocumentPayload: Dispatch<SetStateAction<DocumentPayload | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setExpandedDirectories: Dispatch<SetStateAction<Set<string>>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setPendingSmartScrollAnchor: Dispatch<
    SetStateAction<SmartScrollAnchor | null>
  >;
  setQuery: Dispatch<SetStateAction<string>>;
  setRenderResult: Dispatch<SetStateAction<RenderResult | null>>;
  bumpDocumentRenderRevision: () => void;
  setOpenFileReloadStates: Dispatch<
    SetStateAction<Record<string, OpenFileReloadState>>
  >;
  setRootDirectory: Dispatch<SetStateAction<string>>;
  setTabs: Dispatch<SetStateAction<DocumentPayload[]>>;
  setWorkspaceEnvironment: Dispatch<
    SetStateAction<WorkspaceEnvironment | null>
  >;
  showInlineNotice: (message: string, options?: InlineNoticeOptions) => void;
  canDrainPendingOpenRequests: boolean;
  snapshotForPath: (path: string) => PaneId | null;
  focusPane: (paneId: PaneId) => void;
  onCompareDesktopOpenRequest?: (
    leftPath: string,
    rightPath: string,
  ) => Promise<void>;
  tabs: DocumentPayload[];
  viewerRef: RefObject<HTMLElement | null>;
}

export function useDocumentLifecycle({
  activeHeadingId,
  articleRef,
  config,
  dismissInlineNotice,
  documentPayload,
  focusedPaneId,
  host,
  selectedAntoraContextId = null,
  persistWorkspace,
  recordNavigation,
  searchQueryForPath,
  setChildrenByDirectory,
  setDirectoryErrors,
  setDocumentPayload,
  setError,
  setExpandedDirectories,
  setIsLoading,
  setPendingSmartScrollAnchor,
  setQuery,
  setRenderResult,
  bumpDocumentRenderRevision,
  setOpenFileReloadStates,
  setRootDirectory,
  setTabs,
  setWorkspaceEnvironment,
  showInlineNotice,
  canDrainPendingOpenRequests,
  snapshotForPath,
  focusPane,
  onCompareDesktopOpenRequest,
  tabs,
  viewerRef,
}: UseDocumentLifecycleOptions) {
  const desktopOpenHandlerRef = useRef<
    (request: DesktopOpenRequest) => Promise<void>
  >(async () => {});
  const pendingOpenRequestsConsumedRef = useRef(false);
  const activePathRef = useRef<string | null>(documentPayload?.path ?? null);
  const activeHeadingIdRef = useRef<string | null>(activeHeadingId);
  const watchedTabPaths = useMemo(
    () =>
      [...new Set(tabs.map((tab) => tab.path))]
        .filter((path) => isSupportedDocumentPath(path))
        .sort(),
    [tabs],
  );
  const watchedTabPathKey = watchedTabPaths.join("\0");

  useEffect(() => {
    activePathRef.current = documentPayload?.path ?? null;
  }, [documentPayload?.path]);

  useEffect(() => {
    activeHeadingIdRef.current = activeHeadingId;
  }, [activeHeadingId]);

  function captureReloadAnchor(path: string) {
    if (path !== activePathRef.current) {
      return;
    }
    const anchor = captureSmartScrollAnchor({
      activeHeadingId: activeHeadingIdRef.current,
      article: articleRef.current,
      path,
      viewer: viewerRef.current,
    });
    if (anchor) {
      setPendingSmartScrollAnchor(anchor);
    }
  }

  useEffect(() => {
    let disposed = false;
    const watchHandles: WatchHandle[] = [];

    function markReloadState(path: string, state: OpenFileReloadState) {
      setOpenFileReloadStates((current) => ({
        ...current,
        [path]: state,
      }));
    }

    function clearReloadState(path: string) {
      setOpenFileReloadStates((current) => {
        const next = { ...current };
        delete next[path];
        return next;
      });
    }

    async function reloadWatchedDocument(path: string) {
      markReloadState(path, {
        status: "reloading",
        updatedAt: new Date().toISOString(),
      });
      try {
        await clearDocumentLinkCache(path, "watch-document");
        captureReloadAnchor(path);
        const nextDocument = await host.openDocument(path);
        if (disposed) {
          return;
        }
        const isActive = activePathRef.current === nextDocument.path;
        if (isActive) {
          setDocumentPayload(nextDocument);
          bumpDocumentRenderRevision();
          showInlineNotice(`${fileName(nextDocument.path)} reloaded`, {
            tone: "success",
          });
        }
        setTabs((currentTabs) =>
          currentTabs.map((tab) =>
            tab.path === nextDocument.path ? nextDocument : tab,
          ),
        );
        clearReloadState(nextDocument.path);
      } catch (reloadError) {
        if (disposed) {
          return;
        }
        const message =
          reloadError instanceof Error ? reloadError.message : "Reload failed";
        markReloadState(path, {
          status: "error",
          message,
          updatedAt: new Date().toISOString(),
        });
        if (activePathRef.current === path) {
          showInlineNotice(`Reload failed: ${message}`, { tone: "error" });
        }
      }
    }

    for (const path of watchedTabPaths) {
      void host
        .watchDocument(
          path,
          () => {
            void reloadWatchedDocument(path);
          },
          (message) => {
            if (disposed) {
              return;
            }
            markReloadState(path, {
              status: "error",
              message,
              updatedAt: new Date().toISOString(),
            });
            if (activePathRef.current === path) {
              showInlineNotice(`Reload failed: ${message}`, { tone: "error" });
            }
          },
        )
        .then((handle) => {
          if (disposed) {
            handle.dispose();
            return;
          }
          watchHandles.push(handle);
        })
        .catch((watchError) => {
          if (disposed) {
            return;
          }
          const message =
            watchError instanceof Error
              ? watchError.message
              : "Reload watch failed";
          markReloadState(path, {
            status: "error",
            message,
            updatedAt: new Date().toISOString(),
          });
          if (activePathRef.current === path) {
            showInlineNotice(`Reload watch failed: ${message}`, {
              tone: "error",
            });
          }
        });
    }

    return () => {
      disposed = true;
      for (const handle of watchHandles) {
        handle.dispose();
      }
    };
  }, [watchedTabPathKey]);

  async function clearDocumentLinkCache(path: string, reason: string) {
    const startedAt = perfNow();
    if (!host.clearDocumentLinkCache) {
      tracePerf("documentLink.cache.clear", {
        status: "skipped",
        reason,
        durationMs: perfDuration(startedAt),
      });
      return;
    }
    try {
      await host.clearDocumentLinkCache(path);
      tracePerf("documentLink.cache.clear", {
        status: "ok",
        reason,
        durationMs: perfDuration(startedAt),
      });
    } catch {
      tracePerf("documentLink.cache.clear", {
        status: "failed",
        reason,
        durationMs: perfDuration(startedAt),
      });
    }
  }

  async function openDocument(
    path: string,
    options: {
      recordNavigation?: boolean;
      clearDocumentLinkCache?: boolean;
    } = {},
  ) {
    const totalStartedAt = perfNow();
    const basename = perfBasename(path);
    const existingPane = snapshotForPath(path);
    if (existingPane && existingPane !== focusedPaneId) {
      focusPane(existingPane);
      tracePerf("openDocument.focusExistingPane", {
        basename,
        durationMs: perfDuration(totalStartedAt),
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      if (options.clearDocumentLinkCache) {
        await clearDocumentLinkCache(path, "manual-reload");
        captureReloadAnchor(path);
      }
      const hostStartedAt = perfNow();
      const nextDocument = await host.openDocument(path, {
        antoraContextId: selectedAntoraContextId,
      });
      tracePerf("openDocument.host.openDocument", {
        basename,
        format: nextDocument.format,
        bytes: nextDocument.source.length,
        durationMs: perfDuration(hostStartedAt),
      });
      const stateStartedAt = perfNow();
      if (options.recordNavigation !== false) {
        recordNavigation({
          path: nextDocument.path,
          label: fileName(nextDocument.path),
        });
      }
      tracePerf("openDocument.state.beforeSetPayload", {
        basename: perfBasename(nextDocument.path),
        format: nextDocument.format,
        durationMs: perfDuration(stateStartedAt),
      });
      const isSameActivePath = activePathRef.current === nextDocument.path;
      if (!isSameActivePath) {
        setRenderResult(null);
      }
      setDocumentPayload(nextDocument);
      if (options.clearDocumentLinkCache) {
        bumpDocumentRenderRevision();
      }
      setQuery(searchQueryForPath(nextDocument.path));
      dismissInlineNotice();
      setTabs((currentTabs) => {
        const nextTabs = upsertOpenTab(currentTabs, nextDocument);
        const openTabs = nextTabs.map((tab) => tab.path);
        void persistWorkspace({
          activePath: nextDocument.path,
          openTabs,
          recentTabs: updateRecentTabs(
            config?.workspace.recentTabs ?? [],
            nextDocument.path,
            openTabs,
          ),
          recentDocuments: addRecentDocument(
            config?.workspace.recentDocuments ?? [],
            nextDocument,
          ),
        });
        return nextTabs;
      });
      tracePerf("openDocument.state.afterSetPayloadQueued", {
        basename: perfBasename(nextDocument.path),
        format: nextDocument.format,
        durationMs: perfDuration(stateStartedAt),
      });
      tracePerf("openDocument.state.update", {
        basename: perfBasename(nextDocument.path),
        format: nextDocument.format,
        durationMs: perfDuration(stateStartedAt),
      });
      tracePerf("openDocument.total", {
        basename: perfBasename(nextDocument.path),
        format: nextDocument.format,
        durationMs: perfDuration(totalStartedAt),
      });
    } catch (openError) {
      const message =
        openError instanceof Error ? openError.message : "Open document failed";
      tracePerf("openDocument.failed", {
        basename,
        durationMs: perfDuration(totalStartedAt),
        message,
      });
      showInlineNotice(`Open failed: ${message}`, { tone: "error" });
    } finally {
      setIsLoading(false);
    }
  }

  async function openPathInEditor(path: string) {
    if (!isSupportedDocumentPath(path)) {
      showInlineNotice("Only markup documents can be opened in an editor", {
        tone: "warning",
      });
      return;
    }

    try {
      await host.openPathInEditor(path);
      showInlineNotice(`Open in Editor requested for ${fileName(path)}`, {
        tone: "success",
      });
    } catch (openError) {
      const message =
        openError instanceof Error
          ? openError.message
          : typeof openError === "string"
            ? openError
            : "Open in Editor failed";
      showInlineNotice(`Open in Editor failed: ${message}`, {
        tone: "error",
      });
    }
  }

  async function pickAndOpenDocument() {
    const path = await host.pickDocument();
    if (path) {
      await openDocument(path);
    }
  }

  async function pickAndOpenDirectory() {
    const path = await host.pickDirectory();
    if (path) {
      await openDirectory(path);
    }
  }

  async function openDirectory(path: string) {
    try {
      await host.authorizeDirectory(path);
      const nextEntries = await host.listDirectory(path);
      const workspacePaths = await host
        .resolveWorkspacePaths({
          documentPath: null,
          basePath: path,
          lastDirectory: path,
          recentDirectories: [],
          expandedDirectories: [],
        })
        .catch(() => null);
      setRootDirectory(path);
      setWorkspaceEnvironment(workspacePaths?.environment ?? null);
      setChildrenByDirectory({ [path]: nextEntries });
      setExpandedDirectories(new Set());
      setDirectoryErrors({});
      await persistWorkspace({
        lastDirectory: path,
        expandedDirectories: [],
        sourceControlBranchDiffBaseRef: null,
        recentDirectories: addRecentDirectory(
          config?.workspace.recentDirectories ?? [],
          path,
        ),
      });
    } catch (listError) {
      const message =
        listError instanceof Error
          ? listError.message
          : "Open directory failed";
      setError(message);
      showInlineNotice(`Open failed: ${message}`, { tone: "error" });
    }
  }

  async function handleDesktopOpenRequest(request: DesktopOpenRequest) {
    for (const action of planDesktopOpenRequest(request)) {
      await runDesktopOpenAction(action);
    }
  }

  async function runDesktopOpenAction(action: DesktopOpenAction) {
    switch (action.kind) {
      case "warning":
        showInlineNotice(action.message, { tone: "warning" });
        break;
      case "compareDocuments":
        if (onCompareDesktopOpenRequest) {
          await onCompareDesktopOpenRequest(action.leftPath, action.rightPath);
        } else {
          await openDocument(action.leftPath);
          await openDocument(action.rightPath);
        }
        break;
      case "openDocument":
        await openDocument(action.path);
        break;
      case "openDirectory":
        await openDirectory(action.path);
        break;
    }
  }

  desktopOpenHandlerRef.current = handleDesktopOpenRequest;

  useEffect(() => {
    let disposed = false;
    let watchHandle: WatchHandle | null = null;

    if (
      canDrainPendingOpenRequests &&
      !pendingOpenRequestsConsumedRef.current
    ) {
      pendingOpenRequestsConsumedRef.current = true;
      void host.takePendingOpenRequests().then((requests) => {
        if (disposed) {
          return;
        }
        for (const request of requests) {
          void desktopOpenHandlerRef.current(request);
        }
      });
    }

    void host
      .watchOpenRequests((request) => {
        void desktopOpenHandlerRef.current(request);
      })
      .then((handle) => {
        if (disposed) {
          handle.dispose();
          return;
        }
        watchHandle = handle;
      });

    return () => {
      disposed = true;
      watchHandle?.dispose();
    };
  }, [canDrainPendingOpenRequests]);

  return {
    openDirectory,
    openDocument,
    openPathInEditor,
    pickAndOpenDirectory,
    pickAndOpenDocument,
  };
}
