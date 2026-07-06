import { GitBranch } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type {
  AppConfig,
  DocumentDiffStreamPreview,
  GitBranchDiff,
  GitBranchDiffProviderBaseCandidate,
  GitBranchDiffEntry,
  GitChangeEntry,
  GitChanges,
  GitCommitGraph,
  GitCommitGraphItem,
  GitCommitGraphScope,
  GitFileHistory,
  GitFileHistoryItem,
} from "../../../core/types";
import { gitStatusDisplay } from "../../lib/gitStatusDisplay";
import { buildDocumentDiffStreamItems } from "../../lib/documentDiffStream";
import type {
  DocumentReviewSessionControls,
  DocumentReviewState,
} from "../../lib/documentReviewSession";
import { emptyDocumentReviewSessionControls } from "../../lib/documentReviewSession";
import {
  documentReviewStateLabel,
  nextDocumentReviewPath,
  previousDocumentReviewPath,
  summarizeDocumentReviewSession,
  uniqueDocumentReviewPaths,
} from "../../lib/documentReviewSession";
import { fileName } from "../../lib/path";
import { sourceControlEmptyTitle } from "./shared";
import {
  formatTimelineDate,
  LoadOlderCommitsControl,
  TimelinePanel,
  useLoadMoreSentinel,
} from "./TimelinePanel";

