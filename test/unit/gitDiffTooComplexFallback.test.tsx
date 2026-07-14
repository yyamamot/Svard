import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  isLineDiffTooComplex,
  lineDiffAvailability,
  normalizeGitDiffPreview,
  type DocumentDiffPreview,
} from "../../src/core/types";
import { DocumentDiffPreviewPanel } from "../../src/ui/components/GitDiffPreviewPanel";
import type { CaptureAreaCommandHandler } from "../../src/ui/lib/captureArea";
import { deriveGitRenderedDiffSummary } from "../../src/ui/lib/gitRenderedDiff";
import { deriveGitTableDiffSummary } from "../../src/ui/lib/gitTableDiff";

vi.mock("../../src/ui/lib/gitRenderedDiff", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/ui/lib/gitRenderedDiff")>();
  return {
    ...actual,
    deriveGitRenderedDiffSummary: vi.fn(),
  };
});

vi.mock("../../src/ui/lib/gitTableDiff", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/ui/lib/gitTableDiff")>();
  return {
    ...actual,
    deriveGitTableDiffSummary: vi.fn(),
  };
});

const deriveRenderedMock = vi.mocked(deriveGitRenderedDiffSummary);
const deriveTableMock = vi.mocked(deriveGitTableDiffSummary);

function tooComplexPreview(): DocumentDiffPreview {
  return {
    source: "git",
    repositoryRoot: "/workspace",
    relativePath: "docs/guide.md",
    leftPath: "/workspace/docs/guide.md",
    rightPath: "/workspace/docs/guide.md",
    status: "modified",
    lineDiffAvailability: "too-complex",
    lineDiffFallbackReason: "work-budget-exceeded",
    leftLabel: "HEAD",
    rightLabel: "Working Tree",
    hunks: [],
    leftText: "# Guide\n\nOld text",
    rightText: "# Guide\n<script>window.__executed = true</script>\nNew text",
    message:
      "Highlighted diff is unavailable because this comparison exceeds the safe work limit. Both source versions remain available.",
  };
}

function availablePreview(): DocumentDiffPreview {
  return {
    ...tooComplexPreview(),
    lineDiffAvailability: "available",
    lineDiffFallbackReason: undefined,
    hunks: [
      {
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 1,
        lines: [
          { kind: "removed", oldLine: 1, newLine: null, text: "Old text" },
          { kind: "added", oldLine: null, newLine: 1, text: "New text" },
        ],
      },
    ],
    message: undefined,
  };
}

