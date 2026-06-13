import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppMainShell } from "./components/AppMainShell";
import { useActiveHeadingTracking } from "./hooks/useActiveHeadingTracking";
import { useBookmarksState } from "./hooks/useBookmarksState";
import { useAppCommandWiring } from "./hooks/useAppCommandWiring";
import { useAppRightSidebarWiring } from "./hooks/useAppRightSidebarWiring";
import { useAppShellViewState } from "./hooks/useAppShellViewState";
import { useAppSidebarWiring } from "./hooks/useAppSidebarWiring";
import { useAppWindowActions } from "./hooks/useAppWindowActions";
import { useContentCursorActions } from "./hooks/useContentCursorActions";
import { useDocumentLifecycle } from "./hooks/useDocumentLifecycle";
import { useDocumentLinks } from "./hooks/useDocumentLinks";
import { useDocumentRender } from "./hooks/useDocumentRender";
import { useExternalLinkConfirmation } from "./hooks/useExternalLinkConfirmation";
import { useFileTreeState } from "./hooks/useFileTreeState";
import { useFileCompareActions } from "./hooks/useFileCompareActions";
import { useInlineNotice } from "./hooks/useInlineNotice";
import { useKrokiActions } from "./hooks/useKrokiActions";
import { useLightweightActionFeedback } from "./hooks/useLightweightActionFeedback";
import { useContextMenuState } from "./hooks/useContextMenuState";
import { useMouseGestures } from "./hooks/useMouseGestures";
import { useMarkdownWorkerWarmupProbe } from "./hooks/useMarkdownWorkerWarmupProbe";
import { useNativeAppMenu } from "./hooks/useNativeAppMenu";
import {
  type ActivateTabForHistory,
  useNavigationHistory,
} from "./hooks/useNavigationHistory";
import { useOpenFileActions } from "./hooks/useOpenFileActions";
import { useQuickOpenCandidates } from "./hooks/useQuickOpenCandidates";
import { useQuickOpenActions } from "./hooks/useQuickOpenActions";
import { useSearchState } from "./hooks/useSearchState";
import { useShellContextMenu } from "./hooks/useShellContextMenu";
import { useSidebarLayout } from "./hooks/useSidebarLayout";
import { useSiteScreenshotScenario } from "./hooks/useSiteScreenshotScenario";
import { useSourceControlActions } from "./hooks/useSourceControlActions";
import { useSplitViewState } from "./hooks/useSplitViewState";
import { useTabsState } from "./hooks/useTabsState";
import { useViewerSplitResize } from "./hooks/useViewerSplitResize";
import { useWorkspacePersistence } from "./hooks/useWorkspacePersistence";
import { useWorkspaceBoot } from "./hooks/useWorkspaceBoot";
import { useWorkspaceSearch } from "./hooks/useWorkspaceSearch";
import { usePostDiffGitMarkerState } from "./hooks/usePostDiffGitMarkerState";
import { useWorkspaceTabActions } from "./hooks/useWorkspaceTabActions";
import { useZenModeActions } from "./hooks/useZenModeActions";
import {
  activeWorkspaceTabId as resolveActiveWorkspaceTabId,
  buildWorkspaceTabs,
} from "./lib/workspaceTabs";
import { MAIN_WINDOW_SESSION_ID, normalizeConfig } from "./lib/config";
import type { ContentCursorCommandHandler } from "./lib/contentCursor";
import {
  mergePersistedSharedConfigIntoWindow,
  mergeWindowConfigForSave,
} from "./lib/windowConfig";
import { emptySafeHtml } from "./lib/safeHtml";
import type { LinkPreviewState } from "./lib/linkPreview";
import type {
  DiagramPreviewState,
  MouseGestureAutomation,
  NavigationLocation,
  OpenFileReloadState,
  RecentlyVisitedLocation,
  RightSidebarTab,
  SearchHitSummary,
  SmartScrollAnchor,
  WorkspaceTab,
} from "./types";
import { createHostAdapter } from "../adapters/createHostAdapter";
import type {
  AppConfig,
  DocumentDiffPreview,
  DocumentLinkResolution,
  DocumentPayload,
  KrokiRequest,
  KrokiResult,
  LocalImageResult,
  RenderResult,
  WorkspaceEnvironment,
} from "../core/types";
import { getBoundedTabs } from "../core/tabLayout";
import { tracePerf } from "./lib/perfTrace";
import { shouldInvalidatePostDiffGitMarkersForGitRefreshReason } from "./lib/postDiffGitMarkerRefresh";

const host = createHostAdapter();