export function SourceControlPanel({
  changes,
  changesLoading,
  documentReviewSession = emptyDocumentReviewSessionControls,
  branchDiff,
  branchDiffLoading,
  graph,
  graphLoading,
  graphLoadingMore,
  fileHistory,
  fileHistoryLoading,
  fileHistoryLoadingMore,
  fileHistoryPath,
  view,
  graphScope,
  selectedRevision,
  onSelectView,
  onSelectBranchDiffBase,
  onSelectGraphScope,
  onOpenChange,
  onOpenAllDiffs,
  onOpenBranchDiffItem,
  onOpenGraphItem,
  onOpenFileHistoryChanges,
  onLoadMoreGraph,
  onLoadMoreFileHistory,
  onChangeContextMenu,
  onBranchDiffContextMenu,
  onGraphItemContextMenu,
  onItemContextMenu,
}: {
  changes: GitChanges | null;
  changesLoading: boolean;
  documentReviewSession?: DocumentReviewSessionControls;
  branchDiff: GitBranchDiff | null;
  branchDiffLoading: boolean;
  graph: GitCommitGraph | null;
  graphLoading: boolean;
  graphLoadingMore: boolean;
  fileHistory: GitFileHistory | null;
  fileHistoryLoading: boolean;
  fileHistoryLoadingMore: boolean;
  fileHistoryPath: string | null;
  view: AppConfig["workspace"]["sourceControlView"];
  graphScope: GitCommitGraphScope;
  selectedRevision: string | null;
  onSelectView: (view: AppConfig["workspace"]["sourceControlView"]) => void;
  onSelectBranchDiffBase: (baseRef: string) => void;
  onSelectGraphScope: (scope: GitCommitGraphScope) => void;
  onOpenChange: (path: string | null | undefined) => void | Promise<void>;
  onOpenAllDiffs: (preview: DocumentDiffStreamPreview) => void;
  onOpenBranchDiffItem: (item: GitBranchDiffEntry) => void | Promise<void>;
  onOpenGraphItem: (item: GitFileHistoryItem) => void | Promise<void>;
  onOpenFileHistoryChanges: (item: GitFileHistoryItem) => void | Promise<void>;
  onLoadMoreGraph: () => void;
  onLoadMoreFileHistory: () => void;
  onChangeContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    item: GitChangeEntry,
  ) => void;
  onBranchDiffContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    item: GitBranchDiffEntry,
  ) => void;
  onGraphItemContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    item: GitCommitGraphItem,
  ) => void;
  onItemContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    item: GitFileHistoryItem,
  ) => void;
}) {
  const activeSourceControlMode =
    view === "changes"
      ? "changes"
      : view === "branchDiff"
        ? "branchDiff"
        : graphScope === "file"
          ? "fileHistory"
          : "repoGraph";
  const sourceControlGitState =
    view === "changes"
      ? !changesLoading && changes?.status === "ok"
        ? changes
        : null
      : view === "branchDiff"
        ? !branchDiffLoading && branchDiff?.status === "ok"
          ? branchDiff
          : null
        : !graphLoading && graph?.status === "ok"
          ? graph
          : null;
  const currentBranch = sourceControlGitState?.currentBranch ?? null;
  const headCommit = sourceControlGitState?.headCommit ?? null;
  const headCommitTitle = headCommit
    ? `${currentBranch ?? "Git repository"} (${headCommit.revision}) ${headCommit.summary}`
    : undefined;
  return (
    <section
      className="timeline-panel source-control-panel"
      data-review-id="source-control-panel"
    >
      <div className="source-control-head" data-review-id="source-control-head">
        <div
          className="source-control-branch"
          data-review-id="source-control-branch"
          title={headCommitTitle}
        >
          <GitBranch size={14} aria-hidden="true" />
          <span className="source-control-branch-name">
            {currentBranch ?? "Git repository"}
          </span>
          {headCommit ? (
            <span className="source-control-head-hash">
              ({headCommit.shortHash})
            </span>
          ) : null}
        </div>
        {headCommit ? (
          <span
            className="source-control-head-commit"
            data-review-id="source-control-head-commit"
            title={headCommitTitle}
            aria-label={headCommitTitle}
          >
            <span className="source-control-head-summary">
              {headCommit.summary}
            </span>
          </span>
        ) : null}
      </div>
      <div
        className="source-control-switch"
        role="tablist"
        aria-label="Source Control views"
      >
        <button
          type="button"
          className={activeSourceControlMode === "changes" ? "active" : ""}
          data-review-id="source-control-view-changes"
          role="tab"
          aria-selected={activeSourceControlMode === "changes"}
          onClick={() => onSelectView("changes")}
        >
          Changes
        </button>
        <button
          type="button"
          className={activeSourceControlMode === "branchDiff" ? "active" : ""}
          data-review-id="source-control-view-branch-diff"
          role="tab"
          aria-selected={activeSourceControlMode === "branchDiff"}
          onClick={() => onSelectView("branchDiff")}
        >
          Branch Diff
        </button>
        <button
          type="button"
          className={activeSourceControlMode === "repoGraph" ? "active" : ""}
          data-review-id="source-control-view-repo-graph"
          role="tab"
          aria-selected={activeSourceControlMode === "repoGraph"}
          onClick={() => onSelectGraphScope("repository")}
        >
          Repo Graph
        </button>
        <button
          type="button"
          className={activeSourceControlMode === "fileHistory" ? "active" : ""}
          data-review-id="source-control-view-file-history"
          role="tab"
          aria-selected={activeSourceControlMode === "fileHistory"}
          onClick={() => onSelectGraphScope("file")}
        >
          File History
        </button>
      </div>
      {view === "changes" ? (
        <ChangesPanel
          changes={changes}
          documentReviewSession={documentReviewSession}
          loading={changesLoading}
          onOpenChange={onOpenChange}
          onOpenAllDiffs={onOpenAllDiffs}
          onItemContextMenu={onChangeContextMenu}
        />
      ) : view === "branchDiff" ? (
        <BranchDiffPanel
          branchDiff={branchDiff}
          loading={branchDiffLoading}
          onSelectBaseRef={onSelectBranchDiffBase}
          onOpenItem={onOpenBranchDiffItem}
          onItemContextMenu={onBranchDiffContextMenu}
        />
      ) : (
        <GraphPanel
          graph={graph}
          loading={graphLoading}
          loadingMore={graphLoadingMore}
          fileHistory={fileHistory}
          fileHistoryLoading={fileHistoryLoading}
          fileHistoryLoadingMore={fileHistoryLoadingMore}
          fileHistoryPath={fileHistoryPath}
          graphScope={graphScope}
          selectedRevision={selectedRevision}
          onOpenGraphItem={onOpenGraphItem}
          onOpenFileHistoryChanges={onOpenFileHistoryChanges}
          onLoadMoreGraph={onLoadMoreGraph}
          onLoadMoreFileHistory={onLoadMoreFileHistory}
          onGraphItemContextMenu={onGraphItemContextMenu}
          onItemContextMenu={onItemContextMenu}
        />
      )}
    </section>
  );
}

