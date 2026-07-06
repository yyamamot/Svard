import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DocumentDiffStreamPanel } from "../../src/ui/components/DocumentDiffStreamPanel";
import type { DocumentDiffPreview } from "../../src/core/types";
import { deriveGitRenderedDiffSummary } from "../../src/ui/lib/gitRenderedDiff";

vi.mock("../../src/ui/lib/gitRenderedDiff", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../src/ui/lib/gitRenderedDiff")>();
  return {
    ...actual,
    deriveGitRenderedDiffSummary: vi.fn(),
  };
});

const deriveGitRenderedDiffSummaryMock = vi.mocked(deriveGitRenderedDiffSummary);

describe("DocumentDiffStreamPanel", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    deriveGitRenderedDiffSummaryMock.mockReset();
    deriveGitRenderedDiffSummaryMock.mockResolvedValue(renderedDiffSummary());
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("loads document sections and marks only loaded documents viewed", async () => {
    const markViewed = vi.fn();
    const preview = diffPreview("/workspace/docs/guide.md");
    const getGitDiffPreview = vi.fn().mockResolvedValue(preview);
    const props = requiredDiffStreamProps();

    await act(async () => {
      root.render(
        <DocumentDiffStreamPanel
          config={null}
          preview={{
            source: "git-changes-stream",
            items: [
              {
                kind: "document",
                path: "docs/guide.md",
                documentPath: "/workspace/docs/guide.md",
                status: "modified",
              },
              {
                kind: "document",
                path: "docs/second.md",
                documentPath: "/workspace/docs/second.md",
                status: "modified",
              },
            ],
          }}
          documentReviewSession={{
            stateByPath: {},
            summary: { total: 1, reviewed: 0, needsAttention: 0 },
            markViewed,
            markNeedsAttention: vi.fn(),
            reset: vi.fn(),
          }}
          getGitDiffPreview={getGitDiffPreview}
          {...props}
          onClose={vi.fn()}
        />,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(getGitDiffPreview).toHaveBeenCalledWith("/workspace/docs/guide.md");
    expect(getGitDiffPreview).toHaveBeenCalledWith("/workspace/docs/second.md");
    expect(markViewed).toHaveBeenCalledWith("/workspace/docs/guide.md");
    expect(markViewed).toHaveBeenCalledWith("/workspace/docs/second.md");
    expect(
      container.querySelector('[data-review-id="diff-stream-file-section"]'),
    ).not.toBeNull();
    expect(container.textContent).not.toContain("Loading rendered diff");
    expect(container.textContent).not.toContain("Preview failed");
  });

  it("renders unsupported files as blocker rows without fetching previews", async () => {
    const getGitDiffPreview = vi.fn();
    const props = requiredDiffStreamProps();

    await act(async () => {
      root.render(
        <DocumentDiffStreamPanel
          config={null}
          preview={{
            source: "git-changes-stream",
            items: [
              {
                kind: "blocker",
                path: "assets/logo.png",
                status: "modified",
                reason: "Preview diff is available for markup documents only.",
              },
            ],
          }}
          getGitDiffPreview={getGitDiffPreview}
          {...props}
          onClose={vi.fn()}
        />,
      );
    });

    expect(getGitDiffPreview).not.toHaveBeenCalled();
    expect(
      container.querySelector('[data-review-id="diff-stream-blocker-row"]')
        ?.textContent,
    ).toContain("Preview diff is available for markup documents only.");
  });

  it("hides block meta in full preview and shows it in changes only", async () => {
    const getGitDiffPreview = vi.fn().mockResolvedValue(
      diffPreview("/workspace/docs/guide.md"),
    );
    const props = requiredDiffStreamProps();

    await act(async () => {
      root.render(
        <DocumentDiffStreamPanel
          config={null}
          preview={{
            source: "git-changes-stream",
            items: [
              {
                kind: "document",
                path: "docs/guide.md",
                documentPath: "/workspace/docs/guide.md",
                status: "modified",
              },
            ],
          }}
          getGitDiffPreview={getGitDiffPreview}
          {...props}
          onClose={vi.fn()}
        />,
      );
    });

    await flushPreviewLoad();

    expect(container.querySelector(".git-rendered-block-meta")).toBeNull();

    const changesOnlyButton = container.querySelector<HTMLButtonElement>(
      '[data-review-id="diff-stream-changes-only-view"]',
    );
    expect(changesOnlyButton).not.toBeNull();
    await act(async () => {
      changesOnlyButton!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(container.querySelector(".git-rendered-block-meta")).not.toBeNull();

    const fullPreviewButton = container.querySelector<HTMLButtonElement>(
      '[data-review-id="diff-stream-full-preview-view"]',
    );
    expect(fullPreviewButton).not.toBeNull();
    await act(async () => {
      fullPreviewButton!.dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });

    expect(container.querySelector(".git-rendered-block-meta")).toBeNull();
  });

});

async function flushPreviewLoad() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function requiredDiffStreamProps() {
  return {
    copyText: vi.fn().mockResolvedValue(undefined),
    openContextMenu: vi.fn(() => true),
    openDocument: vi.fn().mockResolvedValue(undefined),
    openPathInEditor: vi.fn().mockResolvedValue(undefined),
    resolveDocumentLink: vi.fn().mockResolvedValue({
      status: "blocked",
      message: "Missing",
    }),
    confirmExternalLink: vi.fn().mockResolvedValue(true),
    openExternalUrl: vi.fn().mockResolvedValue(undefined),
    onOpenDiagramPreview: vi.fn(),
    showInlineNotice: vi.fn(),
  };
}

function diffPreview(path: string): DocumentDiffPreview {
  return {
    source: "git",
    relativePath: "docs/guide.md",
    leftPath: path,
    rightPath: path,
    status: "modified",
    leftLabel: "HEAD",
    rightLabel: "Working Tree",
    hunks: [
      {
        oldStart: 1,
        oldLines: 1,
        newStart: 1,
        newLines: 1,
        lines: [
          { kind: "removed", oldLine: 1, newLine: null, text: "# Old Guide" },
          { kind: "removed", oldLine: 3, newLine: null, text: "Old text" },
          { kind: "added", oldLine: null, newLine: 1, text: "# New Guide" },
          { kind: "added", oldLine: null, newLine: 3, text: "New text" },
        ],
      },
    ],
    leftText: "# Old Guide\n\nOld text",
    rightText: "# New Guide\n\nNew text",
  };
}

function renderedDiffSummary() {
  return {
    blocks: [
      {
        id: "paragraph",
        kind: "changed" as const,
        blockKind: "paragraph" as const,
        left: {
          id: "paragraph-left",
          kind: "paragraph" as const,
          tagName: "p",
          text: "Old text",
          html: "<p>Old text</p>",
        },
        right: {
          id: "paragraph-right",
          kind: "paragraph" as const,
          tagName: "p",
          text: "New text",
          html: "<p>New text</p>",
        },
      },
    ],
  };
}