export function App() {
  const viewerRef = useRef<HTMLElement | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const activateTabForHistoryRef = useRef<ActivateTabForHistory | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const openFilesFilterInputRef = useRef<HTMLInputElement | null>(null);
  const quickOpenInputRef = useRef<HTMLInputElement | null>(null);
  const closeTabRef = useRef<((path: string) => void) | null>(null);
  const diffContentCursorCommandRef =
    useRef<ContentCursorCommandHandler | null>(null);
  const diffContentCursorClearRef = useRef<(() => void) | null>(null);
  const [documentPayload, setDocumentPayload] =
    useState<DocumentPayload | null>(null);
  const [navigationBackStack, setNavigationBackStack] = useState<
    NavigationLocation[]
  >([]);
  const [navigationForwardStack, setNavigationForwardStack] = useState<
    NavigationLocation[]
  >([]);
  const [recentlyVisitedLocations, setRecentlyVisitedLocations] = useState<
    RecentlyVisitedLocation[]
  >([]);
  const [renderResult, setRenderResult] = useState<RenderResult | null>(null);
  const [documentHtml, setDocumentHtml] = useState(emptySafeHtml);
  const [confirmedRemoteDiagramKeys, setConfirmedRemoteDiagramKeys] = useState<
    ReadonlySet<string>
  >(new Set());
  const [krokiFallbackDiagramKeys, setKrokiFallbackDiagramKeys] = useState<
    ReadonlySet<string>
  >(new Set());
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [query, setQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const [searchHits, setSearchHits] = useState<SearchHitSummary[]>([]);
  const [rightSidebarTab, setRightSidebarTab] =
    useState<RightSidebarTab>("contents");
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [pendingSmartScrollAnchor, setPendingSmartScrollAnchor] =
    useState<SmartScrollAnchor | null>(null);
  const [tabQueries, setTabQueries] = useState<Record<string, string>>({});
  const [tabMoreOpen, setTabMoreOpen] = useState(false);
  const [preferencesTabOpen, setPreferencesTabOpen] = useState(false);
  const [zenModeActive, setZenModeActive] = useState(false);
  const [activeWorkspaceTabKind, setActiveWorkspaceTabKind] = useState<
    "document" | "preferences"
  >("document");
  const [fileComparePickerOpen, setFileComparePickerOpen] = useState(false);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [quickOpenQuery, setQuickOpenQuery] = useState("");
  const [viewerShortcutHintsOpen, setViewerShortcutHintsOpen] = useState(false);
  const [diagramPreview, setDiagramPreview] =
    useState<DiagramPreviewState | null>(null);
  const [documentDiffPreview, setDocumentDiffPreview] =
    useState<DocumentDiffPreview | null>(null);
  const [workspaceEnvironment, setWorkspaceEnvironment] =
    useState<WorkspaceEnvironment | null>(null);
  const wslWorkspaceNoticeShownRef = useRef(false);
  const {
    confirmExternalLink,
    externalLinkConfirmation,
    resolveExternalLinkConfirmation,
  } = useExternalLinkConfirmation(config);
  const [openFileReloadStates, setOpenFileReloadStates] = useState<
    Record<string, OpenFileReloadState>
  >({});
  const [linkHoverDestination, setLinkHoverDestination] = useState<
    string | null
  >(null);
  const [linkPreview, setLinkPreview] = useState<LinkPreviewState | null>(null);
  const copyTextRef = useRef<(label: string, value: string) => void>(() => {});
  const {
    lastClosedTabs,
    orderedTabs,
    pinnedTabs,
    setLastClosedTabs,
    setTabs,
    tabs,
  } = useTabsState({
    activePath: documentPayload?.path,
    config,
  });
  const preferencesOpen =
    preferencesTabOpen && activeWorkspaceTabKind === "preferences";
  const activeDocumentPayload = preferencesOpen ? null : documentPayload;
  const [windowSessionId, setWindowSessionId] = useState(
    MAIN_WINDOW_SESSION_ID,
  );
  useEffect(() => {
    setLinkPreview(null);
  }, [documentPayload?.path]);

  useEffect(() => {
    let disposed = false;
    let handle: { dispose(): void } | null = null;

    async function refreshConfigFromDisk() {
      try {
        const loadedConfig = normalizeConfig(await host.loadConfig());
        if (disposed) {
          return;
        }
        setConfig((currentConfig) => {
          const nextConfig =
            currentConfig
              ? mergePersistedSharedConfigIntoWindow({
                  persistedConfig: loadedConfig,
                  windowConfig: currentConfig,
                })
              : loadedConfig;
          setSidebarLayout(nextConfig.layout);
          void host.setWindowTheme(nextConfig.theme);
          return nextConfig;
        });
      } catch {
        // Cross-window config sync is opportunistic; direct save/open flows remain authoritative.
      }
    }

    void host
      .watchConfigChanges?.(() => {
        void refreshConfigFromDisk();
      })
      .then((nextHandle) => {
        if (disposed) {
          nextHandle?.dispose();
          return;
        }
        handle = nextHandle ?? null;
      });

    return () => {
      disposed = true;
      handle?.dispose();
    };
  }, []);
  const workspaceTabs = useMemo(
    () => buildWorkspaceTabs(orderedTabs, preferencesTabOpen),
    [orderedTabs, preferencesTabOpen],
  );
  const activeWorkspaceTabId = resolveActiveWorkspaceTabId({
    activeDocumentPath: documentPayload?.path,
    preferencesActive: preferencesOpen,
  });
  const workspaceTabLayout = useMemo(
    () =>
      getBoundedTabs(
        workspaceTabs.map((tab) => tab.id),
        activeWorkspaceTabId,
        4,
      ),
    [activeWorkspaceTabId, workspaceTabs],
  );
  const visibleWorkspaceTabs = useMemo(
    () =>
      workspaceTabLayout.visiblePaths
        .map((id) => workspaceTabs.find((tab) => tab.id === id))
        .filter((tab): tab is WorkspaceTab => Boolean(tab)),
    [workspaceTabLayout.visiblePaths, workspaceTabs],
  );
  const overflowWorkspaceTabs = useMemo(
    () =>
      workspaceTabLayout.overflowPaths
        .map((id) => workspaceTabs.find((tab) => tab.id === id))
        .filter((tab): tab is WorkspaceTab => Boolean(tab)),
    [workspaceTabLayout.overflowPaths, workspaceTabs],
  );
  const { inlineNotice, showInlineNotice, dismissInlineNotice } =
    useInlineNotice();
  const { lightweightActionFeedback, showLightweightActionFeedback } =
    useLightweightActionFeedback();
  const { contextMenu, closeContextMenu, openContextMenu } =
    useContextMenuState();
  const {
    clearKrokiCache,
    confirmKrokiRender,
    testKrokiPlantUml,
    tryKrokiFallback,
  } = useKrokiActions({
    host,
    setConfirmedRemoteDiagramKeys,
    setKrokiFallbackDiagramKeys,
    showInlineNotice,
  });
  const {
    chooseCompareDocument,
    compareActiveWithPickedDocument,
    compareDocumentPaths,
    comparePickedDocuments,
    compareWithActiveFile,
  } = useFileCompareActions({
    documentPayload: activeDocumentPayload,
    host,
    setDocumentDiffPreview,
    setFileComparePickerOpen,
    showInlineNotice,
  });

  useEffect(() => {
    const openPaths = new Set(tabs.map((tab) => tab.path));
    setOpenFileReloadStates((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([path]) => openPaths.has(path)),
      ),
    );
  }, [tabs]);

  function searchQueryForPath(path: string, fallbackQuery = "") {
    const tabQuery = tabQueries[path];
    if (tabQuery?.trim()) {
      return tabQuery;
    }
    if (fallbackQuery.trim()) {
      return fallbackQuery;
    }
    return config?.workspace.pinnedSearch ?? "";
  }
  const [openFilesFilter, setOpenFilesFilter] = useState("");
  const [lastMouseGesture, setLastMouseGesture] =
    useState<MouseGestureAutomation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [workspaceBootComplete, setWorkspaceBootComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    closeSplitView,
    focusedPaneId,
    focusPane,
    openSplitRight,
    paneSnapshots,
    pendingNavigationLocation,
    replaceClosedDocumentInPaneSnapshots,
    resetSplitToDocument,
    resetSplitToEmpty,
    setFocusedPaneId,
    setPaneSnapshots,
    setPendingNavigationLocation,
    setSplitEnabled,
    setSplitRatio,
    snapshotForPath,
    splitEnabled,
    splitRatio,
  } = useSplitViewState({
    activeHeadingId,
    documentHtml,
    documentPayload,
    navigationBackStack,
    navigationForwardStack,
    query,
    renderResult,
    searchHits,
    searchIndex,
    searchQueryForPath,
    setActiveHeadingId,
    setDocumentHtml,
    setDocumentPayload,
    setNavigationBackStack,
    setNavigationForwardStack,
    setQuery,
    setRenderResult,
    setSearchHits,
    setSearchIndex,
  });
  const { persistWorkspace } = useWorkspacePersistence({
    activeHeadingId,
    config,
    documentPayload,
    focusedPaneId,
    host,
    isLoading,
    paneSnapshots,
    setConfig,
    splitEnabled,
    splitRatio,
    viewerRef,
    windowSessionId,
  });
  const refreshSourceControlFromFileTreeRef = useRef<
    (event: { reason: string; changedPath: string | null }) => void
  >(() => undefined);
  const {
    rootDirectory,
    setRootDirectory,
    childrenByDirectory,
    setChildrenByDirectory,
    expandedDirectories,
    setExpandedDirectories,
    loadingDirectories,
    directoryErrors,
    setDirectoryErrors,
    toggleDirectory,
    refreshTree,
    collapseTree,
  } = useFileTreeState({
    host,
    persistWorkspace,
    workspacePerformanceMode: workspaceEnvironment?.performanceMode ?? "normal",
    showInlineNotice,
    onWorkspaceFileChange: (event) =>
      refreshSourceControlFromFileTreeRef.current(event),
  });
  const {
    leftSidebarContentRef,
    openFilesPaneRef,
    sidebarLayout,
    setSidebarLayout,
    sidebarResizeState,
    openFilesSplitResizeState,
    beginSidebarResize,
    updateSidebarResize,
    endSidebarResize,
    cancelSidebarResize,
    resetSidebarWidth,
    maxOpenFilesHeightForDisplay,
    beginOpenFilesSplitResize,
    updateOpenFilesSplitResize,
    endOpenFilesSplitResize,
    cancelOpenFilesSplitResize,
    resetOpenFilesSplitHeight,
    toggleOpenFilesCollapsed,
  } = useSidebarLayout({
    config,
    saveConfig,
  });
  const {
    beginViewerSplitResize,
    endViewerSplitResize,
    splitResizeState,
    updateViewerSplitResize,
  } = useViewerSplitResize({
    setSplitRatio,
    splitRatio,
  });

  useWorkspaceBoot({
    host,
    setWindowSessionId,
    setChildrenByDirectory,
    setConfig,
    setDirectoryErrors,
    setDocumentPayload,
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
  });

  useEffect(() => {
    if (
      workspaceEnvironment?.performanceMode !== "wsl-mitigated" ||
      wslWorkspaceNoticeShownRef.current
    ) {
      return;
    }
    wslWorkspaceNoticeShownRef.current = true;
    tracePerf("workspace.wslMitigation.enabled", {
      mode: workspaceEnvironment.performanceMode,
      locationKind: workspaceEnvironment.locationKind,
      reason: "wsl-workspace",
    });
    showInlineNotice(
      "WSL workspace detected. File tree and Git metadata are loaded on demand because Windows access to WSL files can be slow. Use refresh or expand folders to pick up new files.",
      { tone: "info" },
    );
  }, [showInlineNotice, workspaceEnvironment]);

  useMarkdownWorkerWarmupProbe(workspaceBootComplete);

  useDocumentRender({
    confirmedRemoteDiagramKeys,
    config,
    documentPayload,
    host,
    krokiFallbackDiagramKeys,
    setError,
    setDocumentHtml,
    setRenderResult,
  });

  const { navigateHistory, openRecentlyVisitedLocation, recordNavigation } =
    useNavigationHistory({
      activeHeadingId,
      activateTabRef: activateTabForHistoryRef,
      articleRef,
      documentHtml,
      documentPayload,
      navigationBackStack,
      navigationForwardStack,
      pendingNavigationLocation,
      pendingSmartScrollAnchor,
      setActiveHeadingId,
      setNavigationBackStack,
      setNavigationForwardStack,
      setRecentlyVisitedLocations,
      setPendingNavigationLocation,
      setPendingSmartScrollAnchor,
      viewerRef,
    });

  const {
    openDirectory,
    openDocument,
    openPathInEditor,
    pickAndOpenDirectory,
    pickAndOpenDocument,
  } = useDocumentLifecycle({
    config,
    dismissInlineNotice,
    documentPayload,
    activeHeadingId,
    articleRef,
    focusedPaneId,
    focusPane,
    host,
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
    setOpenFileReloadStates,
    setRootDirectory,
    setTabs,
    setWorkspaceEnvironment,
    showInlineNotice,
    canDrainPendingOpenRequests: workspaceBootComplete,
    snapshotForPath,
    onCompareDesktopOpenRequest: compareDocumentPaths,
    tabs,
    viewerRef,
  });

  const resolveDiffLocalImage = useCallback(
    (
      source: string,
      documentPath: string,
      context: DocumentPayload["asciidocContext"],
    ): Promise<LocalImageResult> =>
      host.resolveLocalImage(source, documentPath, context),
    [],
  );
  const loadDiffDocumentContext = useCallback(
    async (
      documentPath: string,
    ): Promise<Pick<
      DocumentPayload,
      "includeFiles" | "asciidocContext"
    > | null> => {
      const document = await host.openDocument(documentPath);
      return {
        includeFiles: document.includeFiles,
        asciidocContext: document.asciidocContext,
      };
    },
    [],
  );
  const renderDiffDiagram = useCallback(
    (request: KrokiRequest): Promise<KrokiResult> =>
      host.renderDiagram(request),
    [],
  );
  const getGitDiffPreview = useCallback(
    (path: string): Promise<DocumentDiffPreview> => host.getGitDiffPreview(path),
    [],
  );

  const {
    activePostDiffGitMarkers,
    closeDocumentDiffPreview,
    handleWorkspaceFileChangeRefresh,
    invalidatePostDiffGitMarkersForActiveDocument,
  } = usePostDiffGitMarkerState({
    config,
    documentPayload,
    documentDiffPreview,
    renderResult,
    confirmedRemoteDiagramKeys,
    krokiFallbackDiagramKeys,
    getGitDiffPreview,
    loadDiffDocumentContext,
    resolveDiffLocalImage,
    renderDiffDiagram,
    setDocumentDiffPreview,
  });

  const {
    effectiveGitTimelinePath,
    gitBranchDiff,
    gitBranchDiffLoading,
    gitChanges,
    gitChangesLoading,
    gitCommitDetails,
    gitCommitGraph,
    gitCommitGraphLoading,
    gitCommitGraphLoadingMore,
    gitRefPicker,
    gitTimelineCompareBase,
    gitTimelineHistory,
    gitTimelineLoading,
    gitTimelineLoadingMore,
    loadMoreGitCommitGraph,
    loadMoreGitFileHistory,
    loadMoreGitRefs,
    reloadGitRefs,
    refreshGitChanges,
    openGitBranchDiffItem,
    openGitCommitDetailsFile,
    openGitRefDiff,
    openSourceControlChange,
    openSourceControlGraphItem,
    openSourceControlChangeContextMenu,
    openSourceControlBranchDiffContextMenu,
    openSourceControlGraphContextMenu,
    openTimelineChanges,
    openTimelineItemContextMenu,
    setGitCommitDetails,
    setGitRefPicker,
    setSidebarTab,
    setSourceControlBranchDiffBaseRef,
    setSourceControlGraphScope,
    setSourceControlView,
    showGitDiff,
    showGitFileHistory,
    compareWithGitRef,
  } = useSourceControlActions({
    config,
    copyText: (label, value) => copyTextRef.current(label, value),
    documentPayload: activeDocumentPayload,
    host,
    openContextMenu,
    onGitRefresh: (reason) => {
      if (shouldInvalidatePostDiffGitMarkersForGitRefreshReason(reason)) {
        invalidatePostDiffGitMarkersForActiveDocument("git-refresh");
      }
    },
    persistWorkspace,
    rootDirectory,
    setDocumentDiffPreview,
    workspacePerformanceMode: workspaceEnvironment?.performanceMode ?? "normal",
    showInlineNotice,
  });
  refreshSourceControlFromFileTreeRef.current = (event) =>
    handleWorkspaceFileChangeRefresh(event, refreshGitChanges);

  const matchCount = searchHits.length;
  const {
    activateSearchHit,
    clearSearch,
    handleSearchInputKeyDown,
    pinQuery,
    updateQuery,
    updateSearchIndex,
  } = useSearchState({
    articleRef,
    config,
    documentPayload,
    documentHtml,
    matchCount,
    persistWorkspace,
    query,
    searchIndex,
    setQuery,
    setRightSidebarTab,
    setSearchHits,
    setSearchIndex,
    setTabQueries,
    showLightweightActionFeedback,
  });
  const {
    duplicateWindow,
    moveTabToNewWindow,
    openCurrentDocumentInNewWindow,
    openDocumentInNewWindow,
    openNewWindow,
  } = useAppWindowActions({
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
  });

  const {
    copyHeadingLink,
    copyText,
    handleArticleContextMenu,
    handleArticleClick,
    handleArticleDoubleClick,
    handleArticleBlur,
    handleArticleFocus,
    handleArticlePointerLeave,
    handleArticlePointerMove,
    navigateToHeading,
    openFocusedLink,
  } = useDocumentLinks({
    activeHeadingId,
    articleRef,
    config,
    documentPayload,
    loadDocumentForPreview: (path) => host.openDocument(path),
    openDocument,
    openDocumentInNewWindow,
    openPathInEditor,
    resolveDocumentLink: (href, documentPath) =>
      host.resolveDocumentLink({ href, documentPath }),
    onShowGitDiff: showGitDiff,
    onConfirmKrokiRender: confirmKrokiRender,
    onLinkHoverDestinationChange: setLinkHoverDestination,
    onLinkPreviewChange: setLinkPreview,
    onOpenDiagramPreview: setDiagramPreview,
    onOpenPreferences: openPreferencesTab,
    onCompareGitRef: compareWithGitRef,
    onTryKrokiFallback: tryKrokiFallback,
    confirmExternalLink,
    openContextMenu,
    openExternalUrl: (url) => host.openExternalUrl(url),
    recordNavigation,
    renderResult,
    setActiveHeadingId,
    showInlineNotice,
    showLightweightActionFeedback,
  });
  copyTextRef.current = copyText;
  const {
    addActiveBookmark,
    addBookmarkEntry,
    addRootBookmark,
    moveBookmark,
    openBookmark,
    removeBookmarkEntry,
    toggleActiveBookmark,
  } = useBookmarksState({
    config,
    documentPayload: activeDocumentPayload,
    openDirectory,
    openDocument,
    persistWorkspace,
    rootDirectory,
    setSidebarTab,
    showInlineNotice,
  });
  const {
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
  } = useOpenFileActions({
    config,
    documentPayload,
    focusedPaneId,
    focusPane,
    lastClosedTabs,
    openDocument,
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
    tabs,
  });
  closeTabRef.current = closeTab;
  activateTabForHistoryRef.current = activateTab;

  function openPreferencesTab() {
    setPreferencesTabOpen(true);
    setActiveWorkspaceTabKind("preferences");
    setTabMoreOpen(false);
  }

  const {
    activateDocumentTabByIndex,
    activateDocumentWorkspaceTab,
    activateRelativeDocumentTab,
    closeAllWorkspaceTabs,
    closePreferencesTab,
    closeWorkspaceTab,
    openDocumentWorkspaceTab,
    restoreClosedDocumentTab,
    setPreferencesTabVisible,
  } = useWorkspaceTabActions({
    activateRelativeTab,
    activateTab,
    activateTabByIndex,
    closeAllTabs,
    closeTab,
    openDocument,
    openPreferencesTab,
    restoreClosedTab,
    setActiveWorkspaceTabKind,
    setPreferencesTabOpen,
    setTabMoreOpen,
  });

  const resolveDiffDocumentLink = useCallback(
    (href: string, documentPath: string): Promise<DocumentLinkResolution> =>
      host.resolveDocumentLink({ href, documentPath }),
    [],
  );
  const openDiffExternalUrl = useCallback(
    (url: string): Promise<void> => host.openExternalUrl(url),
    [],
  );

  const { clearActiveContentCursor, moveActiveContentCursor } =
    useContentCursorActions({
      articleRef,
      viewerRef,
      documentDiffPreview,
      diffContentCursorCommandRef,
      diffContentCursorClearRef,
    });

  const {
    activeTitle,
    appShellStyle,
    centeredContentWidth,
    diffPreviewChromeHidden,
    effectiveRightSidebarVisible,
    effectiveSidebarVisible,
    hideOpenFilesForSiteScreenshot,
    nativeAppMenuStateKey,
    rootEntries,
    showZenModeExitControl,
    topbarHidden,
    zenModeApplies,
    zenModeConfig,
    zenModeBlockingOverlay,
  } = useAppShellViewState({
    activeDocumentPayload,
    activeWorkspaceTabId,
    childrenByDirectory,
    config,
    contextMenu,
    documentDiffPreview,
    documentPayload,
    externalLinkConfirmation,
    fileComparePickerOpen,
    focusedPaneId,
    gitCommitDetails,
    gitRefPicker,
    isLoading,
    lastClosedTabs,
    navigationBackStackLength: navigationBackStack.length,
    navigationForwardStackLength: navigationForwardStack.length,
    orderedTabs,
    paneSnapshots,
    pinnedTabs,
    preferencesOpen,
    quickOpenOpen,
    recentlyVisitedLocations,
    rootDirectory,
    sidebarLayout,
    splitEnabled,
    splitRatio,
    viewerShortcutHintsOpen,
    workspaceTabs,
    zenModeActive,
    maxOpenFilesHeightForDisplay,
    diagramPreview,
  });
  const { exitZenMode, toggleZenMode } = useZenModeActions({
    zenModeActive,
    zenModeConfig,
    setZenModeActive,
    showLightweightActionFeedback,
  });

  const { dispatchCommand, isCommandEnabled } = useAppCommandWiring({
    activeDocumentPayload,
    config,
    focusedPaneId,
    lastClosedTabs,
    lastMouseGesture,
    navigationBackStack,
    navigationForwardStack,
    preferencesOpen,
    quickOpenOpen,
    splitEnabled,
    tabs,
    zenModeActive,
    orderedTabs,
    zenModeEscapeBlocked: zenModeBlockingOverlay,
    onActivateRelativeTab: activateRelativeDocumentTab,
    onActivateTabByIndex: activateDocumentTabByIndex,
    onClearSearch: clearSearch,
    onCloseAllTabs: closeAllWorkspaceTabs,
    onCloseOtherTabs: closeOtherTabs,
    onCloseSplitView: closeSplitView,
    onCloseTab: closeTab,
    onCopyHeadingLink: copyHeadingLink,
    onClearContentCursor: clearActiveContentCursor,
    onFocusPane: focusPane,
    onMoveContentCursor: moveActiveContentCursor,
    onOpenFocusedLink: openFocusedLink,
    onOpenExternalUrl: (url) => host.openExternalUrl(url),
    onCompareActiveWithPickedDocument: compareActiveWithPickedDocument,
    onCompareGitRef: compareWithGitRef,
    onComparePickedDocuments: comparePickedDocuments,
    onShowGitDiff: showGitDiff,
    onShowGitFileHistory: showGitFileHistory,
    onShowViewerShortcuts: showViewerShortcuts,
    onOpenQuickOpen: openQuickOpen,
    onOpenNewWindow: openNewWindow,
    onDuplicateWindow: duplicateWindow,
    onOpenDocument: openDocument,
    onOpenCurrentDocumentInNewWindow: openCurrentDocumentInNewWindow,
    onPickAndOpenDirectory: pickAndOpenDirectory,
    onPickAndOpenDocument: pickAndOpenDocument,
    onSaveConfig: saveConfig,
    onSearchIndexChange: updateSearchIndex,
    onSetPreferencesOpen: setPreferencesTabVisible,
    onSetRightSidebarTab: setRightSidebarTab,
    onSetSidebarTab: setSidebarTab,
    onSplitRight: openSplitRight,
    onToggleZenMode: toggleZenMode,
    onExitZenMode: exitZenMode,
    onToggleActiveBookmark: toggleActiveBookmark,
    onAddCurrentFolderBookmark: addRootBookmark,
    onTogglePinned: toggleActivePinnedTab,
    onNavigateHistory: navigateHistory,
    onRestoreClosedTab: restoreClosedDocumentTab,
    onActivateDocumentWorkspaceTab: activateDocumentWorkspaceTab,
    searchInputRef,
    openFilesFilterInputRef,
    viewerRef,
    showInlineNotice,
    showLightweightActionFeedback,
  });
  const { navigateToSourceLine, openQuickOpenCandidate } = useQuickOpenActions({
    articleRef,
    clearActiveContentCursor,
    dispatchCommand,
    documentPayload: activeDocumentPayload,
    navigateToHeading,
    openDirectory,
    openDocumentWorkspaceTab,
    recordNavigation,
    setActiveWorkspaceTabKind,
    setQuickOpenOpen,
    setQuickOpenQuery,
    setSidebarTab,
    setViewerShortcutHintsOpen,
    viewerRef,
  });

  const {
    searchScope,
    setSearchScope,
    searchInputQuery,
    workspaceSearch,
    workspaceSearchIndex,
    updateSearchQuery,
    activateWorkspaceSearchResult,
    updateWorkspaceSearchIndex,
    handleWorkspaceSearchClear,
    handleWorkspaceSearchEnterKey,
  } = useWorkspaceSearch({
    activeDocumentPayload,
    clearActiveContentCursor,
    config,
    documentHtml,
    documentPayload,
    host,
    navigateToSourceLine,
    openDocumentWorkspaceTab,
    query,
    rootDirectory,
    setRightSidebarTab,
    setTabQueries,
    updateQuery,
  });

  const { handleShellContextMenu } = useShellContextMenu({
    activateSearchHit,
    activateWorkspaceSearchResult,
    addBookmarkEntry,
    articleRef,
    bookmarks: config?.workspace.bookmarks ?? [],
    closeAllTabs: closeAllWorkspaceTabs,
    closeOtherTabs,
    closeTab,
    copyText,
    documentPayload: activeDocumentPayload,
    navigateToHeading,
    openContextMenu,
    openDocumentInNewWindow,
    moveTabToNewWindow,
    openPathInEditor,
    comparePickedDocuments,
    compareWithActiveFile,
    compareWithGitRef,
    showGitDiff,
    showGitFileHistory,
    openTabs: orderedTabs,
    pinnedTabs,
    removeBookmarkEntry,
    renderResult,
    toggleActivePinnedTab,
  });

  const { rightSidebarProps } = useAppRightSidebarWiring({
    activeHeadingId,
    activateSearchHit,
    activateWorkspaceSearchResult,
    clearActiveContentCursor,
    config,
    dispatchCommand,
    handleSearchInputKeyDown,
    handleWorkspaceSearchClear,
    handleWorkspaceSearchEnterKey,
    matchCount,
    navigateToHeading,
    pinQuery,
    renderResult,
    rightSidebarTab,
    searchHits,
    searchIndex,
    searchInputQuery,
    searchInputRef,
    searchScope,
    setRightSidebarTab,
    setSearchScope,
    updateSearchQuery,
    updateWorkspaceSearchIndex,
    workspaceSearch,
    workspaceSearchIndex,
  });
  const {
    mouseGestureTrail,
    consumePendingMouseGestureContextMenu,
    handleMouseGestureContextMenu,
    handleMouseGesturePointerCancel,
    handleMouseGesturePointerDown,
    handleMouseGesturePointerMove,
    handleMouseGesturePointerUp,
  } = useMouseGestures({
    closeContextMenu,
    config,
    preferencesOpen,
    quickOpenOpen,
    dispatchCommand,
    setLastMouseGesture,
  });
  const bookmarks = config?.workspace.bookmarks ?? [];
  const { leftSidebarProps } = useAppSidebarWiring({
    activePath: preferencesOpen ? undefined : documentPayload?.path,
    bookmarks,
    childrenByDirectory,
    config,
    directoryErrors,
    expandedDirectories,
    gitSourceControl: {
      effectiveGitTimelinePath,
      gitBranchDiff,
      gitBranchDiffLoading,
      gitChanges,
      gitChangesLoading,
      gitCommitGraph,
      gitCommitGraphLoading,
      gitCommitGraphLoadingMore,
      gitTimelineCompareBase,
      gitTimelineHistory,
      gitTimelineLoading,
      gitTimelineLoadingMore,
      loadMoreGitCommitGraph,
      loadMoreGitFileHistory,
      openGitBranchDiffItem,
      openSourceControlBranchDiffContextMenu,
      openSourceControlChange,
      openSourceControlChangeContextMenu,
      openSourceControlGraphContextMenu,
      openSourceControlGraphItem,
      openTimelineChanges,
      openTimelineItemContextMenu,
      setSourceControlBranchDiffBaseRef,
      setSourceControlGraphScope,
      setSourceControlView,
      showGitDiff,
    },
    hideOpenFiles: hideOpenFilesForSiteScreenshot,
    host,
    leftSidebarContentRef,
    loadingDirectories,
    openFileReloadStates,
    openFilesCollapsed: sidebarLayout.openFilesCollapsed,
    openFilesFilter,
    openFilesFilterInputRef,
    openFilesPaneRef,
    openFilesSplitResizeState,
    orderedTabs,
    pinnedTabs,
    preferencesActive: preferencesOpen,
    preferencesTabOpen,
    rootDirectory,
    rootEntries,
    sidebarResizeState,
    tabs,
    workspacePerformanceMode: workspaceEnvironment?.performanceMode ?? "normal",
    onActivateTab: activateDocumentWorkspaceTab,
    onActivatePreferences: openPreferencesTab,
    onAddActiveBookmark: addActiveBookmark,
    onAddRootBookmark: addRootBookmark,
    onBeginOpenFilesSplitResize: beginOpenFilesSplitResize,
    onBeginSidebarResize: beginSidebarResize,
    onCloseTab: closeTab,
    onClosePreferences: closePreferencesTab,
    onCollapseTree: collapseTree,
    onOpenBookmark: openBookmark,
    onOpenFile: openDocumentWorkspaceTab,
    onPickDirectory: pickAndOpenDirectory,
    onPickDocument: pickAndOpenDocument,
    onRefreshTree: refreshTree,
    onRemoveBookmark: removeBookmarkEntry,
    onReorderBookmarks: moveBookmark,
    onReorderOpenTabs: reorderOpenTabs,
    onResetOpenFilesSplitHeight: resetOpenFilesSplitHeight,
    onResetSidebarWidth: resetSidebarWidth,
    onSelectSidebarTab: setSidebarTab,
    onSetOpenFilesFilter: setOpenFilesFilter,
    onToggleDirectory: toggleDirectory,
    onToggleOpenFilesCollapsed: toggleOpenFilesCollapsed,
    onTogglePinned: toggleActivePinnedTab,
  });
  const quickOpenCandidates = useQuickOpenCandidates({
    bookmarks,
    childrenByDirectory,
    commandEnabled: isCommandEnabled,
    documentPayload: activeDocumentPayload,
    quickOpenQuery,
    recentDocuments: config?.workspace.recentDocuments ?? [],
    renderResult,
    tabs,
  });
  useNativeAppMenu({
    config,
    disabled: false,
    lastClosedTabs,
    recentlyVisitedLocations,
    workspaceTabs,
    activeTabId: activeWorkspaceTabId,
    menuStateKey: nativeAppMenuStateKey,
    dispatchCommand,
    isCommandEnabled,
    openDocument: openDocumentWorkspaceTab,
    openDirectory,
    openRecentlyVisitedLocation,
    restoreClosedTabAt,
  });

  useSiteScreenshotScenario({
    closeAllTabs: closeAllWorkspaceTabs,
    dismissInlineNotice,
    documentPayload,
    openDirectory,
    openDocument: openDocumentWorkspaceTab,
    openPreferences: openPreferencesTab,
    setConfig,
    setRootDirectory,
    setSidebarLayout,
    setZenModeActive,
    setRightSidebarTab,
    setSearchScope,
    showGitDiff,
    updateSearchQuery,
  });

  useEffect(() => {
    if (quickOpenOpen) {
      requestAnimationFrame(() => {
        quickOpenInputRef.current?.focus();
        quickOpenInputRef.current?.select();
      });
    }
  }, [quickOpenOpen]);

  useActiveHeadingTracking({
    articleRef,
    renderResult,
    setActiveHeadingId,
    viewerRef,
  });

  function openQuickOpen() {
    setQuickOpenOpen(true);
    setQuickOpenQuery("");
  }

  function closeQuickOpen() {
    setQuickOpenOpen(false);
    setQuickOpenQuery("");
  }

  function showViewerShortcuts() {
    closeQuickOpen();
    setViewerShortcutHintsOpen(true);
  }

  async function saveConfig(nextConfig: AppConfig) {
    const normalizedConfig = normalizeConfig(nextConfig);
    setConfig(normalizedConfig);
    setSidebarLayout(normalizedConfig.layout);
    void host.setWindowTheme(normalizedConfig.theme);
    const persistedConfig = normalizeConfig(await host.loadConfig());
    await host.saveConfig(
      mergeWindowConfigForSave({
        persistedConfig,
        windowConfig: normalizedConfig,
        windowSessionId,
      }),
    );
  }

  const theme = config?.theme ?? "light";

  function clearRecentDocuments() {
    void persistWorkspace({ recentDocuments: [] });
  }

  function clearRecentDirectories() {
    void persistWorkspace({ recentDirectories: [] });
  }

  return (
    <AppMainShell
      appShellStyle={appShellStyle}
      className={`app-shell theme-${theme} ${effectiveSidebarVisible ? "" : "left-collapsed"} ${effectiveRightSidebarVisible ? "" : "right-collapsed"} ${zenModeApplies ? "zen-mode-active" : ""} ${sidebarResizeState ? "is-resizing-sidebar" : ""} ${openFilesSplitResizeState ? "is-resizing-sidebar-split" : ""} ${splitResizeState ? "is-resizing-viewer-split" : ""}`}
      effectiveRightSidebarVisible={effectiveRightSidebarVisible}
      effectiveSidebarVisible={effectiveSidebarVisible}
      linkHoverDestination={linkHoverDestination}
      linkPreview={linkPreview}
      preferencesOpen={preferencesOpen}
      showLinkHoverStatus={!(zenModeApplies && zenModeConfig.hideStatusBar)}
      showZenModeExitControl={showZenModeExitControl}
      splitEnabled={splitEnabled}
      splitResizeState={splitResizeState}
      topbarHidden={topbarHidden}
      paneSnapshots={paneSnapshots}
      onPointerMove={(event) => {
        updateSidebarResize(event);
        updateOpenFilesSplitResize(event);
      }}
      onPointerUp={(event) => {
        endSidebarResize(event);
        endOpenFilesSplitResize(event);
      }}
      onPointerCancel={(event) => {
        cancelSidebarResize(event);
        cancelOpenFilesSplitResize(event);
      }}
      onShellContextMenu={handleShellContextMenu}
      onBeginViewerSplitResize={beginViewerSplitResize}
      onUpdateViewerSplitResize={updateViewerSplitResize}
      onEndViewerSplitResize={endViewerSplitResize}
      onBeginRightSidebarResize={(event) => beginSidebarResize("right", event)}
      onResetRightSidebarWidth={() => resetSidebarWidth("right")}
      onExitZenMode={() => void dispatchCommand("view.exitZenMode")}
      leftSidebarProps={leftSidebarProps}
      topbarProps={{
        sidebarVisible: effectiveSidebarVisible,
        activeTitle,
        activeTabId: activeWorkspaceTabId,
        tabs: workspaceTabs,
        visibleTabs: visibleWorkspaceTabs,
        overflowTabs: overflowWorkspaceTabs,
        tabMoreOpen,
        splitEnabled,
        rightSidebarVisible: effectiveRightSidebarVisible,
        rightSidebarAvailable: !preferencesOpen,
        zenModeActive: zenModeApplies,
        hideTabs: zenModeApplies && zenModeConfig.hideTabs,
        onActivateTab: (tab) => {
          if (tab.kind === "preferences") {
            openPreferencesTab();
          } else {
            activateDocumentWorkspaceTab(tab.path);
          }
        },
        onCloseTab: closeWorkspaceTab,
        onToggleTabMore: () => {
          setTabMoreOpen((current) => !current);
        },
        onDispatchCommand: (commandId) => void dispatchCommand(commandId),
      }}
      preferencesPanelProps={
        preferencesOpen && config
          ? {
              config,
              mode: "page",
              onChange: (nextConfig) => void saveConfig(nextConfig),
              onClearKrokiCache: () => void clearKrokiCache(),
              onTestKroki: testKrokiPlantUml,
              host,
              onClose: closePreferencesTab,
            }
          : null
      }
      viewerPaneProps={{
        articleRef,
        config,
        error,
        inlineNotice,
        lightweightActionFeedback,
        isLoading,
        mouseGestureTrail,
        splitEnabled,
        focusedPaneId,
        centeredContentWidth,
        hideStatusFeedback: zenModeApplies && zenModeConfig.hideStatusBar,
        documentPayload,
        renderResult,
        documentHtml,
        postDiffGitMarkers: activePostDiffGitMarkers,
        query,
        searchHits,
        searchIndex,
        viewerRef,
        onArticleClick: handleArticleClick,
        onArticleContextMenu: handleArticleContextMenu,
        onArticleDoubleClick: handleArticleDoubleClick,
        onArticleBlur: handleArticleBlur,
        onArticleFocus: handleArticleFocus,
        onArticlePointerLeave: handleArticlePointerLeave,
        onArticlePointerMove: handleArticlePointerMove,
        onClearContentCursor: clearActiveContentCursor,
        onDismissInlineNotice: dismissInlineNotice,
        onDispatchCommand: (commandId) => void dispatchCommand(commandId),
        onFocusPane: focusPane,
        onActivateSearchHit: (index) => {
          clearActiveContentCursor();
          activateSearchHit(index);
        },
        onConsumePendingMouseGestureContextMenu:
          consumePendingMouseGestureContextMenu,
        onMouseGestureContextMenu: handleMouseGestureContextMenu,
        onMouseGesturePointerCancel: handleMouseGesturePointerCancel,
        onMouseGesturePointerDown: handleMouseGesturePointerDown,
        onMouseGesturePointerMove: handleMouseGesturePointerMove,
        onMouseGesturePointerUp: handleMouseGesturePointerUp,
        onOpenDirectory: (path) => void openDirectory(path),
        onOpenDocument: (path) => void openDocument(path),
        onPickDirectory: () => void pickAndOpenDirectory(),
        onPickDocument: () => void pickAndOpenDocument(),
        onClearRecentDocuments: clearRecentDocuments,
        onClearRecentDirectories: clearRecentDirectories,
      }}
      rightSidebarProps={
        preferencesOpen
          ? null
          : rightSidebarProps
      }
      rightSidebarResizeActive={sidebarResizeState?.side === "right"}
      overlaysProps={{
        chooseCompareDocument,
        config,
        confirmedRemoteDiagramKeys,
        contextMenu,
        confirmExternalLink,
        copyText,
        diagramPreview,
        diffContentCursorClearRef,
        diffContentCursorCommandRef,
        documentDiffPreview,
        diffPreviewChromeHidden,
        documentPayload,
        externalLinkConfirmation,
        fileComparePickerOpen,
        gitCommitDetails,
        gitRefPicker,
        host,
        krokiFallbackDiagramKeys,
        loadDiffDocumentContext,
        openContextMenu,
        openDiffExternalUrl,
        quickOpenCandidates,
        quickOpenInputRef,
        quickOpenOpen,
        quickOpenQuery,
        resolveDiffLocalImage,
        resolveDiffDocumentLink,
        renderDiffDiagram,
        viewerShortcutHintsOpen,
        onCloseContextMenu: closeContextMenu,
        onCloseDocumentDiffPreview: closeDocumentDiffPreview,
        onCloseFileComparePicker: () => setFileComparePickerOpen(false),
        onCloseGitCommitDetails: () => setGitCommitDetails(null),
        onCloseGitRefPicker: () => setGitRefPicker(null),
        onCloseQuickOpen: closeQuickOpen,
        onCompareDocuments: compareDocumentPaths,
        onExternalLinkConfirmation: resolveExternalLinkConfirmation,
        onOpenDiagramPreview: setDiagramPreview,
        onOpenDocument: openDocument,
        onOpenGitCommitDetailsFile: openGitCommitDetailsFile,
        onOpenGitRefDiff: openGitRefDiff,
        onLoadMoreGitRefs: loadMoreGitRefs,
        onReloadGitRefs: reloadGitRefs,
        onOpenPathInEditor: openPathInEditor,
        onOpenQuickOpenCandidate: openQuickOpenCandidate,
        onSetLastMouseGesture: setLastMouseGesture,
        onSetQuickOpenQuery: setQuickOpenQuery,
        onSetViewerShortcutHintsOpen: setViewerShortcutHintsOpen,
        showInlineNotice,
      }}
    />
  );
}
