import { useEffect, useMemo, useRef, useState } from "react";
import { AppMainShell } from "./components/AppMainShell";
import { useActiveHeadingTracking } from "./hooks/useActiveHeadingTracking";
import { useBookmarksState } from "./hooks/useBookmarksState";
import { useAppCommandWiring } from "./hooks/useAppCommandWiring";
import { useAppDocumentInspectorState } from "./hooks/useAppDocumentInspectorState";
import { useAppRightSidebarWiring } from "./hooks/useAppRightSidebarWiring";
import { useAppShellViewState } from "./hooks/useAppShellViewState";
import { useAppSidebarWiring } from "./hooks/useAppSidebarWiring";
import { useAppWindowAndDocumentLinks } from "./hooks/useAppWindowAndDocumentLinks";
import * as antoraContext from "./hooks/useAntoraContextSelection";
import { useContentCursorActions } from "./hooks/useContentCursorActions";
import { useDocumentLifecycle } from "./hooks/useDocumentLifecycle";
import { useDocumentRender } from "./hooks/useDocumentRender";
import { useDiffPreviewHostCallbacks } from "./hooks/useDiffPreviewHostCallbacks";
import { useExternalLinkConfirmation } from "./hooks/useExternalLinkConfirmation";
import { useFileTreeState } from "./hooks/useFileTreeState";
import { useFileCompareActions } from "./hooks/useFileCompareActions";
import { useConfigChangeWatcher } from "./hooks/useConfigChangeWatcher";
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
import { useOpenFileReloadStates } from "./hooks/useOpenFileReloadStates";
import { useOpenFileActions } from "./hooks/useOpenFileActions";
import { useQuickOpenCandidates } from "./hooks/useQuickOpenCandidates";
import { useQuickOpenActions } from "./hooks/useQuickOpenActions";
import { useQuickOpenShellState } from "./hooks/useQuickOpenShellState";
import { useDiffOverlayCommandRefs } from "./hooks/useDiffOverlayCommandRefs";
import { useRecentWorkspaceActions } from "./hooks/useRecentWorkspaceActions";
import { useSearchQueryForPath } from "./hooks/useSearchQueryForPath";
import { useSearchState } from "./hooks/useSearchState";
import { useShellContextMenu } from "./hooks/useShellContextMenu";
import { useSidebarLayout } from "./hooks/useSidebarLayout";
import { useSiteScreenshotScenario } from "./hooks/useSiteScreenshotScenario";
import { useAppSourceControlReview } from "./hooks/useAppSourceControlReview";
import { useAppWorkspacePreferencesState } from "./hooks/useAppWorkspacePreferencesState";
import { useSplitViewState } from "./hooks/useSplitViewState";
import { useTabsState } from "./hooks/useTabsState";
import { useViewerSplitResize } from "./hooks/useViewerSplitResize";
import { useWorkspacePersistence } from "./hooks/useWorkspacePersistence";
import { useWorkspaceBoot } from "./hooks/useWorkspaceBoot";
import { useWorkspacePerformanceNotice } from "./hooks/useWorkspacePerformanceNotice";
import { useWorkspaceSearch } from "./hooks/useWorkspaceSearch";
import { useWorkspaceTabLayoutState } from "./hooks/useWorkspaceTabLayoutState";
import { useWorkspaceTabActions } from "./hooks/useWorkspaceTabActions";
import { useZenModeActions } from "./hooks/useZenModeActions";
import { MAIN_WINDOW_SESSION_ID } from "./lib/config";
import { saveAppConfig } from "./lib/saveAppConfig";
import { emptySafeHtml } from "./lib/safeHtml";
import type { LinkPreviewState } from "./lib/linkPreview";
import type {
  CaptureAreaRequest,
  CaptureAreaVariant,
} from "./lib/captureArea";
import type {
  DiagramPreviewState,
  MouseGestureAutomation,
  NavigationLocation,
  RecentlyVisitedLocation,
  RightSidebarTab,
  SearchHitSummary,
  SmartScrollAnchor,
} from "./types";
import { createHostAdapter } from "../adapters/createHostAdapter";
import type {
  AppConfig,
  DocumentDiffPreview,
  DocumentPayload,
  RenderResult,
  WorkspaceEnvironment,
} from "../core/types";
const host = createHostAdapter();
export function App() {
  const viewerRef = useRef<HTMLElement | null>(null);
  const articleRef = useRef<HTMLElement | null>(null);
  const activateTabForHistoryRef = useRef<ActivateTabForHistory | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const openFilesFilterInputRef = useRef<HTMLInputElement | null>(null);
  const quickOpenInputRef = useRef<HTMLInputElement | null>(null);
  const closeTabRef = useRef<((path: string) => void) | null>(null);
  const diffOverlayCommandRefs = useDiffOverlayCommandRefs();
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
  const [documentRenderRevision, setDocumentRenderRevision] = useState(0);
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
  const [zenModeActive, setZenModeActive] = useState(false);
  const antoraContextSelection = antoraContext.useAntoraContextSelectionState();
  const [fileComparePickerOpen, setFileComparePickerOpen] = useState(false);
  const {
    closeQuickOpen,
    openQuickOpen,
    quickOpenOpen,
    quickOpenQuery,
    setQuickOpenOpen,
    setQuickOpenQuery,
    setViewerShortcutHintsOpen,
    showViewerShortcuts,
    viewerShortcutHintsOpen,
  } = useQuickOpenShellState({ inputRef: quickOpenInputRef });
  const [diagramPreview, setDiagramPreview] =
    useState<DiagramPreviewState | null>(null);
  const [documentDiffPreview, setDocumentDiffPreview] =
    useState<DocumentDiffPreview | null>(null);
  const [workspaceEnvironment, setWorkspaceEnvironment] =
    useState<WorkspaceEnvironment | null>(null);
  const {
    confirmExternalLink,
    externalLinkConfirmation,
    resolveExternalLinkConfirmation,
  } = useExternalLinkConfirmation(config);
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
  const { openFileReloadStates, setOpenFileReloadStates } =
    useOpenFileReloadStates(tabs);
  const {
    activeDocumentPayload,
    openPreferencesTab,
    preferencesOpen,
    preferencesTabOpen,
    setActiveWorkspaceTabKind,
    setPreferencesTabOpen,
    setTabMoreOpen,
    tabMoreOpen,
  } = useAppWorkspacePreferencesState(documentPayload);
  const openDocumentPaths = useMemo(
    () => new Set(orderedTabs.map((tab) => tab.path)),
    [orderedTabs],
  );
  const [windowSessionId, setWindowSessionId] = useState(
    MAIN_WINDOW_SESSION_ID,
  );
  useEffect(() => {
    setLinkPreview(null);
  }, [documentPayload?.path]);
  const {
    activeWorkspaceTabId,
    overflowWorkspaceTabs,
    visibleWorkspaceTabs,
    workspaceTabs,
  } = useWorkspaceTabLayoutState({
    activeDocumentPath: documentPayload?.path,
    orderedTabs,
    preferencesOpen,
    preferencesTabOpen,
  });
  const { inlineNotice, showInlineNotice, dismissInlineNotice } =
    useInlineNotice();
  const { lightweightActionFeedback, showLightweightActionFeedback } =
    useLightweightActionFeedback();
  const { contextMenu, closeContextMenu, openContextMenu } =
    useContextMenuState();
  const [captureAreaRequest, setCaptureAreaRequest] =
    useState<CaptureAreaRequest | null>(null);
  const beginViewerCaptureArea = (variant: CaptureAreaVariant = "plain") =>
    setCaptureAreaRequest((request) => ({
      id: (request?.id ?? 0) + 1,
      variant,
    }));
  const {
    clearKrokiCache,
    clearPlantUmlSvgCache,
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
  const searchQueryForPath = useSearchQueryForPath({ config, tabQueries });
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
  const [workspaceFileChangeRevision, setWorkspaceFileChangeRevision] =
    useState(0);
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
    onWorkspaceFileChange: (event) => {
      setWorkspaceFileChangeRevision((revision) => revision + 1);
      refreshSourceControlFromFileTreeRef.current(event);
    },
  });
  const {
    diagramInspectorItems,
    includeInspectorItems,
    linkInspectorModel,
    selectedDiagramId,
    selectDiagramFromInspector,
    setDiagramRenderSnapshot,
    setSelectedDiagramId,
  } = useAppDocumentInspectorState({
    activeDocumentPayload,
    articleRef,
    documentHtml,
    openDocumentPaths,
    preferencesOpen,
    renderResult,
    rootDirectory,
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
  useConfigChangeWatcher({
    host,
    setConfig,
    setSidebarLayout,
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
  useWorkspacePerformanceNotice({
    showInlineNotice,
    workspaceEnvironment,
  });
  useMarkdownWorkerWarmupProbe(workspaceBootComplete);
  useDocumentRender({
    confirmedRemoteDiagramKeys,
    config,
    documentPayload,
    host,
    krokiFallbackDiagramKeys,
    renderRevision: documentRenderRevision,
    setError,
    setDocumentHtml,
    setDiagramRenderSnapshot,
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
    selectedAntoraContextId: antoraContextSelection.selectedContextId,
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
    bumpDocumentRenderRevision: () =>
      setDocumentRenderRevision((revision) => revision + 1),
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
  antoraContext.useReloadActiveDocumentOnAntoraContextChange({
    documentPayload,
    openDocument,
    selectedAntoraContextId: antoraContextSelection.selectedContextId,
  });
  const {
    getGitDiffPreview,
    loadDiffDocumentContext,
    openDiffExternalUrl,
    renderDiffDiagram,
    resolveDiffDocumentLink,
    resolveDiffLocalImage,
  } = useDiffPreviewHostCallbacks(host);
  const {
    activePostDiffGitMarkers,
    closeDocumentDiffPreview,
    closeDocumentDiffStreamPreview,
    diffPreviewWatchState,
    documentDiffStreamPreview,
    documentReviewSession,
    openSourceControlAllDiffs,
    refreshActiveDiffPreview,
    refreshDocumentDiffStream,
    refreshSourceControlFromFileTree,
    sourceControl,
    activeDiffPreviewWatchPath,
  } = useAppSourceControlReview({
    activeDocumentPayload,
    confirmedRemoteDiagramKeys,
    config,
    documentPayload,
    documentDiffPreview,
    getGitDiffPreview,
    host,
    renderResult,
    krokiFallbackDiagramKeys,
    loadDiffDocumentContext,
    openContextMenu,
    persistWorkspace,
    resolveDiffLocalImage,
    renderDiffDiagram,
    rootDirectory,
    setDocumentDiffPreview,
    showInlineNotice,
    workspacePerformanceMode: workspaceEnvironment?.performanceMode ?? "normal",
    copyText: (label, value) => copyTextRef.current(label, value),
  });
  refreshSourceControlFromFileTreeRef.current =
    refreshSourceControlFromFileTree;
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
  const { documentLinks, windowActions } = useAppWindowAndDocumentLinks({
    activeHeadingId,
    articleRef,
    closeTabRef,
    config,
    confirmExternalLink,
    confirmKrokiRender,
    documentPayload,
    expandedDirectories,
    focusedPaneId,
    host,
    openContextMenu,
    openDocument,
    openPathInEditor,
    onBeginCaptureArea: beginViewerCaptureArea,
    openPreferencesTab,
    orderedTabs,
    paneSnapshots,
    pinnedTabs,
    recordNavigation,
    renderResult,
    rootDirectory,
    setActiveHeadingId,
    setDiagramPreview,
    setLinkHoverDestination,
    setLinkPreview,
    setRightSidebarTab,
    setSelectedDiagramId,
    sidebarLayout,
    sourceControl,
    showInlineNotice,
    showLightweightActionFeedback,
    splitEnabled,
    splitRatio,
    tryKrokiFallback,
    viewerRef,
  });
  copyTextRef.current = documentLinks.copyText;
  const bookmarkActions = useBookmarksState({
    config,
    documentPayload: activeDocumentPayload,
    openDirectory,
    openDocument,
    persistWorkspace,
    rootDirectory,
    setSidebarTab: sourceControl.setSidebarTab,
    showInlineNotice,
  });
  const openFileActions = useOpenFileActions({
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
  closeTabRef.current = openFileActions.closeTab;
  activateTabForHistoryRef.current = openFileActions.activateTab;
  const workspaceTabActions = useWorkspaceTabActions({
    activateRelativeTab: openFileActions.activateRelativeTab,
    activateTab: openFileActions.activateTab,
    activateTabByIndex: openFileActions.activateTabByIndex,
    closeAllTabs: openFileActions.closeAllTabs,
    closeTab: openFileActions.closeTab,
    openDocument,
    openPreferencesTab,
    restoreClosedTab: openFileActions.restoreClosedTab,
    setActiveWorkspaceTabKind,
    setPreferencesTabOpen,
    setTabMoreOpen,
  });
  const contentCursor = useContentCursorActions({
    articleRef,
    viewerRef,
    documentDiffPreview,
    documentDiffStreamPreview,
    diffContentCursorCommandRef:
      diffOverlayCommandRefs.diffContentCursorCommandRef,
    diffContentCursorClearRef: diffOverlayCommandRefs.diffContentCursorClearRef,
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
    gitCommitDetails: sourceControl.gitCommitDetails,
    gitRefPicker: sourceControl.gitRefPicker,
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
    canSelectAntoraContext: antoraContextSelection.canSelectContext,
    zenModeEscapeBlocked: zenModeBlockingOverlay,
    onActivateRelativeTab: workspaceTabActions.activateRelativeDocumentTab,
    onActivateTabByIndex: workspaceTabActions.activateDocumentTabByIndex,
    onClearSearch: clearSearch,
    onCloseAllTabs: workspaceTabActions.closeAllWorkspaceTabs,
    onCloseOtherTabs: openFileActions.closeOtherTabs,
    onCloseSplitView: closeSplitView,
    onCloseTab: openFileActions.closeTab,
    onCopyHeadingLink: documentLinks.copyHeadingLink,
    onBeginCaptureArea: (variant = "plain") => {
      if (documentDiffPreview) {
        diffOverlayCommandRefs.diffCaptureAreaCommandRef.current?.(variant);
        return;
      }
      beginViewerCaptureArea(variant);
    },
    onClearContentCursor: contentCursor.clearActiveContentCursor,
    onFocusPane: focusPane,
    onMoveContentCursor: contentCursor.moveActiveContentCursor,
    onOpenFocusedLink: documentLinks.openFocusedLink,
    onOpenExternalUrl: (url) => host.openExternalUrl(url),
    onCompareActiveWithPickedDocument: compareActiveWithPickedDocument,
    onCompareGitRef: sourceControl.compareWithGitRef,
    onComparePickedDocuments: comparePickedDocuments,
    onShowGitDiff: sourceControl.showGitDiff,
    onShowGitFileHistory: sourceControl.showGitFileHistory,
    onShowViewerShortcuts: showViewerShortcuts,
    onOpenQuickOpen: openQuickOpen,
    onOpenNewWindow: windowActions.openNewWindow,
    onDuplicateWindow: windowActions.duplicateWindow,
    onOpenDocument: openDocument,
    onOpenCurrentDocumentInNewWindow:
      windowActions.openCurrentDocumentInNewWindow,
    onPickAndOpenDirectory: pickAndOpenDirectory,
    onPickAndOpenDocument: pickAndOpenDocument,
    onSaveConfig: saveConfig,
    onSearchIndexChange: updateSearchIndex,
    onSetPreferencesOpen: workspaceTabActions.setPreferencesTabVisible,
    onSetRightSidebarTab: setRightSidebarTab,
    onSetSidebarTab: sourceControl.setSidebarTab,
    onSplitRight: openSplitRight,
    onToggleZenMode: toggleZenMode,
    onExitZenMode: exitZenMode,
    onToggleActiveBookmark: bookmarkActions.toggleActiveBookmark,
    onAddCurrentFolderBookmark: bookmarkActions.addRootBookmark,
    onTogglePinned: openFileActions.toggleActivePinnedTab,
    onNavigateHistory: navigateHistory,
    onRestoreClosedTab: workspaceTabActions.restoreClosedDocumentTab,
    onSelectAntoraContextCommand: () => {
      void sourceControl.setSidebarTab("files");
      antoraContextSelection.openSelector();
    },
    diffStreamCommandRef: diffOverlayCommandRefs.diffStreamCommandRef,
    documentDiffPreviewActive: Boolean(documentDiffPreview),
    documentDiffStreamActive: Boolean(documentDiffStreamPreview),
    onActivateDocumentWorkspaceTab:
      workspaceTabActions.activateDocumentWorkspaceTab,
    searchInputRef,
    openFilesFilterInputRef,
    viewerRef,
    showInlineNotice,
    showLightweightActionFeedback,
  });
  const { navigateToSourceLine, openQuickOpenCandidate } = useQuickOpenActions({
    articleRef,
    clearActiveContentCursor: contentCursor.clearActiveContentCursor,
    dispatchCommand,
    documentPayload: activeDocumentPayload,
    navigateToHeading: documentLinks.navigateToHeading,
    openDirectory,
    openDocumentWorkspaceTab: workspaceTabActions.openDocumentWorkspaceTab,
    recordNavigation,
    setActiveWorkspaceTabKind,
    setQuickOpenOpen,
    setQuickOpenQuery,
    setSidebarTab: sourceControl.setSidebarTab,
    setViewerShortcutHintsOpen,
    viewerRef,
  });
  const bookmarks = config?.workspace.bookmarks ?? [];
  const sidebarWiring = useAppSidebarWiring({
    activePath: preferencesOpen ? undefined : documentPayload?.path,
    bookmarks,
    childrenByDirectory,
    config,
    directoryErrors,
    documentReviewSession,
    documentOrderRefreshRevision: workspaceFileChangeRevision,
    expandedDirectories,
    gitSourceControl: {
      ...sourceControl,
      openSourceControlAllDiffs,
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
    ...antoraContextSelection.sidebarProps,
    tabs,
    workspacePerformanceMode: workspaceEnvironment?.performanceMode ?? "normal",
    onActivateTab: workspaceTabActions.activateDocumentWorkspaceTab,
    onActivatePreferences: openPreferencesTab,
    onAddActiveBookmark: bookmarkActions.addActiveBookmark,
    onAddRootBookmark: bookmarkActions.addRootBookmark,
    onBeginOpenFilesSplitResize: beginOpenFilesSplitResize,
    onBeginSidebarResize: beginSidebarResize,
    onCloseTab: openFileActions.closeTab,
    onClosePreferences: workspaceTabActions.closePreferencesTab,
    onCollapseTree: collapseTree,
    onOpenBookmark: bookmarkActions.openBookmark,
    onOpenFile: workspaceTabActions.openDocumentWorkspaceTab,
    onPickDirectory: pickAndOpenDirectory,
    onPickDocument: pickAndOpenDocument,
    onRefreshTree: refreshTree,
    onRemoveBookmark: bookmarkActions.removeBookmarkEntry,
    onReorderBookmarks: bookmarkActions.moveBookmark,
    onReorderOpenTabs: openFileActions.reorderOpenTabs,
    onResetOpenFilesSplitHeight: resetOpenFilesSplitHeight,
    onResetSidebarWidth: resetSidebarWidth,
    onSelectSidebarTab: sourceControl.setSidebarTab,
    onSetOpenFilesFilter: setOpenFilesFilter,
    onToggleDirectory: toggleDirectory,
    onToggleOpenFilesCollapsed: toggleOpenFilesCollapsed,
    onTogglePinned: openFileActions.toggleActivePinnedTab,
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
    clearActiveContentCursor: contentCursor.clearActiveContentCursor,
    config,
    documentHtml,
    documentPayload,
    host,
    navigateToSourceLine,
    openDocumentWorkspaceTab: workspaceTabActions.openDocumentWorkspaceTab,
    query,
    rootDirectory,
    workspaceSearchRefreshRevision: workspaceFileChangeRevision,
    workspaceSearchOrderedPaths: sidebarWiring.workspaceSearchOrderedPaths,
    setRightSidebarTab,
    setTabQueries,
    updateQuery,
  });
  const { handleShellContextMenu } = useShellContextMenu({
    activateSearchHit,
    activateWorkspaceSearchResult,
    addBookmarkEntry: bookmarkActions.addBookmarkEntry,
    articleRef,
    bookmarks: config?.workspace.bookmarks ?? [],
    closeAllTabs: workspaceTabActions.closeAllWorkspaceTabs,
    closeOtherTabs: openFileActions.closeOtherTabs,
    closeTab: openFileActions.closeTab,
    copyText: documentLinks.copyText,
    documentPayload: activeDocumentPayload,
    documentReviewSession,
    navigateToHeading: documentLinks.navigateToHeading,
    openContextMenu,
    openDocumentInNewWindow: windowActions.openDocumentInNewWindow,
    moveTabToNewWindow: windowActions.moveTabToNewWindow,
    openPathInEditor,
    comparePickedDocuments,
    compareWithActiveFile,
    compareWithGitRef: sourceControl.compareWithGitRef,
    showGitDiff: sourceControl.showGitDiff,
    showGitFileHistory: sourceControl.showGitFileHistory,
    openTabs: orderedTabs,
    pinnedTabs,
    removeBookmarkEntry: bookmarkActions.removeBookmarkEntry,
    renderResult,
    toggleActivePinnedTab: openFileActions.toggleActivePinnedTab,
  });
  const { rightSidebarProps } = useAppRightSidebarWiring({
    activeHeadingId,
    activateSearchHit,
    activateWorkspaceSearchResult,
    clearActiveContentCursor: contentCursor.clearActiveContentCursor,
    config,
    diagramInspectorItems,
    documentPayload: activeDocumentPayload,
    linkInspectorModel,
    includeInspectorItems,
    dispatchCommand,
    handleSearchInputKeyDown,
    handleWorkspaceSearchClear,
    handleWorkspaceSearchEnterKey,
    matchCount,
    navigateToHeading: documentLinks.navigateToHeading,
    openLinkedDocument: workspaceTabActions.openDocumentWorkspaceTab,
    openIncludeDocument: workspaceTabActions.openDocumentWorkspaceTab,
    pinQuery,
    renderResult,
    rightSidebarTab,
    searchHits,
    searchIndex,
    searchInputQuery,
    searchInputRef,
    searchScope,
    selectedDiagramId,
    setSelectedDiagramId: selectDiagramFromInspector,
    setRightSidebarTab,
    setSearchScope,
    showInlineNotice,
    copyText: documentLinks.copyText,
    saveSvgFile: (fileName, svg) => host.saveSvgFile(fileName, svg),
    navigateToSourceLine,
    onOpenDiagramPreview: setDiagramPreview,
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
    openDocument: workspaceTabActions.openDocumentWorkspaceTab,
    openDirectory,
    openRecentlyVisitedLocation,
    restoreClosedTabAt: openFileActions.restoreClosedTabAt,
  });
  useSiteScreenshotScenario({
    closeAllTabs: workspaceTabActions.closeAllWorkspaceTabs,
    dismissInlineNotice,
    documentPayload,
    openDirectory,
    openDocument: workspaceTabActions.openDocumentWorkspaceTab,
    openPreferences: openPreferencesTab,
    loadDocumentForScreenshot: (path) => host.openDocument(path),
    setConfig,
    setDocumentPayload,
    setRootDirectory,
    setSidebarLayout,
    setTabs,
    setZenModeActive,
    setWindowTheme: (theme) => host.setWindowTheme(theme),
    setRightSidebarTab,
    setSearchScope,
    compareDocumentPaths,
    showGitDiff: sourceControl.showGitDiff,
    updateSearchQuery,
  });
  useActiveHeadingTracking({
    articleRef,
    renderResult,
    setActiveHeadingId,
    viewerRef,
  });
  const { clearRecentDocuments, clearRecentDirectories } =
    useRecentWorkspaceActions(persistWorkspace);
  async function saveConfig(nextConfig: AppConfig) {
    await saveAppConfig({
      host,
      nextConfig,
      setConfig,
      setSidebarLayout,
      windowSessionId,
    });
  }
  return (
    <AppMainShell
      appShellStyle={appShellStyle}
      className={`app-shell theme-${config?.theme ?? "light"} ${effectiveSidebarVisible ? "" : "left-collapsed"} ${effectiveRightSidebarVisible ? "" : "right-collapsed"} ${zenModeApplies ? "zen-mode-active" : ""} ${sidebarResizeState ? "is-resizing-sidebar" : ""} ${openFilesSplitResizeState ? "is-resizing-sidebar-split" : ""} ${splitResizeState ? "is-resizing-viewer-split" : ""}`}
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
      leftSidebarProps={sidebarWiring.leftSidebarProps}
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
        documentOrderNavigation: sidebarWiring.documentOrderNavigation,
        onActivateTab: (tab) => {
          if (tab.kind === "preferences") {
            openPreferencesTab();
          } else {
            workspaceTabActions.activateDocumentWorkspaceTab(tab.path);
          }
        },
        onCloseTab: workspaceTabActions.closeWorkspaceTab,
        onToggleTabMore: () => {
          setTabMoreOpen((current) => !current);
        },
        onOpenDocumentOrderTarget: (path) =>
          void workspaceTabActions.openDocumentWorkspaceTab(path),
        onDispatchCommand: (commandId) => void dispatchCommand(commandId),
      }}
      preferencesPanelProps={
        preferencesOpen && config
          ? {
              config,
              mode: "page",
              onChange: (nextConfig) => void saveConfig(nextConfig),
              onClearKrokiCache: clearKrokiCache,
              onClearPlantUmlSvgCache: clearPlantUmlSvgCache,
              onTestKroki: testKrokiPlantUml,
              host,
              onClose: workspaceTabActions.closePreferencesTab,
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
        captureAreaRequest,
        postDiffGitMarkers: activePostDiffGitMarkers,
        query,
        searchHits,
        searchIndex,
        viewerRef,
        onArticleClick: documentLinks.handleArticleClick,
        onArticleContextMenu: documentLinks.handleArticleContextMenu,
        onArticleDoubleClick: documentLinks.handleArticleDoubleClick,
        onArticleBlur: documentLinks.handleArticleBlur,
        onArticleFocus: documentLinks.handleArticleFocus,
        onArticlePointerLeave: documentLinks.handleArticlePointerLeave,
        onArticlePointerMove: documentLinks.handleArticlePointerMove,
        onCaptureArea: documentLinks.copyCaptureArea,
        onClearContentCursor: contentCursor.clearActiveContentCursor,
        onDismissInlineNotice: dismissInlineNotice,
        onDispatchCommand: (commandId) => void dispatchCommand(commandId),
        onFocusPane: focusPane,
        onActivateSearchHit: (index) => {
          contentCursor.clearActiveContentCursor();
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
      rightSidebarProps={preferencesOpen ? null : rightSidebarProps}
      rightSidebarResizeActive={sidebarResizeState?.side === "right"}
      overlaysProps={{
        chooseCompareDocument,
        config,
        confirmedRemoteDiagramKeys,
        contextMenu,
        confirmExternalLink,
        copyText: documentLinks.copyText,
        diagramPreview,
        ...diffOverlayCommandRefs,
        documentDiffPreview,
        documentDiffStreamPreview,
        diffPreviewWatchState: activeDiffPreviewWatchPath
          ? diffPreviewWatchState
          : undefined,
        diffPreviewChromeHidden,
        documentPayload,
        documentReviewSession,
        externalLinkConfirmation,
        fileComparePickerOpen,
        gitCommitDetails: sourceControl.gitCommitDetails,
        gitRefPicker: sourceControl.gitRefPicker,
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
        onCloseDocumentDiffStreamPreview: closeDocumentDiffStreamPreview,
        onRefreshDiffPreview: activeDiffPreviewWatchPath
          ? refreshActiveDiffPreview
          : undefined,
        onRefreshDocumentDiffStream: refreshDocumentDiffStream,
        onCloseFileComparePicker: () => setFileComparePickerOpen(false),
        onCloseGitCommitDetails: () => sourceControl.setGitCommitDetails(null),
        onCloseGitRefPicker: () => sourceControl.setGitRefPicker(null),
        onCloseQuickOpen: closeQuickOpen,
        onCompareDocuments: compareDocumentPaths,
        onExternalLinkConfirmation: resolveExternalLinkConfirmation,
        onOpenDiagramPreview: setDiagramPreview,
        onOpenDocument: openDocument,
        onOpenGitCommitDetailsFile: sourceControl.openGitCommitDetailsFile,
        onOpenAllDiffs: openSourceControlAllDiffs,
        onOpenGitRefDiff: sourceControl.openGitRefDiff,
        onLoadMoreGitRefs: sourceControl.loadMoreGitRefs,
        onReloadGitRefs: sourceControl.reloadGitRefs,
        onOpenPathInEditor: openPathInEditor,
        onOpenQuickOpenCandidate: openQuickOpenCandidate,
        onSetLastMouseGesture: setLastMouseGesture,
        onSetQuickOpenQuery: setQuickOpenQuery,
        onSetViewerShortcutHintsOpen: setViewerShortcutHintsOpen,
        showLightweightActionFeedback,
        showInlineNotice,
      }}
    />
  );
}
