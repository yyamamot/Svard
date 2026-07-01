import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useMemo,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type {
  AppConfig,
  DocumentPayload,
  WorkspaceSearchInput,
  WorkspaceSearchResult,
} from "../../src/core/types";
import { defaultConfig } from "../../src/core/defaultConfig";
import { defaultWorkspaceSearchLimits } from "../../src/core/workspaceSearch";
import { useWorkspaceSearch } from "../../src/ui/hooks/useWorkspaceSearch";
import { emptySafeHtml, markSafeHtml } from "../../src/ui/lib/safeHtml";
import type { RightSidebarTab } from "../../src/ui/types";
import { createReactRootHarness } from "./helpers/reactHarness";

type HookApi = ReturnType<typeof useWorkspaceSearch> & {
  query: string;
  tabQueries: Record<string, string>;
  rightSidebarTab: RightSidebarTab;
  setQuery: (value: string) => void;
  setRootDirectory: (value: string | null) => void;
  setDocumentPayload: (value: DocumentPayload | null) => void;
  setDocumentHtml: (value: ReturnType<typeof markSafeHtml>) => void;
  setWorkspaceSearchRefreshRevision: (value: number) => void;
};

function documentPayload(path: string): DocumentPayload {
  return {
    path,
    basePath: "/workspace",
    format: "markdown",
    source: "# Title",
    updatedAt: "2026-06-04T00:00:00.000Z",
  };
}

function searchResult(query: string): WorkspaceSearchResult {
  return {
    status: "ok",
    rootPath: "/workspace",
    query,
    results: [
      {
        path: "/workspace/docs/a.md",
        displayPath: "docs/a.md",
        line: 7,
        heading: "A",
        snippet: `${query} one`,
        matchCount: 1,
        sourceReference: "/workspace/docs/a.md:7",
      },
      {
        path: "/workspace/docs/b.md",
        displayPath: "docs/b.md",
        line: 12,
        heading: "B",
        snippet: `${query} two`,
        matchCount: 1,
        sourceReference: "/workspace/docs/b.md:12",
      },
    ],
    totalMatches: 2,
    searchedFiles: 2,
    skippedFiles: 0,
    capped: false,
    message: null,
  };
}

function renderHookHarness({
  hostSearchWorkspace = vi.fn(async ({ query }: WorkspaceSearchInput) =>
    searchResult(query),
  ),
  workspaceSearchOrderedPaths,
  navigateToSourceLine = vi.fn((_line: number) => {}),
  openDocumentWorkspaceTab = vi.fn(async (_path: string) => {}),
  clearActiveContentCursor = vi.fn(() => {}),
  config = defaultConfig,
}: {
  hostSearchWorkspace?: (
    input: WorkspaceSearchInput,
  ) => Promise<WorkspaceSearchResult>;
  workspaceSearchOrderedPaths?: string[];
  navigateToSourceLine?: (line: number) => void;
  openDocumentWorkspaceTab?: (path: string) => Promise<void>;
  clearActiveContentCursor?: () => void;
  config?: AppConfig | null;
} = {}) {
  const harness = createReactRootHarness();
  let api: HookApi | null = null;

  function Probe() {
    const [query, setQuery] = useState("");
    const [rootDirectory, setRootDirectory] = useState<string | null>(
      "/workspace",
    );
    const [document, setDocumentPayload] = useState<DocumentPayload | null>(
      null,
    );
    const [documentHtml, setDocumentHtml] = useState(emptySafeHtml);
    const [workspaceSearchRefreshRevision, setWorkspaceSearchRefreshRevision] =
      useState(0);
    const [tabQueries, setTabQueries] = useState<Record<string, string>>({});
    const [rightSidebarTab, setRightSidebarTab] =
      useState<RightSidebarTab>("contents");
    const host = useMemo(() => ({ searchWorkspace: hostSearchWorkspace }), []);
    const hook = useWorkspaceSearch({
      activeDocumentPayload: document,
      clearActiveContentCursor,
      config,
      documentHtml,
      documentPayload: document,
      host,
      navigateToSourceLine,
      openDocumentWorkspaceTab,
      query,
      rootDirectory,
      workspaceSearchOrderedPaths,
      workspaceSearchRefreshRevision,
      setRightSidebarTab,
      setTabQueries,
      updateQuery: setQuery,
    });
    api = {
      ...hook,
      query,
      rightSidebarTab,
      setDocumentHtml,
      setDocumentPayload,
      setQuery,
      setRootDirectory,
      setWorkspaceSearchRefreshRevision,
      tabQueries,
    };
    return null;
  }

  harness.render(<Probe />);
  if (!api) {
    throw new Error("Hook probe did not render.");
  }
  return {
    api: () => {
      if (!api) {
        throw new Error("Hook probe is unavailable.");
      }
      return api;
    },
    clearActiveContentCursor,
    harness,
    hostSearchWorkspace,
    navigateToSourceLine,
    openDocumentWorkspaceTab,
  };
}

