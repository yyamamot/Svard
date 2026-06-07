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

interface UseWorkspaceSearchInput {
  query: string;
  rootDirectory: string | null | undefined;
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
      return;
    }
    if (!rootPath) {
      setWorkspaceSearch({
        status: "error",
        result: null,
        message: "Workspace root is not available.",
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
      const result = await host.searchWorkspace({
        rootPath,
        query: trimmedQuery,
        ...defaultWorkspaceSearchLimits,
      });
      if (workspaceSearchRequestIdRef.current !== requestId) {
        return;
      }
      setWorkspaceSearch({
        status: "ready",
        result,
        message: result.message ?? null,
      });
      setWorkspaceSearchIndex(0);
    } catch (error) {
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
    }
  }, [host, workspaceQuery, workspaceSearchRoot]);

  useEffect(() => {
    if (searchScope !== "workspace") {
      return;
    }
    const trimmedQuery = workspaceQuery.trim();
    workspaceSearchRequestIdRef.current += 1;
    if (!trimmedQuery) {
      setWorkspaceSearch({ status: "idle", result: null, message: null });
      setWorkspaceSearchIndex(0);
      return;
    }
    const timer = window.setTimeout(() => {
      void runWorkspaceSearch();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [runWorkspaceSearch, searchScope, workspaceQuery]);

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
        setWorkspaceQuery(value);
        setWorkspaceSearch({ status: "idle", result: null, message: null });
        setWorkspaceSearchIndex(0);
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