function ChangesPanel({
  changes,
  documentReviewSession,
  loading,
  onOpenChange,
  onOpenAllDiffs,
  onItemContextMenu,
}: {
  changes: GitChanges | null;
  documentReviewSession: DocumentReviewSessionControls;
  loading: boolean;
  onOpenChange: (path: string | null | undefined) => void | Promise<void>;
  onOpenAllDiffs: (preview: DocumentDiffStreamPreview) => void;
  onItemContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    item: GitChangeEntry,
  ) => void;
}) {
  const reviewTargetPaths = useMemo(
    () =>
      uniqueDocumentReviewPaths(
        changes?.status === "ok"
          ? changes.items
              .map((item) => item.documentPath)
              .filter((path): path is string => Boolean(path))
          : [],
      ),
    [changes],
  );
  const [reviewCursorPath, setReviewCursorPath] = useState<string | null>(null);
  useEffect(() => {
    setReviewCursorPath((current) =>
      current && reviewTargetPaths.includes(current) ? current : null,
    );
  }, [reviewTargetPaths]);
  if (loading) {
    return (
      <div
        className="timeline-empty"
        data-review-id="source-control-changes-loading"
      >
        Loading Git changes
      </div>
    );
  }
  if (changes?.status !== "ok") {
    return (
      <div
        className="timeline-empty"
        data-review-id="source-control-changes-empty"
      >
        <strong>{sourceControlEmptyTitle(changes?.status)}</strong>
        <p>
          {changes?.message ?? "Open a Git-backed workspace to view changes."}
        </p>
      </div>
    );
  }
  if (changes.items.length === 0) {
    return (
      <div
        className="timeline-empty"
        data-review-id="source-control-changes-empty"
      >
        <strong>No changes</strong>
        <p>The working tree has no changed files.</p>
      </div>
    );
  }
  const nextReviewPath = nextDocumentReviewPath({
    currentPath: reviewCursorPath,
    stateByPath: documentReviewSession.stateByPath,
    targetPaths: reviewTargetPaths,
  });
  const previousReviewPath = previousDocumentReviewPath({
    currentPath: reviewCursorPath,
    targetPaths: reviewTargetPaths,
  });
  const reviewSummary = summarizeDocumentReviewSession({
    stateByPath: documentReviewSession.stateByPath,
    targetPaths: reviewTargetPaths,
  });
  const streamItems = buildDocumentDiffStreamItems(changes.items, {
    repositoryRoot: changes.repositoryRoot,
  });
  const openReviewChange = (path: string) => {
    setReviewCursorPath(path);
    void onOpenChange(path);
  };
  return (
    <>
      {reviewTargetPaths.length > 0 ? (
        <div
          className="document-review-session source-control-review-session"
          data-review-id="source-control-review-session"
          aria-label="Review session"
        >
          <span className="document-review-session-title">Review session</span>
          <span data-review-id="source-control-review-progress">
            Reviewed {reviewSummary.reviewed} / {reviewSummary.total}
          </span>
          {reviewSummary.needsAttention > 0 ? (
            <span data-review-id="source-control-review-attention">
              Needs attention {reviewSummary.needsAttention}
            </span>
          ) : null}
          <button
            type="button"
            disabled={!previousReviewPath}
            onClick={() => {
              if (previousReviewPath) {
                openReviewChange(previousReviewPath);
              }
            }}
          >
            Previous
          </button>
          <button
            type="button"
            disabled={!nextReviewPath}
            onClick={() => {
              if (nextReviewPath) {
                openReviewChange(nextReviewPath);
              }
            }}
          >
            Next
          </button>
          <button
            type="button"
            data-review-id="source-control-all-diffs"
            onClick={() =>
              onOpenAllDiffs({
                source: "git-changes-stream",
                repositoryRoot: changes.repositoryRoot,
                items: streamItems,
                watchStatus: "fresh",
              })
            }
          >
            All diffs
          </button>
        </div>
      ) : null}
      <div
        className="source-control-change-list"
        data-review-id="source-control-changes-list"
      >
        {changes.items.map((item) => (
          <ChangeRow
            key={`${item.status}:${item.path}`}
            documentReviewSession={documentReviewSession}
            item={item}
            onOpenReviewChange={openReviewChange}
            onOpenChange={onOpenChange}
            onItemContextMenu={onItemContextMenu}
          />
        ))}
      </div>
    </>
  );
}

