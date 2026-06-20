import { ChevronDown, ChevronUp, Pin, Search, X } from "lucide-react";
import type { KeyboardEvent, RefObject } from "react";
import { DiagramInspectorPanel } from "./DiagramInspectorPanel";
import { IncludeInspectorSection } from "./IncludeInspectorSection";
import { Toc } from "./Toc";
import type { CommandId } from "../../core/commands";
import type { DocumentPayload, RenderResult } from "../../core/types";
import type { DiagramInspectorItem } from "../lib/diagramInspector";
import type { IncludeInspectorItem } from "../lib/includeInspector";
import type {
  DiagramPreviewState,
  RightSidebarTab,
  SearchHitSummary,
  SearchScope,
  WorkspaceSearchState,
} from "../types";

interface RightSidebarProps {
  activeHeadingId: string | null;
  diagramInspectorItems: DiagramInspectorItem[];
  documentPayload: DocumentPayload | null;
  includeInspectorItems: IncludeInspectorItem[];
  matchCount: number;
  pinnedSearch: string | null;
  query: string;
  renderResult: RenderResult | null;
  rightSidebarTab: RightSidebarTab;
  searchScope: SearchScope;
  searchHits: SearchHitSummary[];
  searchIndex: number;
  searchInputRef: RefObject<HTMLInputElement | null>;
  selectedDiagramId: string | null;
  workspaceSearchIndex: number;
  workspaceSearch: WorkspaceSearchState;
  onActivateSearchHit: (index: number) => void;
  onActivateWorkspaceSearchResult: (index: number) => void;
  onClearSearch: () => void;
  onCopyText: (label: string, content?: string) => Promise<void>;
  onDispatchCommand: (commandId: CommandId) => void;
  onNavigateSourceLine: (line: number) => void;
  onNavigateHeading: (headingId: string) => void;
  onOpenDiagramPreview: (preview: DiagramPreviewState) => void;
  onOpenInclude: (path: string) => void | Promise<void>;
  onPinQuery: () => void;
  onSelectDiagram: (id: string) => void;
  onSetSearchScope: (scope: SearchScope) => void;
  onSetRightSidebarTab: (tab: RightSidebarTab) => void;
  onShowInlineNotice: (
    message: string,
    options?: { tone?: "info" | "success" | "warning" | "error" },
  ) => void;
  onSearchInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onUpdateQuery: (query: string) => void;
  onWorkspaceSearchIndexChange: (delta: number) => void;
}

