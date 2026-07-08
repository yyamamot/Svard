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
} from "./documentDiffStreamTestUtils";

describe("DocumentDiffStreamPanel loader", () => {
  const test = setupDocumentDiffStreamPanelTest();

  it("loads document sections and marks only loaded documents viewed", async () => {
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
    expect(markViewed).toHaveBeenCalledWith("/workspace/docs/guide.md");
    expect(markViewed).toHaveBeenCalledWith("/workspace/docs/second.md");
    expect(
      test.container.querySelector('[data-review-id="diff-stream-file-section"]'),
    ).not.toBeNull();
    expect(test.container.textContent).not.toContain("Loading rendered diff");
    expect(test.container.textContent).not.toContain("Preview failed");
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
});
