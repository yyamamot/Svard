import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultConfig } from "../../src/core/defaultConfig";
import type {
  AppConfig,
  DocumentPayload,
  RenderResult,
} from "../../src/core/types";
import { ViewerPane } from "../../src/ui/components/ViewerPane";
import { emptySafeHtml, markSafeHtml } from "../../src/ui/lib/safeHtml";
import type {
  RevisionLensResolvedTarget,
  RevisionLensTargetRequest,
  ViewerPaneSnapshot,
} from "../../src/ui/types";

const renderResult: RenderResult = {
  html: "<p>Preview</p>",
  headings: [],
  sourceBlocks: [],
  diagnostics: [],
  diagramSlots: [],
  mermaidDiagrams: [],
  plantUmlDiagrams: [],
  graphvizDiagrams: [],
  krokiDiagrams: [],
};

const baseSnapshot: ViewerPaneSnapshot = {
  id: "left",
  documentPayload: null,
  renderResult: null,
  documentHtml: emptySafeHtml,
  query: "",
  searchIndex: 0,
  searchHits: [],
  activeHeadingId: null,
  navigationBackStack: [],
  navigationForwardStack: [],
};

const noop = vi.fn();
const originalNavigatorPlatform = window.navigator.platform;
const originalRangeRect = Range.prototype.getBoundingClientRect;
const originalRangeRects = Range.prototype.getClientRects;

function payload(format: DocumentPayload["format"]): DocumentPayload {
  return {
    path: `/workspace/docs/example.${format === "asciidoc" ? "adoc" : "md"}`,
    basePath: "/workspace/docs",
    format,
    source: "",
    updatedAt: "2026-05-19T00:00:00.000Z",
  };
}

function emptyPostDiffTableSummary() {
  return {
    tableCellMarkerCount: 0,
    tableAddedRowMarkerCount: 0,
    tableBlockFallbackCount: 0,
    tableNotApplicableCount: 0,
    reasonCounts: {},
  };
}