export function RightSidebar({
  activeHeadingId,
  diagramInspectorItems,
  documentPayload,
  includeInspectorItems,
  matchCount,
  pinnedSearch,
  query,
  renderResult,
  rightSidebarTab,
  searchScope,
  searchHits,
  searchIndex,
  searchInputRef,
  selectedDiagramId,
  workspaceSearchIndex,
  workspaceSearch,
  onActivateSearchHit,
  onActivateWorkspaceSearchResult,
  onClearSearch,
  onCopyText,
  onDispatchCommand,
  onNavigateSourceLine,
  onNavigateHeading,
  onOpenDiagramPreview,
  onOpenInclude,
  onPinQuery,
  onSelectDiagram,
  onSetSearchScope,
  onSetRightSidebarTab,
  onShowInlineNotice,
  onSearchInputKeyDown,
  onUpdateQuery,
  onWorkspaceSearchIndexChange,
}: RightSidebarProps) {
  const trimmedQuery = query.trim();
  const workspaceResult = workspaceSearch.result;
  const isPinnedQuery = Boolean(trimmedQuery) && query === pinnedSearch;
  const searchResultLabel =
    searchScope === "workspace"
      ? workspaceSearchLabel(workspaceSearch)
      : !trimmedQuery
        ? "No search query"
        : matchCount === 0
          ? "No matches"
          : `${searchIndex + 1} of ${matchCount} matches`;
  const pinLabel = isPinnedQuery ? "Pinned search" : "Pin current search";
  const pinTitle = trimmedQuery ? pinLabel : "Enter a search query to pin";
  const clearLabel =
    searchScope === "workspace"
      ? "Clear workspace search"
      : "Clear search and pinned search";
  const workspaceResultCount = workspaceResult?.results.length ?? 0;
  const workspaceNavigationDisabled =
    workspaceSearch.status === "loading" || workspaceResultCount === 0;

  return (
    <div className="sidebar-content">
      <div className="right-sidebar-tabs" data-review-id="right-sidebar-tabs">
        <button
          type="button"
          className={rightSidebarTab === "contents" ? "active" : ""}
          data-review-id="right-sidebar-tab-contents"
          onClick={() => onSetRightSidebarTab("contents")}
        >
          Contents
        </button>
        <button
          type="button"
          className={rightSidebarTab === "search" ? "active" : ""}
          data-review-id="right-sidebar-tab-search"
          onClick={() => {
            onSetRightSidebarTab("search");
            requestAnimationFrame(() => searchInputRef.current?.focus());
          }}
        >
          Search
        </button>
        <button
          type="button"
          className={rightSidebarTab === "diagrams" ? "active" : ""}
          data-review-id="right-sidebar-tab-diagrams"
          onClick={() => onSetRightSidebarTab("diagrams")}
        >
          Diagrams
        </button>
      </div>
      <section
        className="panel right-sidebar-tab-panel"
        data-review-id="right-sidebar-tab-panel"
      >
        {rightSidebarTab === "contents" ? (
          <>
            <div className="panel-heading-row">
              <h2>Contents</h2>
            </div>
            <Toc
              activeHeadingId={activeHeadingId}
              headings={renderResult?.headings ?? []}
              onNavigate={onNavigateHeading}
            />
            <IncludeInspectorSection
              document={documentPayload}
              items={includeInspectorItems}
              onCopyText={onCopyText}
              onNavigateSourceLine={onNavigateSourceLine}
              onOpenInclude={onOpenInclude}
              onShowNotice={onShowInlineNotice}
            />
          </>
        ) : rightSidebarTab === "diagrams" ? (
          <DiagramInspectorPanel
            items={diagramInspectorItems}
            selectedDiagramId={selectedDiagramId}
            onCopyText={onCopyText}
            onNavigateSourceLine={onNavigateSourceLine}
            onOpenPreview={(item) => {
              if (!item.svg) {
                return;
              }
              onOpenDiagramPreview({
                title: `${item.diagramType} diagram`,
                svg: item.svg,
                sourceReference: item.sourceReference,
              });
            }}
            onSelectDiagram={onSelectDiagram}
            onShowNotice={onShowInlineNotice}
          />
        ) : (
          <div data-review-id="search">
            <h2>Search</h2>
            <div
              className="search-scope-control"
              data-review-id="search-scope-control"
            >
              <button
                type="button"
                className={searchScope === "document" ? "active" : ""}
                data-review-id="search-scope-document"
                onClick={() => onSetSearchScope("document")}
              >
                Current File
              </button>
              <button
                type="button"
                className={searchScope === "workspace" ? "active" : ""}
                data-review-id="search-scope-workspace"
                onClick={() => onSetSearchScope("workspace")}
              >
                All Files
              </button>
            </div>
            <label className="search-box">
              <Search size={16} />
              <input
                ref={searchInputRef}
                data-review-id="search-input"
                value={query}
                placeholder={
                  searchScope === "workspace"
                    ? "Search all files"
                    : "Search current file"
                }
                onChange={(event) => onUpdateQuery(event.target.value)}
                onKeyDown={onSearchInputKeyDown}
              />
            </label>
            <div className="search-actions">
              {searchScope === "document" ? (
                <>
                  <button
                    type="button"
                    className="icon-button"
                    data-review-id="search-previous"
                    aria-label="Previous match"
                    onClick={() => onDispatchCommand("search.previous")}
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    data-review-id="search-next"
                    aria-label="Next match"
                    onClick={() => onDispatchCommand("search.next")}
                  >
                    <ChevronDown size={15} />
                  </button>
                  <button
                    type="button"
                    className={`icon-button labeled${isPinnedQuery ? " active" : ""}`}
                    data-review-id="search-pin"
                    aria-label={pinTitle}
                    title={pinTitle}
                    disabled={!trimmedQuery}
                    onClick={onPinQuery}
                  >
                    <Pin size={15} />
                    <span>Pin</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="icon-button"
                    data-review-id="search-previous"
                    aria-label="Previous workspace result"
                    disabled={workspaceNavigationDisabled}
                    onClick={() => onWorkspaceSearchIndexChange(-1)}
                  >
                    <ChevronUp size={15} />
                  </button>
                  <button
                    type="button"
                    className="icon-button"
                    data-review-id="search-next"
                    aria-label="Next workspace result"
                    disabled={workspaceNavigationDisabled}
                    onClick={() => onWorkspaceSearchIndexChange(1)}
                  >
                    <ChevronDown size={15} />
                  </button>
                </>
              )}
              <button
                type="button"
                className="icon-button"
                data-review-id="search-clear"
                aria-label={clearLabel}
                title={clearLabel}
                onClick={onClearSearch}
              >
                <X size={15} />
              </button>
            </div>
            <p className="search-result" data-review-id="search-result">
              {searchResultLabel}
            </p>
            {searchScope === "document" && pinnedSearch ? (
              <p
                className="search-pinned"
                data-review-id="search-pinned-status"
              >
                Pinned search: {pinnedSearch}
              </p>
            ) : null}
            <div
              className="search-result-list"
              data-review-id="search-result-list"
            >
              {searchScope === "document" ? (
                <>
                  {!query.trim() && (
                    <p className="search-empty">No search query</p>
                  )}
                  {query.trim() && matchCount === 0 && (
                    <p className="search-empty">No matches</p>
                  )}
                  {query.trim() &&
                    searchHits.map((hit) => (
                      <button
                        key={hit.index}
                        type="button"
                        className={`search-result-item${
                          hit.index === searchIndex ? " active" : ""
                        }`}
                        data-review-id="search-result-item"
                        data-context-menu-kind="search-result"
                        data-search-index={hit.index}
                        onClick={() => onActivateSearchHit(hit.index)}
                      >
                        <span className="search-result-heading">
                          {hit.heading}
                        </span>
                        <span className="search-result-snippet">
                          {hit.snippet}
                        </span>
                        <span className="search-result-count">
                          {hit.index + 1} / {matchCount}
                        </span>
                      </button>
                    ))}
                </>
              ) : (
                <>
                  {!query.trim() && (
                    <p className="search-empty">No search query</p>
                  )}
                  {query.trim() && workspaceSearch.status === "idle" && (
                    <p className="search-empty">
                      Type to search the workspace.
                    </p>
                  )}
                  {workspaceSearch.status === "loading" && (
                    <p className="search-empty">Searching workspace...</p>
                  )}
                  {workspaceSearch.status === "error" && (
                    <p className="search-empty">
                      {workspaceSearch.message ?? "Workspace search failed."}
                    </p>
                  )}
                  {workspaceResult?.capped ? (
                    <p
                      className="search-pinned"
                      data-review-id="workspace-search-capped"
                    >
                      Results capped. Narrow the query for more precise results.
                    </p>
                  ) : null}
                  {workspaceSearch.status === "ready" &&
                    workspaceResult?.results.length === 0 && (
                      <p className="search-empty">No matches</p>
                    )}
                  {workspaceResult?.results.map((hit, index) => (
                    <button
                      key={`${hit.path}:${hit.line}:${index}`}
                      type="button"
                      className={`search-result-item workspace-search-result-item${
                        index === workspaceSearchIndex ? " active" : ""
                      }`}
                      data-review-id="workspace-search-result-item"
                      data-context-menu-kind="search-result"
                      data-search-index={index}
                      data-source-reference={hit.sourceReference}
                      onClick={() => onActivateWorkspaceSearchResult(index)}
                    >
                      <span className="search-result-heading">
                        {hit.displayPath}
                      </span>
                      <span className="search-result-snippet">
                        {hit.heading ? `${hit.heading} · ` : ""}
                        line {hit.line}: {hit.snippet}
                      </span>
                      <span className="search-result-count">
                        {hit.matchCount}{" "}
                        {hit.matchCount === 1 ? "match" : "matches"}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function workspaceSearchLabel(search: WorkspaceSearchState) {
  if (search.status === "loading") {
    return "Searching workspace...";
  }
  if (search.status === "error") {
    return search.message ?? "Workspace search failed";
  }
  const result = search.result;
  if (!result?.query.trim()) {
    return "No search query";
  }
  if (result.results.length === 0) {
    return "No matches";
  }
  return `${result.totalMatches} ${result.totalMatches === 1 ? "match" : "matches"} in ${result.results.length} ${result.results.length === 1 ? "result" : "results"}`;
}
