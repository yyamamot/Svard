import { act } from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { AppConfig, DocumentPayload } from "../../src/core/types";
import { defaultConfig } from "../../src/core/defaultConfig";
import { useSearchState } from "../../src/ui/hooks/useSearchState";
import { markSafeHtml } from "../../src/ui/lib/safeHtml";
import type { RightSidebarTab, SearchHitSummary } from "../../src/ui/types";
import { createReactRootHarness } from "./helpers/reactHarness";

interface HookApi {
  activateSearchHit: ReturnType<typeof useSearchState>["activateSearchHit"];
  articleRef: RefObject<HTMLElement | null>;
  clearSearch: ReturnType<typeof useSearchState>["clearSearch"];
  handleSearchInputKeyDown: ReturnType<
    typeof useSearchState
  >["handleSearchInputKeyDown"];
  hits: SearchHitSummary[];
  query: string;
  searchIndex: number;
  setDocumentHtml: (html: string) => void;
  updateQuery: ReturnType<typeof useSearchState>["updateQuery"];
  updateSearchIndex: ReturnType<typeof useSearchState>["updateSearchIndex"];
}

function documentPayload(path = "/workspace/docs/search.md"): DocumentPayload {
  return {
    path,
    basePath: "/workspace",
    format: "markdown",
    source: "# Search",
    updatedAt: "2026-06-16T00:00:00.000Z",
  };
}

function renderSearchStateHarness({
  config = defaultConfig,
  document = documentPayload(),
  html = `<h1>Search</h1><p>AsciiDoc and Markdown. AsciiDoc again.</p>`,
}: {
  config?: AppConfig | null;
  document?: DocumentPayload | null;
  html?: string;
} = {}) {
  const harness = createReactRootHarness();
  let api: HookApi | null = null;

  function Probe() {
    const articleRef = useRef<HTMLElement | null>(null);
    const [documentHtml, setDocumentHtmlState] = useState(markSafeHtml(html));
    const [query, setQuery] = useState("");
    const [searchIndex, setSearchIndex] = useState(0);
    const [searchHits, setSearchHits] = useState<SearchHitSummary[]>([]);
    const [, setTabQueries] = useState<Record<string, string>>({});
    const [, setRightSidebarTab] = useState<RightSidebarTab>("contents");
    const safeHtml = useMemo(() => documentHtml, [documentHtml]);

    useEffect(() => {
      if (!articleRef.current) {
        return;
      }
      articleRef.current.innerHTML = safeHtml;
      if (document?.path) {
        articleRef.current.dataset.renderedDocumentPath = document.path;
      }
    }, [document?.path, safeHtml]);

    const hook = useSearchState({
      articleRef,
      config,
      documentPayload: document,
      documentHtml: safeHtml,
      matchCount: searchHits.length,
      persistWorkspace: vi.fn(async () => {}),
      query,
      searchIndex,
      setQuery,
      setRightSidebarTab,
      setSearchHits,
      setSearchIndex,
      setTabQueries,
      showLightweightActionFeedback: vi.fn(),
    });

    api = {
      ...hook,
      articleRef,
      hits: searchHits,
      query,
      searchIndex,
      setDocumentHtml: (nextHtml: string) =>
        setDocumentHtmlState(markSafeHtml(nextHtml)),
    };

    return <article ref={articleRef} />;
  }

  harness.render(<Probe />);
  if (!api) {
    throw new Error("Search hook probe did not render.");
  }
  return {
    api: () => {
      if (!api) {
        throw new Error("Search hook probe is unavailable.");
      }
      return api;
    },
    harness,
  };
}

