import { useEffect, useMemo } from "react";
import { defaultConfig } from "../core/defaultConfig";
import { AppMainShell } from "./components/AppMainShell";
import { AppAgentPanel } from "./components/AppAgentPanel";
import * as appHooks from "./hooks/appHooks";
// prettier-ignore
const { useActiveHeadingTracking, useBookmarksState, useAppCommandWiring, useAppConfigActions, useAppLocalState, useAppDocumentInspectorState, useAppRightSidebarWiring, useAppShellViewState, useAppSidebarWiring, useAppWindowAndDocumentLinks, antoraContext, useContentCursorActions, useDocumentLifecycle, useDocumentRender, useDiffPreviewHostCallbacks, useExternalLinkConfirmation, useFileTreeState, useFileCompareActions, useConfigChangeWatcher, useInlineNotice, useKrokiActions, useLightweightActionFeedback, useContextMenuState, useMouseGestures, useMarkdownWorkerWarmupProbe, useNativeAppMenu, useNavigationHistory, useOpenFileReloadStates, useOpenFileActions, useQuickOpenCandidates, useQuickOpenActions, useQuickOpenShellState, useDiffOverlayCommandRefs, useDiffAgentDockState, createAppAgentChatDisplayActions, useAppAgentChatDisplayState, useAgentChatOriginActions, useDetachedAgentChatOwnerSync, useRecentWorkspaceActions, useSearchQueryForPath, useSearchState, useShellContextMenu, useSidebarLayout, useSiteScreenshotScenario, useAppSourceControlReview, useAppWorkspacePreferencesState, useSplitViewState, useTabsState, useViewerSplitResize, useWorkspacePersistence, useWorkspaceBoot, useWorkspacePerformanceNotice, useWorkspaceSearch, useWorkspaceTabLayoutState, useWorkspaceTabActions, useAgentQuotedContextReveal, useAgentQuotedContextState, useZenModeActions } = appHooks;
import { createAppTopbarProps } from "./lib/appTopbarProps";
import type { CaptureAreaVariant } from "./lib/captureArea";
import { appHost as host } from "./appHost";
import type { AppConfig } from "../core/types";
import { panelPlacement } from "./agent/agentPanelTypes";
import { agentChatHandoffPayload } from "./agent/agentChatHandoff";
export function App() {
  const local = useAppLocalState();
  // prettier-ignore
  const { activeHeadingId, activateTabForHistoryRef, agentPanelPlacement, articleRef, captureAreaRequest, closeTabRef, codexPanelOpen, config, confirmedRemoteDiagramKeys, copyTextRef, diagramPreview, documentDiffPreview, documentHtml, documentHtmlRevision, documentPayload, documentRenderRevision, error, fileComparePickerOpen, isLoading, krokiFallbackDiagramKeys, lastMouseGesture, linkHoverDestination, linkPreview, navigationBackStack, navigationForwardStack, openFilesFilter, openFilesFilterInputRef, pendingSmartScrollAnchor, query, quickOpenInputRef, recentlyVisitedLocations, refreshSourceControlFromFileTreeRef, renderResult, rightSidebarTab, searchHits, searchIndex, searchInputRef, setActiveHeadingId, setAgentPanelPlacement, setCaptureAreaRequest, setCodexPanelOpen, setConfig, setConfirmedRemoteDiagramKeys, setDiagramPreview, setDocumentDiffPreview, setDocumentHtml, setDocumentHtmlRevision, setDocumentPayload, setDocumentRenderRevision, setError, setFileComparePickerOpen, setIsLoading, setKrokiFallbackDiagramKeys, setLastMouseGesture, setLinkHoverDestination, setLinkPreview, setNavigationBackStack, setNavigationForwardStack, setOpenFilesFilter, setPendingSmartScrollAnchor, setQuery, setRecentlyVisitedLocations, setRenderResult, setRightSidebarTab, setSearchHits, setSearchIndex, setTabQueries, setWindowSessionId, setWorkspaceBootComplete, setWorkspaceEnvironment, setWorkspaceFileChangeRevision, setZenModeActive, tabQueries, viewerRef, windowSessionId, workspaceBootComplete, workspaceEnvironment, workspaceFileChangeRevision, workspaceTreeGenerationRef, zenModeActive, } = local;
  const diffOverlayCommandRefs = useDiffOverlayCommandRefs();
  const antoraContextSelection = antoraContext.useAntoraContextSelectionState();
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
  const {
    confirmExternalLink,
    externalLinkConfirmation,
    resolveExternalLinkConfirmation,
  } = useExternalLinkConfirmation(config);
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
    preferencesSectionRequest,
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
  // prettier-ignore
  const { closeSplitView, focusedPaneId, focusPane, openSplitRight, paneSnapshots, pendingNavigationLocation, replaceClosedDocumentInPaneSnapshots, resetSplitToDocument, resetSplitToEmpty, setFocusedPaneId, setPaneSnapshots, setPendingNavigationLocation, setSplitEnabled, setSplitRatio, snapshotForPath, splitEnabled, splitRatio, } = useSplitViewState({
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
    canAutoPersist: !isLoading && workspaceBootComplete,
    config,
    documentPayload,
    focusedPaneId,
    host,
    paneSnapshots,
    setConfig,
    splitEnabled,
    splitRatio,
    viewerRef,
    windowSessionId,
  });
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
  const agentChatAvailable = Boolean(rootDirectory);
  const agentExecutablePreference = (
    config?.agentProviders ?? defaultConfig.agentProviders
  ).codex.executable;
  const agentChatDisplayState = useAppAgentChatDisplayState({
    executablePreference: agentExecutablePreference,
    host,
    onError: showLightweightActionFeedback,
    onOpenChange: setCodexPanelOpen,
    workspaceRoot: rootDirectory,
  });
  // prettier-ignore
  const { agentChatEntryState, detachedAgentChat, latestMainAgentSnapshotRef, setMainAgentSnapshotMovable, setMainAgentSnapshotReady } = agentChatDisplayState;
  const {
    acceptQuotedContexts,
    addQuotedContext: addAgentQuotedContext,
    beginQuotedContextReveal,
    pendingReveal: pendingQuotedContextReveal,
    quotedContexts: agentQuotedContexts,
    registerQuotedContext: registerAgentQuotedContext,
    removeQuotedContext,
    setPendingReveal: setPendingQuotedContextReveal,
  } = useAgentQuotedContextState({
    agentChatAvailable,
    preferencesOpen,
    rootDirectory,
    setCodexPanelOpen,
    showInlineNotice,
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
  // prettier-ignore
  function saveConfig(nextConfig: AppConfig) { return persistAppConfig(nextConfig); }
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
  const { saveConfig: persistAppConfig } = useAppConfigActions({
    host,
    setConfig,
    setSidebarLayout,
    windowSessionId,
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
  // prettier-ignore
  useWorkspaceBoot({ host, workspaceTreeGenerationRef, setWindowSessionId, setChildrenByDirectory, setConfig, setDirectoryErrors, setDocumentPayload, setError, setExpandedDirectories, setFocusedPaneId, setIsLoading, setWorkspaceBootComplete, setPaneSnapshots, setPendingNavigationLocation, setQuery, setRootDirectory, setSidebarLayout, setSplitEnabled, setSplitRatio, setTabQueries, setTabs, setWorkspaceEnvironment, });
  useWorkspacePerformanceNotice({
    showInlineNotice,
    workspaceEnvironment,
  });
  useMarkdownWorkerWarmupProbe(workspaceBootComplete);
  // prettier-ignore
  useDocumentRender({ confirmedRemoteDiagramKeys, config, documentPayload, host, krokiFallbackDiagramKeys, renderRevision: documentRenderRevision, setError, setDocumentHtml, setDocumentHtmlRevision, setDiagramRenderSnapshot, setRenderResult, });
  const { navigateHistory, openRecentlyVisitedLocation, recordNavigation } =
    // prettier-ignore
    useNavigationHistory({ activeHeadingId, activateTabRef: activateTabForHistoryRef, articleRef, documentHtml, documentPayload, documentRenderRevision: documentHtmlRevision, navigationBackStack, navigationForwardStack, pendingNavigationLocation, pendingSmartScrollAnchor, setActiveHeadingId, setNavigationBackStack, setNavigationForwardStack, setRecentlyVisitedLocations, setPendingNavigationLocation, setPendingSmartScrollAnchor, viewerRef, });
  const {
    openDirectory,
    openDocument,
    openPathInEditor,
    pickAndOpenDirectory,
    pickAndOpenDocument,
  } = useDocumentLifecycle({
    canWatchDocuments: workspaceBootComplete,
    workspaceTreeGenerationRef,
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
    documentRenderRevision,
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
    openDocumentDiffPreviewFromStream,
    openSourceControlAllDiffs,
    refreshActiveDiffPreview,
    refreshDocumentDiffStream,
    refreshSourceControlFromFileTree,
    resolveRevisionLensTargets,
    sourceControl,
    activeDiffPreviewWatchPath,
    // prettier-ignore
  } = useAppSourceControlReview({
    activeDocumentPayload,
    confirmedRemoteDiagramKeys,
    config: workspaceBootComplete ? config : null,
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
  // prettier-ignore
  const { addQuotedContext: addAgentDiffQuotedContext, agentDock: diffAgentDock,
    focusRequest: diffAgentFocusRequest, mainPanelOpen: baseMainAgentPanelOpen,
    mountTarget: diffAgentMountTarget, requestComposerFocus: requestAgentComposerFocus } = useDiffAgentDockState({
      available: agentChatAvailable, chatOpen: codexPanelOpen,
      diffOpen: Boolean(documentDiffPreview || documentDiffStreamPreview), onChatOpenChange: setCodexPanelOpen, registerQuotedContext: registerAgentQuotedContext,
    });
  const mainAgentPanelOpen =
    baseMainAgentPanelOpen && !detachedAgentChat.detached;
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
    onAddAgentSelection: addAgentQuotedContext,
    onAddAgentMedia: addAgentQuotedContext,
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
  // prettier-ignore
  const bookmarkActions = useBookmarksState({ config, documentPayload: activeDocumentPayload, openDirectory, openDocument, persistWorkspace, rootDirectory, setSidebarTab: sourceControl.setSidebarTab, showInlineNotice, });
  // prettier-ignore
  const openFileActions = useOpenFileActions({ config, documentPayload, focusedPaneId, focusPane, lastClosedTabs, openDocument, openFileReloadStates, orderedTabs, persistWorkspace, recordNavigation, replaceClosedDocumentInPaneSnapshots, resetSplitToDocument, resetSplitToEmpty, searchQueryForPath, setActiveHeadingId, setDocumentHtml, setDocumentPayload, setError, setFocusedPaneId, setIsLoading, setLastClosedTabs, setNavigationBackStack, setNavigationForwardStack, setPendingNavigationLocation, setQuery, setRenderResult, setSearchHits, setSearchIndex, setSplitEnabled, setTabMoreOpen, setTabs, showInlineNotice, showLightweightActionFeedback, snapshotForPath, tabs, });
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
  // prettier-ignore
  const contentCursor = useContentCursorActions({ articleRef, viewerRef, documentDiffPreview, documentDiffStreamPreview, diffContentCursorCommandRef: diffOverlayCommandRefs.diffContentCursorCommandRef, diffContentCursorClearRef: diffOverlayCommandRefs.diffContentCursorClearRef, });
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
    // prettier-ignore
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
  // prettier-ignore
  const { dispatchCommand, isCommandEnabled } = useAppCommandWiring({ activeDocumentPayload, config, focusedPaneId, lastClosedTabs, lastMouseGesture, navigationBackStack, navigationForwardStack, preferencesOpen, quickOpenOpen, splitEnabled, tabs, zenModeActive, orderedTabs, canSelectAntoraContext: antoraContextSelection.canSelectContext, zenModeEscapeBlocked: zenModeBlockingOverlay, onActivateRelativeTab: workspaceTabActions.activateRelativeDocumentTab, onActivateTabByIndex: workspaceTabActions.activateDocumentTabByIndex, onClearSearch: clearSearch, onCloseAllTabs: workspaceTabActions.closeAllWorkspaceTabs, onCloseOtherTabs: openFileActions.closeOtherTabs, onCloseSplitView: closeSplitView, onCloseTab: openFileActions.closeTab, onCopyHeadingLink: documentLinks.copyHeadingLink, onBeginCaptureArea: (variant = "plain") => { if (documentDiffPreview) { diffOverlayCommandRefs.diffCaptureAreaCommandRef.current?.(variant); return; } beginViewerCaptureArea(variant); }, onClearContentCursor: contentCursor.clearActiveContentCursor, onFocusPane: focusPane, onMoveContentCursor: contentCursor.moveActiveContentCursor, onOpenFocusedLink: documentLinks.openFocusedLink, onOpenExternalUrl: (url) => host.openExternalUrl(url), onCompareActiveWithPickedDocument: compareActiveWithPickedDocument, onCompareGitRef: sourceControl.compareWithGitRef, onComparePickedDocuments: comparePickedDocuments, onShowGitDiff: sourceControl.showGitDiff, onShowGitFileHistory: sourceControl.showGitFileHistory, onShowViewerShortcuts: showViewerShortcuts, onOpenQuickOpen: openQuickOpen, onOpenNewWindow: windowActions.openNewWindow, onDuplicateWindow: windowActions.duplicateWindow, onOpenDocument: openDocument, onOpenCurrentDocumentInNewWindow: windowActions.openCurrentDocumentInNewWindow, onPickAndOpenDirectory: pickAndOpenDirectory, onPickAndOpenDocument: pickAndOpenDocument, onSaveConfig: saveConfig, onSearchIndexChange: updateSearchIndex, onSetPreferencesOpen: workspaceTabActions.setPreferencesTabVisible, onSetRightSidebarTab: setRightSidebarTab, onSetSidebarTab: sourceControl.setSidebarTab, onSplitRight: openSplitRight, onToggleZenMode: toggleZenMode, onExitZenMode: exitZenMode, onToggleActiveBookmark: bookmarkActions.toggleActiveBookmark, onAddCurrentFolderBookmark: bookmarkActions.addRootBookmark, onTogglePinned: openFileActions.toggleActivePinnedTab, onNavigateHistory: navigateHistory, onRestoreClosedTab: workspaceTabActions.restoreClosedDocumentTab, onSelectAntoraContextCommand: () => { void sourceControl.setSidebarTab("files"); antoraContextSelection.openSelector(); }, diffStreamCommandRef: diffOverlayCommandRefs.diffStreamCommandRef, documentDiffPreviewActive: Boolean(documentDiffPreview), documentDiffStreamActive: Boolean(documentDiffStreamPreview), onActivateDocumentWorkspaceTab: workspaceTabActions.activateDocumentWorkspaceTab, searchInputRef, openFilesFilterInputRef, viewerRef, showInlineNotice, showLightweightActionFeedback, });
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
  // prettier-ignore
  // prettier-ignore
  const sidebarWiring = useAppSidebarWiring({ activePath: preferencesOpen ? undefined : documentPayload?.path, bookmarks, childrenByDirectory, config, directoryErrors, documentReviewSession, documentOrderRefreshRevision: workspaceFileChangeRevision, expandedDirectories, gitSourceControl: { ...sourceControl, openSourceControlAllDiffs, }, gitStatusEnabled: workspaceBootComplete, hideOpenFiles: hideOpenFilesForSiteScreenshot, host, leftSidebarContentRef, loadingDirectories, openFileReloadStates, openFilesCollapsed: sidebarLayout.openFilesCollapsed, openFilesFilter, openFilesFilterInputRef, openFilesPaneRef, openFilesSplitResizeState, orderedTabs, pinnedTabs, preferencesActive: preferencesOpen, preferencesTabOpen, rootDirectory, rootEntries, sidebarResizeState, ...antoraContextSelection.sidebarProps, tabs, workspacePerformanceMode: workspaceEnvironment?.performanceMode ?? "normal", onActivateTab: workspaceTabActions.activateDocumentWorkspaceTab, onActivatePreferences: openPreferencesTab, onAddActiveBookmark: bookmarkActions.addActiveBookmark, onAddRootBookmark: bookmarkActions.addRootBookmark, onBeginOpenFilesSplitResize: beginOpenFilesSplitResize, onBeginSidebarResize: beginSidebarResize, onCloseTab: openFileActions.closeTab, onClosePreferences: workspaceTabActions.closePreferencesTab, onCollapseTree: collapseTree, onOpenBookmark: bookmarkActions.openBookmark, onOpenFile: workspaceTabActions.openDocumentWorkspaceTab, onPickDirectory: pickAndOpenDirectory, onPickDocument: pickAndOpenDocument, onRefreshTree: refreshTree, onRemoveBookmark: bookmarkActions.removeBookmarkEntry, onReorderBookmarks: bookmarkActions.moveBookmark, onReorderOpenTabs: openFileActions.reorderOpenTabs, onResetOpenFilesSplitHeight: resetOpenFilesSplitHeight, onResetSidebarWidth: resetSidebarWidth, onSelectSidebarTab: sourceControl.setSidebarTab, onSetOpenFilesFilter: setOpenFilesFilter, onToggleDirectory: toggleDirectory, onToggleOpenFilesCollapsed: toggleOpenFilesCollapsed, onTogglePinned: openFileActions.toggleActivePinnedTab, });
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
  // prettier-ignore
  const { handleShellContextMenu } = useShellContextMenu({ activateSearchHit, activateWorkspaceSearchResult, addBookmarkEntry: bookmarkActions.addBookmarkEntry, articleRef, bookmarks: config?.workspace.bookmarks ?? [], closeAllTabs: workspaceTabActions.closeAllWorkspaceTabs, closeOtherTabs: openFileActions.closeOtherTabs, closeTab: openFileActions.closeTab, copyText: documentLinks.copyText, documentPayload: activeDocumentPayload, documentReviewSession, navigateToHeading: documentLinks.navigateToHeading, openContextMenu, openDocumentInNewWindow: windowActions.openDocumentInNewWindow, moveTabToNewWindow: windowActions.moveTabToNewWindow, openPathInEditor, comparePickedDocuments, compareWithActiveFile, compareWithGitRef: sourceControl.compareWithGitRef, showGitDiff: sourceControl.showGitDiff, showGitFileHistory: sourceControl.showGitFileHistory, openTabs: orderedTabs, pinnedTabs, removeBookmarkEntry: bookmarkActions.removeBookmarkEntry, renderResult, toggleActivePinnedTab: openFileActions.toggleActivePinnedTab, });
  // prettier-ignore
  // prettier-ignore
  const { rightSidebarProps } = useAppRightSidebarWiring({ activeHeadingId, activateSearchHit, activateWorkspaceSearchResult, clearActiveContentCursor: contentCursor.clearActiveContentCursor, config, diagramInspectorItems, documentPayload: activeDocumentPayload, linkInspectorModel, includeInspectorItems, dispatchCommand, handleSearchInputKeyDown, handleWorkspaceSearchClear, handleWorkspaceSearchEnterKey, matchCount, navigateToHeading: documentLinks.navigateToHeading, openLinkedDocument: workspaceTabActions.openDocumentWorkspaceTab, openIncludeDocument: workspaceTabActions.openDocumentWorkspaceTab, pinQuery, renderResult, rightSidebarTab, searchHits, searchIndex, searchInputQuery, searchInputRef, searchScope, selectedDiagramId, setSelectedDiagramId: selectDiagramFromInspector, setRightSidebarTab, setSearchScope, showInlineNotice, copyText: documentLinks.copyText, saveSvgFile: (fileName, svg) => host.saveSvgFile(fileName, svg), navigateToSourceLine, onOpenDiagramPreview: setDiagramPreview, updateSearchQuery, updateWorkspaceSearchIndex, workspaceSearch, workspaceSearchIndex, });
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
  // prettier-ignore
  const quickOpenCandidates = useQuickOpenCandidates({ bookmarks, childrenByDirectory, commandEnabled: isCommandEnabled, documentPayload: activeDocumentPayload, quickOpenQuery, recentDocuments: config?.workspace.recentDocuments ?? [], renderResult, tabs, });
  // prettier-ignore
  useNativeAppMenu({ config, disabled: false, lastClosedTabs, recentlyVisitedLocations, workspaceTabs, activeTabId: activeWorkspaceTabId, menuStateKey: nativeAppMenuStateKey, dispatchCommand, isCommandEnabled, openDocument: workspaceTabActions.openDocumentWorkspaceTab, openDirectory, openRecentlyVisitedLocation, restoreClosedTabAt: openFileActions.restoreClosedTabAt, });
  // prettier-ignore
  useSiteScreenshotScenario({ closeAllTabs: workspaceTabActions.closeAllWorkspaceTabs, dismissInlineNotice, documentPayload: workspaceBootComplete ? documentPayload : null, openDirectory, openDocument: workspaceTabActions.openDocumentWorkspaceTab, openPreferences: openPreferencesTab, loadDocumentForScreenshot: (path) => host.openDocument(path), setConfig, setDocumentPayload, setRootDirectory, setSidebarLayout, setTabs, setZenModeActive, setWindowTheme: (theme) => host.setWindowTheme(theme), setRightSidebarTab, setSearchScope, compareDocumentPaths, showGitDiff: sourceControl.showGitDiff, updateSearchQuery, });
  useActiveHeadingTracking({
    articleRef,
    renderResult,
    setActiveHeadingId,
    viewerRef,
  });
  // prettier-ignore
  useAgentQuotedContextReveal({ articleRef, documentDiffPreview, documentDiffStreamPreview, documentHtmlRevision, documentPath: documentPayload?.path, pendingReveal: pendingQuotedContextReveal, setPendingReveal: setPendingQuotedContextReveal, showInlineNotice, });
  // prettier-ignore
  useDetachedAgentChatOwnerSync({ activeDocument: activeDocumentPayload, detachedAgentChat, host, onError: showLightweightActionFeedback, quotedContexts: agentQuotedContexts, workspaceRoot: rootDirectory, });
  useAgentChatOriginActions(host, (action) => {
    if (action.type === "openDocument") {
      void openFileActions.activateTab(action.path);
    } else if (action.type === "reviewChanges") {
      void sourceControl.reviewAgentChanges();
    } else {
      const target = beginQuotedContextReveal(action.snapshot);
      if (target.kind === "diffPreview") setDocumentDiffPreview(target.preview);
      else if (target.kind === "diffStream")
        openSourceControlAllDiffs(target.stream);
      else void openFileActions.activateTab(target.documentPath);
    }
  });
  const { clearRecentDocuments, clearRecentDirectories } =
    useRecentWorkspaceActions(persistWorkspace);
  const diffAgentSurfaceOpen = Boolean(
    documentDiffPreview || documentDiffStreamPreview,
  );
  const {
    agentChatDisplayItems,
    prepareAgentChatDisplayMenu,
    selectAgentChatDisplay,
  } = createAppAgentChatDisplayActions({
    codexPanelOpen,
    diffAgentSurfaceOpen,
    executablePreference: agentExecutablePreference,
    host,
    mainPlacement: agentPanelPlacement,
    openAgentProviders: () => openPreferencesTab("agentProviders"),
    requestComposerFocus: requestAgentComposerFocus,
    setCodexPanelOpen,
    setMainPlacement: setAgentPanelPlacement,
    showFeedback: showLightweightActionFeedback,
    state: agentChatDisplayState,
  });
  // prettier-ignore
  const topbarProps = createAppTopbarProps({
    activateDocumentTab: workspaceTabActions.activateDocumentWorkspaceTab,
    base: {
      sidebarVisible: effectiveSidebarVisible, activeTitle,
      activeTabId: activeWorkspaceTabId, tabs: workspaceTabs,
      visibleTabs: visibleWorkspaceTabs, overflowTabs: overflowWorkspaceTabs,
      tabMoreOpen, splitEnabled,
      rightSidebarVisible: effectiveRightSidebarVisible,
      rightSidebarAvailable: !preferencesOpen, zenModeActive: zenModeApplies,
      hideTabs: zenModeApplies && zenModeConfig.hideTabs,
      documentOrderNavigation: sidebarWiring.documentOrderNavigation,
      codexSpikeAvailable: agentChatAvailable, codexSpikeActive: codexPanelOpen,
      codexSpikeDetached: detachedAgentChat.detached || detachedAgentChat.moving,
      agentChatDisplayItems,
      agentChatEntryState:
        codexPanelOpen || detachedAgentChat.detached || detachedAgentChat.moving
          ? "ready"
          : agentChatEntryState,
      onBeforeOpenAgentChat: prepareAgentChatDisplayMenu,
      onSelectAgentChatDisplay: selectAgentChatDisplay,
    },
    closeWorkspaceTab: workspaceTabActions.closeWorkspaceTab,
    codexPanelOpen,
    dispatchCommand: (commandId) => void dispatchCommand(commandId),
    openDocumentTab: workspaceTabActions.openDocumentWorkspaceTab,
    openPreferencesTab, preferencesOpen,
    setTabMoreOpen,
  });
  return (
    // prettier-ignore
    <AppMainShell
      appShellStyle={appShellStyle}
      className={`app-shell theme-${config?.theme ?? "light"} ${effectiveSidebarVisible ? "" : "left-collapsed"} ${effectiveRightSidebarVisible && !mainAgentPanelOpen ? "" : "right-collapsed"} ${mainAgentPanelOpen ? "codex-panel-active" : ""} ${zenModeApplies ? "zen-mode-active" : ""} ${sidebarResizeState ? "is-resizing-sidebar" : ""} ${openFilesSplitResizeState ? "is-resizing-sidebar-split" : ""} ${splitResizeState ? "is-resizing-viewer-split" : ""}`}
      effectiveRightSidebarVisible={
        effectiveRightSidebarVisible && !mainAgentPanelOpen
      }
      effectiveSidebarVisible={effectiveSidebarVisible}
      linkHoverDestination={linkHoverDestination}
      linkPreview={linkPreview}
      preferencesOpen={preferencesOpen}
      showLinkHoverStatus={!(zenModeApplies && zenModeConfig.hideStatusBar)}
      showZenModeExitControl={showZenModeExitControl}
      splitEnabled={splitEnabled}
      agentPanelPlacement={agentPanelPlacement}
      codexPanelOpen={mainAgentPanelOpen}
      codexPanel={
        detachedAgentChat.detached ? null : <AppAgentPanel
          activeDocument={activeDocumentPayload}
          confirmExternalLink={confirmExternalLink}
          focusRequest={diffAgentFocusRequest}
          host={host}
          open={codexPanelOpen}
          onClose={() => setCodexPanelOpen(false)}
          onOpenDocument={openFileActions.activateTab}
          providerConfig={
            config?.agentProviders ?? defaultConfig.agentProviders
          }
          theme={config?.theme ?? defaultConfig.theme}
          quotedContexts={agentQuotedContexts}
          onRemoveQuotedContext={removeQuotedContext}
          onQuotedContextsAccepted={acceptQuotedContexts}
          onReviewChanges={sourceControl.reviewAgentChanges}
          onMainPlacementChange={setAgentPanelPlacement}
          onDetach={async (snapshot) => {
            const detachedFromDiff = diffAgentMountTarget !== null;
            const moved = await detachedAgentChat.detach(snapshot);
            if (moved && detachedFromDiff) {
              setCodexPanelOpen(false);
            }
          }}
          handoffSnapshot={detachedAgentChat.reattachSnapshot}
          handoffMoving={detachedAgentChat.moving}
          onHandoffReady={detachedAgentChat.acknowledgeReattach}
          onHandoffFailure={detachedAgentChat.failReattach}
          onHandoffSnapshotChange={(snapshot) => {
            latestMainAgentSnapshotRef.current = snapshot;
            setMainAgentSnapshotReady(true);
            const recovery = agentChatHandoffPayload(snapshot)?.recoveryState;
            setMainAgentSnapshotMovable(
              recovery !== "cleaning" &&
                recovery !== "cleanupFailed" &&
                recovery !== "reconnecting",
            );
          }}
          lastMainPlacement={agentPanelPlacement}
          onReturnToQuotedContext={(snapshot) => {
            const target = beginQuotedContextReveal(snapshot);
            if (target.kind === "diffPreview") {
              setDocumentDiffPreview(target.preview);
            } else if (target.kind === "diffStream") {
              openSourceControlAllDiffs(target.stream);
            } else {
              void openFileActions.activateTab(target.documentPath);
            }
          }}
          preferencesOpen={preferencesOpen}
          placement={panelPlacement(agentPanelPlacement, diffAgentMountTarget)}
          portalTarget={diffAgentMountTarget}
          workspaceRoot={rootDirectory}
        />
      }
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
      topbarProps={topbarProps}
      preferencesPanelProps={
        preferencesOpen && config
          ? {
              config,
              mode: "page",
              onChange: (nextConfig) => void persistAppConfig(nextConfig),
              onClearKrokiCache: clearKrokiCache,
              onClearPlantUmlSvgCache: clearPlantUmlSvgCache,
              onTestKroki: testKrokiPlantUml,
              host,
              onClose: workspaceTabActions.closePreferencesTab,
              sectionRequest: preferencesSectionRequest,
            }
          : null
      }
      viewerPaneProps={{
        articleRef, config, error, inlineNotice, lightweightActionFeedback,
        isLoading, mouseGestureTrail, splitEnabled, focusedPaneId,
        centeredContentWidth,
        hideStatusFeedback: zenModeApplies && zenModeConfig.hideStatusBar,
        documentPayload, documentRenderRevision: documentHtmlRevision,
        renderResult, documentHtml, captureAreaRequest,
        postDiffGitMarkers: activePostDiffGitMarkers,
        resolveRevisionLensTargets, query, searchHits, searchIndex, viewerRef,
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
        onAddAgentSelection: addAgentQuotedContext,
        onShowSelectionNotice: (message) =>
          showInlineNotice(message, { tone: "warning" }),
      }}
      rightSidebarProps={preferencesOpen ? null : rightSidebarProps}
      rightSidebarResizeActive={sidebarResizeState?.side === "right"}
      overlaysProps={{
        agentDock: diffAgentDock,
        chooseCompareDocument, config, confirmedRemoteDiagramKeys, contextMenu,
        confirmExternalLink,
        copyText: documentLinks.copyText,
        diagramPreview, ...diffOverlayCommandRefs, documentDiffPreview,
        documentDiffStreamPreview,
        diffPreviewWatchState: activeDiffPreviewWatchPath
          ? diffPreviewWatchState
          : undefined,
        diffPreviewChromeHidden, documentPayload, documentReviewSession,
        externalLinkConfirmation, fileComparePickerOpen,
        gitCommitDetails: sourceControl.gitCommitDetails,
        gitRefPicker: sourceControl.gitRefPicker,
        host, krokiFallbackDiagramKeys, loadDiffDocumentContext, openContextMenu,
        openDiffExternalUrl, quickOpenCandidates, quickOpenInputRef,
        quickOpenOpen, quickOpenQuery, resolveDiffLocalImage,
        resolveDiffDocumentLink, renderDiffDiagram, viewerShortcutHintsOpen,
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
        onOpenDocumentDiffPreviewFromStream: openDocumentDiffPreviewFromStream,
        onAddAgentDiffContext: addAgentDiffQuotedContext,
        selectionRevealTarget:
          pendingQuotedContextReveal?.target.kind === "document"
            ? null
            : (pendingQuotedContextReveal?.target ?? null),
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
