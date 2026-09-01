import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import {
  BookmarksPanel,
  OpenFilesList,
  SidebarTabs,
  SourceControlPanel,
} from "./SidebarLists";
import { FileTreePanel } from "./FileTreePanel";
import type {
  AppConfig,
  BookmarkEntry,
  DirectoryEntry,
  DocumentOrderCatalog,
  DocumentDiffStreamPreview,
  DocumentPayload,
  GitBranchDiff,
  GitBranchDiffEntry,
  GitChanges,
  GitCommitGraph,
  GitCommitGraphScope,
  GitFileHistory,
  GitFileHistoryItem,
  GitDiffStatus,
} from "../../core/types";
import type { DocumentsViewMode } from "../lib/fileTreeDocuments";
import type { DocumentReviewSessionControls } from "../lib/documentReviewSession";
import type { SuggestedDocumentsMode } from "./fileTreePanel/types";
import type { OpenFileReloadState } from "../types";

interface LeftSidebarProps {
  activePath?: string;
  antoraContextSelectorOpenSignal: number;
  preferencesTabOpen: boolean;
  preferencesActive: boolean;
  bookmarks: BookmarkEntry[];
  childrenByDirectory: Record<string, DirectoryEntry[]>;
  directoryErrors: Record<string, string>;
  expandedDirectories: Set<string>;
  loadingDirectories: Set<string>;
  openFilesFilter: string;
  hideOpenFiles?: boolean;
  openFilesCollapsed: boolean;
  openFilesFilterInputRef: RefObject<HTMLInputElement | null>;
  openFilesPaneRef: RefObject<HTMLElement | null>;
  openFilesSplitResizeState: unknown;
  orderedTabs: DocumentPayload[];
  openDocumentPaths: ReadonlySet<string>;
  pinnedTabs: string[];
  rootDirectory: string;
  rootEntries: DirectoryEntry[];
  documentOrder: DocumentOrderCatalog;
  documentReviewSession: DocumentReviewSessionControls;
  filesViewMode: DocumentsViewMode;
  suggestedDocumentsMode?: SuggestedDocumentsMode;
  activeDocumentOrderSectionKeys: ReadonlySet<string>;
  gitStatusByPath: Record<string, GitDiffStatus>;
  openFileReloadStates: Record<string, OpenFileReloadState>;
  gitChanges: GitChanges | null;
  gitChangesLoading: boolean;
  gitFileHistoryGitState: GitChanges | null;
  gitBranchDiff: GitBranchDiff | null;
  gitBranchDiffLoading: boolean;
  gitCommitGraph: GitCommitGraph | null;
  gitCommitGraphLoading: boolean;
  gitCommitGraphLoadingMore: boolean;
  gitTimelineHistory: GitFileHistory | null;
  gitTimelineLoading: boolean;
  gitTimelineLoadingMore: boolean;
  gitTimelinePath: string | null;
  sidebarResizeState: { side: "left" | "right" } | null;
  sidebarTab: AppConfig["workspace"]["sidebarTab"];
  sourceControlView: AppConfig["workspace"]["sourceControlView"];
  sourceControlGraphScope: GitCommitGraphScope;
  leftSidebarContentRef: RefObject<HTMLDivElement | null>;
  onActivateTab: (path: string) => void;
  onActivatePreferences: () => void;
  onAddActiveBookmark: () => void;
  onAddRootBookmark: () => void;
  onSelectAntoraContext: (contextId: string) => void;
  onLoadMoreGitCommitGraph: () => void;
  onLoadMoreGitFileHistory: () => void;
  onBeginOpenFilesSplitResize: (event: ReactPointerEvent<HTMLElement>) => void;
  onBeginSidebarResize: (
    side: "left" | "right",
    event: ReactPointerEvent<HTMLElement>,
  ) => void;
  onCloseTab: (path: string) => void;
  onClosePreferences: () => void;
  onCollapseTree: () => void;
  onOpenBookmark: (bookmark: BookmarkEntry) => void;
  onOpenFile: (path: string) => void;
  onOpenGitDiff: (path: string) => void;
  onOpenAllDiffs: (preview: DocumentDiffStreamPreview) => void;
  onFilesViewModeChange: (mode: DocumentsViewMode) => void;
  onPickDirectory: () => void;
  onPickDocument: () => void;
  onRefreshTree: () => void;
  onRemoveBookmark: (path: string) => void;
  onReorderBookmarks: (fromIndex: number, toIndex: number) => void;
  onReorderOpenTabs: (fromPath: string, toPath: string) => void;
  onResetOpenFilesSplitHeight: () => void;
  onResetSidebarWidth: (side: "left" | "right") => void;
  onSelectSidebarTab: (tab: AppConfig["workspace"]["sidebarTab"]) => void;
  onSelectSourceControlView: (
    view: AppConfig["workspace"]["sourceControlView"],
  ) => void;
  onSelectSourceControlBranchDiffBase: (baseRef: string) => void;
  onSelectSourceControlGraphScope: (scope: GitCommitGraphScope) => void;
  onSetOpenFilesFilter: (value: string) => void;
  onToggleDirectory: (path: string) => void;
  onToggleOpenFilesCollapsed: () => void;
  onTogglePinned: (path: string) => void;
  selectedTimelineRevision: string | null;
  onOpenBranchDiffItem: (item: GitBranchDiffEntry) => void;
  onOpenTimelineChanges: (item: GitFileHistoryItem) => void;
  onOpenSourceControlChange: (path: string | null | undefined) => void;
  onOpenSourceControlGraphItem: (item: GitFileHistoryItem) => void;
  onSourceControlChangeContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    item: GitChanges["items"][number],
  ) => void;
  onSourceControlBranchDiffContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    item: GitBranchDiffEntry,
  ) => void;
  onSourceControlGraphContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    item: GitCommitGraph["items"][number],
  ) => void;
  onTimelineItemContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    item: GitFileHistoryItem,
  ) => void;
}

