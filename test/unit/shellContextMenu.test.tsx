import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useShellContextMenu } from "../../src/ui/hooks/useShellContextMenu";
import type { ContextMenuItem } from "../../src/ui/types";

describe("useShellContextMenu", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("adds document review actions to changed supported document rows", async () => {
    const openedItems: ContextMenuItem[][] = [];
    const markViewed = vi.fn();
    const markNeedsAttention = vi.fn();
    const reset = vi.fn();

    await act(async () => {
      root.render(
        <ContextMenuHarness
          documentReviewTarget={true}
          openContextMenu={(_, items) => {
            openedItems.push(items);
            return true;
          }}
          documentReviewSession={{
            stateByPath: { "/workspace/docs/guide.md": "unreviewed" },
            summary: { total: 1, reviewed: 0, needsAttention: 0 },
            markViewed,
            markNeedsAttention,
            reset,
          }}
        />,
      );
    });

    await act(async () => {
      container
        .querySelector<HTMLElement>("[data-context-menu-kind]")
        ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    });

    const labels = openedItems[0].map((item) => item.label);
    expect(labels).toContain("Mark viewed");
    expect(labels).toContain("Mark needs attention");
    expect(labels).toContain("Reset review state");

    openedItems[0]
      .find((item) => item.label === "Mark needs attention")
      ?.onSelect();
    expect(markNeedsAttention).toHaveBeenCalledWith("/workspace/docs/guide.md");
  });

  it("does not add document review actions to unchanged document rows", async () => {
    const openedItems: ContextMenuItem[][] = [];

    await act(async () => {
      root.render(
        <ContextMenuHarness
          documentReviewTarget={false}
          openContextMenu={(_, items) => {
            openedItems.push(items);
            return true;
          }}
        />,
      );
    });

    await act(async () => {
      container
        .querySelector<HTMLElement>("[data-context-menu-kind]")
        ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    });

    const labels = openedItems[0].map((item) => item.label);
    expect(labels).not.toContain("Mark viewed");
    expect(labels).not.toContain("Mark needs attention");
    expect(labels).not.toContain("Reset review state");
  });
});

function ContextMenuHarness({
  documentReviewTarget,
  documentReviewSession = {
    stateByPath: {},
    summary: { total: 0, reviewed: 0, needsAttention: 0 },
    markViewed: vi.fn(),
    markNeedsAttention: vi.fn(),
    reset: vi.fn(),
  },
  openContextMenu,
}: {
  documentReviewTarget: boolean;
  documentReviewSession?: Parameters<typeof useShellContextMenu>[0]["documentReviewSession"];
  openContextMenu: Parameters<typeof useShellContextMenu>[0]["openContextMenu"];
}) {
  const { handleShellContextMenu } = useShellContextMenu({
    activateSearchHit: vi.fn(),
    addBookmarkEntry: vi.fn(),
    articleRef: { current: null },
    bookmarks: [],
    closeAllTabs: vi.fn(),
    closeOtherTabs: vi.fn(),
    closeTab: vi.fn(),
    comparePickedDocuments: vi.fn(),
    compareWithActiveFile: vi.fn(),
    compareWithGitRef: vi.fn(),
    copyText: vi.fn(),
    documentPayload: null,
    documentReviewSession,
    moveTabToNewWindow: vi.fn(),
    navigateToHeading: vi.fn(),
    openContextMenu,
    openDocumentInNewWindow: vi.fn(),
    openPathInEditor: vi.fn(),
    openTabs: [],
    pinnedTabs: [],
    removeBookmarkEntry: vi.fn(),
    renderResult: null,
    showGitDiff: vi.fn(),
    showGitFileHistory: vi.fn(),
    toggleActivePinnedTab: vi.fn(),
  });

  return (
    <div onContextMenu={handleShellContextMenu}>
      <div
        data-context-menu-kind="file-tree"
        data-document-review-target={documentReviewTarget ? "true" : undefined}
        data-entry-kind="file"
        data-path="/workspace/docs/guide.md"
        data-review-id="documents-view-row"
      >
        guide.md
      </div>
    </div>
  );
}
