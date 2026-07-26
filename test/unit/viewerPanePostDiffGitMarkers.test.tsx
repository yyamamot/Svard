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
import type { ViewerPaneSnapshot } from "../../src/ui/types";

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
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: originalNavigatorPlatform,
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

  it("renders opt-in post-diff git markers and scrolls to the target block", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    await act(async () =>
      renderPane({
        config: {
          ...defaultConfig,
          experimental: {
            ...defaultConfig.experimental,
            postDiffGitMarkers: true,
          },
        },
        documentHtml: markSafeHtml("<p>Intro</p><p>Changed token</p>"),
        postDiffGitMarkers: {
          documentPath: "/workspace/docs/example.adoc",
          documentUpdatedAt: "2026-05-19T00:00:00.000Z",
          totalCount: 1,
          renderedCount: 1,
          tableSummary: emptyPostDiffTableSummary(),
          markers: [
            {
              id: "post-diff-marker:0:rendered-block:1",
              kind: "changed",
              anchorBlockId: "rendered-block:1",
              changeIndex: 0,
              inlineDiffRanges: [{ kind: "added", start: 8, end: 13 }],
            },
          ],
        },
      }),
    );

    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });

    const marker = container.querySelector<HTMLButtonElement>(
      '[data-review-id="post-diff-git-marker"]',
    );
    expect(
      container.querySelector('[data-review-id="post-diff-git-markers"]'),
    ).not.toBeNull();
    expect(marker?.dataset.markerKind).toBe("changed");
    const highlightedBlock = container.querySelector<HTMLElement>(
      ".post-diff-git-highlight",
    );
    expect(highlightedBlock?.textContent).toBe("Changed token");
    expect(highlightedBlock?.dataset.postDiffGitMarkerKind).toBe("changed");
    const inlineHighlight = highlightedBlock?.querySelector<HTMLElement>(
      ".git-inline-word-highlight.added",
    );
    expect(inlineHighlight?.textContent).toBe("token");

    act(() => {
      marker?.click();
    });

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
  });

  it("keeps subtle Change Review markers without persistent document highlights", async () => {
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        const tagName = this.tagName.toLowerCase();
        const geometry =
          tagName === "p"
            ? { top: 100, height: 80 }
            : tagName === "li"
              ? { top: 200, height: 60 }
              : tagName === "tr"
                ? { top: 300, height: 40 }
                : { top: 0, height: 24 };
        return {
          x: 100,
          y: geometry.top,
          top: geometry.top,
          right: 500,
          bottom: geometry.top + geometry.height,
          left: 100,
          width: 400,
          height: geometry.height,
          toJSON: () => ({}),
        } as DOMRect;
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
          [
            "<p>Changed token</p>",
            "<ul><li>Changed item</li></ul>",
            "<table><tbody><tr><th>Name</th><th>Status</th></tr>",
            "<tr><td>Feature</td><td>Status Done</td></tr></tbody></table>",
          ].join(""),
        ),
        postDiffGitMarkers: {
          documentPath: "/workspace/docs/example.adoc",
          documentUpdatedAt: "2026-05-19T00:00:00.000Z",
          totalCount: 3,
          renderedCount: 3,
          tableSummary: {
            tableCellMarkerCount: 1,
            tableAddedRowMarkerCount: 0,
            tableBlockFallbackCount: 0,
            tableNotApplicableCount: 0,
            reasonCounts: { "same-schema-cell-change": 1 },
          },
          markers: [
            {
              id: "post-diff-marker:0:rendered-block:0",
              kind: "changed",
              anchorBlockId: "rendered-block:0",
              changeIndex: 0,
              inlineDiffRanges: [{ kind: "added", start: 8, end: 13 }],
            },
            {
              id: "post-diff-marker:1:rendered-block:1:item:0",
              kind: "changed",
              anchorBlockId: "rendered-block:1",
              anchorItemIndex: 0,
              changeIndex: 1,
              targetKind: "list-item",
              inlineDiffRanges: [{ kind: "added", start: 8, end: 12 }],
            },
            {
              id: "post-diff-marker:2:rendered-block:2:table-row:1",
              kind: "changed",
              anchorBlockId: "rendered-block:2",
              anchorTableRowIndex: 1,
              changeIndex: 2,
              targetKind: "table-row",
              tableCellHighlights: [
                {
                  cellIndex: 1,
                  kind: "changed",
                  inlineDiffRanges: [{ kind: "added", start: 7, end: 11 }],
                },
              ],
            },
          ],
        },
      }),
    );

    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });

    const markerRoot = container.querySelector<HTMLElement>(
      '[data-review-id="post-diff-git-markers"]',
    );
    expect(markerRoot?.dataset.displayMode).toBe("subtle");
    expect(markerRoot?.classList.contains("subtle")).toBe(true);
    expect(markerRoot?.dataset.markerCount).toBe("3");
    const markers = container.querySelectorAll<HTMLElement>(
      '[data-review-id="post-diff-git-marker"]',
    );
    expect(markers).toHaveLength(2);
    expect(markers[0]?.style.top).toBe("180px");
    expect(
      markers[0]?.style.getPropertyValue("--post-diff-marker-range-height"),
    ).toBe("160px");
    expect(
      markers[1]?.style.getPropertyValue("--post-diff-marker-range-height"),
    ).toBe("40px");
    expect(container.querySelector(".post-diff-git-highlight")).toBeNull();
    expect(
      container.querySelector(".post-diff-git-highlight-list-item"),
    ).toBeNull();
    expect(
      container.querySelector(".post-diff-git-highlight-table-cell"),
    ).toBeNull();
    expect(container.querySelector(".git-inline-word-highlight")).toBeNull();
  });

  it("renders post-diff git markers on changed list items without highlighting the parent list", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    await act(async () =>
      renderPane({
        config: {
          ...defaultConfig,
          experimental: {
            ...defaultConfig.experimental,
            postDiffGitMarkers: true,
          },
        },
        documentHtml: markSafeHtml(
          "<ul><li>Stable item</li><li>Changed token</li></ul>",
        ),
        postDiffGitMarkers: {
          documentPath: "/workspace/docs/example.adoc",
          documentUpdatedAt: "2026-05-19T00:00:00.000Z",
          totalCount: 1,
          renderedCount: 1,
          tableSummary: emptyPostDiffTableSummary(),
          markers: [
            {
              id: "post-diff-marker:0:rendered-block:0:item:1",
              kind: "changed",
              anchorBlockId: "rendered-block:0",
              anchorItemIndex: 1,
              changeIndex: 0,
              inlineDiffRanges: [{ kind: "added", start: 8, end: 13 }],
              targetKind: "list-item",
            },
          ],
        },
      }),
    );

    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });

    const marker = container.querySelector<HTMLButtonElement>(
      '[data-review-id="post-diff-git-marker"]',
    );
    const parentList = container.querySelector("ul");
    const highlightedItem = container.querySelector<HTMLElement>(
      "li.post-diff-git-highlight-list-item",
    );

    expect(marker?.dataset.markerKind).toBe("changed");
    expect(parentList?.classList.contains("post-diff-git-highlight")).toBe(
      false,
    );
    expect(highlightedItem?.textContent).toBe("Changed token");
    expect(highlightedItem?.dataset.postDiffGitMarkerKind).toBe("changed");
    expect(
      highlightedItem?.querySelector(".git-inline-word-highlight.added")
        ?.textContent,
    ).toBe("token");

    act(() => {
      marker?.click();
    });

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
  });

  it("renders post-diff git markers on table cells without highlighting the parent table", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    await act(async () =>
      renderPane({
        config: {
          ...defaultConfig,
          experimental: {
            ...defaultConfig.experimental,
            postDiffGitMarkers: true,
          },
        },
        documentHtml: markSafeHtml(
          [
            "<table><tbody>",
            "<tr><th>Name</th><th>Status</th></tr>",
            "<tr><td>Feature</td><td>Status Done review</td></tr>",
            "</tbody></table>",
          ].join(""),
        ),
        postDiffGitMarkers: {
          documentPath: "/workspace/docs/example.adoc",
          documentUpdatedAt: "2026-05-19T00:00:00.000Z",
          totalCount: 1,
          renderedCount: 1,
          tableSummary: {
            tableCellMarkerCount: 1,
            tableAddedRowMarkerCount: 0,
            tableBlockFallbackCount: 0,
            tableNotApplicableCount: 0,
            reasonCounts: {
              "same-schema-cell-change": 1,
            },
          },
          markers: [
            {
              id: "post-diff-marker:0:rendered-block:0:table-row:1",
              kind: "changed",
              anchorBlockId: "rendered-block:0",
              anchorTableRowIndex: 1,
              changeIndex: 0,
              targetKind: "table-row",
              tableCellHighlights: [
                {
                  cellIndex: 1,
                  kind: "changed",
                  inlineDiffRanges: [{ kind: "added", start: 7, end: 11 }],
                },
              ],
            },
          ],
        },
      }),
    );

    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });

    const marker = container.querySelector<HTMLButtonElement>(
      '[data-review-id="post-diff-git-marker"]',
    );
    const markerRoot = container.querySelector<HTMLElement>(
      '[data-review-id="post-diff-git-markers"]',
    );
    const parentTable = container.querySelector("table");
    const highlightedRow = container.querySelector<HTMLTableRowElement>(
      "tr.post-diff-git-highlight-table-row",
    );
    const highlightedCell = container.querySelector<HTMLElement>(
      "td.post-diff-git-highlight-table-cell",
    );

    expect(marker?.dataset.markerKind).toBe("changed");
    expect(markerRoot?.dataset.tableCellMarkerCount).toBe("1");
    expect(markerRoot?.dataset.tableAddedRowMarkerCount).toBe("0");
    expect(markerRoot?.dataset.tableBlockFallbackCount).toBe("0");
    expect(markerRoot?.dataset.tableNotApplicableCount).toBe("0");
    expect(markerRoot?.dataset.tableReasonCounts).toBe(
      '{"same-schema-cell-change":1}',
    );
    expect(parentTable?.classList.contains("post-diff-git-highlight")).toBe(
      false,
    );
    expect(highlightedRow?.textContent).toContain("Status Done review");
    expect(highlightedCell?.textContent).toBe("Status Done review");
    expect(highlightedCell?.dataset.postDiffGitMarkerKind).toBe("changed");
    expect(
      highlightedCell?.querySelector(".git-inline-word-highlight.added")
        ?.textContent,
    ).toBe("Done");

    act(() => {
      marker?.click();
    });

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
  });

  it("renders whole-file added table row markers without inline word highlights", async () => {
    await act(async () =>
      renderPane({
        config: {
          ...defaultConfig,
          experimental: {
            ...defaultConfig.experimental,
            postDiffGitMarkers: true,
          },
        },
        documentHtml: markSafeHtml(
          [
            "<table><tbody>",
            "<tr><th>Name</th><th>Status</th></tr>",
            "<tr><td>Feature</td><td>Planned</td></tr>",
            "</tbody></table>",
          ].join(""),
        ),
        postDiffGitMarkers: {
          documentPath: "/workspace/docs/example.adoc",
          documentUpdatedAt: "2026-05-19T00:00:00.000Z",
          totalCount: 1,
          renderedCount: 1,
          tableSummary: {
            tableCellMarkerCount: 0,
            tableAddedRowMarkerCount: 1,
            tableBlockFallbackCount: 0,
            tableNotApplicableCount: 0,
            reasonCounts: {
              "untracked-or-whole-file-added": 1,
            },
          },
          markers: [
            {
              id: "post-diff-marker:0:rendered-block:0:table-row:1",
              kind: "added",
              anchorBlockId: "rendered-block:0",
              anchorTableRowIndex: 1,
              changeIndex: 0,
              targetKind: "table-row",
              tableCellHighlights: [
                { cellIndex: 0, kind: "added" },
                { cellIndex: 1, kind: "added" },
              ],
            },
          ],
        },
      }),
    );

    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });

    const markerRoot = container.querySelector<HTMLElement>(
      '[data-review-id="post-diff-git-markers"]',
    );
    const parentTable = container.querySelector("table");
    const highlightedRow = container.querySelector<HTMLTableRowElement>(
      "tr.post-diff-git-highlight-table-row",
    );
    const highlightedCells = container.querySelectorAll<HTMLElement>(
      "td.post-diff-git-highlight-table-cell",
    );

    expect(markerRoot?.dataset.tableCellMarkerCount).toBe("0");
    expect(markerRoot?.dataset.tableAddedRowMarkerCount).toBe("1");
    expect(markerRoot?.dataset.tableReasonCounts).toBe(
      '{"untracked-or-whole-file-added":1}',
    );
    expect(parentTable?.classList.contains("post-diff-git-highlight")).toBe(
      false,
    );
    expect(highlightedRow?.textContent).toContain("Feature");
    expect(highlightedCells).toHaveLength(2);
    expect(
      highlightedRow?.querySelector(".git-inline-word-highlight"),
    ).toBeNull();
  });

  it("renders removed inline post-diff highlights when the active side has deleted text", async () => {
    await act(async () =>
      renderPane({
        config: {
          ...defaultConfig,
          experimental: {
            ...defaultConfig.experimental,
            postDiffGitMarkers: true,
          },
        },
        documentHtml: markSafeHtml("<p>Deleted token remains</p>"),
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
              inlineDiffRanges: [{ kind: "removed", start: 8, end: 13 }],
            },
          ],
        },
      }),
    );

    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });

    const inlineHighlight = container.querySelector<HTMLElement>(
      ".git-inline-word-highlight.removed",
    );
    expect(inlineHighlight?.textContent).toBe("token");
  });

  it("renders deletion-only post-diff markers without highlighting the anchor block", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    await act(async () =>
      renderPane({
        config: {
          ...defaultConfig,
          experimental: {
            ...defaultConfig.experimental,
            postDiffGitMarkers: true,
          },
        },
        documentHtml: markSafeHtml("<h2>Following section</h2><p>Context</p>"),
        postDiffGitMarkers: {
          documentPath: "/workspace/docs/example.adoc",
          documentUpdatedAt: "2026-05-19T00:00:00.000Z",
          totalCount: 1,
          renderedCount: 1,
          tableSummary: emptyPostDiffTableSummary(),
          markers: [
            {
              id: "post-diff-marker:0:removed-source-block",
              kind: "removed",
              anchorBlockId: "rendered-block:0",
              changeIndex: 0,
              highlightBlock: false,
            },
          ],
        },
      }),
    );

    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });

    const marker = container.querySelector<HTMLButtonElement>(
      '[data-review-id="post-diff-git-marker"]',
    );
    expect(marker?.dataset.markerKind).toBe("removed");
    expect(marker?.title).toBe(
      "Go to removed content near here. Press and hold to view Base.",
    );
    expect(container.querySelector(".post-diff-git-highlight")).toBeNull();

    act(() => {
      marker?.click();
    });

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
  });

  it("keeps post-diff inline highlights stable during viewer scroll", async () => {
    await act(async () =>
      renderPane({
        config: {
          ...defaultConfig,
          experimental: {
            ...defaultConfig.experimental,
            postDiffGitMarkers: true,
          },
        },
        documentHtml: markSafeHtml("<p>Intro</p><p>Changed token</p>"),
        postDiffGitMarkers: {
          documentPath: "/workspace/docs/example.adoc",
          documentUpdatedAt: "2026-05-19T00:00:00.000Z",
          totalCount: 1,
          renderedCount: 1,
          tableSummary: emptyPostDiffTableSummary(),
          markers: [
            {
              id: "post-diff-marker:0:rendered-block:1",
              kind: "changed",
              anchorBlockId: "rendered-block:1",
              changeIndex: 0,
              inlineDiffRanges: [{ kind: "added", start: 8, end: 13 }],
            },
          ],
        },
      }),
    );

    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });

    const viewerPane = container.querySelector<HTMLElement>(".viewer-pane");
    expect(
      container.querySelectorAll(".git-inline-word-highlight.added"),
    ).toHaveLength(1);

    await act(async () => {
      viewerPane?.dispatchEvent(new Event("scroll"));
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });

    const inlineHighlights = container.querySelectorAll(
      ".git-inline-word-highlight.added",
    );
    expect(inlineHighlights).toHaveLength(1);
    expect(inlineHighlights[0]?.textContent).toBe("token");
  });
});