function ChangeRow({
  documentReviewSession,
  item,
  onOpenReviewChange,
  onOpenChange,
  onItemContextMenu,
}: {
  documentReviewSession: DocumentReviewSessionControls;
  item: GitChangeEntry;
  onOpenReviewChange: (path: string) => void;
  onOpenChange: (path: string | null | undefined) => void | Promise<void>;
  onItemContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    item: GitChangeEntry,
  ) => void;
}) {
  const display = gitStatusDisplay(item.status);
  const supported = Boolean(item.documentPath);
  const reviewState = item.documentPath
    ? documentReviewSession.stateByPath[item.documentPath]
    : undefined;
  return (
    <button
      type="button"
      className={`source-control-change-row ${supported ? "" : "disabled"}`}
      data-review-id="source-control-change-item"
      data-git-status={item.status}
      aria-disabled={!supported}
      onClick={() => {
        if (item.documentPath) {
          onOpenReviewChange(item.documentPath);
        }
      }}
      onContextMenu={(event) => onItemContextMenu(event, item)}
      title={
        supported
          ? "Open working tree diff"
          : "Preview diff is available for markup documents only"
      }
    >
      <span className="source-control-change-main">
        <span className="source-control-change-name">
          {fileName(item.path)}
        </span>
        {display ? (
          <span
            className={`git-status-badge ${display.className}`}
            title={display.label}
            aria-label={display.label}
          >
            {display.shortLabel}
          </span>
        ) : null}
        {supported ? <ReviewStateBadge state={reviewState} /> : null}
      </span>
      <span className="source-control-change-path">{item.path}</span>
    </button>
  );
}

function ReviewStateBadge({
  state,
}: {
  state: DocumentReviewState | undefined;
}) {
  const effectiveState = state ?? "unreviewed";
  const label = documentReviewStateLabel(effectiveState);
  return (
    <span
      className={`document-review-state document-review-state-${effectiveState}`}
      data-review-id="document-review-state"
      title={label}
      aria-label={label}
    >
      {label}
    </span>
  );
}

