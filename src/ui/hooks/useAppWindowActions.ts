import { useCallback, type RefObject } from "react";
import type {
  AppConfig,
  DocumentPayload,
  SplitSessionState,
  ViewerWindowOpenRequest,
  HostAdapter,
} from "../../core/types";
import type { PaneId, ViewerPaneSnapshot } from "../types";

interface UseAppWindowActionsOptions {
  activeHeadingId: string | null;
  closeTabRef: RefObject<((path: string) => void) | null>;
  config: AppConfig | null;
  documentPayload: DocumentPayload | null;
  expandedDirectories: Set<string>;
  focusedPaneId: PaneId;
  host: HostAdapter;
  orderedTabs: DocumentPayload[];
  paneSnapshots: Record<PaneId, ViewerPaneSnapshot>;
  pinnedTabs: string[];
  rootDirectory: string;
  sidebarLayout: AppConfig["layout"];
  showLightweightActionFeedback: (message: string) => void;
  splitEnabled: boolean;
  splitRatio: number;
  viewerRef: RefObject<HTMLElement | null>;
}

export function useAppWindowActions({
  activeHeadingId,
  closeTabRef,
  config,
  documentPayload,
  expandedDirectories,
  focusedPaneId,
  host,
  orderedTabs,
  paneSnapshots,
  pinnedTabs,
  rootDirectory,
  sidebarLayout,
  showLightweightActionFeedback,
  splitEnabled,
  splitRatio,
  viewerRef,
}: UseAppWindowActionsOptions) {
  const openNewWindow = useCallback(async () => {
    const request: ViewerWindowOpenRequest = {
      path: null,
      rootDirectory: rootDirectory || null,
      expandedDirectories: [...expandedDirectories],
      sidebarTab: config?.workspace.sidebarTab ?? "files",
      sidebarVisible: config?.sidebarVisible ?? true,
      rightSidebarVisible: config?.rightSidebarVisible ?? true,
      layout: sidebarLayout,
      bookmarks: config?.workspace.bookmarks ?? [],
    };
    await host.openNewWindow(request);
  }, [config, expandedDirectories, host, rootDirectory, sidebarLayout]);

  const duplicateWindow = useCallback(async () => {
    const activePath = documentPayload?.path ?? null;
    const nextScrollPositions = {
      ...(config?.workspace.scrollPositions ?? {}),
    };
    const nextActiveHeadingByPath = {
      ...(config?.workspace.activeHeadingByPath ?? {}),
    };
    if (activePath) {
      nextScrollPositions[activePath] = Math.round(
        viewerRef.current?.scrollTop ?? 0,
      );
      if (activeHeadingId) {
        nextActiveHeadingByPath[activePath] = activeHeadingId;
      }
    }
    const splitSession: SplitSessionState | null =
      splitEnabled && documentPayload
        ? {
            enabled: true,
            focusedPaneId,
            splitRatio,
            panePaths: {
              left:
                (focusedPaneId === "left"
                  ? documentPayload
                  : paneSnapshots.left.documentPayload
                )?.path ?? null,
              right:
                (focusedPaneId === "right"
                  ? documentPayload
                  : paneSnapshots.right.documentPayload
                )?.path ?? null,
            },
          }
        : null;
    const request: ViewerWindowOpenRequest = {
      path: activePath,
      activePath,
      openTabs: orderedTabs.map((tab) => tab.path),
      pinnedTabs,
      scrollPositions: nextScrollPositions,
      activeHeadingByPath: nextActiveHeadingByPath,
      recentTabs: config?.workspace.recentTabs ?? [],
      splitSession,
      rootDirectory: rootDirectory || null,
      expandedDirectories: [...expandedDirectories],
      sidebarTab: config?.workspace.sidebarTab ?? "files",
      sidebarVisible: config?.sidebarVisible ?? true,
      rightSidebarVisible: config?.rightSidebarVisible ?? true,
      layout: sidebarLayout,
      bookmarks: config?.workspace.bookmarks ?? [],
    };
    await host.openNewWindow(request);
  }, [
    activeHeadingId,
    config,
    documentPayload,
    expandedDirectories,
    focusedPaneId,
    host,
    orderedTabs,
    paneSnapshots,
    pinnedTabs,
    rootDirectory,
    sidebarLayout,
    splitEnabled,
    splitRatio,
    viewerRef,
  ]);

  const openDocumentInNewWindow = useCallback(
    async (
      path: string,
      options: { pinned?: boolean; recentTabs?: string[] } = {},
    ) => {
      const request: ViewerWindowOpenRequest = {
        path,
        rootDirectory: rootDirectory || null,
        expandedDirectories: [...expandedDirectories],
        sidebarTab: config?.workspace.sidebarTab ?? "files",
        sidebarVisible: config?.sidebarVisible ?? true,
        rightSidebarVisible: config?.rightSidebarVisible ?? true,
        layout: sidebarLayout,
        ...(options.pinned ? { pinned: true } : {}),
        ...(options.recentTabs ? { recentTabs: options.recentTabs } : {}),
        bookmarks: config?.workspace.bookmarks ?? [],
      };
      await host.openDocumentInNewWindow(request);
    },
    [config, expandedDirectories, host, rootDirectory, sidebarLayout],
  );

  const moveTabToNewWindow = useCallback(
    async (path: string) => {
      await openDocumentInNewWindow(path, {
        pinned: pinnedTabs.includes(path),
        recentTabs: [path],
      });
      closeTabRef.current?.(path);
      showLightweightActionFeedback("Moved tab to new window");
    },
    [
      closeTabRef,
      openDocumentInNewWindow,
      pinnedTabs,
      showLightweightActionFeedback,
    ],
  );

  const openCurrentDocumentInNewWindow = useCallback(
    async (path: string) => {
      await openDocumentInNewWindow(path);
    },
    [openDocumentInNewWindow],
  );

  return {
    duplicateWindow,
    moveTabToNewWindow,
    openCurrentDocumentInNewWindow,
    openDocumentInNewWindow,
    openNewWindow,
  };
}