describe("useWorkspaceSearch", () => {
  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function flushAsyncWork() {
    await Promise.resolve();
    await act(async () => {
      await Promise.resolve();
    });
  }

  async function runWorkspaceSearch(api: () => HookApi) {
    await act(async () => {
      await api().runWorkspaceSearch();
    });
  }

  it("runs workspace search with the shared default limits", async () => {
    const { api, harness, hostSearchWorkspace } = renderHookHarness();

    await act(async () => {
      api().setSearchScope("workspace");
    });
    await act(async () => {
      api().updateSearchQuery("Graphviz");
    });

    expect(hostSearchWorkspace).not.toHaveBeenCalled();

    await runWorkspaceSearch(api);

    expect(hostSearchWorkspace).toHaveBeenCalledWith({
      rootPath: "/workspace",
      query: "Graphviz",
      ...defaultWorkspaceSearchLimits,
    });
    expect(api().workspaceSearch.status).toBe("ready");
    expect(api().workspaceSearch.result?.results).toHaveLength(2);
    harness.cleanup();
  });

  it("passes active document order paths to workspace search when available", async () => {
    const { api, harness, hostSearchWorkspace } = renderHookHarness({
      workspaceSearchOrderedPaths: [
        "/workspace/docs/part-2.md",
        "/workspace/docs/part-1.md",
      ],
    });

    await act(async () => {
      api().setSearchScope("workspace");
    });
    await act(async () => {
      api().updateSearchQuery("Graphviz");
    });
    await runWorkspaceSearch(api);

    expect(hostSearchWorkspace).toHaveBeenCalledWith({
      rootPath: "/workspace",
      query: "Graphviz",
      ...defaultWorkspaceSearchLimits,
      orderedPaths: ["/workspace/docs/part-2.md", "/workspace/docs/part-1.md"],
    });
    harness.cleanup();
  });

  it("reruns workspace search when the workspace file change revision advances", async () => {
    vi.useFakeTimers();
    const { api, harness, hostSearchWorkspace } = renderHookHarness();

    await act(async () => {
      api().setSearchScope("workspace");
    });
    await act(async () => {
      api().updateSearchQuery("Graphviz");
    });
    await act(async () => {
      vi.runOnlyPendingTimers();
    });
    await flushAsyncWork();

    expect(hostSearchWorkspace).toHaveBeenCalledTimes(1);

    await act(async () => {
      api().setWorkspaceSearchRefreshRevision(1);
    });
    await act(async () => {
      vi.runOnlyPendingTimers();
    });
    await flushAsyncWork();

    expect(hostSearchWorkspace).toHaveBeenCalledTimes(2);
    harness.cleanup();
  });

  it("returns an error state when workspace root is unavailable", async () => {
    const { api, harness, hostSearchWorkspace } = renderHookHarness({
      config: null,
    });

    await act(async () => {
      api().setRootDirectory(null);
      api().setSearchScope("workspace");
    });
    await act(async () => {
      api().updateSearchQuery("Graphviz");
    });
    await runWorkspaceSearch(api);

    expect(hostSearchWorkspace).not.toHaveBeenCalled();
    expect(api().workspaceSearch.status).toBe("error");
    expect(api().workspaceSearch.message).toBe(
      "Workspace root is not available.",
    );
    harness.cleanup();
  });

  it("ignores stale search responses after a newer query starts", async () => {
    let resolveFirst: ((result: WorkspaceSearchResult) => void) | null = null;
    let resolveSecond: ((result: WorkspaceSearchResult) => void) | null = null;
    const hostSearchWorkspace = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<WorkspaceSearchResult>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<WorkspaceSearchResult>((resolve) => {
            resolveSecond = resolve;
          }),
      );
    const { api, harness } = renderHookHarness({ hostSearchWorkspace });
    let firstRun: Promise<void> | null = null;
    let secondRun: Promise<void> | null = null;

    await act(async () => {
      api().setSearchScope("workspace");
    });
    await act(async () => {
      api().updateSearchQuery("first");
    });
    act(() => {
      firstRun = api().runWorkspaceSearch();
    });
    await act(async () => {
      api().updateSearchQuery("second");
    });
    act(() => {
      secondRun = api().runWorkspaceSearch();
    });

    await act(async () => {
      resolveFirst?.(searchResult("first"));
    });
    await act(async () => {
      await firstRun;
    });
    await flushAsyncWork();
    expect(api().workspaceSearch.result?.query).not.toBe("first");

    await act(async () => {
      expect(resolveSecond).not.toBeNull();
      resolveSecond?.(searchResult("second"));
    });
    await act(async () => {
      await secondRun;
    });
    await flushAsyncWork();
    expect(api().workspaceSearch.status).toBe("ready");
    expect(api().workspaceSearch.result?.query).toBe("second");
    harness.cleanup();
  });

  it("supports next and previous result navigation with wrapping", async () => {
    const { api, harness } = renderHookHarness();

    await act(async () => {
      api().setSearchScope("workspace");
    });
    await act(async () => {
      api().updateSearchQuery("Graphviz");
    });
    await runWorkspaceSearch(api);

    act(() => api().updateWorkspaceSearchIndex(1));
    expect(api().workspaceSearchIndex).toBe(1);
    act(() => api().updateWorkspaceSearchIndex(1));
    expect(api().workspaceSearchIndex).toBe(0);
    act(() => api().updateWorkspaceSearchIndex(-1));
    expect(api().workspaceSearchIndex).toBe(1);
    harness.cleanup();
  });

  it("clears workspace query and results without touching document pinned search", async () => {
    const { api, harness } = renderHookHarness();

    await act(async () => {
      api().setSearchScope("workspace");
    });
    await act(async () => {
      api().updateSearchQuery("Graphviz");
    });
    await runWorkspaceSearch(api);

    act(() => api().handleWorkspaceSearchClear());

    expect(api().query).toBe("");
    expect(api().workspaceQuery).toBe("");
    expect(api().searchInputQuery).toBe("");
    expect(api().workspaceSearch.status).toBe("idle");
    expect(api().workspaceSearch.result).toBeNull();
    expect(api().workspaceSearchIndex).toBe(0);
    harness.cleanup();
  });

  it("handles Enter in workspace scope when no result exists", async () => {
    const { api, clearActiveContentCursor, harness } = renderHookHarness();

    await act(async () => {
      api().setSearchScope("workspace");
    });

    const enterEvent = {
      key: "Enter",
      shiftKey: false,
      preventDefault: vi.fn(),
    } as unknown as ReactKeyboardEvent<HTMLInputElement>;

    act(() => {
      expect(api().handleWorkspaceSearchEnterKey(enterEvent)).toBe(true);
    });
    expect(enterEvent.preventDefault).toHaveBeenCalled();
    expect(clearActiveContentCursor).toHaveBeenCalledTimes(1);
    harness.cleanup();
  });

  it("bypasses the workspace search debounce on explicit Enter submit", async () => {
    vi.useFakeTimers();
    const { api, harness, hostSearchWorkspace } = renderHookHarness();

    await act(async () => {
      api().setSearchScope("workspace");
    });
    await act(async () => {
      api().updateSearchQuery("Graphviz");
    });

    const enterEvent = {
      key: "Enter",
      shiftKey: false,
      preventDefault: vi.fn(),
    } as unknown as ReactKeyboardEvent<HTMLInputElement>;

    await act(async () => {
      expect(api().handleWorkspaceSearchEnterKey(enterEvent)).toBe(true);
      await Promise.resolve();
    });

    expect(enterEvent.preventDefault).toHaveBeenCalled();
    expect(hostSearchWorkspace).toHaveBeenCalledTimes(1);
    expect(hostSearchWorkspace).toHaveBeenCalledWith({
      rootPath: "/workspace",
      query: "Graphviz",
      ...defaultWorkspaceSearchLimits,
    });

    await act(async () => {
      vi.advanceTimersByTime(400);
      await Promise.resolve();
    });

    expect(hostSearchWorkspace).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
    harness.cleanup();
  });

  it("uses Enter and Shift+Enter to open next and previous workspace results", async () => {
    const { api, harness, openDocumentWorkspaceTab } = renderHookHarness();

    await act(async () => {
      api().setSearchScope("workspace");
    });
    await act(async () => {
      api().updateSearchQuery("Graphviz");
    });
    await runWorkspaceSearch(api);

    const enterEvent = {
      key: "Enter",
      shiftKey: false,
      preventDefault: vi.fn(),
    } as unknown as ReactKeyboardEvent<HTMLInputElement>;
    const shiftEnterEvent = {
      key: "Enter",
      shiftKey: true,
      preventDefault: vi.fn(),
    } as unknown as ReactKeyboardEvent<HTMLInputElement>;

    await act(async () => {
      expect(api().handleWorkspaceSearchEnterKey(enterEvent)).toBe(true);
    });
    expect(enterEvent.preventDefault).toHaveBeenCalled();
    expect(openDocumentWorkspaceTab).toHaveBeenCalledWith(
      "/workspace/docs/b.md",
    );
    expect(api().workspaceSearchIndex).toBe(1);

    await act(async () => {
      expect(api().handleWorkspaceSearchEnterKey(shiftEnterEvent)).toBe(true);
    });
    expect(shiftEnterEvent.preventDefault).toHaveBeenCalled();
    expect(openDocumentWorkspaceTab).toHaveBeenLastCalledWith(
      "/workspace/docs/a.md",
    );
    expect(api().workspaceSearchIndex).toBe(0);
    harness.cleanup();
  });

  it("opens a workspace result and schedules the source-line jump after render", async () => {
    const {
      api,
      clearActiveContentCursor,
      harness,
      navigateToSourceLine,
      openDocumentWorkspaceTab,
    } = renderHookHarness();

    await act(async () => {
      api().setSearchScope("workspace");
    });
    await act(async () => {
      api().updateSearchQuery("Graphviz");
    });
    await runWorkspaceSearch(api);
    await act(async () => {
      await api().activateWorkspaceSearchResult(1);
    });

    expect(openDocumentWorkspaceTab).toHaveBeenCalledWith(
      "/workspace/docs/b.md",
    );
    expect(clearActiveContentCursor).toHaveBeenCalled();
    expect(api().tabQueries["/workspace/docs/b.md"]).toBe("Graphviz");
    expect(api().query).toBe("Graphviz");
    expect(api().workspaceQuery).toBe("Graphviz");
    expect(api().searchInputQuery).toBe("Graphviz");
    expect(api().workspaceSearch.result?.results).toHaveLength(2);
    expect(api().workspaceSearchIndex).toBe(1);
    expect(api().rightSidebarTab).toBe("search");
    expect(navigateToSourceLine).not.toHaveBeenCalled();

    await act(async () => {
      api().setDocumentPayload(documentPayload("/workspace/docs/b.md"));
      api().setDocumentHtml(markSafeHtml("<p>loaded</p>"));
    });

    expect(navigateToSourceLine).toHaveBeenCalledWith(12);
    act(() => api().setSearchScope("document"));
    harness.cleanup();
  });
});