function BranchDiffPanel({
  branchDiff,
  loading,
  onSelectBaseRef,
  onOpenItem,
  onItemContextMenu,
}: {
  branchDiff: GitBranchDiff | null;
  loading: boolean;
  onSelectBaseRef: (baseRef: string) => void;
  onOpenItem: (item: GitBranchDiffEntry) => void | Promise<void>;
  onItemContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    item: GitBranchDiffEntry,
  ) => void;
}) {
  if (loading) {
    return (
      <div
        className="timeline-empty"
        data-review-id="source-control-branch-diff-loading"
      >
        Loading Branch Diff
      </div>
    );
  }
  const candidates = branchDiff?.baseCandidates ?? [];
  const providerCandidates = branchDiff?.providerBaseCandidates ?? [];
  const activeBase = branchDiff?.baseRef ?? "";
  const baseOptions =
    activeBase && !candidates.includes(activeBase)
      ? [activeBase, ...candidates]
      : candidates;
  const providerOptions = providerCandidates.filter(
    (candidate) => candidate.available,
  );
  const unavailableProviderOptions = providerCandidates.filter(
    (candidate) => !candidate.available,
  );
  const localOptions = baseOptions.filter(
    (candidate) =>
      !providerOptions.some((provider) => provider.baseRef === candidate),
  );
  const controls = (
    <div
      className="source-control-branch-diff-controls"
      data-review-id="source-control-branch-diff-controls"
    >
      <label>
        <span>Base</span>
        <select
          data-review-id="source-control-branch-diff-base"
          value={activeBase}
          onChange={(event) => onSelectBaseRef(event.currentTarget.value)}
          disabled={baseOptions.length === 0}
        >
          {activeBase ? null : <option value="">Select base</option>}
          {providerOptions.length > 0 ? (
            <optgroup label="Provider target">
              {providerOptions.map((candidate) => (
                <option key={candidateKey(candidate)} value={candidate.baseRef}>
                  {candidate.label}
                </option>
              ))}
            </optgroup>
          ) : null}
          <optgroup label="Local refs">
            {localOptions.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </optgroup>
        </select>
      </label>
      <span className="source-control-branch-diff-range">
        {activeBase || "base"}...{branchDiff?.headRef ?? "HEAD"}
      </span>
      {unavailableProviderOptions.length > 0 ? (
        <span
          className="source-control-branch-diff-warning"
          data-review-id="source-control-branch-diff-provider-warning"
        >
          {unavailableProviderOptions[0].message ??
            "Provider target branch is unavailable locally."}
        </span>
      ) : null}
    </div>
  );
  if (branchDiff?.status !== "ok") {
    return (
      <div data-review-id="source-control-branch-diff-panel">
        {controls}
        <div
          className="timeline-empty"
          data-review-id="source-control-branch-diff-empty"
        >
          <strong>{sourceControlEmptyTitle(branchDiff?.status)}</strong>
          <p>
            {branchDiff?.message ??
              "Select a Git-backed workspace to view Branch Diff."}
          </p>
        </div>
      </div>
    );
  }
  if (branchDiff.items.length === 0) {
    return (
      <div data-review-id="source-control-branch-diff-panel">
        {controls}
        <div
          className="timeline-empty"
          data-review-id="source-control-branch-diff-empty"
        >
          <strong>No branch changes</strong>
          <p>No files changed in this Branch Diff range.</p>
        </div>
      </div>
    );
  }
  return (
    <div data-review-id="source-control-branch-diff-panel">
      {controls}
      <div
        className="source-control-change-list"
        data-review-id="source-control-branch-diff-list"
      >
        {branchDiff.items.map((item) => (
          <BranchDiffRow
            key={`${item.status}:${item.oldPath ?? ""}:${item.path}`}
            item={item}
            onOpenItem={onOpenItem}
            onItemContextMenu={onItemContextMenu}
          />
        ))}
      </div>
    </div>
  );
}

function candidateKey(candidate: GitBranchDiffProviderBaseCandidate) {
  return `${candidate.provider}:${candidate.sourceBranch}:${candidate.targetBranch}:${candidate.baseRef}`;
}

function BranchDiffRow({
  item,
  onOpenItem,
  onItemContextMenu,
}: {
  item: GitBranchDiffEntry;
  onOpenItem: (item: GitBranchDiffEntry) => void | Promise<void>;
  onItemContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    item: GitBranchDiffEntry,
  ) => void;
}) {
  const display = gitStatusDisplay(item.status);
  const supported = Boolean(item.documentPath);
  const pathText = item.oldPath ? `${item.oldPath} -> ${item.path}` : item.path;
  return (
    <button
      type="button"
      className={`source-control-change-row ${supported ? "" : "disabled"}`}
      data-review-id="source-control-branch-diff-item"
      data-git-status={item.status}
      aria-disabled={!supported}
      onClick={() => {
        if (supported) {
          void onOpenItem(item);
        }
      }}
      onContextMenu={(event) => onItemContextMenu(event, item)}
      title={
        supported
          ? "Open Branch Diff preview"
          : "Preview diff is available for markup documents only"
      }
    >
      <span className="source-control-change-main">
        <span className="source-control-change-name">
          {fileName(item.path)}
        </span>
        {display ? (
          <span
            className={`git-status-badge ${display.className}`}
            title={display.label}
            aria-label={display.label}
          >
            {display.shortLabel}
          </span>
        ) : null}
      </span>
      <span className="source-control-change-path">{pathText}</span>
    </button>
  );
}

