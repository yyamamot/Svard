import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { setupDocumentDiffStreamPanelTest } from "./documentDiffStreamPanelHarness";
import type { ContextMenuItem } from "../../src/ui/types";
import {
  diffPreview,
  documentStreamItem,
  flushPreviewLoad,
  requiredDiffStreamProps,
} from "./documentDiffStreamTestUtils";

describe("DocumentDiffStreamPanel rendered section", () => {
  const test = setupDocumentDiffStreamPanelTest();

  it("hides block meta in full preview and shows it in changes only", async () => {
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValue(diffPreview("/workspace/docs/guide.md"));

    await test.render({
      config: null,
      preview: {
        source: "git-changes-stream",
        items: [documentStreamItem("docs/guide.md")],
      },
      getGitDiffPreview,
      ...requiredDiffStreamProps(),
      onClose: vi.fn(),
    });

    await flushPreviewLoad();
    expect(test.container.querySelector(".git-rendered-block-meta")).toBeNull();

    const changesOnlyButton = test.container.querySelector<HTMLButtonElement>(
      '[data-review-id="diff-stream-changes-only-view"]',
    );
    expect(changesOnlyButton).not.toBeNull();
    await act(async () => {
      changesOnlyButton!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(
      test.container.querySelector(".git-rendered-block-meta"),
    ).not.toBeNull();

    const fullPreviewButton = test.container.querySelector<HTMLButtonElement>(
      '[data-review-id="diff-stream-full-preview-view"]',
    );
    expect(fullPreviewButton).not.toBeNull();
    await act(async () => {
      fullPreviewButton!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(test.container.querySelector(".git-rendered-block-meta")).toBeNull();
  });

  it("defers rendered context menu until right button release", async () => {
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValue(diffPreview("/workspace/docs/guide.md"));
    const openContextMenu = vi.fn(() => true);

    await test.render({
      config: null,
      preview: {
        source: "git-changes-stream",
        items: [documentStreamItem("docs/guide.md")],
      },
      getGitDiffPreview,
      ...requiredDiffStreamProps(),
      openContextMenu,
      onClose: vi.fn(),
    });

    await flushPreviewLoad();

    const rightPane = test.container.querySelector<HTMLElement>(
      '[data-review-id="diff-stream-right-pane"]',
    );
    expect(rightPane).not.toBeNull();

    await act(async () => {
      rightPane!.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          button: 2,
          buttons: 2,
          clientX: 12,
          clientY: 18,
        }),
      );
    });
    expect(openContextMenu).not.toHaveBeenCalled();

    await act(async () => {
      rightPane!.dispatchEvent(
        new MouseEvent("mouseup", {
          bubbles: true,
          button: 2,
          buttons: 0,
          clientX: 12,
          clientY: 18,
        }),
      );
    });
    expect(openContextMenu).toHaveBeenCalledTimes(1);
  });

  it("opens rendered context menu immediately when contextmenu fires after release", async () => {
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValue(diffPreview("/workspace/docs/guide.md"));
    const openContextMenu = vi.fn((..._args: unknown[]) => true);

    await test.render({
      config: null,
      preview: {
        source: "git-changes-stream",
        items: [documentStreamItem("docs/guide.md")],
      },
      getGitDiffPreview,
      ...requiredDiffStreamProps(),
      openContextMenu,
      onClose: vi.fn(),
    });

    await flushPreviewLoad();

    const rightPane = test.container.querySelector<HTMLElement>(
      '[data-review-id="diff-stream-right-pane"]',
    );
    expect(rightPane).not.toBeNull();

    await act(async () => {
      rightPane!.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          button: 2,
          buttons: 0,
          clientX: 12,
          clientY: 18,
        }),
      );
    });
    expect(openContextMenu).toHaveBeenCalledTimes(1);
  });

  it("offers capture actions from a loaded rendered section", async () => {
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValue(diffPreview("/workspace/docs/guide.md"));
    const openContextMenu = vi.fn((..._args: unknown[]) => true);

    await test.render({
      config: null,
      preview: {
        source: "git-changes-stream",
        items: [documentStreamItem("docs/guide.md")],
      },
      getGitDiffPreview,
      ...requiredDiffStreamProps(),
      openContextMenu,
      onClose: vi.fn(),
    });

    await flushPreviewLoad();
    const rightPane = test.container.querySelector<HTMLElement>(
      '[data-review-id="diff-stream-right-pane"]',
    );
    expect(rightPane).not.toBeNull();

    await act(async () => {
      rightPane!.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          button: 2,
          buttons: 0,
          clientX: 12,
          clientY: 18,
        }),
      );
    });

    const items = openContextMenu.mock.calls[0]?.[1] as ContextMenuItem[];
    expect(items.map((item) => item.label)).toEqual(
      expect.arrayContaining(["Capture Area…", "Capture Area with Reference…"]),
    );
    expect(rightPane?.dataset.captureDocumentPath).toBe(
      "/workspace/docs/guide.md",
    );
    expect(rightPane?.dataset.captureRevisionLabel).toBe("Working Tree");
    expect(rightPane?.dataset.captureSide).toBe("right");
  });
});
