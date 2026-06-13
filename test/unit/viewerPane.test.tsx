import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultConfig } from "../../src/core/defaultConfig";
import type {
  AppConfig,
  DocumentPayload,
  RenderResult,
} from "../../src/core/types";
import {
  loadingMessageDelayMs,
  ViewerPane,
} from "../../src/ui/components/ViewerPane";
import { markSafeHtml, emptySafeHtml } from "../../src/ui/lib/safeHtml";
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
    tableBlockFallbackCount: 0,
    tableNotApplicableCount: 0,
    reasonCounts: {},
  };
}

describe("ViewerPane", () => {
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

  function setNavigatorPlatform(platform: string) {
    Object.defineProperty(window.navigator, "platform", {
      configurable: true,
      value: platform,
    });
  }

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
    onDispatchCommand = noop,
    onActivateSearchHit = noop,
    renderResult: nextRenderResult = renderResult,
    query = "",
    searchHits = [],
    searchIndex = 0,
    postDiffGitMarkers = null,
  }: {
    config?: AppConfig;
    documentPayload?: DocumentPayload | null;
    documentHtml?: ReturnType<typeof markSafeHtml>;
    error?: string | null;
    isLoading?: boolean;
    onDispatchCommand?: typeof noop;
    onActivateSearchHit?: typeof noop;
    renderResult?: RenderResult | null;
    query?: string;
    searchHits?: ViewerPaneSnapshot["searchHits"];
    searchIndex?: number;
    postDiffGitMarkers?: Parameters<
      typeof ViewerPane
    >[0]["postDiffGitMarkers"];
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
        query={query}
        searchHits={searchHits}
        searchIndex={searchIndex}
        onArticleClick={noop}
        onArticleContextMenu={noop}
        onArticleDoubleClick={noop}
        onArticleBlur={noop}
        onArticleFocus={noop}
        onArticlePointerLeave={noop}
        onArticlePointerMove={noop}
        onClearContentCursor={noop}
        onDismissInlineNotice={noop}
        onDispatchCommand={onDispatchCommand}
        onFocusPane={noop}
        onActivateSearchHit={onActivateSearchHit}
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

  function render(format: DocumentPayload["format"]) {
    renderPane({ documentPayload: payload(format) });
  }

  it("adds the selected AsciiDoc theme class only to AsciiDoc documents", async () => {
    await act(async () => render("asciidoc"));
    const asciidocArticle = container.querySelector("article");

    expect(asciidocArticle?.classList.contains("format-asciidoc")).toBe(true);
    expect(asciidocArticle?.classList.contains("asciidoc-theme-antora")).toBe(
      true,
    );

    await act(async () => render("markdown"));
    const markdownArticle = container.querySelector("article");

    expect(markdownArticle?.classList.contains("format-markdown")).toBe(true);
    expect(markdownArticle?.className).not.toContain("asciidoc-theme-");
  });

  it("delays the loading message to avoid flicker", async () => {
    vi.useFakeTimers();

    await act(async () => renderPane({ isLoading: true }));
    expect(container.textContent).not.toContain("Loading document");

    await act(async () => {
      vi.advanceTimersByTime(loadingMessageDelayMs - 1);
    });
    expect(container.textContent).not.toContain("Loading document");

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(container.textContent).toContain("Loading document");

    vi.useRealTimers();
  });

  it("does not show the loading message when loading finishes before the delay", async () => {
    vi.useFakeTimers();

    await act(async () => renderPane({ isLoading: true }));
    await act(async () => {
      vi.advanceTimersByTime(loadingMessageDelayMs - 1);
    });
    await act(async () => renderPane({ isLoading: false }));
    await act(async () => {
      vi.advanceTimersByTime(loadingMessageDelayMs);
    });

    expect(container.textContent).not.toContain("Loading document");

    vi.useRealTimers();
  });

  it("keeps error and document body rendering independent from delayed loading", async () => {
    await act(async () =>
      renderPane({
        error: "Render failed",
        isLoading: true,
      }),
    );

    expect(container.textContent).toContain("Render failed");
    expect(container.querySelector("article")).not.toBeNull();
  });

  it("renders a search hit ruler for focused document search hits", async () => {
    const onActivateSearchHit = vi.fn();

    await act(async () =>
      renderPane({
        config: {
          ...defaultConfig,
          experimental: {
            searchHitRuler: true,
            restoreAdditionalWindowsOnStartup: false,
            diagramPlaceholderRendering: false,
            postDiffGitMarkers: false,
          },
        },
        documentHtml: markSafeHtml(
          '<p><mark class="search-hit" data-search-hit-index="0">Svard</mark></p><p><mark class="search-hit" data-search-hit-index="1">Svard</mark></p>',
        ),
        query: "Svard",
        searchHits: [
          { index: 0, heading: "Intro", snippet: "Svard" },
          { index: 1, heading: "Usage", snippet: "Svard" },
        ],
        searchIndex: 1,
        onActivateSearchHit,
      }),
    );

    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });

    expect(
      container.querySelector('[data-review-id="search-hit-ruler"]'),
    ).not.toBeNull();
    expect(
      container.querySelectorAll('[data-review-id="search-hit-ruler-marker"]'),
    ).toHaveLength(1);
    const activeMarker = container.querySelector<HTMLButtonElement>(
      '[data-review-id="search-hit-ruler-active-marker"]',
    );
    expect(activeMarker?.getAttribute("aria-current")).toBe("true");

    act(() => {
      activeMarker?.click();
    });
    expect(onActivateSearchHit).toHaveBeenCalledWith(1);
  });

  it("does not render a search hit ruler without a query or hits", async () => {
    await act(async () =>
      renderPane({
        documentHtml: markSafeHtml(
          '<p><mark class="search-hit" data-search-hit-index="0">Svard</mark></p>',
        ),
        query: "",
        searchHits: [{ index: 0, heading: "Intro", snippet: "Svard" }],
      }),
    );

    expect(
      container.querySelector('[data-review-id="search-hit-ruler"]'),
    ).toBeNull();
  });

  it("keeps the search hit ruler hidden while the experimental flag is disabled", async () => {
    await act(async () =>
      renderPane({
        documentHtml: markSafeHtml(
          '<p><mark class="search-hit" data-search-hit-index="0">Svard</mark></p>',
        ),
        query: "Svard",
        searchHits: [{ index: 0, heading: "Intro", snippet: "Svard" }],
      }),
    );

    await act(async () => {
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });

    expect(
      container.querySelector('[data-review-id="search-hit-ruler"]'),
    ).toBeNull();
  });

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
    expect(marker?.title).toBe("Go to removed content near here");
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

  it("does not dispatch mouse wheel zoom while the opt-in setting is disabled", async () => {
    const onDispatchCommand = vi.fn();
    setNavigatorPlatform("MacIntel");

    await act(async () => renderPane({ onDispatchCommand }));
    const article = container.querySelector("article");
    expect(article).not.toBeNull();

    await act(async () => {
      article?.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          deltaY: -120,
          metaKey: true,
        }),
      );
    });

    expect(onDispatchCommand).not.toHaveBeenCalled();
  });

  it("dispatches zoom commands for macOS Command wheel when enabled", async () => {
    const onDispatchCommand = vi.fn();
    setNavigatorPlatform("MacIntel");

    await act(async () =>
      renderPane({
        config: {
          ...defaultConfig,
          zoomWithMouseWheel: true,
        },
        onDispatchCommand,
      }),
    );
    const article = container.querySelector("article");

    await act(async () => {
      article?.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          deltaY: -120,
          metaKey: true,
        }),
      );
    });

    expect(onDispatchCommand).toHaveBeenCalledWith("zoom.in");
  });

  it("uses Ctrl wheel on Windows and ignores macOS-only modifier there", async () => {
    const onDispatchCommand = vi.fn();
    setNavigatorPlatform("Win32");

    await act(async () =>
      renderPane({
        config: {
          ...defaultConfig,
          zoomWithMouseWheel: true,
        },
        onDispatchCommand,
      }),
    );
    const article = container.querySelector("article");

    await act(async () => {
      article?.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          deltaY: -120,
          metaKey: true,
        }),
      );
    });
    expect(onDispatchCommand).not.toHaveBeenCalled();

    await act(async () => {
      article?.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          ctrlKey: true,
          deltaY: 120,
        }),
      );
    });

    expect(onDispatchCommand).toHaveBeenCalledWith("zoom.out");
  });

  it("ignores small wheel deltas and zoom range boundaries", async () => {
    const onDispatchCommand = vi.fn();
    setNavigatorPlatform("MacIntel");

    await act(async () =>
      renderPane({
        config: {
          ...defaultConfig,
          zoom: 140,
          zoomWithMouseWheel: true,
        },
        onDispatchCommand,
      }),
    );
    const article = container.querySelector("article");

    await act(async () => {
      article?.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          deltaY: -20,
          metaKey: true,
        }),
      );
    });
    expect(onDispatchCommand).not.toHaveBeenCalled();

    await act(async () => {
      article?.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          deltaY: -120,
          metaKey: true,
        }),
      );
    });
    expect(onDispatchCommand).not.toHaveBeenCalled();
  });
});