function GraphPanel({
  graph,
  loading,
  loadingMore,
  fileHistory,
  fileHistoryLoading,
  fileHistoryLoadingMore,
  fileHistoryPath,
  graphScope,
  selectedRevision,
  onOpenGraphItem,
  onOpenFileHistoryChanges,
  onLoadMoreGraph,
  onLoadMoreFileHistory,
  onGraphItemContextMenu,
  onItemContextMenu,
}: {
  graph: GitCommitGraph | null;
  loading: boolean;
  loadingMore: boolean;
  fileHistory: GitFileHistory | null;
  fileHistoryLoading: boolean;
  fileHistoryLoadingMore: boolean;
  fileHistoryPath: string | null;
  graphScope: GitCommitGraphScope;
  selectedRevision: string | null;
  onOpenGraphItem: (item: GitFileHistoryItem) => void | Promise<void>;
  onOpenFileHistoryChanges: (item: GitFileHistoryItem) => void | Promise<void>;
  onLoadMoreGraph: () => void;
  onLoadMoreFileHistory: () => void;
  onGraphItemContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    item: GitCommitGraphItem,
  ) => void;
  onItemContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    item: GitFileHistoryItem,
  ) => void;
}) {
  const items = graph?.items ?? [];
  const { sentinelRef: graphSentinelRef, onScrollIntent: onGraphScrollIntent } =
    useLoadMoreSentinel({
      enabled: Boolean(graph?.hasMore) && !loading && !loadingMore,
      onLoadMore: onLoadMoreGraph,
      surface: "repoGraph",
    });
  return (
    <div data-review-id="source-control-graph-panel">
      {graphScope === "file" ? (
        <TimelinePanel
          history={fileHistory}
          loading={fileHistoryLoading}
          loadingMore={fileHistoryLoadingMore}
          path={fileHistoryPath}
          selectedRevision={selectedRevision}
          onLoadMore={onLoadMoreFileHistory}
          onOpenChanges={onOpenFileHistoryChanges}
          onItemContextMenu={onItemContextMenu}
        />
      ) : loading ? (
        <div className="timeline-empty" data-review-id="timeline-loading">
          Loading Git graph
        </div>
      ) : graph?.status === "ok" ? (
        <div
          className="timeline-list"
          data-review-id="timeline-list"
          onScroll={() => onGraphScrollIntent()}
          onTouchMove={() => onGraphScrollIntent()}
          onWheel={(event) => onGraphScrollIntent(event.deltaY)}
        >
          {items.map((item) => (
            <GraphRow
              key={item.revision}
              item={item}
              selected={selectedRevision === item.revision}
              onOpen={onOpenGraphItem}
              onItemContextMenu={onGraphItemContextMenu}
            />
          ))}
          <LoadOlderCommitsControl
            hasMore={Boolean(graph.hasMore)}
            loading={loadingMore}
            sentinelRef={graphSentinelRef}
            onLoadMore={onLoadMoreGraph}
          />
        </div>
      ) : (
        <div className="timeline-empty" data-review-id="timeline-empty-state">
          <strong>{sourceControlEmptyTitle(graph?.status)}</strong>
          <p>
            {graph?.message ?? "Open a Git-backed workspace to view the graph."}
          </p>
        </div>
      )}
    </div>
  );
}

function GraphRow({
  item,
  selected,
  onOpen,
  onItemContextMenu,
}: {
  item: GitCommitGraphItem;
  selected: boolean;
  onOpen: (item: GitFileHistoryItem) => void | Promise<void>;
  onItemContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    item: GitCommitGraphItem,
  ) => void;
}) {
  return (
    <button
      type="button"
      className={`timeline-row source-control-graph-row ${selected ? "selected-for-compare" : ""}`}
      data-review-id="timeline-item"
      data-revision={item.revision}
      data-parent-count={item.parentRevisions.length}
      onClick={() => onOpen(item)}
      onContextMenu={(event) => onItemContextMenu(event, item)}
    >
      <span className="source-control-graph-rail" aria-hidden="true" />
      <div className="timeline-row-main">
        <strong>{item.summary}</strong>
        <span>
          {item.shortHash} · {item.author} · {formatTimelineDate(item.date)}
        </span>
      </div>
    </button>
  );
}
