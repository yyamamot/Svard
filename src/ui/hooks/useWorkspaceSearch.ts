import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type SetStateAction,
} from "react";
import type { AppConfig, DocumentPayload, HostAdapter } from "../../core/types";
import { defaultWorkspaceSearchLimits } from "../../core/workspaceSearch";
import type { SafeHtml } from "../lib/safeHtml";
import type {
  RightSidebarTab,
  SearchScope,
  WorkspaceSearchState,
} from "../types";

declare global {
  interface Window {
    __SVARD_WORKSPACE_SEARCH_TIMING__?: {
      capped?: boolean;
      debounceWaitMs?: number;
      hostSearchMs?: number;
      resultCount?: number;
      searchedFiles?: number;
      skippedFiles?: number;
      status?: string;
      submitBypassMs?: number;
    };
  }
}

interface UseWorkspaceSearchInput {
  query: string;
  rootDirectory: string | null | undefined;
  workspaceSearchOrderedPaths?: string[];
  config: AppConfig | null;
  activeDocumentPayload: DocumentPayload | null;
  documentPayload: DocumentPayload | null;
  documentHtml: SafeHtml;
  host: Pick<HostAdapter, "searchWorkspace">;
  openDocumentWorkspaceTab: (path: string) => Promise<void>;
  navigateToSourceLine: (line: number) => void;
  clearActiveContentCursor: () => void;
  setTabQueries: Dispatch<SetStateAction<Record<string, string>>>;
  setRightSidebarTab: (tab: RightSidebarTab) => void;
  updateQuery: (value: string) => void;
}

