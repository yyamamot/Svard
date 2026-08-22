import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import type {
  DocumentDiffPreview,
  GitBranchDiffPreviewBatchItem,
  GitDiffPreviewBatchEntry,
} from "../../src/core/types";
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

  it("aborts an in-flight rendered summary when the stream generation changes", async () => {
    let firstSignal: AbortSignal | undefined;
    deriveGitRenderedDiffSummaryMock
      .mockImplementationOnce((_preview, options) => {
        firstSignal = options?.signal;
        return new Promise((_, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Operation aborted", "AbortError")),
            { once: true },
          );
        });
      })
      .mockResolvedValue({ blocks: [] });
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValue(diffPreview("/workspace/docs/one.md"));
    const baseProps = {
      config: null,
      getGitDiffPreview,
      ...requiredDiffStreamProps(),
      onClose: vi.fn(),
    };

    await test.render({
      ...baseProps,
      preview: {
        source: "git-changes-stream" as const,
        items: [documentStreamItem("docs/one.md")],
      },
    });
    await flushPreviewLoad();

    expect(firstSignal).toBeInstanceOf(AbortSignal);
    expect(firstSignal?.aborted).toBe(false);

    await test.render({
      ...baseProps,
      preview: {
        source: "git-changes-stream" as const,
        items: [documentStreamItem("docs/two.md")],
      },
    });
    await flushPreviewLoad();

    expect(firstSignal?.aborted).toBe(true);
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

  it("batches at most two visible Working Tree previews without preloading the third", async () => {
    const getGitDiffPreview = vi.fn();
    const getGitDiffPreviews = vi.fn(
      async (repositoryRoot: string, relativePaths: string[]) =>
        relativePaths.map((relativePath) => ({
          status: "ready" as const,
          preview: diffPreview(`${repositoryRoot}/${relativePath}`),
        })),
    );

    await test.render({
      config: null,
      preview: {
        source: "git-changes-stream",
        repositoryRoot: "/workspace",
        items: [
          documentStreamItem("docs/one.md"),
          documentStreamItem("docs/two.md"),
          documentStreamItem("docs/three.md"),
        ],
      },
      getGitDiffPreview,
      getGitDiffPreviews,
      ...requiredDiffStreamProps(),
      onClose: vi.fn(),
    });

    await flushPreviewLoad();

    expect(getGitDiffPreviews).toHaveBeenCalledTimes(1);
    expect(getGitDiffPreviews).toHaveBeenCalledWith("/workspace", [
      "docs/one.md",
      "docs/two.md",
    ]);
    expect(getGitDiffPreview).not.toHaveBeenCalled();
    expect(deriveGitRenderedDiffSummaryMock).toHaveBeenCalledTimes(2);
  });

  it("keeps a single visible Working Tree preview on the existing API", async () => {
    const getGitDiffPreview = vi
      .fn()
      .mockResolvedValue(diffPreview("/workspace/docs/one.md"));
    const getGitDiffPreviews = vi.fn();

    await test.render({
      config: null,
      preview: {
        source: "git-changes-stream",
        repositoryRoot: "/workspace",
        items: [documentStreamItem("docs/one.md")],
      },
      getGitDiffPreview,
      getGitDiffPreviews,
      ...requiredDiffStreamProps(),
      onClose: vi.fn(),
    });

    await flushPreviewLoad();

    expect(getGitDiffPreviews).not.toHaveBeenCalled();
    expect(getGitDiffPreview).toHaveBeenCalledTimes(1);
  });

  it("keeps a successful batch section when another entry fails", async () => {
    const getGitDiffPreviews = vi.fn().mockResolvedValue([
      {
        status: "ready",
        preview: diffPreview("/workspace/docs/one.md"),
      },
      { status: "error", message: "fixture failure" },
    ]);

    await test.render({
      config: null,
      preview: {
        source: "git-changes-stream",
        repositoryRoot: "/workspace",
        items: [
          documentStreamItem("docs/one.md"),
          documentStreamItem("docs/two.md"),
        ],
      },
      getGitDiffPreview: vi.fn(),
      getGitDiffPreviews,
      ...requiredDiffStreamProps(),
      onClose: vi.fn(),
    });

    await flushPreviewLoad();

    expect(deriveGitRenderedDiffSummaryMock).toHaveBeenCalledTimes(1);
    expect(
      test.container.querySelectorAll(
        '[data-review-id="diff-stream-rendered-body"]',
      ),
    ).toHaveLength(1);
    expect(test.container.textContent).toContain(
      "This file cannot be previewed right now.",
    );
  });

  it("does not use the Working Tree batch callback for Branch Diff streams", async () => {
    const getGitDiffPreviews = vi.fn();
    const getGitBranchFileDiff = vi
      .fn()
      .mockResolvedValue(diffPreview("/workspace/docs/one.md"));

    await test.render({
      config: null,
      preview: {
        source: "git-branch-stream",
        repositoryRoot: "/workspace",
        baseRef: "main",
        items: [documentStreamItem("docs/one.md")],
      },
      getGitDiffPreview: vi.fn(),
      getGitDiffPreviews,
      getGitBranchFileDiff,
      ...requiredDiffStreamProps(),
      onClose: vi.fn(),
    });

    await flushPreviewLoad();

    expect(getGitDiffPreviews).not.toHaveBeenCalled();
    expect(getGitBranchFileDiff).toHaveBeenCalledTimes(1);
  });

  it("batches two visible Branch Diff previews without preloading a third", async () => {
    const getGitBranchFileDiff = vi.fn();
    const getGitBranchFileDiffs = vi.fn(
      async (
        _root: string,
        options: { items: GitBranchDiffPreviewBatchItem[] },
      ) =>
        options.items.map((item) => ({
          status: "ready" as const,
          preview: diffPreview(`/workspace/${item.path}`),
        })),
    );
    await test.render({
      config: null,
      preview: {
        source: "git-branch-stream",
        repositoryRoot: "/workspace",
        baseRef: "main",
        headRef: "HEAD",
        items: [
          documentStreamItem("docs/one.md"),
          documentStreamItem("docs/two.md"),
          documentStreamItem("docs/three.md"),
        ],
      },
      getGitDiffPreview: vi.fn(),
      getGitBranchFileDiff,
      getGitBranchFileDiffs,
      ...requiredDiffStreamProps(),
      onClose: vi.fn(),
    });
    await flushPreviewLoad();
    expect(getGitBranchFileDiffs).toHaveBeenCalledTimes(1);
    expect(getGitBranchFileDiffs).toHaveBeenCalledWith("/workspace", {
      baseRef: "main",
      headRef: "HEAD",
      items: [
        { path: "docs/one.md", oldPath: undefined },
        { path: "docs/two.md", oldPath: undefined },
      ],
    });
    expect(getGitBranchFileDiff).not.toHaveBeenCalled();
  });

  it("batches two visible Repo Graph commit previews", async () => {
    const getGitFileCommitDiff = vi.fn();
    const getGitFileCommitDiffs = vi.fn(
      async (repositoryRoot: string, _revision: string, paths: string[]) =>
        paths.map((path) => ({
          status: "ready" as const,
          preview: diffPreview(`${repositoryRoot}/${path}`),
        })),
    );
    await test.render({
      config: null,
      preview: {
        source: "git-commit-stream",
        repositoryRoot: "/workspace",
        revision: "revision-a",
        items: [
          documentStreamItem("docs/one.md"),
          documentStreamItem("docs/two.md"),
        ],
      },
      getGitDiffPreview: vi.fn(),
      getGitFileCommitDiff,
      getGitFileCommitDiffs,
      ...requiredDiffStreamProps(),
      onClose: vi.fn(),
    });
    await flushPreviewLoad();
    expect(getGitFileCommitDiffs).toHaveBeenCalledWith(
      "/workspace",
      "revision-a",
      ["docs/one.md", "docs/two.md"],
    );
    expect(getGitFileCommitDiff).not.toHaveBeenCalled();
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

    expect(deriveGitRenderedDiffSummaryMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        perfOwner: "all-diffs",
        perfEntryIndex: 0,
      }),
    );
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

  it("discards stale Working Tree batch results when refresh starts with the same items", async () => {
    const intersection = installMockIntersectionObserver();
    const paths = ["/workspace/docs/one.md", "/workspace/docs/two.md"];
    const items = [
      documentStreamItem("docs/one.md"),
      documentStreamItem("docs/two.md"),
    ];
    const staleBatch = deferred<GitDiffPreviewBatchEntry[]>();
    const currentBatch = deferred<GitDiffPreviewBatchEntry[]>();
    const getGitDiffPreviews = vi
      .fn()
      .mockReturnValueOnce(staleBatch.promise)
      .mockReturnValueOnce(currentBatch.promise);
    const props = {
      config: null,
      getGitDiffPreview: vi.fn(),
      getGitDiffPreviews,
      ...requiredDiffStreamProps(),
      onClose: vi.fn(),
    };

    try {
      await test.render({
        ...props,
        preview: {
          source: "git-changes-stream" as const,
          repositoryRoot: "/workspace",
          items,
          watchStatus: "fresh" as const,
        },
      });
      await act(async () => intersection.trigger("docs/one.md", "docs/two.md"));
      expect(getGitDiffPreviews).toHaveBeenCalledTimes(1);

      await test.render({
        ...props,
        preview: {
          source: "git-changes-stream" as const,
          repositoryRoot: "/workspace",
          items,
          watchStatus: "refreshing" as const,
        },
      });
      await act(async () => intersection.trigger("docs/one.md", "docs/two.md"));
      expect(getGitDiffPreviews).toHaveBeenCalledTimes(2);

      await act(async () => {
        staleBatch.resolve(
          paths.map((path) => ({
            status: "ready" as const,
            preview: diffPreview(path),
          })),
        );
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(deriveGitRenderedDiffSummaryMock).not.toHaveBeenCalled();

      currentBatch.resolve(
        paths.map((path) => ({
          status: "ready" as const,
          preview: diffPreview(path),
        })),
      );
      await flushPreviewLoad();
      expect(deriveGitRenderedDiffSummaryMock).toHaveBeenCalledTimes(2);
    } finally {
      intersection.restore();
    }
  });
});