export function LeftSidebar({
  activePath,
  antoraContextSelectorOpenSignal,
  preferencesTabOpen,
  preferencesActive,
  bookmarks,
  childrenByDirectory,
  directoryErrors,
  expandedDirectories,
  loadingDirectories,
  openFilesFilter,
  hideOpenFiles = false,
  openFilesCollapsed,
  openFilesFilterInputRef,
  openFilesPaneRef,
  openFilesSplitResizeState,
  orderedTabs,
  openDocumentPaths,
  pinnedTabs,
  rootDirectory,
  rootEntries,
  documentOrder,
  documentReviewSession,
  filesViewMode,
  suggestedDocumentsMode,
  activeDocumentOrderSectionKeys,
  gitStatusByPath,
  openFileReloadStates,
  gitChanges,
  gitChangesLoading,
  gitFileHistoryGitState,
  gitBranchDiff,
  gitBranchDiffLoading,
  gitCommitGraph,
  gitCommitGraphLoading,
  gitCommitGraphLoadingMore,
  gitTimelineHistory,
  gitTimelineLoading,
  gitTimelineLoadingMore,
  gitTimelinePath,
  sidebarResizeState,
  sidebarTab,
  sourceControlView,
  sourceControlGraphScope,
  leftSidebarContentRef,
  onActivateTab,
  onActivatePreferences,
  onAddActiveBookmark,
  onAddRootBookmark,
  onSelectAntoraContext,
  onLoadMoreGitCommitGraph,
  onLoadMoreGitFileHistory,
  onBeginOpenFilesSplitResize,
  onBeginSidebarResize,
  onCloseTab,
  onClosePreferences,
  onCollapseTree,
  onOpenBookmark,
  onOpenFile,
  onOpenGitDiff,
  onOpenAllDiffs,
  onFilesViewModeChange,
  onPickDirectory,
  onPickDocument,
  onRefreshTree,
  onRemoveBookmark,
  onReorderBookmarks,
  onReorderOpenTabs,
  onResetOpenFilesSplitHeight,
  onResetSidebarWidth,
  onSelectSidebarTab,
  onSelectSourceControlView,
  onSelectSourceControlBranchDiffBase,
  onSelectSourceControlGraphScope,
  onSetOpenFilesFilter,
  onToggleDirectory,
  onToggleOpenFilesCollapsed,
  onTogglePinned,
  selectedTimelineRevision,
  onOpenBranchDiffItem,
  onOpenTimelineChanges,
  onOpenSourceControlChange,
  onOpenSourceControlGraphItem,
  onSourceControlChangeContextMenu,
  onSourceControlBranchDiffContextMenu,
  onSourceControlGraphContextMenu,
  onTimelineItemContextMenu,
}: LeftSidebarProps) {
  return (
    <aside className="sidebar left" data-review-id="left-sidebar">
      <div
        ref={leftSidebarContentRef}
        className={`sidebar-content left-sidebar-content ${
          hideOpenFiles
            ? "open-files-hidden"
            : openFilesCollapsed
              ? "open-files-collapsed"
              : ""
        }`}
      >
        {!hideOpenFiles && (
          <OpenFilesList
            sectionRef={openFilesPaneRef}
            collapsed={openFilesCollapsed}
            tabs={orderedTabs}
            activePath={activePath}
            preferencesTabOpen={preferencesTabOpen}
            preferencesActive={preferencesActive}
            pinnedTabs={pinnedTabs}
            filterValue={openFilesFilter}
            filterInputRef={openFilesFilterInputRef}
            onFilterChange={onSetOpenFilesFilter}
            onActivate={onActivateTab}
            onActivatePreferences={onActivatePreferences}
            onClose={onCloseTab}
            onClosePreferences={onClosePreferences}
            onReorder={onReorderOpenTabs}
            onOpenGitDiff={onOpenGitDiff}
            onToggleCollapsed={onToggleOpenFilesCollapsed}
            onTogglePinned={onTogglePinned}
            gitStatusByPath={gitStatusByPath}
            reloadStateByPath={openFileReloadStates}
          />
        )}
        {!hideOpenFiles && !openFilesCollapsed && (
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize Open Files"
            className={`open-files-split-resizer ${openFilesSplitResizeState ? "active" : ""}`}
            data-review-id="open-files-split-resizer"
            onPointerDown={onBeginOpenFilesSplitResize}
            onDoubleClick={onResetOpenFilesSplitHeight}
          />
        )}
        <div
          className="sidebar-lower-pane"
          data-review-id="left-sidebar-lower-pane"
        >
          <SidebarTabs activeTab={sidebarTab} onSelect={onSelectSidebarTab} />
          <div className="sidebar-tab-panel">
            {sidebarTab === "files" ? (
              <FileTreePanel
                rootDirectory={rootDirectory}
                rootEntries={rootEntries}
                documentOrder={documentOrder}
                documentReviewSession={documentReviewSession}
                childrenByDirectory={childrenByDirectory}
                expandedDirectories={expandedDirectories}
                loadingDirectories={loadingDirectories}
                directoryErrors={directoryErrors}
                activePath={activePath}
                gitStatusByPath={gitStatusByPath}
                gitChanges={gitChanges}
                orderedTabs={orderedTabs}
                openDocumentPaths={openDocumentPaths}
                filesViewMode={filesViewMode}
                suggestedDocumentsMode={suggestedDocumentsMode}
                antoraContextSelectorOpenSignal={
                  antoraContextSelectorOpenSignal
                }
                activeDocumentOrderSectionKeys={activeDocumentOrderSectionKeys}
                onOpenFile={onOpenFile}
                onOpenGitDiff={onOpenGitDiff}
                onFilesViewModeChange={onFilesViewModeChange}
                onSelectAntoraContext={onSelectAntoraContext}
                onToggleDirectory={onToggleDirectory}
                onPickDocument={onPickDocument}
                onPickDirectory={onPickDirectory}
                onRefresh={onRefreshTree}
                onCollapse={onCollapseTree}
              />
            ) : sidebarTab === "bookmarks" ? (
              <BookmarksPanel
                bookmarks={bookmarks}
                activePath={activePath}
                rootDirectory={rootDirectory}
                gitStatusByPath={gitStatusByPath}
                onAddActive={onAddActiveBookmark}
                onAddRoot={onAddRootBookmark}
                onOpen={onOpenBookmark}
                onRemove={onRemoveBookmark}
                onReorder={onReorderBookmarks}
              />
            ) : (
              <SourceControlPanel
                changes={gitChanges}
                changesLoading={gitChangesLoading}
                fileHistoryGitState={gitFileHistoryGitState}
                documentReviewSession={documentReviewSession}
                branchDiff={gitBranchDiff}
                branchDiffLoading={gitBranchDiffLoading}
                graph={gitCommitGraph}
                graphLoading={gitCommitGraphLoading}
                graphLoadingMore={gitCommitGraphLoadingMore}
                fileHistory={gitTimelineHistory}
                fileHistoryLoading={gitTimelineLoading}
                fileHistoryLoadingMore={gitTimelineLoadingMore}
                fileHistoryPath={gitTimelinePath}
                view={sourceControlView}
                graphScope={sourceControlGraphScope}
                selectedRevision={selectedTimelineRevision}
                onSelectView={onSelectSourceControlView}
                onSelectBranchDiffBase={onSelectSourceControlBranchDiffBase}
                onSelectGraphScope={onSelectSourceControlGraphScope}
                onOpenChange={onOpenSourceControlChange}
                onOpenAllDiffs={onOpenAllDiffs}
                onOpenBranchDiffItem={onOpenBranchDiffItem}
                onOpenGraphItem={onOpenSourceControlGraphItem}
                onOpenFileHistoryChanges={onOpenTimelineChanges}
                onLoadMoreGraph={onLoadMoreGitCommitGraph}
                onLoadMoreFileHistory={onLoadMoreGitFileHistory}
                onChangeContextMenu={onSourceControlChangeContextMenu}
                onBranchDiffContextMenu={onSourceControlBranchDiffContextMenu}
                onGraphItemContextMenu={onSourceControlGraphContextMenu}
                onItemContextMenu={onTimelineItemContextMenu}
              />
            )}
          </div>
        </div>
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize left sidebar"
        className={`sidebar-resizer left-resizer ${sidebarResizeState?.side === "left" ? "active" : ""}`}
        data-review-id="left-sidebar-resizer"
        onPointerDown={(event) => onBeginSidebarResize("left", event)}
        onDoubleClick={() => onResetSidebarWidth("left")}
      />
    </aside>
  );
}