async function flushSearchEffects() {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

describe("useSearchState", () => {
  beforeEach(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    delete window.__SVARD_CURRENT_FILE_SEARCH_TIMING__;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.removeItem("SVARD_PERF_TRACE");
    delete window.__SVARD_CURRENT_FILE_SEARCH_TIMING__;
  });

  it("records search cleanup cost without query or document identity", async () => {
    const events: Array<Record<string, unknown>> = [];
    localStorage.setItem("SVARD_PERF_TRACE", "1");
    vi.spyOn(console, "info").mockImplementation(
      (label: unknown, payload: unknown) => {
        if (label === "[perf]" && payload && typeof payload === "object") {
          events.push(payload as Record<string, unknown>);
        }
      },
    );
    const { harness } = renderSearchStateHarness({
      html: '<h1>Search</h1><p><mark class="search-hit">private-query</mark></p>',
    });

    await flushSearchEffects();

    const event = events.find(
      (candidate) =>
        candidate.event === "render.search.cleanup" &&
        candidate.status === "complete" &&
        candidate.markCount === 1,
    );
    expect(event).toEqual(
      expect.objectContaining({
        markCount: 1,
        status: "complete",
      }),
    );
    expect(typeof event?.durationMs).toBe("number");
    expect(JSON.stringify(event)).not.toContain("private-query");
    expect(JSON.stringify(event)).not.toContain("/workspace");

    harness.cleanup();
  });

  it("highlights current document hits and publishes privacy-safe timing", async () => {
    const { api, harness } = renderSearchStateHarness();

    await act(async () => {
      api().updateQuery("AsciiDoc");
    });
    await flushSearchEffects();

    const marks = api().articleRef.current?.querySelectorAll("mark.search-hit");
    expect(marks).toHaveLength(2);
    expect(api().hits).toHaveLength(2);
    expect(api().hits[0]).toMatchObject({
      heading: "Search",
      index: 0,
    });
    expect(window.__SVARD_CURRENT_FILE_SEARCH_TIMING__).toMatchObject({
      basename: "search.md",
      hitCount: 2,
      status: "ready",
    });
    expect(
      JSON.stringify(window.__SVARD_CURRENT_FILE_SEARCH_TIMING__),
    ).not.toContain("AsciiDoc");
    expect(
      JSON.stringify(window.__SVARD_CURRENT_FILE_SEARCH_TIMING__),
    ).not.toContain("/workspace");

    harness.cleanup();
  });

  it("moves active hit without leaving stale active classes", async () => {
    const { api, harness } = renderSearchStateHarness();

    await act(async () => {
      api().updateQuery("AsciiDoc");
    });
    await flushSearchEffects();

    expect(
      api().articleRef.current?.querySelectorAll("mark.search-hit.active"),
    ).toHaveLength(1);
    expect(
      api().articleRef.current?.querySelector("mark.search-hit.active")
        ?.textContent,
    ).toBe("AsciiDoc");

    await act(async () => {
      api().updateSearchIndex(1);
    });
    await flushSearchEffects();

    const activeMarks = api().articleRef.current?.querySelectorAll(
      "mark.search-hit.active",
    );
    expect(activeMarks).toHaveLength(1);
    expect(activeMarks?.[0]?.getAttribute("data-search-hit-index")).toBe("1");
    expect(window.__SVARD_CURRENT_FILE_SEARCH_TIMING__).toMatchObject({
      hitCount: 2,
      status: "ready",
    });
    expect(
      typeof window.__SVARD_CURRENT_FILE_SEARCH_TIMING__?.activeHitUpdateMs,
    ).toBe("number");

    harness.cleanup();
  });

  it("clears stale active marks when the query no longer matches", async () => {
    const { api, harness } = renderSearchStateHarness();

    await act(async () => {
      api().updateQuery("AsciiDoc");
    });
    await flushSearchEffects();
    await act(async () => {
      api().updateSearchIndex(1);
    });
    await flushSearchEffects();
    await act(async () => {
      api().updateQuery("missing");
    });
    await flushSearchEffects();

    expect(
      api().articleRef.current?.querySelectorAll("mark.search-hit"),
    ).toHaveLength(0);
    expect(
      api().articleRef.current?.querySelectorAll("mark.search-hit.active"),
    ).toHaveLength(0);
    expect(api().hits).toHaveLength(0);
    expect(window.__SVARD_CURRENT_FILE_SEARCH_TIMING__).toMatchObject({
      hitCount: 0,
      status: "no-hit",
    });

    harness.cleanup();
  });
});