describe("Git diff too-complex fallback", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    deriveRenderedMock.mockReset();
    deriveTableMock.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("normalizes only omitted migration fields to available", () => {
    const legacy = {
      ...tooComplexPreview(),
      lineDiffAvailability: undefined,
      lineDiffFallbackReason: undefined,
    };

    expect(lineDiffAvailability(legacy)).toBe("available");
    expect(isLineDiffTooComplex(legacy)).toBe(false);
    expect(normalizeGitDiffPreview(legacy)).toMatchObject({
      lineDiffAvailability: "available",
    });
    expect(isLineDiffTooComplex(tooComplexPreview())).toBe(true);
  });

  it("shows raw source only without starting rendered or table producers", async () => {
    const loadDocumentContext = vi.fn();
    const resolveLocalImage = vi.fn();
    const renderDiagram = vi.fn();
    const onClose = vi.fn();

    await act(async () => {
      root.render(
        <DocumentDiffPreviewPanel
          preview={tooComplexPreview()}
          config={null}
          loadDocumentContext={loadDocumentContext}
          resolveLocalImage={resolveLocalImage}
          renderDiagram={renderDiagram}
          copyText={vi.fn()}
          openContextMenu={vi.fn(() => false)}
          openDocument={vi.fn(async () => undefined)}
          openPathInEditor={vi.fn(async () => undefined)}
          resolveDocumentLink={vi.fn(async () => ({
            status: "blocked" as const,
          }))}
          confirmExternalLink={vi.fn(async () => false)}
          openExternalUrl={vi.fn(async () => undefined)}
          onOpenDiagramPreview={vi.fn()}
          showInlineNotice={vi.fn()}
          onClose={onClose}
        />,
      );
      await Promise.resolve();
    });

    expect(
      container.querySelector('[data-review-id="git-diff-source-only-banner"]')
        ?.textContent,
    ).toBe("Change highlighting is unavailable for this comparison.");
    expect(
      container.querySelector('[data-review-id="git-diff-change-count"]')
        ?.textContent,
    ).toBe("Source only");
    expect(
      container.querySelector('[data-review-id="git-diff-left-pane"]')
        ?.textContent,
    ).toContain("1# Guide2 3Old text");
    expect(
      container.querySelector('[data-review-id="git-diff-right-pane"]')
        ?.textContent,
    ).toContain("2<script>window.__executed = true</script>");
    expect(container.querySelector("script")).toBeNull();

    for (const reviewId of [
      "git-diff-overview-view",
      "git-diff-full-preview-view",
      "git-diff-rendered-view",
      "git-diff-table-view",
    ]) {
      expect(
        container.querySelector<HTMLButtonElement>(
          `[data-review-id="${reviewId}"]`,
        )?.disabled,
      ).toBe(true);
    }
    expect(
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="git-diff-source-view"]',
        )
        ?.classList.contains("active"),
    ).toBe(true);
    expect(
      [...container.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) => button.textContent?.trim() === "Previous",
      )?.disabled,
    ).toBe(true);
    expect(
      [...container.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) => button.textContent?.trim() === "Next",
      )?.disabled,
    ).toBe(true);
    expect(
      container.querySelector('[data-review-id="git-diff-change-ruler"]'),
    ).toBeNull();
    expect(container.textContent).not.toContain("0 changes");

    expect(deriveRenderedMock).not.toHaveBeenCalled();
    expect(deriveTableMock).not.toHaveBeenCalled();
    expect(loadDocumentContext).not.toHaveBeenCalled();
    expect(resolveLocalImage).not.toHaveBeenCalled();
    expect(renderDiagram).not.toHaveBeenCalled();

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="git-diff-preview-close"]',
        )
        ?.click();
    });
    expect(onClose).toHaveBeenCalledWith(
      expect.objectContaining({
        preview: expect.objectContaining({
          lineDiffAvailability: "too-complex",
        }),
        renderedPresentation: expect.objectContaining({
          entries: [],
          navigationTargets: [],
        }),
      }),
    );
  });

  it("clears an active capture when the preview falls back to source only", async () => {
    deriveRenderedMock.mockResolvedValue({
      blocks: [
        {
          id: "paragraph-0",
          kind: "changed",
          blockKind: "paragraph",
          left: {
            id: "paragraph-0-left",
            kind: "paragraph",
            tagName: "p",
            text: "Old text",
            html: "<p>Old text</p>",
          },
          right: {
            id: "paragraph-0-right",
            kind: "paragraph",
            tagName: "p",
            text: "New text",
            html: "<p>New text</p>",
          },
        },
      ],
    });
    deriveTableMock.mockResolvedValue({
      renderedTables: [],
      tableMarkers: [],
    });
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({
        bottom: 100,
        height: 100,
        left: 0,
        right: 100,
        top: 0,
        width: 100,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect);
    const captureAreaCommandRef: {
      current: CaptureAreaCommandHandler | null;
    } = { current: null };
    const onClose = vi.fn();
    const panelProps = {
      config: null,
      captureAreaCommandRef,
      copyText: vi.fn(),
      openContextMenu: vi.fn(() => false),
      openDocument: vi.fn(async () => undefined),
      openPathInEditor: vi.fn(async () => undefined),
      resolveDocumentLink: vi.fn(async () => ({
        status: "blocked" as const,
      })),
      confirmExternalLink: vi.fn(async () => false),
      openExternalUrl: vi.fn(async () => undefined),
      onOpenDiagramPreview: vi.fn(),
      showInlineNotice: vi.fn(),
      onClose,
    };

    await act(async () => {
      root.render(
        <DocumentDiffPreviewPanel
          {...panelProps}
          preview={availablePreview()}
        />,
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    const renderedArticle = container.querySelector<HTMLElement>(
      ".git-rendered-diff-body",
    );
    expect(renderedArticle).not.toBeNull();
    await act(async () => {
      expect(captureAreaCommandRef.current?.()).toBe(true);
    });
    expect(
      container.querySelector('[data-review-id="capture-area-overlay"]'),
    ).not.toBeNull();

    await act(async () => {
      root.render(
        <DocumentDiffPreviewPanel
          {...panelProps}
          preview={tooComplexPreview()}
        />,
      );
    });
    rectSpy.mockRestore();

    expect(
      container.querySelector('[data-review-id="capture-area-overlay"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-review-id="git-diff-source-only"]'),
    ).not.toBeNull();
    expect(captureAreaCommandRef.current?.()).toBe(false);
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
