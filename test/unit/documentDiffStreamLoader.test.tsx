import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import type { DocumentDiffPreview } from "../../src/core/types";
import {
  deriveGitRenderedDiffSummaryMock,
  setupDocumentDiffStreamPanelTest,
} from "./documentDiffStreamPanelHarness";
import {
  deferred,
  diffPreview,
  documentStreamItem,
  flushPreviewLoad,
  installMockIntersectionObserver,
  requiredDiffStreamProps,
  tooComplexDiffPreview,
} from "./documentDiffStreamTestUtils";

describe("DocumentDiffStreamPanel loader", () => {
  const test = setupDocumentDiffStreamPanelTest();

  it("loads document sections without marking preloaded documents viewed", async () => {
    const markViewed = vi.fn();
    const preview = diffPreview("/workspace/docs/guide.md");
    const getGitDiffPreview = vi.fn().mockResolvedValue(preview);
    const props = requiredDiffStreamProps();

    await test.render({
      config: null,
      preview: {
        source: "git-changes-stream",
        items: [
          documentStreamItem("docs/guide.md"),
          documentStreamItem("docs/second.md"),
        ],
      },
      documentReviewSession: {
        stateByPath: {},
        summary: { total: 1, reviewed: 0, needsAttention: 0 },
        markViewed,
        markNeedsAttention: vi.fn(),
        reset: vi.fn(),
      },
      getGitDiffPreview,
      ...props,
      onClose: vi.fn(),
    });

    await flushPreviewLoad();

    expect(getGitDiffPreview).toHaveBeenCalledWith("/workspace/docs/guide.md");
    expect(getGitDiffPreview).toHaveBeenCalledWith("/workspace/docs/second.md");
    expect(markViewed).not.toHaveBeenCalled();
    expect(
      test.container.querySelector(
        '[data-review-id="diff-stream-file-section"]',
      ),
    ).not.toBeNull();
    expect(test.container.textContent).not.toContain("Loading rendered diff");
    expect(test.container.textContent).not.toContain("Preview failed");
  });

  it("marks only the current loaded section viewed after the reading delay", async () => {
    vi.useFakeTimers();
    const markViewed = vi.fn();
    try {
      await test.render({
        config: null,
        preview: {
          source: "git-changes-stream",
          items: [
            documentStreamItem("docs/guide.md"),
            documentStreamItem("docs/second.md"),
          ],
        },
        documentReviewSession: {
          stateByPath: {},
          summary: { total: 2, reviewed: 0, needsAttention: 0 },
          markViewed,
          markNeedsAttention: vi.fn(),
          reset: vi.fn(),
        },
        getGitDiffPreview: vi
          .fn()
          .mockResolvedValue(diffPreview("/workspace/docs/guide.md")),
        ...requiredDiffStreamProps(),
        onClose: vi.fn(),
      });

      await flushPreviewLoad();
      expect(markViewed).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(700);
      });

      expect(markViewed).toHaveBeenCalledTimes(1);
      expect(markViewed).toHaveBeenCalledWith("/workspace/docs/guide.md");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not fetch every document when All diffs opens", async () => {
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValue(diffPreview("/workspace/docs/guide.md"));

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

    await flushPreviewLoad();

    expect(getGitDiffPreview).toHaveBeenCalledTimes(2);
    expect(getGitDiffPreview).not.toHaveBeenCalledWith(
      "/workspace/docs/three.md",
    );
  });

  it("hydrates sections when they enter the stream viewport", async () => {
    const intersection = installMockIntersectionObserver();
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValue(diffPreview("/workspace/docs/guide.md"));

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

      expect(getGitDiffPreview).not.toHaveBeenCalled();

      await act(async () => {
        intersection.trigger("docs/two.md");
      });
      await flushPreviewLoad();

      expect(getGitDiffPreview).toHaveBeenCalledTimes(1);
      expect(getGitDiffPreview).toHaveBeenCalledWith("/workspace/docs/two.md");
    } finally {
      intersection.restore();
    }
  });

  it("limits initial stream hydration to two concurrent preview requests", async () => {
    const intersection = installMockIntersectionObserver();
    const first = deferred<DocumentDiffPreview>();
    const second = deferred<DocumentDiffPreview>();
    const third = deferred<DocumentDiffPreview>();
    const getGitDiffPreview = vi.fn((path: string) => {
      if (path.endsWith("one.md")) {
        return first.promise;
      }
      if (path.endsWith("two.md")) {
        return second.promise;
      }
      return third.promise;
    });

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
        intersection.trigger("docs/one.md", "docs/two.md", "docs/three.md");
      });

      expect(getGitDiffPreview).toHaveBeenCalledTimes(2);

      await act(async () => {
        first.resolve(diffPreview("/workspace/docs/one.md"));
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(getGitDiffPreview).toHaveBeenCalledTimes(3);
      second.resolve(diffPreview("/workspace/docs/two.md"));
      third.resolve(diffPreview("/workspace/docs/three.md"));
      await flushPreviewLoad();
    } finally {
      intersection.restore();
    }
  });

  it("keeps summary derivation wired through the loader", async () => {
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

    expect(deriveGitRenderedDiffSummaryMock).toHaveBeenCalled();
  });

  it("blocks an over-budget section before rendered producers and continues the stream", async () => {
    const openDiffPreview = vi.fn();
    const getGitDiffPreview = vi.fn((path: string) =>
      Promise.resolve(
        path.endsWith("one.md")
          ? tooComplexDiffPreview(path)
          : diffPreview(path),
      ),
    );

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
      onOpenDiffPreview: openDiffPreview,
      onClose: vi.fn(),
    });

    await flushPreviewLoad();

    expect(getGitDiffPreview).toHaveBeenCalledTimes(2);
    expect(deriveGitRenderedDiffSummaryMock).toHaveBeenCalledTimes(1);
    expect(
      test.container.querySelector(
        '[data-review-id="diff-stream-too-complex-blocker"]',
      )?.textContent,
    ).toContain("exceeds the safe work limit");
    expect(
      test.container.querySelectorAll(
        '[data-review-id="diff-stream-rendered-body"]',
      ),
    ).toHaveLength(1);

    const action = test.container.querySelector<HTMLButtonElement>(
      '[data-review-id="diff-stream-open-source-fallback"]',
    );
    expect(action).not.toBeNull();
    await act(async () => action?.click());
    expect(openDiffPreview).toHaveBeenCalledTimes(1);
    expect(openDiffPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        lineDiffAvailability: "too-complex",
        leftText: expect.stringContaining("Original source"),
        rightText: expect.stringContaining("Updated source"),
      }),
    );
  });

  it("does not retry an over-budget section within the same stream generation", async () => {
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValue(tooComplexDiffPreview("/workspace/docs/one.md"));

    await test.render({
      config: null,
      preview: {
        source: "git-changes-stream",
        items: [documentStreamItem("docs/one.md")],
      },
      getGitDiffPreview,
      ...requiredDiffStreamProps(),
      onOpenDiffPreview: vi.fn(),
      onClose: vi.fn(),
    });
    await flushPreviewLoad();

    const toggle = test.container.querySelector<HTMLButtonElement>(
      '[data-review-id="diff-stream-file-section"] header button',
    );
    await act(async () => toggle?.click());
    await act(async () => toggle?.click());
    await flushPreviewLoad();

    expect(getGitDiffPreview).toHaveBeenCalledTimes(1);
    expect(deriveGitRenderedDiffSummaryMock).not.toHaveBeenCalled();
  });

  it("does not automatically mark an over-budget section viewed", async () => {
    vi.useFakeTimers();
    const markViewed = vi.fn();
    try {
      await test.render({
        config: null,
        preview: {
          source: "git-changes-stream",
          items: [documentStreamItem("docs/one.md")],
        },
        documentReviewSession: {
          stateByPath: {},
          summary: { total: 1, reviewed: 0, needsAttention: 0 },
          markViewed,
          markNeedsAttention: vi.fn(),
          reset: vi.fn(),
        },
        getGitDiffPreview: vi
          .fn()
          .mockResolvedValue(tooComplexDiffPreview("/workspace/docs/one.md")),
        ...requiredDiffStreamProps(),
        onOpenDiffPreview: vi.fn(),
        onClose: vi.fn(),
      });
      await flushPreviewLoad();
      await act(async () => vi.advanceTimersByTime(1_000));

      expect(markViewed).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("re-evaluates a section when refreshed stream items form a new generation", async () => {
    const path = "/workspace/docs/one.md";
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValueOnce(tooComplexDiffPreview(path))
      .mockResolvedValueOnce(diffPreview(path));
    const props = {
      config: null,
      getGitDiffPreview,
      ...requiredDiffStreamProps(),
      onOpenDiffPreview: vi.fn(),
      onClose: vi.fn(),
    };

    await test.render({
      ...props,
      preview: {
        source: "git-changes-stream" as const,
        items: [documentStreamItem("docs/one.md")],
      },
    });
    await flushPreviewLoad();
    expect(
      test.container.querySelector(
        '[data-review-id="diff-stream-too-complex-blocker"]',
      ),
    ).not.toBeNull();

    await test.render({
      ...props,
      preview: {
        source: "git-changes-stream" as const,
        items: [documentStreamItem("docs/one.md")],
      },
    });
    await flushPreviewLoad();

    expect(getGitDiffPreview).toHaveBeenCalledTimes(2);
    expect(deriveGitRenderedDiffSummaryMock).toHaveBeenCalledTimes(1);
    expect(
      test.container.querySelector(
        '[data-review-id="diff-stream-too-complex-blocker"]',
      ),
    ).toBeNull();
    expect(
      test.container.querySelector(
        '[data-review-id="diff-stream-rendered-body"]',
      ),
    ).not.toBeNull();
  });

  it("hides the prior ready snapshot during the refreshed items commit", async () => {
    const intersection = installMockIntersectionObserver();
    const path = "/workspace/docs/one.md";
    const nextPreview = deferred<DocumentDiffPreview>();
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValueOnce(diffPreview(path))
      .mockReturnValueOnce(nextPreview.promise);
    const renderedBodyAtLayout: boolean[] = [];
    const recordLayout = () => {
      renderedBodyAtLayout.push(
        Boolean(
          test.container.querySelector(
            '[data-review-id="diff-stream-rendered-body"]',
          ),
        ),
      );
    };
    const props = {
      config: null,
      getGitDiffPreview,
      ...requiredDiffStreamProps(),
      onClose: vi.fn(),
    };

    try {
      await test.renderObserved(
        {
          ...props,
          preview: {
            source: "git-changes-stream" as const,
            items: [documentStreamItem("docs/one.md")],
          },
        },
        recordLayout,
      );
      await act(async () => intersection.trigger("docs/one.md"));
      await flushPreviewLoad();
      expect(
        test.container.querySelector(
          '[data-review-id="diff-stream-rendered-body"]',
        ),
      ).not.toBeNull();

      await test.renderObserved(
        {
          ...props,
          preview: {
            source: "git-changes-stream" as const,
            items: [documentStreamItem("docs/one.md")],
          },
        },
        recordLayout,
      );

      expect(renderedBodyAtLayout.at(-1)).toBe(false);
      expect(
        test.container.querySelector(
          '[data-review-id="diff-stream-rendered-body"]',
        ),
      ).toBeNull();
      nextPreview.resolve(diffPreview(path));
    } finally {
      intersection.restore();
    }
  });

  it("starts the refreshed same-path request while the stale generation is pending", async () => {
    const intersection = installMockIntersectionObserver();
    const path = "/workspace/docs/one.md";
    const stalePreview = deferred<DocumentDiffPreview>();
    const currentPreview = deferred<DocumentDiffPreview>();
    const getGitDiffPreview = vi
      .fn()
      .mockReturnValueOnce(stalePreview.promise)
      .mockReturnValueOnce(currentPreview.promise);
    const props = {
      config: null,
      getGitDiffPreview,
      ...requiredDiffStreamProps(),
      onClose: vi.fn(),
    };

    try {
      await test.render({
        ...props,
        preview: {
          source: "git-changes-stream" as const,
          items: [documentStreamItem("docs/one.md")],
        },
      });
      await act(async () => intersection.trigger("docs/one.md"));
      expect(getGitDiffPreview).toHaveBeenCalledTimes(1);

      await test.render({
        ...props,
        preview: {
          source: "git-changes-stream" as const,
          items: [documentStreamItem("docs/one.md")],
        },
      });
      await act(async () => intersection.trigger("docs/one.md"));

      expect(getGitDiffPreview).toHaveBeenCalledTimes(2);
      await act(async () => {
        stalePreview.resolve(diffPreview(path));
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(deriveGitRenderedDiffSummaryMock).not.toHaveBeenCalled();
      expect(
        test.container.querySelector(
          '[data-review-id="diff-stream-rendered-body"]',
        ),
      ).toBeNull();

      currentPreview.resolve(diffPreview(path));
      await flushPreviewLoad();
      expect(deriveGitRenderedDiffSummaryMock).toHaveBeenCalledTimes(1);
      expect(
        test.container.querySelector(
          '[data-review-id="diff-stream-rendered-body"]',
        ),
      ).not.toBeNull();
    } finally {
      intersection.restore();
    }
  });
});