describe("ViewerPane post-diff git markers", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    Object.defineProperty(Range.prototype, "getBoundingClientRect", {
      configurable: true,
      value: () => new DOMRect(0, 0, 1, 1),
    });
    Object.defineProperty(Range.prototype, "getClientRects", {
      configurable: true,
      value: () => [new DOMRect(0, 0, 1, 1)],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: originalNavigatorPlatform,
    });
    Object.defineProperty(Range.prototype, "getBoundingClientRect", {
      configurable: true,
      value: originalRangeRect,
    });
    Object.defineProperty(Range.prototype, "getClientRects", {
      configurable: true,
      value: originalRangeRects,
    });
    act(() => root.unmount());
    container.remove();
  });

  function renderPane({
    config = {
      ...defaultConfig,
      reader: { asciidocTheme: "antora" },
      experimental: {
        searchHitRuler: false,
        restoreAdditionalWindowsOnStartup: false,
        diagramPlaceholderRendering: false,
        postDiffGitMarkers: false,
      },
    },
    documentPayload = payload("asciidoc"),
    documentHtml = markSafeHtml("<p>Preview</p>"),
    error = null,
    isLoading = false,
    renderResult: nextRenderResult = renderResult,
    postDiffGitMarkers = null,
    resolveRevisionLensTargets,
  }: {
    config?: AppConfig;
    documentPayload?: DocumentPayload | null;
    documentHtml?: ReturnType<typeof markSafeHtml>;
    error?: string | null;
    isLoading?: boolean;
    renderResult?: RenderResult | null;
    postDiffGitMarkers?: Parameters<typeof ViewerPane>[0]["postDiffGitMarkers"];
    resolveRevisionLensTargets?: Parameters<
      typeof ViewerPane
    >[0]["resolveRevisionLensTargets"];
  } = {}) {
    root.render(
      <ViewerPane
        config={config}
        error={error}
        inlineNotice={null}
        lightweightActionFeedback={null}
        isLoading={isLoading}
        mouseGestureTrail={[]}
        paneId="left"
        snapshot={baseSnapshot}
        splitEnabled={false}
        focusedPaneId="left"
        documentPayload={documentPayload}
        renderResult={nextRenderResult}
        documentHtml={documentHtml}
        postDiffGitMarkers={postDiffGitMarkers}
        resolveRevisionLensTargets={resolveRevisionLensTargets}
        query=""
        searchHits={[]}
        searchIndex={0}
        onArticleClick={noop}
        onArticleContextMenu={noop}
        onArticleDoubleClick={noop}
        onArticleBlur={noop}
        onArticleFocus={noop}
        onArticlePointerLeave={noop}
        onArticlePointerMove={noop}
        onClearContentCursor={noop}
        onDismissInlineNotice={noop}
        onDispatchCommand={noop}
        onFocusPane={noop}
        onActivateSearchHit={noop}
        onConsumePendingMouseGestureContextMenu={() => null}
        onMouseGestureContextMenu={noop}
        onMouseGesturePointerCancel={noop}
        onMouseGesturePointerDown={noop}
        onMouseGesturePointerMove={noop}
        onMouseGesturePointerUp={noop}
        onOpenDirectory={noop}
        onOpenDocument={noop}
        onPickDirectory={noop}
        onPickDocument={noop}
        onClearRecentDocuments={noop}
        onClearRecentDirectories={noop}
      />,
    );
  }

  it("keeps post-diff git markers hidden while the opt-in flag is disabled", async () => {
    await act(async () =>
      renderPane({
        documentHtml: markSafeHtml("<p>Changed</p>"),
        postDiffGitMarkers: {
          documentPath: "/workspace/docs/example.adoc",
          documentUpdatedAt: "2026-05-19T00:00:00.000Z",
          totalCount: 1,
          renderedCount: 1,
          tableSummary: emptyPostDiffTableSummary(),
          markers: [
            {
              id: "post-diff-marker:0:rendered-block:0",
              kind: "changed",
              anchorBlockId: "rendered-block:0",
              changeIndex: 0,
            },
          ],
        },
      }),
    );

    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });

    expect(
      container.querySelector('[data-review-id="post-diff-git-markers"]'),
    ).toBeNull();
    expect(container.querySelector(".post-diff-git-highlight")).toBeNull();
  });

  it("keeps stale post-diff git markers hidden after document reload", async () => {
    await act(async () =>
      renderPane({
        config: {
          ...defaultConfig,
          experimental: {
            ...defaultConfig.experimental,
            postDiffGitMarkers: true,
          },
        },
        documentHtml: markSafeHtml("<p>Changed</p>"),
        documentPayload: {
          ...payload("asciidoc"),
          updatedAt: "2026-05-20T00:00:00.000Z",
        },
        postDiffGitMarkers: {
          documentPath: "/workspace/docs/example.adoc",
          documentUpdatedAt: "2026-05-19T00:00:00.000Z",
          totalCount: 1,
          renderedCount: 1,
          tableSummary: emptyPostDiffTableSummary(),
          markers: [
            {
              id: "post-diff-marker:0:rendered-block:0",
              kind: "changed",
              anchorBlockId: "rendered-block:0",
              changeIndex: 0,
            },
          ],
        },
      }),
    );

    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });

    expect(
      container.querySelector('[data-review-id="post-diff-git-markers"]'),
    ).toBeNull();
    expect(container.querySelector(".post-diff-git-highlight")).toBeNull();
  });

  it("reveals the selected marker Base only while B is held", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const resolveRevisionLensTargets = vi.fn(
      async (targets: RevisionLensTargetRequest[]) =>
        targets.map((target) => ({
          ...target,
          status: "base" as const,
          blockKind: "paragraph",
          html: "<p>Base wording</p>",
        })),
    );

    await act(async () =>
      renderPane({
        config: {
          ...defaultConfig,
          experimental: {
            ...defaultConfig.experimental,
            postDiffGitMarkers: true,
            changeReviewDisplay: "subtle",
          },
        },
        documentHtml: markSafeHtml("<p>Working Tree wording</p>"),
        postDiffGitMarkers: {
          documentPath: "/workspace/docs/example.adoc",
          documentUpdatedAt: "2026-05-19T00:00:00.000Z",
          totalCount: 1,
          renderedCount: 1,
          tableSummary: emptyPostDiffTableSummary(),
          markers: [
            {
              id: "post-diff-marker:0:rendered-diff:0",
              diffBlockId: "rendered-diff:0",
              kind: "changed",
              anchorBlockId: "rendered-block:0",
              changeIndex: 0,
            },
          ],
        },
        resolveRevisionLensTargets,
      }),
    );
    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });

    const marker = container.querySelector<HTMLButtonElement>(
      '[data-review-id="post-diff-git-marker"]',
    );
    const firstParagraph = container.querySelector(".document-body > p");
    const selection = window.getSelection();
    await act(async () => {
      if (firstParagraph && selection) {
        const range = document.createRange();
        range.selectNodeContents(firstParagraph);
        selection.removeAllRanges();
        selection.addRange(range);
        document.dispatchEvent(new Event("selectionchange"));
      }
    });
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    });
    expect(resolveRevisionLensTargets).not.toHaveBeenCalled();
    await act(async () => {
      marker?.focus();
      await Promise.resolve();
    });
    expect(resolveRevisionLensTargets).toHaveBeenCalledTimes(1);
    expect(
      container.querySelector('[data-review-id="revision-lens-hint"]'),
    ).toBeNull();

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "b", bubbles: true }),
      );
    });
    expect(
      container.querySelector('[data-review-id="revision-lens-replacement"]')
        ?.textContent,
    ).toContain("Base wording");
    expect(
      container.querySelector(".document-body > p")?.getAttribute("style"),
    ).toContain("display: none");

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keyup", { key: "b", bubbles: true }),
      );
    });
    expect(
      container.querySelector('[data-review-id="revision-lens-replacement"]'),
    ).toBeNull();
    expect(container.querySelector(".document-body > p")?.textContent).toBe(
      "Working Tree wording",
    );
    expect(
      container.querySelector('[data-review-id="revision-lens-hint"]'),
    ).toBeNull();

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "b", bubbles: true }),
      );
    });
    expect(
      container.querySelector('[data-review-id="revision-lens-replacement"]'),
    ).not.toBeNull();

    await act(async () => {
      window.dispatchEvent(new Event("blur"));
    });
    expect(
      container.querySelector('[data-review-id="revision-lens-replacement"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-review-id="revision-lens-hint"]'),
    ).toBeNull();
  });

  it("reveals compact marker blocks only while the marker is pressed", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const paragraphs = Array.from(
          this.ownerDocument.querySelectorAll(".document-body > p"),
        );
        const index = paragraphs.indexOf(this);
        const isViewerSurface =
          this.classList.contains("viewer-pane") ||
          this.classList.contains("document-body");
        const top = index >= 0 ? 80 + index * 60 : 0;
        const height = isViewerSurface ? 500 : 40;
        return {
          x: 100,
          y: top,
          top,
          right: 500,
          bottom: top + height,
          left: 100,
          width: 400,
          height,
          toJSON: () => ({}),
        } as DOMRect;
      },
    );
    let completeFirstResolution: (() => void) | null = null;
    const resolveRevisionLensTargets = vi.fn(
      (targets: RevisionLensTargetRequest[]) => {
        const resolved: RevisionLensResolvedTarget[] = targets.map(
          (target) => ({
            ...target,
            status: "base" as const,
            blockKind: "paragraph",
            html: `<p>Base ${target.diffBlockId}</p>`,
          }),
        );
        if (resolveRevisionLensTargets.mock.calls.length === 1) {
          return new Promise<RevisionLensResolvedTarget[]>((resolve) => {
            completeFirstResolution = () => resolve(resolved);
          });
        }
        return Promise.resolve(resolved);
      },
    );

    await act(async () =>
      renderPane({
        config: {
          ...defaultConfig,
          experimental: {
            ...defaultConfig.experimental,
            postDiffGitMarkers: true,
            changeReviewDisplay: "subtle",
          },
        },
        documentHtml: markSafeHtml(
          "<p>First working text</p><p>Second working text</p>",
        ),
        postDiffGitMarkers: {
          documentPath: "/workspace/docs/example.adoc",
          documentUpdatedAt: "2026-05-19T00:00:00.000Z",
          totalCount: 2,
          renderedCount: 2,
          tableSummary: emptyPostDiffTableSummary(),
          markers: [
            {
              id: "post-diff-marker:0:rendered-diff:0",
              diffBlockId: "rendered-diff:0",
              kind: "changed",
              anchorBlockId: "rendered-block:0",
              changeIndex: 0,
            },
            {
              id: "post-diff-marker:1:rendered-diff:1",
              diffBlockId: "rendered-diff:1",
              kind: "changed",
              anchorBlockId: "rendered-block:1",
              changeIndex: 1,
            },
          ],
        },
        resolveRevisionLensTargets,
      }),
    );
    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });
    expect(
      container.querySelectorAll('[data-review-id="post-diff-git-marker"]'),
    ).toHaveLength(1);
    const marker = container.querySelector<HTMLButtonElement>(
      '[data-review-id="post-diff-git-marker"]',
    );
    await act(async () => {
      marker?.dispatchEvent(
        new MouseEvent("pointerdown", {
          bubbles: true,
          button: 0,
          clientX: 10,
          clientY: 100,
        }),
      );
      await new Promise((resolve) => window.setTimeout(resolve, 220));
    });

    expect(resolveRevisionLensTargets).toHaveBeenCalledWith([
      expect.objectContaining({ diffBlockId: "rendered-diff:0" }),
      expect.objectContaining({ diffBlockId: "rendered-diff:1" }),
    ]);
    expect(
      container.querySelector('[data-review-id="revision-lens-hint"]')
        ?.textContent,
    ).toBe("Preparing Base…");
    expect(
      container.querySelector('[data-review-id="revision-lens-replacement"]'),
    ).toBeNull();
    await act(async () => {
      completeFirstResolution?.();
      await Promise.resolve();
    });
    expect(
      container.querySelector('[data-review-id="revision-lens-hint"]'),
    ).toBeNull();
    expect(
      container.querySelectorAll(
        '[data-review-id="revision-lens-replacement"]',
      ),
    ).toHaveLength(2);
    await act(async () => {
      marker?.dispatchEvent(
        new MouseEvent("pointerup", {
          bubbles: true,
          button: 0,
          clientX: 10,
          clientY: 100,
        }),
      );
      marker?.click();
    });
    expect(
      container.querySelector('[data-review-id="revision-lens-replacement"]'),
    ).toBeNull();
    expect(scrollIntoView).not.toHaveBeenCalled();

    await act(async () => {
      marker?.dispatchEvent(
        new MouseEvent("pointerdown", { bubbles: true, button: 0 }),
      );
      marker?.dispatchEvent(
        new MouseEvent("pointerup", { bubbles: true, button: 0 }),
      );
      marker?.click();
    });
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
  });

  it("does not activate Revision Lens for modified B or while a dialog is open", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const resolveRevisionLensTargets = vi.fn(
      async (targets: RevisionLensTargetRequest[]) =>
        targets.map((target) => ({
          ...target,
          status: "added" as const,
        })),
    );
    await act(async () =>
      renderPane({
        config: {
          ...defaultConfig,
          experimental: {
            ...defaultConfig.experimental,
            postDiffGitMarkers: true,
          },
        },
        documentHtml: markSafeHtml("<p>Added wording</p>"),
        postDiffGitMarkers: {
          documentPath: "/workspace/docs/example.adoc",
          documentUpdatedAt: "2026-05-19T00:00:00.000Z",
          totalCount: 1,
          renderedCount: 1,
          tableSummary: emptyPostDiffTableSummary(),
          markers: [
            {
              id: "post-diff-marker:0:rendered-diff:0",
              diffBlockId: "rendered-diff:0",
              kind: "added",
              anchorBlockId: "rendered-block:0",
              changeIndex: 0,
            },
          ],
        },
        resolveRevisionLensTargets,
      }),
    );
    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });
    await act(async () => {
      container
        .querySelector<HTMLButtonElement>(
          '[data-review-id="post-diff-git-marker"]',
        )
        ?.focus();
      await Promise.resolve();
    });
    expect(
      container.querySelector('[data-review-id="revision-lens-hint"]'),
    ).toBeNull();

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "b",
          bubbles: true,
          metaKey: true,
        }),
      );
    });
    expect(
      container.querySelector('[data-review-id="revision-lens-replacement"]'),
    ).toBeNull();

    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.append(dialog);
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "b", bubbles: true }),
      );
    });
    expect(
      container.querySelector('[data-review-id="revision-lens-replacement"]'),
    ).toBeNull();
    dialog.remove();

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "b",
          bubbles: true,
          repeat: true,
        }),
      );
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "b",
          bubbles: true,
          isComposing: true,
        }),
      );
    });
    expect(
      container.querySelector('[data-review-id="revision-lens-replacement"]'),
    ).toBeNull();

    const input = document.createElement("input");
    document.body.append(input);
    await act(async () => {
      input.dispatchEvent(
        new KeyboardEvent("keydown", { key: "b", bubbles: true }),
      );
    });
    expect(
      container.querySelector('[data-review-id="revision-lens-replacement"]'),
    ).toBeNull();
    input.remove();

    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "b", bubbles: true }),
      );
    });
    expect(
      container.querySelector('[data-review-id="revision-lens-replacement"]')
        ?.textContent,
    ).toContain("Added in Working Tree — no Base content");
    await act(async () => {
      window.dispatchEvent(
        new KeyboardEvent("keyup", { key: "b", bubbles: true }),
      );
    });
  });
});
