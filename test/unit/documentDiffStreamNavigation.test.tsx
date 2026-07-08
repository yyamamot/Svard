import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ContentCursorCommandHandler } from "../../src/ui/lib/contentCursor";
import type { DocumentDiffStreamCommandBridge } from "../../src/ui/lib/documentDiffStreamCommands";
import {
  deriveGitRenderedDiffSummaryMock,
  setupDocumentDiffStreamPanelTest,
} from "./documentDiffStreamPanelHarness";
import {
  buttonByText,
  diffPreview,
  documentStreamItem,
  flushPreviewLoad,
  flushRulerMeasure,
  installMockIntersectionObserver,
  requiredDiffStreamProps,
  renderedDiffSummary,
  renderedDiffSummaryWithFineTargets,
} from "./documentDiffStreamTestUtils";

describe("DocumentDiffStreamPanel navigation", () => {
  const test = setupDocumentDiffStreamPanelTest();

  it("loads the next unloaded document before moving to its first target", async () => {
    const intersection = installMockIntersectionObserver();
    const getGitDiffPreview = vi.fn((path: string) =>
      Promise.resolve(diffPreview(path)),
    );

    try {
      await test.render({
        config: null,
        preview: {
          source: "git-changes-stream",
          items: [
            documentStreamItem("docs/one.md"),
            documentStreamItem("docs/two.md"),
          ],
        },
        getGitDiffPreview,
        ...requiredDiffStreamProps(),
        onClose: vi.fn(),
      });

      await act(async () => {
        intersection.trigger("docs/one.md");
      });
      await flushPreviewLoad();
      expect(getGitDiffPreview).toHaveBeenCalledTimes(1);

      await act(async () => {
        buttonByText("Next").dispatchEvent(
          new MouseEvent("click", { bubbles: true }),
        );
      });
      await flushPreviewLoad();

      expect(getGitDiffPreview).toHaveBeenCalledWith("/workspace/docs/two.md");
      expect(
        test.container.querySelector(
          '[data-stream-index="1"] [data-active-change="true"]',
        ),
      ).not.toBeNull();
    } finally {
      intersection.restore();
    }
  });

  it("moves next through list item and table row targets", async () => {
    deriveGitRenderedDiffSummaryMock.mockResolvedValue(
      renderedDiffSummaryWithFineTargets(),
    );
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValue(diffPreview("/workspace/docs/guide.md"));
    const scrollTargets: Element[] = [];
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = function scrollIntoViewMock() {
      scrollTargets.push(this);
    };

    try {
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
      await flushRulerMeasure();

      await act(async () => {
        buttonByText("Next").dispatchEvent(
          new MouseEvent("click", { bubbles: true }),
        );
      });

      const activeListItem = test.container.querySelector(
        ".git-rendered-list-item-change[data-active-change='true']",
      );
      expect(activeListItem?.textContent).toContain("New list item");
      expect(scrollTargets.at(-1)?.textContent).toContain("New list item");
      expect(scrollTargets.at(-1)?.getAttribute("data-change-index")).toBe("1");

      await act(async () => {
        buttonByText("Next").dispatchEvent(
          new MouseEvent("click", { bubbles: true }),
        );
      });

      const activeTableRow = test.container.querySelector(
        ".git-rendered-table-row-change[data-active-change='true']",
      );
      expect(activeTableRow?.textContent).toContain("New table value");
      expect(scrollTargets.at(-1)?.textContent).toContain("New table value");
      expect(scrollTargets.at(-1)?.getAttribute("data-change-index")).toBe("2");

      await act(async () => {
        buttonByText("Previous").dispatchEvent(
          new MouseEvent("click", { bubbles: true }),
        );
      });

      expect(
        test.container.querySelector(
          ".git-rendered-list-item-change[data-active-change='true']",
        )?.textContent,
      ).toContain("New list item");
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it("routes content cursor and shortcut commands to the stream", async () => {
    deriveGitRenderedDiffSummaryMock.mockResolvedValue(renderedDiffSummary(2));
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValue(diffPreview("/workspace/docs/guide.md"));
    const contentCursorCommandRef: {
      current: ContentCursorCommandHandler | null;
    } = { current: null };
    const streamCommandRef: {
      current: DocumentDiffStreamCommandBridge | null;
    } = { current: null };
    const onClose = vi.fn();

    await test.render({
      config: null,
      preview: {
        source: "git-changes-stream",
        items: [documentStreamItem("docs/guide.md")],
      },
      getGitDiffPreview,
      contentCursorCommandRef,
      streamCommandRef,
      ...requiredDiffStreamProps(),
      onClose,
    });

    await flushPreviewLoad();
    await flushRulerMeasure();

    const markers = () =>
      Array.from(
        test.container.querySelectorAll<HTMLButtonElement>(
          '[data-review-id="diff-stream-change-ruler-marker"]',
        ),
      );
    expect(markers()[0].classList.contains("active")).toBe(true);

    await act(async () => {
      expect(contentCursorCommandRef.current?.("next")).toBe(true);
    });
    expect(markers()[1].classList.contains("active")).toBe(true);

    await act(async () => {
      expect(
        streamCommandRef.current?.dispatch("viewer.contentCursor.previous"),
      ).toBe(true);
    });
    expect(markers()[0].classList.contains("active")).toBe(true);

    const streamBody =
      test.container.querySelector<HTMLElement>(".diff-stream-body");
    expect(streamBody).not.toBeNull();
    Object.defineProperty(streamBody, "clientHeight", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(streamBody, "scrollHeight", {
      configurable: true,
      value: 600,
    });
    await act(async () => {
      expect(streamCommandRef.current?.dispatch("viewer.pageDown")).toBe(true);
    });
    expect(streamBody!.scrollTop).toBeGreaterThan(0);

    await act(async () => {
      expect(streamCommandRef.current?.dispatch("tab.close")).toBe(true);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
