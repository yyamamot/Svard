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
    documentRenderRevision = 0,
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
    captureAreaRequest = null,
  }: {
    config?: AppConfig;
    documentPayload?: DocumentPayload | null;
    documentRenderRevision?: number;
    documentHtml?: ReturnType<typeof markSafeHtml>;
    error?: string | null;
    isLoading?: boolean;
    onDispatchCommand?: typeof noop;
    onActivateSearchHit?: typeof noop;
    renderResult?: RenderResult | null;
    query?: string;
    searchHits?: ViewerPaneSnapshot["searchHits"];
    searchIndex?: number;
    postDiffGitMarkers?: Parameters<typeof ViewerPane>[0]["postDiffGitMarkers"];
    captureAreaRequest?: Parameters<typeof ViewerPane>[0]["captureAreaRequest"];
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
        documentRenderRevision={documentRenderRevision}
        renderResult={nextRenderResult}
        documentHtml={documentHtml}
        postDiffGitMarkers={postDiffGitMarkers}
        captureAreaRequest={captureAreaRequest}
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

  it("preserves the article and recommits unchanged HTML for a new render revision", async () => {
    const documentHtml = markSafeHtml("<pre>wide source block</pre>");
    await act(async () =>
      renderPane({ documentHtml, documentRenderRevision: 1 }),
    );
    const firstArticle = container.querySelector("article");

    await act(async () =>
      renderPane({ documentHtml, documentRenderRevision: 2 }),
    );
    const secondArticle = container.querySelector("article");

    expect(secondArticle).toBe(firstArticle);
    expect(secondArticle?.innerHTML).toBe("<pre>wide source block</pre>");
    expect(secondArticle?.dataset.renderRevision).toBe("2");
  });

  it("cancels Capture Area when the focused pane switches documents", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 640,
      bottom: 480,
      width: 640,
      height: 480,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    await act(async () =>
      renderPane({ captureAreaRequest: { id: 1, variant: "plain" } }),
    );
    expect(
      container.querySelector('[data-review-id="capture-area-overlay"]'),
    ).not.toBeNull();

    await act(async () =>
      renderPane({
        captureAreaRequest: { id: 1, variant: "plain" },
        documentPayload: {
          ...payload("markdown"),
          path: "/workspace/docs/another.md",
        },
      }),
    );
    expect(
      container.querySelector('[data-review-id="capture-area-overlay"]'),
    ).toBeNull();
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
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    });

    expect(
      container.querySelector('[data-review-id="search-hit-ruler"]'),
    ).toBeNull();
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
