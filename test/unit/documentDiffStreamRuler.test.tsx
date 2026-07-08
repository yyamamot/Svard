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

describe("DocumentDiffStreamPanel ruler", () => {
  const test = setupDocumentDiffStreamPanelTest();

  it("renders stream ruler markers and keeps marker selection in sync", async () => {
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

    const markers = () =>
      Array.from(
        test.container.querySelectorAll<HTMLButtonElement>(
          '[data-review-id="diff-stream-change-ruler-marker"]',
        ),
      );
    expect(markers()).toHaveLength(2);
    expect(markers()[0].classList.contains("active")).toBe(true);

    await act(async () => {
      markers()[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(markers()[1].classList.contains("active")).toBe(true);

    await act(async () => {
      buttonByText("Previous").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(markers()[0].classList.contains("active")).toBe(true);

    await act(async () => {
      buttonByText("Next").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    expect(markers()[1].classList.contains("active")).toBe(true);
  });

  it("selects fine-grained stream targets from ruler markers", async () => {
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

    const markers = Array.from(
      test.container.querySelectorAll<HTMLButtonElement>(
        '[data-review-id="diff-stream-change-ruler-marker"]',
      ),
    );
    expect(markers).toHaveLength(3);

    await act(async () => {
      markers[2].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(markers[2].classList.contains("active")).toBe(true);
    const activeTarget = test.container.querySelector<HTMLElement>(
      ".git-rendered-table-row-change[data-active-change='true']",
    );
    expect(activeTarget?.textContent).toContain("New table value");
    expect(markers[2].dataset.changeIndex).toBe(
      activeTarget?.dataset.changeIndex,
    );
    expect(markers[2].dataset.streamIndex).toBe(
      activeTarget?.closest<HTMLElement>(
        '[data-review-id="diff-stream-file-section"]',
      )?.dataset.streamIndex,
    );
  });
});
