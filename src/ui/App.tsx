import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { AppOverlays } from "./components/AppOverlays";
import { LeftSidebar } from "./components/LeftSidebar";
import { LinkPreviewPopover } from "./components/LinkPreviewPopover";
import { PreferencesPanel } from "./components/PreferencesPanel";
import { RightSidebar } from "./components/RightSidebar";
import { Topbar } from "./components/Topbar";
import { ViewerPane } from "./components/ViewerPane";
import { useActiveHeadingTracking } from "./hooks/useActiveHeadingTracking";
import { useBookmarksState } from "./hooks/useBookmarksState";
import { useDocumentLifecycle } from "./hooks/useDocumentLifecycle";
import { useDocumentLinks } from "./hooks/useDocumentLinks";
import { useDocumentRender } from "./hooks/useDocumentRender";
import { useExternalLinkConfirmation } from "./hooks/useExternalLinkConfirmation";
import { useFileTreeState } from "./hooks/useFileTreeState";
import { useFileCompareActions } from "./hooks/useFileCompareActions";
import { useGitStatusHints } from "./hooks/useGitStatusHints";
import { useInlineNotice } from "./hooks/useInlineNotice";
import { useKrokiActions } from "./hooks/useKrokiActions";
import { buildLeftSidebarSourceControlProps } from "./hooks/useLeftSidebarSourceControlProps";
import { useLightweightActionFeedback } from "./hooks/useLightweightActionFeedback";
import { useCommandDispatcher } from "./hooks/useCommandDispatcher";
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
import { svardWebsiteUrl } from "../core/projectLinks";
import { usePostDiffGitMarkerState } from "./hooks/usePostDiffGitMarkerState";
import { useWorkspaceTabActions } from "./hooks/useWorkspaceTabActions";
import { fileName } from "./lib/path";
import {
  shouldHideDiffPreviewChromeForZenMode,
  shouldHideTopbarForZenMode,
  shouldShowZenModeExitControl,
} from "./lib/zenMode";
import {
  activeWorkspaceTabId as resolveActiveWorkspaceTabId,
  buildWorkspaceTabs,
} from "./lib/workspaceTabs";
import {
  MAIN_WINDOW_SESSION_ID,
  clampOpenFilesHeight,
  normalizeConfig,
} from "./lib/config";
import {
  clearContentCursor,
  moveContentCursor,
  type ContentCursorCommandHandler,
} from "./lib/contentCursor";
import { scrollViewer } from "./lib/viewerScroll";
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
  PaneId,
  RecentlyVisitedLocation,
  RightSidebarTab,
  SearchHitSummary,
  SmartScrollAnchor,
  ViewerPaneSnapshot,
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
  SplitSessionState,
  ViewerWindowOpenRequest,
  WorkspaceEnvironment,
} from "../core/types";
import { defaultConfig } from "../core/defaultConfig";
import { getBoundedTabs } from "../core/tabLayout";
import { nextRecentTabPath } from "../core/workspaceState";
import { tracePerf } from "./lib/perfTrace";

const host = createHostAdapter();

