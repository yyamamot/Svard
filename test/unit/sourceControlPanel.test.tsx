import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SourceControlPanel } from "../../src/ui/components/sidebar/SourceControlPanel";
import type { ContextMenuItem } from "../../src/ui/types";

describe("SourceControlPanel review session", () => {
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

  it("shows review state only for supported changed documents", async () => {
    await renderPanel();

    expect(
      container.querySelector(
        '[data-review-id="source-control-review-session"]',
      )?.textContent,
    ).toContain("Reviewed 0 / 1");
    expect(
      container.querySelector('[data-review-id="document-review-state"]')
        ?.textContent,
    ).toBe("Unreviewed");
    expect(
      container.querySelectorAll('[data-review-id="document-review-state"]'),
    ).toHaveLength(1);
  });

  it("adds review mark actions to supported change context menus", async () => {
    const markNeedsAttention = vi.fn();
    const openContextMenu = vi.fn();
    await renderPanel({
      documentReviewSession: {
        stateByPath: {},
        summary: { total: 1, reviewed: 0, needsAttention: 0 },
        markViewed: vi.fn(),
        markNeedsAttention,
        reset: vi.fn(),
      },
      onChangeContextMenu: (event, item) => {
        const items: ContextMenuItem[] = [
          {
            id: "mark-review-needs-attention",
            label: "Mark needs attention",
            onSelect: () => markNeedsAttention(item.documentPath ?? ""),
          },
        ];
        openContextMenu(event, items, "source-control-change-item");
      },
    });

    await act(async () => {
      container
        .querySelector<HTMLElement>(
          '[data-review-id="source-control-change-item"]',
        )
        ?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    });

    const items = openContextMenu.mock.calls[0]?.[1] as ContextMenuItem[];
    items[0]?.onSelect?.();
    expect(markNeedsAttention).toHaveBeenCalledWith("/workspace/docs/guide.md");
  });

  it("advances Previous and Next from the last opened review change", async () => {
    const onOpenChange = vi.fn();
    await renderPanel({
      changes: {
        status: "ok",
        items: [
          {
            path: "docs/first.md",
            documentPath: "/workspace/docs/first.md",
            status: "modified",
          },
          {
            path: "docs/second.md",
            documentPath: "/workspace/docs/second.md",
            status: "modified",
          },
        ],
      },
      documentReviewSession: {
        stateByPath: {
          "/workspace/docs/first.md": "viewed",
          "/workspace/docs/second.md": "viewed",
        },
        summary: { total: 2, reviewed: 2, needsAttention: 0 },
        markViewed: vi.fn(),
        markNeedsAttention: vi.fn(),
        reset: vi.fn(),
      },
      onOpenChange,
    });

    const nextButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Next",
    );
    const previousButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent === "Previous");

    await act(async () => {
      nextButton?.click();
    });
    await act(async () => {
      nextButton?.click();
    });
    await act(async () => {
      previousButton?.click();
    });

    expect(onOpenChange).toHaveBeenNthCalledWith(1, "/workspace/docs/first.md");
    expect(onOpenChange).toHaveBeenNthCalledWith(
      2,
      "/workspace/docs/second.md",
    );
    expect(onOpenChange).toHaveBeenNthCalledWith(3, "/workspace/docs/first.md");
  });

  it("opens an all diffs stream without marking every document viewed", async () => {
    const onOpenAllDiffs = vi.fn();
    const markViewed = vi.fn();
    await renderPanel({
      documentReviewSession: {
        stateByPath: {},
        summary: { total: 1, reviewed: 0, needsAttention: 0 },
        markViewed,
        markNeedsAttention: vi.fn(),
        reset: vi.fn(),
      },
      onOpenAllDiffs,
    });

    const allDiffsButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "All diffs",
    );

    await act(async () => {
      allDiffsButton?.click();
    });

    expect(markViewed).not.toHaveBeenCalled();
    expect(onOpenAllDiffs).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "git-changes-stream",
        watchStatus: "fresh",
        items: [
          expect.objectContaining({
            kind: "document",
            documentPath: "/workspace/docs/guide.md",
          }),
        ],
      }),
    );
    expect(onOpenAllDiffs.mock.calls[0]?.[0].items).toHaveLength(1);
  });

  async function renderPanel(
    overrides: Partial<Parameters<typeof SourceControlPanel>[0]> = {},
  ) {
    await act(async () => {
      root.render(
        <SourceControlPanel
          changes={{
            status: "ok",
            items: [
              {
                path: "docs/guide.md",
                documentPath: "/workspace/docs/guide.md",
                status: "modified",
              },
              { path: "assets/logo.png", status: "modified" },
            ],
          }}
          changesLoading={false}
          documentReviewSession={{
            stateByPath: {},
            summary: { total: 1, reviewed: 0, needsAttention: 0 },
            markViewed: vi.fn(),
            markNeedsAttention: vi.fn(),
            reset: vi.fn(),
          }}
          branchDiff={null}
          branchDiffLoading={false}
          graph={null}
          graphLoading={false}
          graphLoadingMore={false}
          fileHistory={null}
          fileHistoryLoading={false}
          fileHistoryLoadingMore={false}
          fileHistoryPath={null}
          view="changes"
          graphScope="repository"
          selectedRevision={null}
          onSelectView={vi.fn()}
          onSelectBranchDiffBase={vi.fn()}
          onSelectGraphScope={vi.fn()}
          onOpenChange={vi.fn()}
          onOpenAllDiffs={vi.fn()}
          onOpenBranchDiffItem={vi.fn()}
          onOpenGraphItem={vi.fn()}
          onOpenFileHistoryChanges={vi.fn()}
          onLoadMoreGraph={vi.fn()}
          onLoadMoreFileHistory={vi.fn()}
          onChangeContextMenu={vi.fn()}
          onBranchDiffContextMenu={vi.fn()}
          onGraphItemContextMenu={vi.fn()}
          onItemContextMenu={vi.fn()}
          {...overrides}
        />,
      );
    });
  }
});
