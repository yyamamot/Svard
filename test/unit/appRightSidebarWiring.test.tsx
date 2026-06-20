import { act, useRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { defaultConfig } from "../../src/core/defaultConfig";
import { RightSidebar } from "../../src/ui/components/RightSidebar";
import { useAppRightSidebarWiring } from "../../src/ui/hooks/useAppRightSidebarWiring";
import type { SearchScope } from "../../src/ui/types";
import { createReactRootHarness } from "./helpers/reactHarness";

function renderSearchWiring({
  searchScope = "document",
}: {
  searchScope?: SearchScope;
} = {}) {
  const harness = createReactRootHarness();
  const dispatchCommand = vi.fn();
  const handleSearchInputKeyDown = vi.fn();
  const handleWorkspaceSearchClear = vi.fn();
  const handleWorkspaceSearchEnterKey = vi.fn(() => false);
  const setRightSidebarTab = vi.fn();

  function Probe() {
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const { rightSidebarProps } = useAppRightSidebarWiring({
      activeHeadingId: null,
      activateSearchHit: vi.fn(),
      activateWorkspaceSearchResult: vi.fn(),
      clearActiveContentCursor: vi.fn(),
      config: defaultConfig,
      diagramInspectorItems: [],
      dispatchCommand,
      handleSearchInputKeyDown,
      handleWorkspaceSearchClear,
      handleWorkspaceSearchEnterKey,
      matchCount: 0,
      navigateToHeading: vi.fn(),
      pinQuery: vi.fn(),
      renderResult: null,
      rightSidebarTab: "search",
      searchHits: [],
      searchIndex: 0,
      searchInputQuery: "Graphviz",
      searchInputRef,
      searchScope,
      selectedDiagramId: null,
      setSelectedDiagramId: vi.fn(),
      setRightSidebarTab,
      setSearchScope: vi.fn(),
      showInlineNotice: vi.fn(),
      copyText: vi.fn(),
      navigateToSourceLine: vi.fn(),
      onOpenDiagramPreview: vi.fn(),
      updateSearchQuery: vi.fn(),
      updateWorkspaceSearchIndex: vi.fn(),
      workspaceSearch: { status: "idle", result: null, message: null },
      workspaceSearchIndex: 0,
    });
    return <RightSidebar {...rightSidebarProps} />;
  }

  harness.render(<Probe />);

  function pressSearchInputKey(key: string, init: KeyboardEventInit = {}) {
    const input = harness.byReviewId<HTMLInputElement>("search-input");
    const event = new KeyboardEvent("keydown", {
      key,
      bubbles: true,
      cancelable: true,
      ...init,
    });
    const propagationSpy = vi.fn();
    input.addEventListener("keydown", propagationSpy);
    act(() => {
      input.focus();
      input.dispatchEvent(event);
    });
    return { event, input, propagationSpy };
  }

  return {
    dispatchCommand,
    handleSearchInputKeyDown,
    handleWorkspaceSearchClear,
    handleWorkspaceSearchEnterKey,
    harness,
    pressSearchInputKey,
    setRightSidebarTab,
  };
}

describe("useAppRightSidebarWiring search keyboard handling", () => {
  it("clears document search and returns to contents on Escape", () => {
    const {
      dispatchCommand,
      handleSearchInputKeyDown,
      handleWorkspaceSearchClear,
      handleWorkspaceSearchEnterKey,
      harness,
      pressSearchInputKey,
      setRightSidebarTab,
    } = renderSearchWiring();

    const { event, input } = pressSearchInputKey("Escape");

    expect(event.defaultPrevented).toBe(true);
    expect(dispatchCommand).toHaveBeenCalledWith("search.clear");
    expect(handleWorkspaceSearchClear).not.toHaveBeenCalled();
    expect(handleWorkspaceSearchEnterKey).not.toHaveBeenCalled();
    expect(handleSearchInputKeyDown).not.toHaveBeenCalled();
    expect(setRightSidebarTab).toHaveBeenCalledWith("contents");
    expect(document.activeElement).not.toBe(input);

    harness.cleanup();
  });

  it("clears workspace search and returns to contents on Escape", () => {
    const {
      dispatchCommand,
      handleSearchInputKeyDown,
      handleWorkspaceSearchClear,
      handleWorkspaceSearchEnterKey,
      harness,
      pressSearchInputKey,
      setRightSidebarTab,
    } = renderSearchWiring({ searchScope: "workspace" });

    const { event, input } = pressSearchInputKey("Escape");

    expect(event.defaultPrevented).toBe(true);
    expect(dispatchCommand).not.toHaveBeenCalled();
    expect(handleWorkspaceSearchClear).toHaveBeenCalledTimes(1);
    expect(handleWorkspaceSearchEnterKey).not.toHaveBeenCalled();
    expect(handleSearchInputKeyDown).not.toHaveBeenCalled();
    expect(setRightSidebarTab).toHaveBeenCalledWith("contents");
    expect(document.activeElement).not.toBe(input);

    harness.cleanup();
  });

  it("keeps Enter on the existing search navigation path", () => {
    const {
      handleSearchInputKeyDown,
      handleWorkspaceSearchEnterKey,
      harness,
      pressSearchInputKey,
      setRightSidebarTab,
    } = renderSearchWiring();

    const { event } = pressSearchInputKey("Enter");

    expect(event.defaultPrevented).toBe(false);
    expect(handleWorkspaceSearchEnterKey).toHaveBeenCalledTimes(1);
    expect(handleSearchInputKeyDown).toHaveBeenCalledTimes(1);
    expect(setRightSidebarTab).not.toHaveBeenCalledWith("contents");

    harness.cleanup();
  });
});