export function App() {
  const viewerRef = useRef<HTMLElement | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const activateTabForHistoryRef = useRef<ActivateTabForHistory | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const openFilesFilterInputRef = useRef<HTMLInputElement | null>(null);
  const quickOpenInputRef = useRef<HTMLInputElement | null>(null);
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
    onGitRefresh: () =>
      invalidatePostDiffGitMarkersForActiveDocument("git-refresh"),
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

  function clearActiveContentCursor() {
    clearContentCursor(articleRef.current);
    diffContentCursorClearRef.current?.();
    clearContentCursor(...visibleDiffContentCursorRoots());
  }

  function visibleDiffContentCursorRoots() {
    const paneReviewIds = [
      "git-full-preview-right-pane",
      "git-rendered-right-pane",
      "git-full-preview-left-pane",
      "git-rendered-left-pane",
    ];
    return paneReviewIds
      .map((reviewId) =>
        document.querySelector<HTMLElement>(
          `[data-review-id="${reviewId}"] .git-rendered-scroll`,
        ),
      )
      .filter((root): root is HTMLElement => root !== null);
  }

  function moveActiveContentCursor(direction: "next" | "previous") {
    if (documentDiffPreview) {
      return diffContentCursorCommandRef.current?.(direction) ?? false;
    }
    return moveContentCursor({
      root: articleRef.current,
      scrollContainer: viewerRef.current,
      direction,
    });
  }

  const zenModeConfig = config?.zenMode ?? defaultConfig.zenMode;
  const zenModeApplies =
    zenModeActive &&
    !preferencesOpen &&
    !(documentDiffPreview && !zenModeConfig.applyToDiffPreview);
  const effectiveSidebarVisible =
    (config?.sidebarVisible ?? true) &&
    !(zenModeApplies && zenModeConfig.hideLeftSidebar);
  const effectiveRightSidebarVisible =
    (config?.rightSidebarVisible ?? true) &&
    !(zenModeApplies && zenModeConfig.hideRightSidebar);
  const zenModeBlockingOverlay = Boolean(
    preferencesOpen ||
    quickOpenOpen ||
    fileComparePickerOpen ||
    viewerShortcutHintsOpen ||
    diagramPreview ||
    documentDiffPreview ||
    externalLinkConfirmation ||
    gitCommitDetails ||
    gitRefPicker ||
    contextMenu,
  );
  const centeredContentWidth =
    zenModeApplies && zenModeConfig.centerLayout && !splitEnabled
      ? zenModeConfig.maxContentWidth
      : null;
  const topbarHidden = shouldHideTopbarForZenMode(
    zenModeApplies,
    zenModeConfig,
  );
  const diffPreviewChromeHidden = shouldHideDiffPreviewChromeForZenMode(
    zenModeApplies,
    zenModeConfig,
  );
  const showZenModeExitControl = shouldShowZenModeExitControl({
    blockingOverlay: zenModeBlockingOverlay,
    diffPreviewOpen: Boolean(documentDiffPreview),
    topbarHidden,
    zenModeApplies,
  });
  const siteScreenshotScenario = import.meta.env.VITE_SVARD_SITE_SCREENSHOT_SCENARIO as string | undefined;
  const hasSiteScreenshotGitWorkspaceTab = orderedTabs.some((tab) =>
    tab.path.includes("/source-control-workspace/"),
  );
  const hideOpenFilesForSiteScreenshot = Boolean(
    hasSiteScreenshotGitWorkspaceTab &&
      (siteScreenshotScenario === "source-control" ||
        config?.workspace.sidebarTab === "sourceControl"),
  );

  const recentTabPath = nextRecentTabPath(
    config?.workspace.recentTabs ?? [],
    activeDocumentPayload?.path ?? null,
    orderedTabs.map((tab) => tab.path),
  );

  function switchToRecentTab() {
    if (recentTabPath) {
      void activateDocumentWorkspaceTab(recentTabPath);
    }
  }

  const { dispatchCommand, isCommandEnabled } = useCommandDispatcher({
    config,
    documentPayload: activeDocumentPayload,
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
    canSwitchToRecentTab: Boolean(recentTabPath),
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
    onOpenWebsite: () => host.openExternalUrl(svardWebsiteUrl),
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
    onScrollViewer: (kind) => scrollViewer(viewerRef, kind),
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
    onSwitchToRecentTab: switchToRecentTab,
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

  function handleSearchClear() {
    if (searchScope === "workspace") {
      handleWorkspaceSearchClear();
      return;
    }
    void dispatchCommand("search.clear");
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (handleWorkspaceSearchEnterKey(event)) {
      return;
    }
    if (event.key === "Enter") {
      clearActiveContentCursor();
    }
    handleSearchInputKeyDown(event);
  }
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
  const activeTitle = preferencesOpen
    ? "Preferences"
    : documentPayload
      ? fileName(documentPayload.path)
      : isLoading
        ? "Loading"
        : "Start";
  const leftSidebarSourceControlProps = buildLeftSidebarSourceControlProps({
    config,
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
  });
  const bookmarks = config?.workspace.bookmarks ?? [];
  const gitStatusByPath = useGitStatusHints({
    bookmarks,
    childrenByDirectory,
    host,
    tabs,
    workspacePerformanceMode: workspaceEnvironment?.performanceMode ?? "normal",
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
  const nativeAppMenuStateKey = JSON.stringify({
    activePath: activeDocumentPayload?.path ?? null,
    bookmarks: bookmarks.map((bookmark) => `${bookmark.kind}:${bookmark.path}`),
    keybindings: config?.keybindings ?? null,
    lastClosed: lastClosedTabs.map((tab) => tab.path),
    navigationBack: navigationBackStack.length,
    navigationForward: navigationForwardStack.length,
    openTabs: orderedTabs.map((tab) => tab.path),
    pinnedTabs,
    recentTabs: config?.workspace.recentTabs ?? [],
    preferencesOpen,
    recentDirectories: config?.workspace.recentDirectories ?? [],
    recentDocuments: config?.workspace.recentDocuments ?? [],
    recentlyVisited: recentlyVisitedLocations.map(
      (location) =>
        `${location.path}:${location.headingId ?? ""}:${location.label ?? ""}:${location.visitedAt}`,
    ),
    rightSidebarVisible: config?.rightSidebarVisible ?? false,
    rootDirectory,
    sidebarVisible: config?.sidebarVisible ?? false,
    splitEnabled,
    zenModeActive,
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

  async function openNewWindow() {
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
  }

  async function duplicateWindow() {
    const activePath = documentPayload?.path ?? null;
    const nextScrollPositions = { ...(config?.workspace.scrollPositions ?? {}) };
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
  }

  async function openDocumentInNewWindow(
    path: string,
    options: { pinned?: boolean; recentTabs?: string[] } = {},
  ) {
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
  }

  async function moveTabToNewWindow(path: string) {
    await openDocumentInNewWindow(path, {
      pinned: pinnedTabs.includes(path),
      recentTabs: [path],
    });
    closeTab(path);
    showLightweightActionFeedback("Moved tab to new window");
  }

  async function openCurrentDocumentInNewWindow(path: string) {
    await openDocumentInNewWindow(path);
  }

  async function toggleZenMode() {
    if (zenModeActive) {
      await exitZenMode();
    } else {
      await enterZenMode();
    }
  }

  async function enterZenMode() {
    setZenModeActive(true);
    if (zenModeConfig.fullScreen && !document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch {
        // Zen mode is still useful without OS fullscreen; avoid covering the reader.
      }
    }
    showLightweightActionFeedback("Zen mode");
  }

  async function exitZenMode() {
    setZenModeActive(false);
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // Leaving Zen mode should not be blocked by the platform fullscreen API.
      }
    }
    showLightweightActionFeedback("Exited Zen mode");
  }

  const theme = config?.theme ?? "light";
  const rootEntries = childrenByDirectory[rootDirectory] ?? [];
  const appShellStyle = {
    "--left-sidebar-width": `${sidebarLayout.leftSidebarWidth}px`,
    "--right-sidebar-width": `${sidebarLayout.rightSidebarWidth}px`,
    "--zen-content-width": `${zenModeConfig.maxContentWidth}px`,
    "--open-files-height": `${clampOpenFilesHeight(
      sidebarLayout.openFilesHeight,
      maxOpenFilesHeightForDisplay(),
    )}px`,
    "--split-left-width": `${Math.round(splitRatio * 100)}%`,
  } as CSSProperties;

  function clearRecentDocuments() {
    void persistWorkspace({ recentDocuments: [] });
  }

  function clearRecentDirectories() {
    void persistWorkspace({ recentDirectories: [] });
  }

  function renderViewerPane(paneId: PaneId, snapshot: ViewerPaneSnapshot) {
    return (
      <ViewerPane
        articleRef={articleRef}
        config={config}
        error={error}
        inlineNotice={inlineNotice}
        lightweightActionFeedback={lightweightActionFeedback}
        isLoading={isLoading}
        mouseGestureTrail={mouseGestureTrail}
        paneId={paneId}
        snapshot={snapshot}
        splitEnabled={splitEnabled}
        focusedPaneId={focusedPaneId}
        centeredContentWidth={centeredContentWidth}
        hideStatusFeedback={zenModeApplies && zenModeConfig.hideStatusBar}
        documentPayload={documentPayload}
        renderResult={renderResult}
        documentHtml={documentHtml}
        postDiffGitMarkers={activePostDiffGitMarkers}
        query={query}
        searchHits={searchHits}
        searchIndex={searchIndex}
        viewerRef={viewerRef}
        onArticleClick={handleArticleClick}
        onArticleContextMenu={handleArticleContextMenu}
        onArticleDoubleClick={handleArticleDoubleClick}
        onArticleBlur={handleArticleBlur}
        onArticleFocus={handleArticleFocus}
        onArticlePointerLeave={handleArticlePointerLeave}
        onArticlePointerMove={handleArticlePointerMove}
        onClearContentCursor={clearActiveContentCursor}
        onDismissInlineNotice={dismissInlineNotice}
        onDispatchCommand={(commandId) => void dispatchCommand(commandId)}
        onFocusPane={focusPane}
        onActivateSearchHit={(index) => {
          clearActiveContentCursor();
          activateSearchHit(index);
        }}
        onConsumePendingMouseGestureContextMenu={
          consumePendingMouseGestureContextMenu
        }
        onMouseGestureContextMenu={handleMouseGestureContextMenu}
        onMouseGesturePointerCancel={handleMouseGesturePointerCancel}
        onMouseGesturePointerDown={handleMouseGesturePointerDown}
        onMouseGesturePointerMove={handleMouseGesturePointerMove}
        onMouseGesturePointerUp={handleMouseGesturePointerUp}
        onOpenDirectory={(path) => void openDirectory(path)}
        onOpenDocument={(path) => void openDocument(path)}
        onPickDirectory={() => void pickAndOpenDirectory()}
        onPickDocument={() => void pickAndOpenDocument()}
        onClearRecentDocuments={clearRecentDocuments}
        onClearRecentDirectories={clearRecentDirectories}
      />
    );
  }

  return (
    <div
      className={`app-shell theme-${theme} ${effectiveSidebarVisible ? "" : "left-collapsed"} ${effectiveRightSidebarVisible ? "" : "right-collapsed"} ${zenModeApplies ? "zen-mode-active" : ""} ${sidebarResizeState ? "is-resizing-sidebar" : ""} ${openFilesSplitResizeState ? "is-resizing-sidebar-split" : ""} ${splitResizeState ? "is-resizing-viewer-split" : ""}`}
      data-zen-mode-active={zenModeApplies ? "true" : undefined}
      data-review-id="shell"
      style={appShellStyle}
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
      onContextMenu={handleShellContextMenu}
    >
      {effectiveSidebarVisible && (
        <LeftSidebar
          activePath={preferencesOpen ? undefined : documentPayload?.path}
          preferencesTabOpen={preferencesTabOpen}
          preferencesActive={preferencesOpen}
          bookmarks={bookmarks}
          childrenByDirectory={childrenByDirectory}
          directoryErrors={directoryErrors}
          expandedDirectories={expandedDirectories}
          loadingDirectories={loadingDirectories}
          openFilesFilter={openFilesFilter}
          hideOpenFiles={hideOpenFilesForSiteScreenshot}
          openFilesCollapsed={sidebarLayout.openFilesCollapsed}
          openFilesFilterInputRef={openFilesFilterInputRef}
          openFilesPaneRef={openFilesPaneRef}
          openFilesSplitResizeState={openFilesSplitResizeState}
          orderedTabs={orderedTabs}
          pinnedTabs={pinnedTabs}
          rootDirectory={rootDirectory}
          rootEntries={rootEntries}
          gitStatusByPath={gitStatusByPath}
          openFileReloadStates={openFileReloadStates}
          sidebarResizeState={sidebarResizeState}
          sidebarTab={config?.workspace.sidebarTab ?? "files"}
          leftSidebarContentRef={leftSidebarContentRef}
          {...leftSidebarSourceControlProps}
          onActivateTab={activateDocumentWorkspaceTab}
          onActivatePreferences={openPreferencesTab}
          onAddActiveBookmark={() => void addActiveBookmark()}
          onAddRootBookmark={() => void addRootBookmark()}
          onBeginOpenFilesSplitResize={beginOpenFilesSplitResize}
          onBeginSidebarResize={beginSidebarResize}
          onCloseTab={closeTab}
          onClosePreferences={closePreferencesTab}
          onCollapseTree={() => void collapseTree()}
          onOpenBookmark={(bookmark) => void openBookmark(bookmark)}
          onOpenFile={(path) => void openDocumentWorkspaceTab(path)}
          onPickDirectory={() => void pickAndOpenDirectory()}
          onPickDocument={() => void pickAndOpenDocument()}
          onRefreshTree={() => void refreshTree()}
          onRemoveBookmark={(path) => void removeBookmarkEntry(path)}
          onReorderBookmarks={(fromIndex, toIndex) =>
            void moveBookmark(fromIndex, toIndex)
          }
          onReorderOpenTabs={reorderOpenTabs}
          onResetOpenFilesSplitHeight={resetOpenFilesSplitHeight}
          onResetSidebarWidth={resetSidebarWidth}
          onSelectSidebarTab={(tab) => void setSidebarTab(tab)}
          onSetOpenFilesFilter={setOpenFilesFilter}
          onToggleDirectory={(path) => void toggleDirectory(path)}
          onToggleOpenFilesCollapsed={toggleOpenFilesCollapsed}
          onTogglePinned={toggleActivePinnedTab}
        />
      )}

      <main className={`main-column ${topbarHidden ? "topbar-hidden" : ""}`}>
        {!topbarHidden && (
          <Topbar
            sidebarVisible={effectiveSidebarVisible}
            activeTitle={activeTitle}
            activeTabId={activeWorkspaceTabId}
            tabs={workspaceTabs}
            visibleTabs={visibleWorkspaceTabs}
            overflowTabs={overflowWorkspaceTabs}
            tabMoreOpen={tabMoreOpen}
            splitEnabled={splitEnabled}
            rightSidebarVisible={effectiveRightSidebarVisible}
            rightSidebarAvailable={!preferencesOpen}
            zenModeActive={zenModeApplies}
            hideTabs={zenModeApplies && zenModeConfig.hideTabs}
            onActivateTab={(tab) => {
              if (tab.kind === "preferences") {
                openPreferencesTab();
              } else {
                activateDocumentWorkspaceTab(tab.path);
              }
            }}
            onCloseTab={closeWorkspaceTab}
            onToggleTabMore={() => {
              setTabMoreOpen((current) => !current);
            }}
            onDispatchCommand={(commandId) => void dispatchCommand(commandId)}
          />
        )}

        {preferencesOpen && config ? (
          <PreferencesPanel
            config={config}
            mode="page"
            onChange={(nextConfig) => void saveConfig(nextConfig)}
            onClearKrokiCache={() => void clearKrokiCache()}
            onTestKroki={testKrokiPlantUml}
            host={host}
            onClose={closePreferencesTab}
          />
        ) : splitEnabled ? (
          <div className="viewer-split" data-review-id="viewer-split">
            {renderViewerPane("left", paneSnapshots.left)}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize split panes"
              className={`viewer-split-resizer ${splitResizeState ? "active" : ""}`}
              data-review-id="viewer-split-resizer"
              onPointerDown={beginViewerSplitResize}
              onPointerMove={updateViewerSplitResize}
              onPointerUp={endViewerSplitResize}
              onPointerCancel={endViewerSplitResize}
            />
            {renderViewerPane("right", paneSnapshots.right)}
          </div>
        ) : (
          renderViewerPane("left", paneSnapshots.left)
        )}
      </main>
      {showZenModeExitControl && (
        <button
          type="button"
          className="zen-mode-exit-control"
          data-review-id="zen-mode-exit-control"
          aria-label="Exit Zen Mode"
          title="Exit Zen Mode"
          onClick={() => void dispatchCommand("view.exitZenMode")}
        >
          ×
        </button>
      )}

      {effectiveRightSidebarVisible && preferencesOpen ? (
        <aside
          className="sidebar right preferences-right-sidebar-placeholder"
          data-review-id="preferences-right-sidebar-placeholder"
          aria-hidden="true"
        />
      ) : effectiveRightSidebarVisible ? (
        <aside className="sidebar right" data-review-id="right-sidebar">
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize right sidebar"
            className={`sidebar-resizer right-resizer ${sidebarResizeState?.side === "right" ? "active" : ""}`}
            data-review-id="right-sidebar-resizer"
            onPointerDown={(event) => beginSidebarResize("right", event)}
            onDoubleClick={() => resetSidebarWidth("right")}
          />
          <RightSidebar
            activeHeadingId={activeHeadingId}
            matchCount={matchCount}
            pinnedSearch={config?.workspace.pinnedSearch ?? null}
            query={searchInputQuery}
            renderResult={renderResult}
            rightSidebarTab={rightSidebarTab}
            searchScope={searchScope}
            searchHits={searchHits}
            searchIndex={searchIndex}
            searchInputRef={searchInputRef}
            workspaceSearch={workspaceSearch}
            workspaceSearchIndex={workspaceSearchIndex}
            onActivateSearchHit={(index) => {
              clearActiveContentCursor();
              activateSearchHit(index);
            }}
            onActivateWorkspaceSearchResult={(index) =>
              void activateWorkspaceSearchResult(index)
            }
            onClearSearch={handleSearchClear}
            onDispatchCommand={(commandId) => void dispatchCommand(commandId)}
            onNavigateHeading={(headingId) => {
              clearActiveContentCursor();
              navigateToHeading(headingId);
            }}
            onPinQuery={() => void pinQuery()}
            onSetSearchScope={setSearchScope}
            onSetRightSidebarTab={setRightSidebarTab}
            onSearchInputKeyDown={handleSearchKeyDown}
            onUpdateQuery={updateSearchQuery}
            onWorkspaceSearchIndexChange={updateWorkspaceSearchIndex}
          />
        </aside>
      ) : null}
      <AppOverlays
        chooseCompareDocument={chooseCompareDocument}
        config={config}
        confirmedRemoteDiagramKeys={confirmedRemoteDiagramKeys}
        contextMenu={contextMenu}
        confirmExternalLink={confirmExternalLink}
        copyText={copyText}
        diagramPreview={diagramPreview}
        diffContentCursorClearRef={diffContentCursorClearRef}
        diffContentCursorCommandRef={diffContentCursorCommandRef}
        documentDiffPreview={documentDiffPreview}
        diffPreviewChromeHidden={diffPreviewChromeHidden}
        documentPayload={documentPayload}
        externalLinkConfirmation={externalLinkConfirmation}
        fileComparePickerOpen={fileComparePickerOpen}
        gitCommitDetails={gitCommitDetails}
        gitRefPicker={gitRefPicker}
        host={host}
        krokiFallbackDiagramKeys={krokiFallbackDiagramKeys}
        loadDiffDocumentContext={loadDiffDocumentContext}
        openContextMenu={openContextMenu}
        openDiffExternalUrl={openDiffExternalUrl}
        quickOpenCandidates={quickOpenCandidates}
        quickOpenInputRef={quickOpenInputRef}
        quickOpenOpen={quickOpenOpen}
        quickOpenQuery={quickOpenQuery}
        resolveDiffLocalImage={resolveDiffLocalImage}
        resolveDiffDocumentLink={resolveDiffDocumentLink}
        renderDiffDiagram={renderDiffDiagram}
        viewerShortcutHintsOpen={viewerShortcutHintsOpen}
        onCloseContextMenu={closeContextMenu}
        onCloseDocumentDiffPreview={closeDocumentDiffPreview}
        onCloseFileComparePicker={() => setFileComparePickerOpen(false)}
        onCloseGitCommitDetails={() => setGitCommitDetails(null)}
        onCloseGitRefPicker={() => setGitRefPicker(null)}
        onCloseQuickOpen={closeQuickOpen}
        onCompareDocuments={compareDocumentPaths}
        onExternalLinkConfirmation={resolveExternalLinkConfirmation}
        onOpenDiagramPreview={setDiagramPreview}
        onOpenDocument={openDocument}
        onOpenGitCommitDetailsFile={openGitCommitDetailsFile}
        onOpenGitRefDiff={openGitRefDiff}
        onLoadMoreGitRefs={loadMoreGitRefs}
        onReloadGitRefs={reloadGitRefs}
        onOpenPathInEditor={openPathInEditor}
        onOpenQuickOpenCandidate={openQuickOpenCandidate}
        onSetLastMouseGesture={setLastMouseGesture}
        onSetQuickOpenQuery={setQuickOpenQuery}
        onSetViewerShortcutHintsOpen={setViewerShortcutHintsOpen}
        showInlineNotice={showInlineNotice}
      />
      {linkHoverDestination &&
        !(zenModeApplies && zenModeConfig.hideStatusBar) && (
          <div className="link-hover-status" data-review-id="link-hover-status">
            {linkHoverDestination}
          </div>
        )}
      <LinkPreviewPopover preview={linkPreview} />
    </div>
  );
}
