import { describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { act } from "react";
import { RightSidebar } from "../../src/ui/components/RightSidebar";
import type { DocumentPayload } from "../../src/core/types";
import { createReactRootHarness } from "./helpers/reactHarness";

function renderSearchSidebar(
  overrides: Partial<Parameters<typeof RightSidebar>[0]> = {},
) {
  const harness = createReactRootHarness();
  const props: Parameters<typeof RightSidebar>[0] = {
    activeHeadingId: null,
    diagramInspectorItems: [],
    documentPayload: null,
    includeInspectorItems: [],
    matchCount: 0,
    pinnedSearch: null,
    query: "",
    renderResult: null,
    rightSidebarTab: "search",
    searchScope: "document",
    searchHits: [],
    searchIndex: 0,
    searchInputRef: createRef<HTMLInputElement>(),
    selectedDiagramId: null,
    workspaceSearch: { status: "idle", result: null, message: null },
    workspaceSearchIndex: 0,
    onActivateSearchHit: vi.fn(),
    onActivateWorkspaceSearchResult: vi.fn(),
    onClearSearch: vi.fn(),
    onCopyText: vi.fn(),
    onDispatchCommand: vi.fn(),
    onNavigateSourceLine: vi.fn(),
    onNavigateHeading: vi.fn(),
    onOpenDiagramPreview: vi.fn(),
    onOpenInclude: vi.fn(),
    onPinQuery: vi.fn(),
    onSelectDiagram: vi.fn(),
    onSetSearchScope: vi.fn(),
    onSetRightSidebarTab: vi.fn(),
    onShowInlineNotice: vi.fn(),
    onSearchInputKeyDown: vi.fn(),
    onUpdateQuery: vi.fn(),
    onWorkspaceSearchIndexChange: vi.fn(),
    ...overrides,
  };
  harness.render(<RightSidebar {...props} />);
  return { harness, props };
}

describe("RightSidebar search panel", () => {
  it("uses file-oriented segmented labels for search scope controls", () => {
    const { harness } = renderSearchSidebar();

    expect(harness.byReviewId("search-scope-document").textContent).toBe(
      "Current File",
    );
    expect(harness.byReviewId("search-scope-workspace").textContent).toBe(
      "All Files",
    );
    expect(
      harness.byReviewId<HTMLInputElement>("search-input").placeholder,
    ).toBe("Search current file");

    harness.cleanup();
  });

  it("uses pinned search labels instead of default search copy", () => {
    const { harness } = renderSearchSidebar({
      matchCount: 36,
      pinnedSearch: "Svard",
      query: "Svard",
      searchIndex: 0,
      searchHits: [
        {
          index: 0,
          heading: "Overview",
          snippet: "Svard local reader",
        },
      ],
    });

    expect(harness.byReviewId("search-pin").textContent?.trim()).toBe("Pin");
    expect(harness.byReviewId("search-pin").getAttribute("aria-label")).toBe(
      "Pinned search",
    );
    expect(harness.byReviewId("search-result").textContent).toBe(
      "1 of 36 matches",
    );
    expect(harness.byReviewId("search-pinned-status").textContent).toBe(
      "Pinned search: Svard",
    );
    expect(harness.container.textContent).not.toContain("Default");
    expect(harness.container.textContent).not.toContain("No default search");

    harness.cleanup();
  });

  it("keeps pin disabled until a query exists and keeps clear explicit", () => {
    const { harness } = renderSearchSidebar();

    expect(harness.byReviewId<HTMLButtonElement>("search-pin").disabled).toBe(
      true,
    );
    expect(harness.byReviewId("search-pin").getAttribute("aria-label")).toBe(
      "Enter a search query to pin",
    );
    expect(harness.byReviewId("search-clear").getAttribute("aria-label")).toBe(
      "Clear search and pinned search",
    );
    expect(harness.byReviewId("search-result").textContent).toBe(
      "No search query",
    );
    expect(
      harness.container.querySelector(
        '[data-review-id="search-pinned-status"]',
      ),
    ).toBeNull();

    harness.cleanup();
  });

  it("shows workspace search controls and results without document pin controls", () => {
    const onActivateWorkspaceSearchResult = vi.fn();
    const { harness } = renderSearchSidebar({
      query: "Graphviz",
      searchScope: "workspace",
      onActivateWorkspaceSearchResult,
      workspaceSearch: {
        status: "ready",
        message: null,
        result: {
          status: "ok",
          rootPath: "/workspace",
          query: "Graphviz",
          results: [
            {
              path: "/workspace/docs/diagram.adoc",
              displayPath: "docs/diagram.adoc",
              line: 4,
              heading: "Diagrams",
              snippet: "Graphviz overview",
              matchCount: 1,
              sourceReference: "/workspace/docs/diagram.adoc:4",
            },
          ],
          totalMatches: 1,
          searchedFiles: 8,
          skippedFiles: 0,
          capped: false,
          message: null,
        },
      },
    });

    expect(harness.byReviewId("search-result").textContent).toBe(
      "1 match in 1 result",
    );
    expect(harness.byReviewId<HTMLInputElement>("search-input").value).toBe(
      "Graphviz",
    );
    expect(
      harness.byReviewId<HTMLInputElement>("search-input").placeholder,
    ).toBe("Search all files");
    expect(
      harness.byReviewId("search-previous").getAttribute("aria-label"),
    ).toBe("Previous workspace result");
    expect(harness.byReviewId("search-next").getAttribute("aria-label")).toBe(
      "Next workspace result",
    );
    expect(
      harness.container.querySelector('[data-review-id="search-pin"]'),
    ).toBeNull();
    expect(
      harness.byReviewId("workspace-search-result-item").textContent,
    ).toContain("docs/diagram.adoc");

    act(() => {
      harness
        .byReviewId<HTMLButtonElement>("workspace-search-result-item")
        .click();
    });

    expect(onActivateWorkspaceSearchResult).toHaveBeenCalledWith(0);
    expect(
      harness.byReviewId("workspace-search-result-item").textContent,
    ).toContain("docs/diagram.adoc");
    harness.cleanup();
  });
});

describe("RightSidebar diagram inspector panel", () => {
  it("shows the diagrams tab and empty state", () => {
    const { harness } = renderSearchSidebar({
      rightSidebarTab: "diagrams",
    });

    expect(harness.byReviewId("right-sidebar-tab-diagrams").textContent).toBe(
      "Diagrams",
    );
    expect(harness.byReviewId("diagram-inspector").textContent).toContain(
      "No diagrams in this file",
    );

    harness.cleanup();
  });

  it("lists diagrams and updates the selected item", () => {
    const onSelectDiagram = vi.fn();
    const { harness } = renderSearchSidebar({
      rightSidebarTab: "diagrams",
      selectedDiagramId: "plantuml-1",
      onSelectDiagram,
      diagramInspectorItems: [
        {
          id: "plantuml-1",
          renderer: "plantuml",
          diagramType: "plantuml",
          renderPath: "local",
          status: "rendered",
          sourceLocation: { line: 12 },
          sourceReference: "/workspace/doc.adoc:12",
          svg: "<svg></svg>",
          metrics: { renderMs: 42, svgBytes: 1200 },
          cacheStatus: "hit",
        },
        {
          id: "kroki-1",
          renderer: "kroki",
          diagramType: "blockdiag",
          renderPath: "disabled",
          status: "disabled",
          sourceLocation: { line: 30 },
        },
      ],
    });

    expect(harness.byReviewId("diagram-inspector-list").textContent).toContain(
      "plantuml",
    );
    expect(
      harness.byReviewId("diagram-inspector-details").textContent,
    ).toContain("renderMs: 42");

    act(() => {
      const items = harness.container.querySelectorAll<HTMLButtonElement>(
        '[data-review-id="diagram-inspector-item"]',
      );
      items[1]?.click();
    });

    expect(onSelectDiagram).toHaveBeenCalledWith("kroki-1");
    harness.cleanup();
  });
});

describe("RightSidebar contents include section", () => {
  const asciidocDocument: DocumentPayload = {
    path: "/workspace/docs/current.adoc",
    basePath: "/workspace/docs",
    format: "asciidoc",
    source: "= Current",
    updatedAt: "test",
    asciidocContext: {
      baseDir: "/workspace",
      workspaceRoot: "/workspace",
      documentDir: "/workspace/docs",
      attributes: {},
      resourceRoots: ["/workspace"],
    },
  };

  it("hides Includes for Markdown documents", () => {
    const { harness } = renderSearchSidebar({
      rightSidebarTab: "contents",
      documentPayload: {
        ...asciidocDocument,
        format: "markdown",
        path: "/workspace/docs/current.md",
      },
      includeInspectorItems: [
        {
          id: "include-1",
          label: "partial.adoc",
          displayPath: "partials/partial.adoc",
          status: "active",
          path: "/workspace/docs/partials/partial.adoc",
          sourcePath: "/workspace/docs/current.md",
          sourceLine: 3,
          sourceReference: "/workspace/docs/current.md:3",
          depth: 0,
        },
      ],
    });

    expect(
      harness.container.querySelector(
        '[data-review-id="include-inspector-toggle"]',
      ),
    ).toBeNull();
    harness.cleanup();
  });

  it("opens active includes from the Contents section", () => {
    const onOpenInclude = vi.fn();
    const { harness } = renderSearchSidebar({
      rightSidebarTab: "contents",
      documentPayload: asciidocDocument,
      onOpenInclude,
      includeInspectorItems: [
        {
          id: "include-1",
          label: "partial.adoc",
          displayPath: "docs/partials/partial.adoc",
          status: "active",
          path: "/workspace/docs/partials/partial.adoc",
          sourcePath: "/workspace/docs/current.adoc",
          sourceLine: 4,
          sourceReference: "/workspace/docs/current.adoc:4",
          depth: 0,
        },
      ],
    });

    act(() => {
      harness.byReviewId<HTMLButtonElement>("include-inspector-toggle").click();
    });
    act(() => {
      harness.container
        .querySelector<HTMLButtonElement>(".include-inspector-main")
        ?.click();
    });

    expect(onOpenInclude).toHaveBeenCalledWith(
      "/workspace/docs/partials/partial.adoc",
    );
    harness.cleanup();
  });

  it("navigates inactive includes to the current source line", () => {
    const onNavigateSourceLine = vi.fn();
    const { harness } = renderSearchSidebar({
      rightSidebarTab: "contents",
      documentPayload: asciidocDocument,
      onNavigateSourceLine,
      includeInspectorItems: [
        {
          id: "include-2",
          label: "disabled.adoc",
          displayPath: "partials/disabled.adoc",
          status: "skipped",
          reason: "conditional",
          sourcePath: "/workspace/docs/current.adoc",
          sourceLine: 9,
          sourceReference: "/workspace/docs/current.adoc:9",
          depth: 0,
        },
      ],
    });

    act(() => {
      harness.byReviewId<HTMLButtonElement>("include-inspector-toggle").click();
    });
    act(() => {
      harness.container
        .querySelector<HTMLButtonElement>(".include-inspector-main")
        ?.click();
    });

    expect(onNavigateSourceLine).toHaveBeenCalledWith(9);
    harness.cleanup();
  });
});
