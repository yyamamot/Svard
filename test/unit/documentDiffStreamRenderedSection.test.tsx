import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  deriveGitRenderedDiffSummaryMock,
  setupDocumentDiffStreamPanelTest,
} from "./documentDiffStreamPanelHarness";
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

  it("captures All Diffs links without native navigation fallthrough", async () => {
    deriveGitRenderedDiffSummaryMock.mockResolvedValue({
      blocks: [
        {
          id: "link-block",
          kind: "changed",
          blockKind: "paragraph",
          left: {
            id: "left-link",
            kind: "paragraph",
            tagName: "p",
            text: "External Mail Document",
            html: '<p><a href="https://example.test/docs">External</a> <a href="mailto:user@example.test">Mail</a> <a href="./next.md">Document</a></p>',
          },
          right: {
            id: "right-link",
            kind: "paragraph",
            tagName: "p",
            text: "External Mail Document",
            html: '<p><a href="https://example.test/docs">External</a> <a href="mailto:user@example.test">Mail</a> <a href="./next.md">Document</a></p>',
          },
        },
      ],
    });
    const confirmExternalLink = vi.fn().mockResolvedValue(false);
    const openExternalUrl = vi.fn();
    const resolveDocumentLink = vi.fn().mockResolvedValue({
      status: "blocked",
      message: "Missing",
    });
    const openDocument = vi.fn();

    await test.render({
      config: null,
      preview: {
        source: "git-changes-stream",
        items: [documentStreamItem("docs/guide.md")],
      },
      getGitDiffPreview: vi.fn().mockResolvedValue({
        ...diffPreview("/workspace/docs/guide.md"),
        leftPath: "/workspace/docs/left.md",
        rightPath: "/workspace/docs/right.md",
      }),
      ...requiredDiffStreamProps(),
      confirmExternalLink,
      openExternalUrl,
      resolveDocumentLink,
      openDocument,
      onClose: vi.fn(),
    });
    await flushPreviewLoad();

    const links = test.container.querySelectorAll<HTMLAnchorElement>(
      '[data-review-id="diff-stream-right-pane"] a',
    );
    const externalClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    await act(async () => links[0]!.dispatchEvent(externalClick));
    expect(externalClick.defaultPrevented).toBe(true);
    expect(confirmExternalLink).toHaveBeenCalledWith(
      "https://example.test/docs",
    );
    expect(openExternalUrl).not.toHaveBeenCalled();

    const mailClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
    });
    await act(async () => links[1]!.dispatchEvent(mailClick));
    expect(mailClick.defaultPrevented).toBe(true);
    expect(resolveDocumentLink).not.toHaveBeenCalled();
    expect(openDocument).not.toHaveBeenCalled();

    const leftDocumentLink = test.container.querySelector<HTMLAnchorElement>(
      '[data-review-id="diff-stream-left-pane"] a[href="./next.md"]',
    );
    const rightDocumentLink = test.container.querySelector<HTMLAnchorElement>(
      '[data-review-id="diff-stream-right-pane"] a[href="./next.md"]',
    );
    await act(async () => {
      leftDocumentLink!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
      );
      rightDocumentLink!.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }),
      );
    });
    expect(resolveDocumentLink).toHaveBeenNthCalledWith(
      1,
      "./next.md",
      "/workspace/docs/left.md",
    );
    expect(resolveDocumentLink).toHaveBeenNthCalledWith(
      2,
      "./next.md",
      "/workspace/docs/right.md",
    );

    const modifierClick = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      button: 0,
      metaKey: true,
    });
    await act(async () => links[0]!.dispatchEvent(modifierClick));
    expect(modifierClick.defaultPrevented).toBe(true);
    expect(confirmExternalLink).toHaveBeenCalledTimes(1);
  });
});
