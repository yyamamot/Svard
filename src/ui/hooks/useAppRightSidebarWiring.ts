import type {
  ComponentProps,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
} from "react";
import type { AppConfig, RenderResult } from "../../core/types";
import type { RightSidebar } from "../components/RightSidebar";
import type {
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
  searchScope: SearchScope;
  setRightSidebarTab: (tab: RightSidebarTab) => void;
  setSearchScope: (scope: SearchScope) => void;
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
    matchCount,
    pinnedSearch: config?.workspace.pinnedSearch ?? null,
    query: searchInputQuery,
    renderResult,
    rightSidebarTab,
    searchScope,
    searchHits,
    searchIndex,
    searchInputRef,
    workspaceSearch,
    workspaceSearchIndex,
    onActivateSearchHit: (index) => {
      clearActiveContentCursor();
      activateSearchHit(index);
    },
    onActivateWorkspaceSearchResult: (index) =>
      void activateWorkspaceSearchResult(index),
    onClearSearch: handleSearchClear,
    onDispatchCommand: (commandId) => void dispatchCommand(commandId),
    onNavigateHeading: (headingId) => {
      clearActiveContentCursor();
      navigateToHeading(headingId);
    },
    onPinQuery: () => void pinQuery(),
    onSetSearchScope: setSearchScope,
    onSetRightSidebarTab: setRightSidebarTab,
    onSearchInputKeyDown: handleSearchKeyDown,
    onUpdateQuery: updateSearchQuery,
    onWorkspaceSearchIndexChange: updateWorkspaceSearchIndex,
  };

  return {
    rightSidebarProps,
  };
}
