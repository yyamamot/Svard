import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import type { DocumentDiffPreview } from "../../src/core/types";
import type { ContentCursorCommandHandler } from "../../src/ui/lib/contentCursor";
import type { DocumentDiffStreamCommandBridge } from "../../src/ui/lib/documentDiffStreamCommands";
import {
  deriveGitRenderedDiffSummaryMock,
  setupDocumentDiffStreamPanelTest,
} from "./documentDiffStreamPanelHarness";
import {
  buttonByText,
  deferred,
  diffPreview,
  documentStreamItem,
  flushPreviewLoad,
  flushRulerMeasure,
  installMockIntersectionObserver,
  requiredDiffStreamProps,
  renderedDiffSummary,
  renderedDiffSummaryWithFineTargets,
  tooComplexDiffPreview,
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

  it("skips a terminal over-budget section when moving to a later document", async () => {
    const intersection = installMockIntersectionObserver();
    const getGitDiffPreview = vi.fn((path: string) =>
      Promise.resolve(
        path.endsWith("two.md")
          ? tooComplexDiffPreview(path)
          : diffPreview(path),
      ),
    );

    try {
      await test.render({
        config: null,
        preview: {
          source: "git-changes-stream",
          items: [
            documentStreamItem("docs/one.md"),
            documentStreamItem("docs/two.md"),
            documentStreamItem("docs/three.md"),
          ],
        },
        getGitDiffPreview,
        ...requiredDiffStreamProps(),
        onClose: vi.fn(),
      });

      await act(async () => {
        intersection.trigger("docs/one.md", "docs/two.md");
      });
      await flushPreviewLoad();
      expect(
        test.container.querySelector(
          '[data-stream-index="1"] [data-review-id="diff-stream-too-complex-blocker"]',
        ),
      ).not.toBeNull();

      await act(async () => {
        buttonByText("Next").dispatchEvent(
          new MouseEvent("click", { bubbles: true }),
        );
      });
      await flushPreviewLoad();

      expect(getGitDiffPreview).toHaveBeenCalledTimes(3);
      expect(getGitDiffPreview).toHaveBeenCalledWith(
        "/workspace/docs/three.md",
      );
      expect(
        test.container.querySelector(
          '[data-stream-index="2"] [data-active-change="true"]',
        ),
      ).not.toBeNull();

      await act(async () => {
        buttonByText("Previous").dispatchEvent(
          new MouseEvent("click", { bubbles: true }),
        );
      });
      expect(
        test.container.querySelector(
          '[data-stream-index="0"] [data-active-change="true"]',
        ),
      ).not.toBeNull();
      expect(getGitDiffPreview).toHaveBeenCalledTimes(3);
    } finally {
      intersection.restore();
    }
  });

  it("continues pending navigation when the requested section becomes over-budget", async () => {
    const intersection = installMockIntersectionObserver();
    const middlePreview = deferred<DocumentDiffPreview>();
    const getGitDiffPreview = vi.fn((path: string) =>
      path.endsWith("two.md")
        ? middlePreview.promise
        : Promise.resolve(diffPreview(path)),
    );

    try {
      await test.render({
        config: null,
        preview: {
          source: "git-changes-stream",
          items: [
            documentStreamItem("docs/one.md"),
            documentStreamItem("docs/two.md"),
            documentStreamItem("docs/three.md"),
          ],
        },
        getGitDiffPreview,
        ...requiredDiffStreamProps(),
        onClose: vi.fn(),
      });

      await act(async () => intersection.trigger("docs/one.md"));
      await flushPreviewLoad();
      await act(async () => {
        buttonByText("Next").dispatchEvent(
          new MouseEvent("click", { bubbles: true }),
        );
      });
      expect(getGitDiffPreview).toHaveBeenCalledWith("/workspace/docs/two.md");

      middlePreview.resolve(tooComplexDiffPreview("/workspace/docs/two.md"));
      await flushPreviewLoad();

      expect(getGitDiffPreview).toHaveBeenCalledWith(
        "/workspace/docs/three.md",
      );
      expect(
        test.container.querySelector(
          '[data-stream-index="2"] [data-active-change="true"]',
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

      const activeListItems = Array.from(
        test.container.querySelectorAll(
          ".git-rendered-list-item-change[data-active-change='true']",
        ),
      );
      expect(activeListItems.map((target) => target.textContent)).toEqual([
        "Old list item",
        "New list item",
      ]);
      expect(scrollTargets.at(-1)?.textContent).toContain("New list item");
      expect(scrollTargets.at(-1)?.getAttribute("data-change-index")).toBe("1");

      await act(async () => {
        buttonByText("Next").dispatchEvent(
          new MouseEvent("click", { bubbles: true }),
        );
      });

      const activeTableRows = Array.from(
        test.container.querySelectorAll(
          ".git-rendered-table-row-change[data-active-change='true']",
        ),
      );
      expect(activeTableRows.map((target) => target.textContent)).toEqual([
        "Old table value",
        "New table value",
      ]);
      expect(scrollTargets.at(-1)?.textContent).toContain("New table value");
      expect(scrollTargets.at(-1)?.getAttribute("data-change-index")).toBe("2");

      await act(async () => {
        buttonByText("Previous").dispatchEvent(
          new MouseEvent("click", { bubbles: true }),
        );
      });

      expect(
        test.container.querySelector(
          ".git-rendered-pane:last-child .git-rendered-list-item-change[data-active-change='true']",
        )?.textContent,
      ).toContain("New list item");
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it("routes content cursor and shortcut commands to the stream", async () => {
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({
        left: 0,
        top: 0,
        right: 640,
        bottom: 480,
        width: 640,
        height: 480,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);
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

    expect(streamCommandRef.current?.isEnabled("viewer.captureArea")).toBe(
      true,
    );
    expect(
      streamCommandRef.current?.isEnabled("viewer.captureAreaWithReference"),
    ).toBe(true);

    await act(async () => {
      expect(streamCommandRef.current?.dispatch("viewer.captureArea")).toBe(
        true,
      );
    });
    expect(
      test.container.querySelector('[data-review-id="capture-area-overlay"]'),
    ).not.toBeNull();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(
      test.container.querySelector('[data-review-id="capture-area-overlay"]'),
    ).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    const activeIndexes = () =>
      new Set(
        Array.from(
          test.container.querySelectorAll<HTMLElement>(
            ".diff-stream-rendered-body [data-active-change='true']",
          ),
          (target) => target.dataset.changeIndex,
        ),
      );
    expect(activeIndexes()).toEqual(new Set(["0"]));

    await act(async () => {
      expect(contentCursorCommandRef.current?.("next")).toBe(true);
    });
    expect(activeIndexes()).toEqual(new Set(["1"]));

    await act(async () => {
      expect(
        streamCommandRef.current?.dispatch("viewer.contentCursor.previous"),
      ).toBe(true);
    });
    expect(activeIndexes()).toEqual(new Set(["0"]));

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
    rectSpy.mockRestore();
  });

  it("disables capture for a blocker current section", async () => {
    const streamCommandRef: {
      current: DocumentDiffStreamCommandBridge | null;
    } = { current: null };

    await test.render({
      config: null,
      preview: {
        source: "git-changes-stream",
        items: [
          {
            kind: "blocker",
            path: "assets/logo.png",
            status: "modified",
            reason: "Unsupported",
          },
        ],
      },
      getGitDiffPreview: vi.fn(),
      streamCommandRef,
      ...requiredDiffStreamProps(),
      onClose: vi.fn(),
    });

    expect(streamCommandRef.current?.isEnabled("viewer.captureArea")).toBe(
      false,
    );
    expect(streamCommandRef.current?.dispatch("viewer.captureArea")).toBe(
      false,
    );
    expect(
      test.container.querySelector('[data-review-id="capture-area-overlay"]'),
    ).toBeNull();
  });
});
