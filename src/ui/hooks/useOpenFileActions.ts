import type { Dispatch, SetStateAction } from "react";
import {
  closeOtherOpenTabPaths,
  pruneRecentTabs,
  removeWorkspacePathStateEntries,
  togglePinnedTab,
  updateRecentTabs,
} from "../../core/workspaceState";
import { reorderByIndex } from "../../core/reorder";
import type {
  AppConfig,
  DocumentPayload,
  RenderResult,
} from "../../core/types";
import { fileName } from "../lib/path";
import { emptySafeHtml } from "../lib/safeHtml";
import type { SafeHtml } from "../lib/safeHtml";
import type {
  InlineNoticeOptions,
  NavigationLocation,
  OpenFileReloadState,
  PaneId,
  SearchHitSummary,
} from "../types";

interface UseOpenFileActionsOptions {
  config: AppConfig | null;
  documentPayload: DocumentPayload | null;
  focusedPaneId: PaneId;
  lastClosedTabs: DocumentPayload[];
  openFileReloadStates: Record<string, OpenFileReloadState>;
  orderedTabs: DocumentPayload[];
  persistWorkspace: (partial: Partial<AppConfig["workspace"]>) => Promise<void>;
  recordNavigation: (location: NavigationLocation) => void;
  replaceClosedDocumentInPaneSnapshots: (
    path: string,
    nextDocument: DocumentPayload | null,
    nextQuery: string,
  ) => void;
  resetSplitToDocument: (document: DocumentPayload, query: string) => void;
  resetSplitToEmpty: () => void;
  searchQueryForPath: (path: string, fallbackQuery?: string) => string;
  setActiveHeadingId: Dispatch<SetStateAction<string | null>>;
  setDocumentHtml: Dispatch<SetStateAction<SafeHtml>>;
  setDocumentPayload: Dispatch<SetStateAction<DocumentPayload | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setFocusedPaneId: Dispatch<SetStateAction<PaneId>>;
  setIsLoading: Dispatch<SetStateAction<boolean>>;
  setLastClosedTabs: Dispatch<SetStateAction<DocumentPayload[]>>;
  setNavigationBackStack: Dispatch<SetStateAction<NavigationLocation[]>>;
  setNavigationForwardStack: Dispatch<SetStateAction<NavigationLocation[]>>;
  setPendingNavigationLocation: Dispatch<
    SetStateAction<NavigationLocation | null>
  >;
  setQuery: Dispatch<SetStateAction<string>>;
  setRenderResult: Dispatch<SetStateAction<RenderResult | null>>;
  setSearchHits: Dispatch<SetStateAction<SearchHitSummary[]>>;
  setSearchIndex: Dispatch<SetStateAction<number>>;
  setSplitEnabled: Dispatch<SetStateAction<boolean>>;
  setTabMoreOpen: Dispatch<SetStateAction<boolean>>;
  setTabs: Dispatch<SetStateAction<DocumentPayload[]>>;
  showInlineNotice: (message: string, options?: InlineNoticeOptions) => void;
  showLightweightActionFeedback: (message: string) => void;
  snapshotForPath: (path: string) => PaneId | null;
  focusPane: (paneId: PaneId) => void;
  tabs: DocumentPayload[];
  openDocument: (
    path: string,
    options?: { recordNavigation?: boolean },
  ) => Promise<void>;
}

