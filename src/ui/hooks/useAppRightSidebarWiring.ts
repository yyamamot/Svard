import type {
  ComponentProps,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
} from "react";
import type { AppConfig, RenderResult } from "../../core/types";
import type { RightSidebar } from "../components/RightSidebar";
import type { DiagramInspectorItem } from "../lib/diagramInspector";
import type {
  DiagramPreviewState,
  RightSidebarTab,
  SearchHitSummary,
  SearchScope,
  WorkspaceSearchState,
} from "../types";

export type AppRightSidebarProps = ComponentProps<typeof RightSidebar>;

interface UseAppRightSidebarWiringOptions {
  activeHeadingId: string | null;
  activateSearchHit: (index: number) => void;
  activateWorkspaceSearchResult: (index: number) => void | Promise<void>;
  clearActiveContentCursor: () => void;
  config: AppConfig | null;
  diagramInspectorItems: DiagramInspectorItem[];
  dispatchCommand: AppRightSidebarProps["onDispatchCommand"];
  handleSearchInputKeyDown: (
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) => void;
  handleWorkspaceSearchClear: () => void;
  handleWorkspaceSearchEnterKey: (
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) => boolean;
  matchCount: number;
  navigateToHeading: (headingId: string) => void;
  pinQuery: () => void | Promise<void>;
  renderResult: RenderResult | null;
  rightSidebarTab: RightSidebarTab;
  searchHits: SearchHitSummary[];
  searchIndex: number;
  searchInputQuery: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  selectedDiagramId: string | null;
  searchScope: SearchScope;
  setRightSidebarTab: (tab: RightSidebarTab) => void;
  setSelectedDiagramId: (id: string) => void;
  setSearchScope: (scope: SearchScope) => void;
  showInlineNotice: AppRightSidebarProps["onShowInlineNotice"];
  copyText: AppRightSidebarProps["onCopyText"];
  navigateToSourceLine: AppRightSidebarProps["onNavigateSourceLine"];
  onOpenDiagramPreview: (preview: DiagramPreviewState) => void;
  updateSearchQuery: (query: string) => void;
  updateWorkspaceSearchIndex: (delta: number) => void;
  workspaceSearch: WorkspaceSearchState;
  workspaceSearchIndex: number;
}

export function useAppRightSidebarWiring({
  activeHeadingId,
  activateSearchHit,
  activateWorkspaceSearchResult,
  clearActiveContentCursor,
  config,
  diagramInspectorItems,
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
  selectedDiagramId,
  searchScope,
  setRightSidebarTab,
  setSelectedDiagramId,
  setSearchScope,
  showInlineNotice,
  copyText,
  navigateToSourceLine,
  onOpenDiagramPreview,
  updateSearchQuery,
  updateWorkspaceSearchIndex,
  workspaceSearch,
  workspaceSearchIndex,
}: UseAppRightSidebarWiringOptions): {
  rightSidebarProps: AppRightSidebarProps;
} {
  function handleSearchClear() {
    if (searchScope === "workspace") {
      handleWorkspaceSearchClear();
      return;
    }
    void dispatchCommand("search.clear");
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      handleSearchClear();
      setRightSidebarTab("contents");
      searchInputRef.current?.blur();
      return;
    }
    if (handleWorkspaceSearchEnterKey(event)) {
      return;
    }
    if (event.key === "Enter") {
      clearActiveContentCursor();
    }
    handleSearchInputKeyDown(event);
  }

  const rightSidebarProps: AppRightSidebarProps = {
    activeHeadingId,
    diagramInspectorItems,
    matchCount,
    pinnedSearch: config?.workspace.pinnedSearch ?? null,
    query: searchInputQuery,
    renderResult,
    rightSidebarTab,
    searchScope,
    searchHits,
    searchIndex,
    searchInputRef,
    selectedDiagramId,
    workspaceSearch,
    workspaceSearchIndex,
    onActivateSearchHit: (index) => {
      clearActiveContentCursor();
      activateSearchHit(index);
    },
    onActivateWorkspaceSearchResult: (index) =>
      void activateWorkspaceSearchResult(index),
    onClearSearch: handleSearchClear,
    onCopyText: copyText,
    onDispatchCommand: (commandId) => void dispatchCommand(commandId),
    onNavigateSourceLine: navigateToSourceLine,
    onNavigateHeading: (headingId) => {
      clearActiveContentCursor();
      navigateToHeading(headingId);
    },
    onOpenDiagramPreview,
    onPinQuery: () => void pinQuery(),
    onSelectDiagram: (id) => {
      clearActiveContentCursor();
      setSelectedDiagramId(id);
    },
    onSetSearchScope: setSearchScope,
    onSetRightSidebarTab: setRightSidebarTab,
    onShowInlineNotice: showInlineNotice,
    onSearchInputKeyDown: handleSearchKeyDown,
    onUpdateQuery: updateSearchQuery,
    onWorkspaceSearchIndexChange: updateWorkspaceSearchIndex,
  };

  return {
    rightSidebarProps,
  };
}