export function useWorkspaceSearch({
  query,
  rootDirectory,
  workspaceSearchOrderedPaths,
  config,
  activeDocumentPayload,
  documentPayload,
  documentHtml,
  host,
  openDocumentWorkspaceTab,
  navigateToSourceLine,
  clearActiveContentCursor,
  setTabQueries,
  setRightSidebarTab,
  updateQuery,
}: UseWorkspaceSearchInput) {
  const [searchScope, setSearchScope] = useState<SearchScope>("document");
  const [workspaceQuery, setWorkspaceQuery] = useState("");
  const [workspaceSearch, setWorkspaceSearch] = useState<WorkspaceSearchState>({
    status: "idle",
    result: null,
    message: null,
  });
  const [workspaceSearchIndex, setWorkspaceSearchIndex] = useState(0);
  const [pendingWorkspaceSearchJump, setPendingWorkspaceSearchJump] = useState<{
    path: string;
    line: number;
  } | null>(null);
  const workspaceSearchRequestIdRef = useRef(0);
  const workspaceSearchCacheRef = useRef<{
    cachedAt: number;
    signature: string;
    result: NonNullable<WorkspaceSearchState["result"]>;
  } | null>(null);
  const workspaceSearchInFlightRef = useRef<{
    signature: string;
    promise: Promise<NonNullable<WorkspaceSearchState["result"]>>;
  } | null>(null);
  const workspaceSearchInputAtRef = useRef<number | null>(null);
  const workspaceSearchDebounceTimerRef = useRef<number | null>(null);

  const updateWorkspaceSearchTiming = useCallback(
    (timing: NonNullable<Window["__SVARD_WORKSPACE_SEARCH_TIMING__"]>) => {
      if (typeof window === "undefined") {
        return;
      }
      window.__SVARD_WORKSPACE_SEARCH_TIMING__ = {
        ...window.__SVARD_WORKSPACE_SEARCH_TIMING__,
        ...timing,
      };
    },
    [],
  );

  const workspaceSearchRoot = useCallback(
    () =>
      rootDirectory ??
      config?.workspace.lastDirectory ??
      activeDocumentPayload?.asciidocContext?.workspaceRoot ??
      activeDocumentPayload?.basePath ??
      null,
    [
      activeDocumentPayload?.asciidocContext?.workspaceRoot,
      activeDocumentPayload?.basePath,
      config?.workspace.lastDirectory,
      rootDirectory,
    ],
  );

  const runWorkspaceSearch = useCallback(async () => {
    const trimmedQuery = workspaceQuery.trim();
    const rootPath = workspaceSearchRoot();
    if (!trimmedQuery) {
      setWorkspaceSearch({
        status: "idle",
        result: null,
        message: "No search query",
      });
      updateWorkspaceSearchTiming({ status: "idle" });
      return;
    }
    if (!rootPath) {
      setWorkspaceSearch({
        status: "error",
        result: null,
        message: "Workspace root is not available.",
      });
      updateWorkspaceSearchTiming({ status: "error" });
      return;
    }
    const signature = [
      rootPath,
      trimmedQuery,
      defaultWorkspaceSearchLimits.maxFiles,
      defaultWorkspaceSearchLimits.maxMatches,
      defaultWorkspaceSearchLimits.maxBytesPerFile,
      ...(workspaceSearchOrderedPaths ?? []),
    ].join("\u0000");
    if (
      workspaceSearchCacheRef.current?.signature === signature &&
      Date.now() - workspaceSearchCacheRef.current.cachedAt < 1000
    ) {
      const result = workspaceSearchCacheRef.current.result;
      setWorkspaceSearch({
        status: "ready",
        result,
        message: result.message ?? null,
      });
      setWorkspaceSearchIndex(0);
      updateWorkspaceSearchTiming({
        capped: result.capped,
        hostSearchMs: 0,
        resultCount: result.results.length,
        searchedFiles: result.searchedFiles,
        skippedFiles: result.skippedFiles,
        status: result.status,
      });
      return;
    }
    const requestId = workspaceSearchRequestIdRef.current + 1;
    workspaceSearchRequestIdRef.current = requestId;
    setWorkspaceSearch((current) => ({
      status: "loading",
      result: current.result,
      message: null,
    }));
    try {
      const hostStartedAt = performance.now();
      let inFlight = workspaceSearchInFlightRef.current;
      if (inFlight?.signature !== signature) {
        const orderedPathInput =
          workspaceSearchOrderedPaths && workspaceSearchOrderedPaths.length > 0
            ? { orderedPaths: workspaceSearchOrderedPaths }
            : {};
        inFlight = {
          signature,
          promise: host.searchWorkspace({
            rootPath,
            query: trimmedQuery,
            ...defaultWorkspaceSearchLimits,
            ...orderedPathInput,
          }),
        };
        workspaceSearchInFlightRef.current = inFlight;
      }
      const result = await inFlight.promise;
      const hostSearchMs = performance.now() - hostStartedAt;
      if (workspaceSearchInFlightRef.current?.signature === signature) {
        workspaceSearchInFlightRef.current = null;
      }
      if (workspaceSearchRequestIdRef.current !== requestId) {
        return;
      }
      workspaceSearchCacheRef.current = {
        cachedAt: Date.now(),
        signature,
        result,
      };
      setWorkspaceSearch({
        status: "ready",
        result,
        message: result.message ?? null,
      });
      setWorkspaceSearchIndex(0);
      updateWorkspaceSearchTiming({
        capped: result.capped,
        hostSearchMs,
        resultCount: result.results.length,
        searchedFiles: result.searchedFiles,
        skippedFiles: result.skippedFiles,
        status: result.status,
      });
    } catch (error) {
      if (workspaceSearchInFlightRef.current?.signature === signature) {
        workspaceSearchInFlightRef.current = null;
      }
      if (workspaceSearchRequestIdRef.current !== requestId) {
        return;
      }
      setWorkspaceSearch({
        status: "error",
        result: null,
        message:
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "Workspace search failed.",
      });
      updateWorkspaceSearchTiming({ status: "error" });
    }
  }, [
    host,
    updateWorkspaceSearchTiming,
    workspaceQuery,
    workspaceSearchOrderedPaths,
    workspaceSearchRoot,
  ]);

  useEffect(() => {
    if (searchScope !== "workspace") {
      return;
    }
    const trimmedQuery = workspaceQuery.trim();
    workspaceSearchRequestIdRef.current += 1;
    if (!trimmedQuery) {
      setWorkspaceSearch({ status: "idle", result: null, message: null });
      setWorkspaceSearchIndex(0);
      updateWorkspaceSearchTiming({ status: "idle" });
      return;
    }
    const timer = window.setTimeout(() => {
      workspaceSearchDebounceTimerRef.current = null;
      const inputAt = workspaceSearchInputAtRef.current;
      if (inputAt !== null) {
        updateWorkspaceSearchTiming({
          debounceWaitMs: performance.now() - inputAt,
        });
      }
      void runWorkspaceSearch();
    }, 350);
    workspaceSearchDebounceTimerRef.current = timer;
    return () => {
      window.clearTimeout(timer);
      if (workspaceSearchDebounceTimerRef.current === timer) {
        workspaceSearchDebounceTimerRef.current = null;
      }
    };
  }, [
    runWorkspaceSearch,
    searchScope,
    updateWorkspaceSearchTiming,
    workspaceQuery,
  ]);

  useEffect(() => {
    if (
      !pendingWorkspaceSearchJump ||
      documentPayload?.path !== pendingWorkspaceSearchJump.path ||
      !documentHtml
    ) {
      return;
    }
    const targetLine = pendingWorkspaceSearchJump.line;
    requestAnimationFrame(() => navigateToSourceLine(targetLine));
    setPendingWorkspaceSearchJump(null);
  }, [
    documentHtml,
    documentPayload?.path,
    navigateToSourceLine,
    pendingWorkspaceSearchJump,
  ]);

  const updateSearchQuery = useCallback(
    (value: string) => {
      if (searchScope === "workspace") {
        if (value === workspaceQuery) {
          return;
        }
        setWorkspaceQuery(value);
        setWorkspaceSearch({ status: "idle", result: null, message: null });
        setWorkspaceSearchIndex(0);
        workspaceSearchInputAtRef.current = performance.now();
        if (typeof window !== "undefined") {
          window.__SVARD_WORKSPACE_SEARCH_TIMING__ = {
            status: "idle",
          };
        }
        return;
      }
      updateQuery(value);
    },
    [searchScope, updateQuery],
  );

  const updateSearchScope = useCallback(
    (scope: SearchScope) => {
      setSearchScope(scope);
      if (scope === "workspace") {
        setWorkspaceQuery((current) => (current.trim() ? current : query));
        return;
      }
      if (workspaceQuery.trim()) {
        updateQuery(workspaceQuery);
        if (activeDocumentPayload) {
          setTabQueries((current) => ({
            ...current,
            [activeDocumentPayload.path]: workspaceQuery,
          }));
        }
      }
    },
    [activeDocumentPayload, query, setTabQueries, updateQuery, workspaceQuery],
  );

  const activateWorkspaceSearchResult = useCallback(
    async (index: number) => {
      const result = workspaceSearch.result?.results[index];
      if (!result) {
        return;
      }
      const activeQuery = workspaceSearch.result?.query ?? workspaceQuery;
      clearActiveContentCursor();
      setWorkspaceSearchIndex(index);
      setTabQueries((current) => ({
        ...current,
        [result.path]: activeQuery,
      }));
      setPendingWorkspaceSearchJump({ path: result.path, line: result.line });
      await openDocumentWorkspaceTab(result.path);
      updateQuery(activeQuery);
      setRightSidebarTab("search");
      setSearchScope("workspace");
    },
    [
      clearActiveContentCursor,
      openDocumentWorkspaceTab,
      setRightSidebarTab,
      setTabQueries,
      updateQuery,
      workspaceQuery,
      workspaceSearch.result?.query,
      workspaceSearch.result?.results,
    ],
  );

  const updateWorkspaceSearchIndex = useCallback(
    (delta: number) => {
      const resultCount = workspaceSearch.result?.results.length ?? 0;
      if (resultCount === 0) {
        return;
      }
      setWorkspaceSearchIndex((current) => {
        const nextIndex = (current + delta + resultCount) % resultCount;
        requestAnimationFrame(() => {
          document
            .querySelector<HTMLElement>(
              `[data-review-id="workspace-search-result-item"][data-search-index="${nextIndex}"]`,
            )
            ?.scrollIntoView({ block: "nearest", behavior: "auto" });
        });
        return nextIndex;
      });
    },
    [workspaceSearch.result?.results.length],
  );

  const handleWorkspaceSearchClear = useCallback(() => {
    workspaceSearchRequestIdRef.current += 1;
    setWorkspaceQuery("");
    setWorkspaceSearch({ status: "idle", result: null, message: null });
    setWorkspaceSearchIndex(0);
    updateQuery("");
  }, [updateQuery]);

  const handleWorkspaceSearchEnterKey = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (searchScope !== "workspace") {
        return false;
      }
      if (event.key !== "Enter") {
        return false;
      }
      event.preventDefault();
      const resultCount = workspaceSearch.result?.results.length ?? 0;
      if (resultCount === 0) {
        clearActiveContentCursor();
        if (workspaceSearchDebounceTimerRef.current !== null) {
          window.clearTimeout(workspaceSearchDebounceTimerRef.current);
          workspaceSearchDebounceTimerRef.current = null;
        }
        const inputAt = workspaceSearchInputAtRef.current;
        updateWorkspaceSearchTiming({
          debounceWaitMs: 0,
          submitBypassMs:
            inputAt === null ? 0 : Math.max(0, performance.now() - inputAt),
        });
        void runWorkspaceSearch();
      } else {
        const nextIndex =
          (workspaceSearchIndex + (event.shiftKey ? -1 : 1) + resultCount) %
          resultCount;
        void activateWorkspaceSearchResult(nextIndex);
      }
      return true;
    },
    [
      activateWorkspaceSearchResult,
      clearActiveContentCursor,
      runWorkspaceSearch,
      searchScope,
      workspaceSearch.result?.results.length,
      workspaceSearchIndex,
    ],
  );

  return {
    searchScope,
    setSearchScope: updateSearchScope,
    searchInputQuery: searchScope === "workspace" ? workspaceQuery : query,
    workspaceQuery,
    workspaceSearch,
    workspaceSearchIndex,
    updateSearchQuery,
    runWorkspaceSearch,
    activateWorkspaceSearchResult,
    updateWorkspaceSearchIndex,
    handleWorkspaceSearchClear,
    handleWorkspaceSearchEnterKey,
  };
}