export function useOpenFileActions({
  config,
  documentPayload,
  focusedPaneId,
  lastClosedTabs,
  openFileReloadStates,
  orderedTabs,
  persistWorkspace,
  recordNavigation,
  replaceClosedDocumentInPaneSnapshots,
  resetSplitToDocument,
  resetSplitToEmpty,
  searchQueryForPath,
  setActiveHeadingId,
  setDocumentHtml,
  setDocumentPayload,
  setError,
  setFocusedPaneId,
  setIsLoading,
  setLastClosedTabs,
  setNavigationBackStack,
  setNavigationForwardStack,
  setPendingNavigationLocation,
  setQuery,
  setRenderResult,
  setSearchHits,
  setSearchIndex,
  setSplitEnabled,
  setTabMoreOpen,
  setTabs,
  showInlineNotice,
  showLightweightActionFeedback,
  snapshotForPath,
  focusPane,
  tabs,
  openDocument,
}: UseOpenFileActionsOptions) {
  async function activateTab(
    path: string,
    options: { recordNavigation?: boolean } = {},
  ) {
    const existingPane = snapshotForPath(path);
    if (existingPane && existingPane !== focusedPaneId) {
      focusPane(existingPane);
      return;
    }

    const existing = tabs.find((tab) => tab.path === path);
    if (existing) {
      if (openFileReloadStates[path]?.status === "error") {
        await openDocument(path, options);
        return;
      }
      if (options.recordNavigation !== false) {
        recordNavigation({ path, label: fileName(path) });
      }
      setDocumentPayload(existing);
      setQuery(searchQueryForPath(path));
      const openTabs = tabs.map((tab) => tab.path);
      void persistWorkspace({
        activePath: path,
        openTabs,
        recentTabs: updateRecentTabs(
          config?.workspace.recentTabs ?? [],
          path,
          openTabs,
        ),
      });
      setTabMoreOpen(false);
      return;
    }

    await openDocument(path, options);
  }

  function closeTab(path: string) {
    setTabs((currentTabs) => {
      const closedIndex = currentTabs.findIndex((tab) => tab.path === path);
      const closedTab = currentTabs[closedIndex];
      if (closedTab) {
        setLastClosedTabs((current) =>
          [
            ...current.filter((tab) => tab.path !== closedTab.path),
            closedTab,
          ].slice(-20),
        );
      }
      const nextTabs = currentTabs.filter((tab) => tab.path !== path);
      const nextActive =
        documentPayload?.path === path
          ? (nextTabs[closedIndex] ?? nextTabs[closedIndex - 1] ?? null)
          : documentPayload;
      setDocumentPayload(nextActive);
      setQuery(nextActive ? searchQueryForPath(nextActive.path) : "");
      if (!nextActive) {
        setRenderResult(null);
        setDocumentHtml(emptySafeHtml);
        setSearchIndex(0);
        setSearchHits([]);
        setActiveHeadingId(null);
        setNavigationBackStack([]);
        setNavigationForwardStack([]);
        setPendingNavigationLocation(null);
        setSplitEnabled(false);
        setFocusedPaneId("left");
      }
      replaceClosedDocumentInPaneSnapshots(
        path,
        nextActive,
        nextActive ? searchQueryForPath(nextActive.path) : "",
      );
      const openTabs = nextTabs.map((tab) => tab.path);
      void persistWorkspace({
        activePath: nextActive?.path ?? null,
        openTabs,
        recentTabs: updateRecentTabs(
          config?.workspace.recentTabs ?? [],
          nextActive?.path ?? null,
          openTabs,
        ),
        pinnedTabs: (config?.workspace.pinnedTabs ?? []).filter(
          (pinnedPath) => pinnedPath !== path,
        ),
        scrollPositions: removeWorkspacePathStateEntries(
          config?.workspace.scrollPositions ?? {},
          [path],
        ),
        activeHeadingByPath: removeWorkspacePathStateEntries(
          config?.workspace.activeHeadingByPath ?? {},
          [path],
        ),
        splitSession: nextActive ? config?.workspace.splitSession : null,
      });
      return nextTabs;
    });
  }

  function closeOtherTabs(path: string) {
    const target = tabs.find((tab) => tab.path === path) ?? documentPayload;
    if (!target) {
      return;
    }
    const currentPinnedTabs = config?.workspace.pinnedTabs ?? [];
    const remainingPaths = closeOtherOpenTabPaths(
      tabs.map((tab) => tab.path),
      currentPinnedTabs,
      target.path,
    );
    const nextTabs = tabs.filter((tab) => remainingPaths.includes(tab.path));
    const removedPaths = tabs
      .map((tab) => tab.path)
      .filter((tabPath) => !remainingPaths.includes(tabPath));
    setDocumentPayload(target);
    setTabs(nextTabs);
    const nextQuery = searchQueryForPath(target.path);
    resetSplitToDocument(target, nextQuery);
    setQuery(nextQuery);
    setTabMoreOpen(false);
    void persistWorkspace({
      activePath: target.path,
      openTabs: nextTabs.map((tab) => tab.path),
      recentTabs: updateRecentTabs(
        config?.workspace.recentTabs ?? [],
        target.path,
        nextTabs.map((tab) => tab.path),
      ),
      pinnedTabs: currentPinnedTabs,
      scrollPositions: removeWorkspacePathStateEntries(
        config?.workspace.scrollPositions ?? {},
        removedPaths,
      ),
      activeHeadingByPath: removeWorkspacePathStateEntries(
        config?.workspace.activeHeadingByPath ?? {},
        removedPaths,
      ),
    });
  }

  function closeAllTabs() {
    if (tabs.length === 0) {
      return;
    }
    const closedTabs = tabs;
    setLastClosedTabs((current) =>
      [
        ...current.filter(
          (tab) => !closedTabs.some((closedTab) => closedTab.path === tab.path),
        ),
        ...closedTabs,
      ].slice(-20),
    );
    setTabs([]);
    setDocumentPayload(null);
    setRenderResult(null);
    setDocumentHtml(emptySafeHtml);
    setError(null);
    setIsLoading(false);
    resetSplitToEmpty();
    setQuery("");
    setSearchIndex(0);
    setSearchHits([]);
    setActiveHeadingId(null);
    setNavigationBackStack([]);
    setNavigationForwardStack([]);
    setPendingNavigationLocation(null);
    setTabMoreOpen(false);
    void persistWorkspace({
      activePath: null,
      openTabs: [],
      pinnedTabs: [],
      recentTabs: [],
      scrollPositions: {},
      activeHeadingByPath: {},
      splitSession: null,
    });
    showInlineNotice("Closed all files", { tone: "success" });
  }

  function toggleActivePinnedTab(path: string) {
    const nextPinnedTabs = togglePinnedTab(
      config?.workspace.pinnedTabs ?? [],
      path,
    );
    void persistWorkspace({ pinnedTabs: nextPinnedTabs });
    showLightweightActionFeedback(
      nextPinnedTabs.includes(path)
        ? `${fileName(path)} pinned`
        : `${fileName(path)} unpinned`,
    );
  }

  function reorderOpenTabs(fromPath: string, toPath: string) {
    setTabs((currentTabs) => {
      const fromIndex = currentTabs.findIndex((tab) => tab.path === fromPath);
      const toIndex = currentTabs.findIndex((tab) => tab.path === toPath);
      const nextTabs = reorderByIndex(currentTabs, fromIndex, toIndex);
      if (nextTabs === currentTabs) {
        return currentTabs;
      }
      void persistWorkspace({
        openTabs: nextTabs.map((tab) => tab.path),
      });
      return nextTabs;
    });
  }

  function activateRelativeTab(delta: number) {
    if (!documentPayload || orderedTabs.length === 0) {
      return;
    }
    const currentIndex = orderedTabs.findIndex(
      (tab) => tab.path === documentPayload.path,
    );
    const baseIndex = currentIndex >= 0 ? currentIndex : 0;
    const nextIndex =
      (baseIndex + delta + orderedTabs.length) % orderedTabs.length;
    void activateTab(orderedTabs[nextIndex].path);
  }

  function activateTabByIndex(index: number) {
    const target = orderedTabs[index];
    if (target) {
      void activateTab(target.path);
    }
  }

  function restoreClosedTabAt(
    index: number,
    options: { activate?: boolean } = {},
  ) {
    const restored = lastClosedTabs[index];
    if (!restored) {
      return;
    }
    const shouldActivate = options.activate ?? true;

    setLastClosedTabs((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
    setTabs((currentTabs) =>
      currentTabs.some((tab) => tab.path === restored.path)
        ? currentTabs
        : [...currentTabs, restored],
    );
    if (shouldActivate) {
      recordNavigation({
        path: restored.path,
        label: fileName(restored.path),
      });
      setDocumentPayload(restored);
      setQuery(searchQueryForPath(restored.path));
    }
    setTabMoreOpen(false);
    showInlineNotice(
      shouldActivate
        ? `Restored ${fileName(restored.path)}`
        : `Restored ${fileName(restored.path)} in background`,
      {
        tone: "success",
      },
    );
    const openTabs = [
      ...tabs
        .filter((tab) => tab.path !== restored.path)
        .map((tab) => tab.path),
      restored.path,
    ];
    void persistWorkspace(
      shouldActivate
        ? {
            activePath: restored.path,
            openTabs,
            recentTabs: updateRecentTabs(
              config?.workspace.recentTabs ?? [],
              restored.path,
              openTabs,
            ),
          }
        : {
            openTabs,
            recentTabs: pruneRecentTabs(
              config?.workspace.recentTabs ?? [],
              openTabs,
            ),
          },
    );
  }

  function restoreClosedTab() {
    restoreClosedTabAt(lastClosedTabs.length - 1);
  }

  return {
    activateRelativeTab,
    activateTab,
    activateTabByIndex,
    closeAllTabs,
    closeOtherTabs,
    closeTab,
    reorderOpenTabs,
    restoreClosedTab,
    restoreClosedTabAt,
    toggleActivePinnedTab,
  };
}
