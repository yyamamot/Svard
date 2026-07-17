import { act } from "react";
import { describe, expect, it, vi } from "vitest";
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
  requiredDiffStreamProps,
  renderedDiffSummary,
  renderedDiffSummaryWithFineTargets,
} from "./documentDiffStreamTestUtils";

describe("DocumentDiffStreamPanel rulers and margin markers", () => {
  const test = setupDocumentDiffStreamPanelTest();

  it("keeps the overview ruler and passive margin markers in sync", async () => {
    deriveGitRenderedDiffSummaryMock.mockResolvedValue(renderedDiffSummary(2));
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
    await flushRulerMeasure();
    const rulerMarkers = () =>
      Array.from(
        test.container.querySelectorAll<HTMLButtonElement>(
          '[data-review-id="diff-stream-change-ruler-marker"]',
        ),
      );
    expect(rulerMarkers()).toHaveLength(2);
    expect(rulerMarkers()[0].classList.contains("active")).toBe(true);
    expect(
      test.container.querySelectorAll(
        ".diff-stream-rendered-body .git-rendered-block.change-target",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      test.container.querySelectorAll(
        '[data-review-id="git-rendered-margin-markers"]',
      ),
    ).toHaveLength(2);
    expect(
      test.container.querySelectorAll(
        '[data-review-id="git-rendered-margin-marker"]',
      ).length,
    ).toBeGreaterThan(0);

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
      rulerMarkers()[1].dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(activeIndexes()).toEqual(new Set(["1"]));
    expect(rulerMarkers()[1].classList.contains("active")).toBe(true);
    expect(
      test.container.querySelector(
        '[data-review-id="git-rendered-margin-marker"][data-change-index="1"].active',
      ),
    ).not.toBeNull();

    await act(async () => {
      buttonByText("Previous").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(activeIndexes()).toEqual(new Set(["0"]));
    expect(
      test.container.querySelector(
        '[data-review-id="git-rendered-margin-marker"][data-change-index="0"].active',
      ),
    ).not.toBeNull();

    await act(async () => {
      buttonByText("Next").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(activeIndexes()).toEqual(new Set(["1"]));
  });

  it("remeasures margin markers when live diff targets are replaced", async () => {
    deriveGitRenderedDiffSummaryMock.mockResolvedValue(renderedDiffSummary(1));
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
    await flushRulerMeasure();
    const leftPane = test.container.querySelector<HTMLElement>(
      '[data-review-id="diff-stream-left-pane"]',
    );
    const scroll = leftPane?.querySelector<HTMLElement>(".git-rendered-scroll");
    expect(scroll).not.toBeNull();

    const replacementTarget = document.createElement("div");
    replacementTarget.className = "git-rendered-block change-target";
    replacementTarget.dataset.changeIndex = "7";
    await act(async () => {
      scroll?.append(replacementTarget);
      await Promise.resolve();
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });

    expect(
      leftPane?.querySelector(
        '[data-review-id="git-rendered-margin-marker"][data-change-index="7"]',
      ),
    ).not.toBeNull();
  });

  it("keeps fine-grained targets passive while navigation selects them", async () => {
    deriveGitRenderedDiffSummaryMock.mockResolvedValue(
      renderedDiffSummaryWithFineTargets(),
    );
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
    await flushRulerMeasure();
    expect(
      test.container.querySelectorAll(
        '[data-review-id="diff-stream-change-ruler-marker"]',
      ),
    ).toHaveLength(3);
    for (const side of ["left", "right"] as const) {
      const layer = test.container.querySelector(
        `[data-review-id="git-rendered-margin-markers"][data-marker-side="${side}"]`,
      );
      expect(
        layer?.querySelectorAll(
          '[data-review-id="git-rendered-margin-marker"]',
        ),
      ).toHaveLength(3);
      expect(
        layer?.querySelector(
          '[data-review-id="git-rendered-margin-marker"][data-change-index="1"]',
        ),
      ).not.toBeNull();
      expect(
        layer?.querySelector(
          '[data-review-id="git-rendered-margin-marker"][data-change-index="2"]',
        ),
      ).not.toBeNull();
    }
    expect(
      test.container.querySelector(
        ".git-rendered-list-item-change .git-rendered-margin-marker",
      ),
    ).toBeNull();

    await act(async () => {
      buttonByText("Next").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    await act(async () => {
      buttonByText("Next").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    const activeTargets = Array.from(
      test.container.querySelectorAll<HTMLElement>(
        ".git-rendered-table-row-change[data-active-change='true']",
      ),
    );
    expect(activeTargets.map((target) => target.textContent)).toEqual([
      "Old table value",
      "New table value",
    ]);
    expect(
      activeTargets.every((target) => target.dataset.changeIndex === "2"),
    ).toBe(true);
  });
});
