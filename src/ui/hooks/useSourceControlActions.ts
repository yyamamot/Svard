import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { isSupportedDocumentPath } from "../../core/documentFormat";
import type {
  AppConfig,
  DocumentDiffPreview,
  DocumentPayload,
  GitBranchDiff,
  GitBranchDiffEntry,
  GitChanges,
  GitCommitDetails,
  GitCommitGraph,
  GitCommitGraphItem,
  GitCommitGraphScope,
  GitFileHistory,
  GitFileHistoryItem,
  GitRefItem,
  GitRefKind,
  GitRefList,
  HostAdapter,
  WorkspacePerformanceMode,
} from "../../core/types";
import type { ContextMenuItem, InlineNoticeOptions } from "../types";
import {
  buildSourceControlBranchDiffContextMenuItems,
  buildSourceControlChangeContextMenuItems,
  buildSourceControlGraphContextMenuItems,
  buildTimelineItemContextMenuItems,
} from "./sourceControlContextMenus";
import { useSourceControlLoaders } from "./useSourceControlLoaders";
import {
  SourceControlRequests,
  sourceControlInitialHistoryLimit,
  sourceControlHistoryPageLimit,
} from "./sourceControlRequests";
import {
  emptyGitRefList,
  mergeGitCommitGraphPage,
  mergeGitFileHistoryPage,
  mergeGitRefPage,
} from "./sourceControlState";
import { perfDuration, perfNow, tracePerf } from "../lib/perfTrace";

export function useSourceControlActions({
  config,
  copyText,
  documentPayload,
  host,
  openContextMenu,
  onGitChangesRefreshComplete,
  onDocumentReviewNeedsAttention,
  onDocumentReviewReset,
  onDocumentReviewViewed,
  onGitRefresh,
  persistWorkspace,
  rootDirectory,
  setDocumentDiffPreview,
  showInlineNotice,
  workspacePerformanceMode = "normal",
}: {
  config: AppConfig | null;
  copyText: (label: string, value: string) => void | Promise<void>;
  documentPayload: DocumentPayload | null;
  host: HostAdapter;
  openContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    items: ContextMenuItem[],
    source: string,
  ) => void;
  onGitChangesRefreshComplete?: (reason: string, changes: GitChanges) => void;
  onDocumentReviewNeedsAttention?: (path: string) => void;
  onDocumentReviewReset?: (path: string) => void;
  onDocumentReviewViewed?: (path: string) => void;
  onGitRefresh?: (reason: string) => void;
  persistWorkspace: (patch: Partial<AppConfig["workspace"]>) => Promise<void>;
  rootDirectory: string;
  setDocumentDiffPreview: (preview: DocumentDiffPreview | null) => void;
  showInlineNotice: (message: string, options?: InlineNoticeOptions) => void;
  workspacePerformanceMode?: WorkspacePerformanceMode;
}) {
  const [gitTimelinePath, setGitTimelinePath] = useState<string | null>(null);
  const [gitTimelineHistory, setGitTimelineHistory] =
    useState<GitFileHistory | null>(null);
  const [gitTimelineLoading, setGitTimelineLoading] = useState(false);
  const [gitTimelineLoadingMore, setGitTimelineLoadingMore] = useState(false);
  const [gitTimelineRefreshToken, setGitTimelineRefreshToken] = useState(0);
  const [gitChanges, setGitChanges] = useState<GitChanges | null>(null);
  const [gitChangesLoading, setGitChangesLoading] = useState(false);
  const [gitBranchDiff, setGitBranchDiff] = useState<GitBranchDiff | null>(
    null,
  );
  const [gitBranchDiffLoading, setGitBranchDiffLoading] = useState(false);
  const [gitCommitGraph, setGitCommitGraph] = useState<GitCommitGraph | null>(
    null,
  );
  const [gitCommitGraphLoading, setGitCommitGraphLoading] = useState(false);
  const [gitCommitGraphLoadingMore, setGitCommitGraphLoadingMore] =
    useState(false);
  const [gitTimelineCompareBase, setGitTimelineCompareBase] =
    useState<GitFileHistoryItem | null>(null);
  const [gitCommitDetails, setGitCommitDetails] =
    useState<GitCommitDetails | null>(null);
  const [gitRefPicker, setGitRefPicker] = useState<{
    kind: GitRefKind;
    path: string;
    refs: GitRefList;
    loading: boolean;
    loadingMore: boolean;
    query: string;
  } | null>(null);

  const [workspaceSourceControlView, setWorkspaceSourceControlView] =
    useState<AppConfig["workspace"]["sourceControlView"]>("changes");
  const [
    workspaceSourceControlGraphScope,
    setWorkspaceSourceControlGraphScope,
  ] = useState<GitCommitGraphScope>("repository");
  const [
    workspaceSourceControlBranchDiffBaseRef,
    setWorkspaceSourceControlBranchDiffBaseRef,
  ] = useState<string | null>(null);
  const [workspaceSidebarTab, setWorkspaceSidebarTab] =
    useState<AppConfig["workspace"]["sidebarTab"]>("files");
  const persistWorkspaceRef = useRef(persistWorkspace);
  const requestsRef = useRef(new SourceControlRequests(host));
  const sourceControlRefreshTimerRef = useRef<number | null>(null);
  const sourceControlIdleWarmDelayRef = useRef<number | null>(null);
  const sourceControlIdleWarmHandleRef = useRef<number | null>(null);
  const sourceControlSilentRefreshTimerRef = useRef<number | null>(null);
  const rootDirectoryRef = useRef(rootDirectory);
  const gitDiffPreviewRequestRef = useRef(0);

  const effectiveGitTimelinePath =
    gitTimelinePath ?? documentPayload?.path ?? null;
  const sourceControlAnchorPath =
    rootDirectory || documentPayload?.path || effectiveGitTimelinePath || "";
  const isSourceControlOpen = workspaceSidebarTab === "sourceControl";
  const isRepoGraphView =
    isSourceControlOpen &&
    workspaceSourceControlView === "graph" &&
    workspaceSourceControlGraphScope === "repository";
  const isFileHistoryView =
    isSourceControlOpen &&
    workspaceSourceControlView === "graph" &&
    workspaceSourceControlGraphScope === "file";
  const sourceControlTimers = useMemo(
    () => ({
      refreshTimerRef: sourceControlRefreshTimerRef,
      idleWarmDelayRef: sourceControlIdleWarmDelayRef,
      idleWarmHandleRef: sourceControlIdleWarmHandleRef,
      silentRefreshTimerRef: sourceControlSilentRefreshTimerRef,
    }),
    [],
  );

  useEffect(() => {
    persistWorkspaceRef.current = persistWorkspace;
  }, [persistWorkspace]);

  const { refreshGitChanges } = useSourceControlLoaders({
    config,
    effectiveGitTimelinePath,
    gitTimelineRefreshToken,
    host,
    isFileHistoryView,
    isRepoGraphView,
    onGitChangesRefreshComplete,
    onGitRefresh,
    persistWorkspaceRef,
    requestsRef,
    rootDirectory,
    rootDirectoryRef,
    setGitBranchDiff,
    setGitBranchDiffLoading,
    setGitChanges,
    setGitChangesLoading,
    setGitCommitDetails,
    setGitCommitGraph,
    setGitCommitGraphLoading,
    setGitTimelineCompareBase,
    setGitTimelineHistory,
    setGitTimelineLoading,
    setGitTimelineRefreshToken,
    setWorkspaceSidebarTab,
    setWorkspaceSourceControlBranchDiffBaseRef,
    setWorkspaceSourceControlGraphScope,
    setWorkspaceSourceControlView,
    sourceControlAnchorPath,
    timers: sourceControlTimers,
    workspaceSidebarTab,
    workspacePerformanceMode,
    workspaceSourceControlBranchDiffBaseRef,
    workspaceSourceControlGraphScope,
    workspaceSourceControlView,
  });

  async function setSidebarTab(tab: AppConfig["workspace"]["sidebarTab"]) {
    setWorkspaceSidebarTab(tab);
    await persistWorkspaceRef.current({ sidebarTab: tab });
  }

  async function setSourceControlView(
    view: AppConfig["workspace"]["sourceControlView"],
  ) {
    setWorkspaceSidebarTab("sourceControl");
    setWorkspaceSourceControlView(view);
    await persistWorkspaceRef.current({
      sidebarTab: "sourceControl",
      sourceControlView: view,
    });
  }

  async function reviewAgentChanges() {
    try {
      await setSourceControlView("changes");
      refreshGitChanges("agent-review-changes");
    } catch {
      showInlineNotice("Source Control could not be opened.", {
        tone: "warning",
      });
    }
  }

  async function setSourceControlGraphScope(scope: GitCommitGraphScope) {
    if (scope === "repository") {
      setGitTimelinePath(null);
    }
    setWorkspaceSidebarTab("sourceControl");
    setWorkspaceSourceControlView("graph");
    setWorkspaceSourceControlGraphScope(scope);
    await persistWorkspaceRef.current({
      sidebarTab: "sourceControl",
      sourceControlView: "graph",
      sourceControlGraphScope: scope,
    });
  }

  async function loadMoreGitCommitGraph() {
    if (
      gitCommitGraphLoadingMore ||
      !gitCommitGraph?.hasMore ||
      !gitCommitGraph.nextCursor ||
      !sourceControlAnchorPath
    ) {
      return;
    }
    const cursor = gitCommitGraph.nextCursor;
    const cacheKey = [
      "graph",
      sourceControlAnchorPath,
      workspaceSourceControlGraphScope,
      effectiveGitTimelinePath ?? "",
      cursor,
    ].join("\0");
    const startedAt = perfNow();
    setGitCommitGraphLoadingMore(true);
    const { cached, deduped, request } =
      requestsRef.current.getOrStartGitCommitGraphPageRequest({
        cacheKey,
        pathOrRoot: sourceControlAnchorPath,
        scope: workspaceSourceControlGraphScope,
        path:
          workspaceSourceControlGraphScope === "file"
            ? effectiveGitTimelinePath
            : null,
        limit: sourceControlHistoryPageLimit,
        cursor,
      });
    if (cached) {
      appendGitCommitGraphPage(cached);
    }
    try {
      const page = await request;
      tracePerf("sourceControl.getGitCommitGraph.page", {
        status: page.status,
        scope: page.scope,
        count: page.items.length,
        hasMore: page.hasMore,
        cursorPresent: true,
        cacheStatus: page.metrics?.cacheStatus,
        walkedCommits: page.metrics?.walkedCommits,
        deduped,
        stale: Boolean(cached),
        durationMs: perfDuration(startedAt),
      });
      appendGitCommitGraphPage(page);
    } catch (error) {
      tracePerf("sourceControl.getGitCommitGraph.page.failed", {
        cursorPresent: true,
        durationMs: perfDuration(startedAt),
        message: error instanceof Error ? error.message : "Git graph failed",
      });
    } finally {
      setGitCommitGraphLoadingMore(false);
    }
  }

  async function loadMoreGitFileHistory() {
    if (
      gitTimelineLoadingMore ||
      !gitTimelineHistory?.hasMore ||
      !gitTimelineHistory.nextCursor ||
      !effectiveGitTimelinePath
    ) {
      return;
    }
    const cursor = gitTimelineHistory.nextCursor;
    const cacheKey = ["fileHistory", effectiveGitTimelinePath, cursor].join(
      "\0",
    );
    const startedAt = perfNow();
    setGitTimelineLoadingMore(true);
    const { cached, deduped, request } =
      requestsRef.current.getOrStartGitFileHistoryPageRequest({
        cacheKey,
        path: effectiveGitTimelinePath,
        limit: sourceControlHistoryPageLimit,
        cursor,
      });
    if (cached) {
      appendGitFileHistoryPage(cached);
    }
    try {
      const page = await request;
      tracePerf("sourceControl.getGitFileHistory.page", {
        status: page.status,
        count: page.items.length,
        hasMore: page.hasMore,
        cursorPresent: true,
        cacheStatus: page.metrics?.cacheStatus,
        walkedCommits: page.metrics?.walkedCommits,
        matchedCommits: page.metrics?.matchedCommits,
        deduped,
        stale: Boolean(cached),
        durationMs: perfDuration(startedAt),
      });
      appendGitFileHistoryPage(page);
    } catch (error) {
      tracePerf("sourceControl.getGitFileHistory.page.failed", {
        cursorPresent: true,
        durationMs: perfDuration(startedAt),
        message: error instanceof Error ? error.message : "File history failed",
      });
    } finally {
      setGitTimelineLoadingMore(false);
    }
  }

  function appendGitCommitGraphPage(page: GitCommitGraph) {
    setGitCommitGraph((current) => mergeGitCommitGraphPage(current, page));
  }

  function appendGitFileHistoryPage(page: GitFileHistory) {
    setGitTimelineHistory((current) => mergeGitFileHistoryPage(current, page));
  }

  async function setSourceControlBranchDiffBaseRef(baseRef: string) {
    setWorkspaceSidebarTab("sourceControl");
    setWorkspaceSourceControlView("branchDiff");
    setWorkspaceSourceControlBranchDiffBaseRef(baseRef);
    await persistWorkspaceRef.current({
      sidebarTab: "sourceControl",
      sourceControlView: "branchDiff",
      sourceControlBranchDiffBaseRef: baseRef,
    });
  }

  async function showGitDiff(path = documentPayload?.path) {
    if (!path || !isSupportedDocumentPath(path)) {
      showInlineNotice("Git diff is available for markup documents only", {
        tone: "warning",
      });
      return;
    }
    const requestId = gitDiffPreviewRequestRef.current + 1;
    gitDiffPreviewRequestRef.current = requestId;
    setDocumentDiffPreview(null);
    try {
      const preview = await host.getGitDiffPreview(path);
      if (gitDiffPreviewRequestRef.current !== requestId) {
        return;
      }
      setDocumentDiffPreview({
        ...preview,
        source: preview.source ?? "git",
        leftPath: preview.leftPath ?? path,
        rightPath: preview.rightPath ?? path,
      });
      onDocumentReviewViewed?.(path);
    } catch (error) {
      if (gitDiffPreviewRequestRef.current !== requestId) {
        return;
      }
      const message =
        error instanceof Error ? error.message : "Git diff preview failed";
      showInlineNotice(message, { tone: "error" });
    }
  }

  async function showGitFileHistory(path = documentPayload?.path) {
    if (!path || !isSupportedDocumentPath(path)) {
      showInlineNotice("File History is available for markup documents only", {
        tone: "warning",
      });
      return;
    }
    setGitTimelinePath(path === documentPayload?.path ? null : path);
    await setSourceControlGraphScope("file");
  }

  async function compareWithGitRef(
    kind: GitRefKind,
    path = documentPayload?.path,
  ) {
    if (!path || !isSupportedDocumentPath(path)) {
      showInlineNotice(
        "Git ref compare is available for markup documents only",
        {
          tone: "warning",
        },
      );
      return;
    }
    setGitRefPicker({
      kind,
      path,
      refs: emptyGitRefList(),
      loading: true,
      loadingMore: false,
      query: "",
    });
    const startedAt = perfNow();
    try {
      const refs = await host.listGitRefs(path, kind, {
        limit: sourceControlInitialHistoryLimit,
      });
      tracePerf("sourceControl.listGitRefs.initial", {
        kind,
        limit: sourceControlInitialHistoryLimit,
        count: refs.items.length,
        hasMore: refs.hasMore,
        cursorPresent: false,
        durationMs: perfDuration(startedAt),
        returnedRefs: refs.metrics?.returnedRefs,
        walkedCommits: refs.metrics?.walkedCommits,
        staleCursor: refs.metrics?.staleCursor,
      });
      setGitRefPicker({
        kind,
        path,
        refs,
        loading: false,
        loadingMore: false,
        query: "",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Git reference lookup failed";
      setGitRefPicker({
        kind,
        path,
        refs: {
          status: "error",
          relativePath: null,
          items: [],
          message,
          hasMore: false,
          nextCursor: null,
        },
        loading: false,
        loadingMore: false,
        query: "",
      });
    }
  }

  async function reloadGitRefs(query: string) {
    if (!gitRefPicker) {
      return;
    }
    const { kind, path } = gitRefPicker;
    const startedAt = perfNow();
    setGitRefPicker((current) =>
      current && current.kind === kind && current.path === path
        ? { ...current, loading: true, loadingMore: false, query }
        : current,
    );
    try {
      const refs = await host.listGitRefs(path, kind, {
        limit: sourceControlInitialHistoryLimit,
        query,
      });
      tracePerf("sourceControl.listGitRefs.initial", {
        kind,
        limit: sourceControlInitialHistoryLimit,
        count: refs.items.length,
        hasMore: refs.hasMore,
        cursorPresent: false,
        queryPresent: query.trim().length > 0,
        durationMs: perfDuration(startedAt),
        returnedRefs: refs.metrics?.returnedRefs,
        walkedCommits: refs.metrics?.walkedCommits,
        staleCursor: refs.metrics?.staleCursor,
      });
      setGitRefPicker((current) =>
        current && current.kind === kind && current.path === path
          ? {
              kind,
              path,
              refs,
              loading: false,
              loadingMore: false,
              query,
            }
          : current,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Git reference lookup failed";
      setGitRefPicker((current) =>
        current && current.kind === kind && current.path === path
          ? {
              ...current,
              refs: {
                status: "error",
                relativePath: null,
                items: [],
                message,
                hasMore: false,
                nextCursor: null,
              },
              loading: false,
              loadingMore: false,
              query,
            }
          : current,
      );
    }
  }

  async function loadMoreGitRefs() {
    if (
      !gitRefPicker ||
      gitRefPicker.loading ||
      gitRefPicker.loadingMore ||
      !gitRefPicker.refs.hasMore ||
      !gitRefPicker.refs.nextCursor
    ) {
      return;
    }
    const { kind, path, query } = gitRefPicker;
    const cursor = gitRefPicker.refs.nextCursor;
    const startedAt = perfNow();
    setGitRefPicker((current) =>
      current && current.kind === kind && current.path === path
        ? { ...current, loadingMore: true }
        : current,
    );
    try {
      const page = await host.listGitRefs(path, kind, {
        limit: sourceControlHistoryPageLimit,
        cursor,
        query,
      });
      tracePerf("sourceControl.listGitRefs.page", {
        kind,
        limit: sourceControlHistoryPageLimit,
        count: page.items.length,
        hasMore: page.hasMore,
        cursorPresent: true,
        queryPresent: query.trim().length > 0,
        durationMs: perfDuration(startedAt),
        returnedRefs: page.metrics?.returnedRefs,
        walkedCommits: page.metrics?.walkedCommits,
        staleCursor: page.metrics?.staleCursor,
      });
      setGitRefPicker((current) => {
        if (!current || current.kind !== kind || current.path !== path) {
          return current;
        }
        return {
          ...current,
          refs: mergeGitRefPage(current.refs, page),
          loadingMore: false,
        };
      });
    } catch {
      tracePerf("sourceControl.listGitRefs.page.failed", {
        kind,
        durationMs: perfDuration(startedAt),
        status: "error",
      });
      setGitRefPicker((current) =>
        current && current.kind === kind && current.path === path
          ? { ...current, loadingMore: false }
          : current,
      );
    }
  }

  async function openGitRefDiff(ref: GitRefItem) {
    if (!gitRefPicker) {
      return;
    }
    try {
      const preview = await host.getGitFileRefDiff(gitRefPicker.path, ref);
      setDocumentDiffPreview(preview);
      setGitRefPicker(null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Git reference diff failed";
      showInlineNotice(message, { tone: "error" });
    }
  }

  async function openGitBranchDiffItem(item: GitBranchDiffEntry) {
    if (!gitBranchDiff?.baseRef) {
      showInlineNotice("Select a base branch before opening Branch Diff", {
        tone: "warning",
      });
      return;
    }
    try {
      const preview = await host.getGitBranchFileDiff(sourceControlAnchorPath, {
        baseRef: gitBranchDiff.baseRef,
        headRef: gitBranchDiff.headRef ?? "HEAD",
        path: item.path,
        oldPath: item.oldPath ?? null,
      });
      setDocumentDiffPreview(preview);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Branch Diff preview failed";
      showInlineNotice(message, { tone: "error" });
    }
  }

  function timelinePathOrWarn() {
    const path = effectiveGitTimelinePath;
    if (!path || !isSupportedDocumentPath(path)) {
      showInlineNotice(
        "File history comparison is available for markup documents only",
        {
          tone: "warning",
        },
      );
      return null;
    }
    return path;
  }

  async function openTimelineChanges(item: GitFileHistoryItem) {
    const path = timelinePathOrWarn();
    if (!path) {
      return;
    }
    try {
      const preview = await host.getGitFileCommitDiff(path, item.revision);
      setDocumentDiffPreview(preview);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "File history diff failed";
      showInlineNotice(message, { tone: "error" });
    }
  }

  async function openSourceControlChange(path: string | null | undefined) {
    if (!path || !isSupportedDocumentPath(path)) {
      showInlineNotice("Git diff is available for markup documents only", {
        tone: "warning",
      });
      return;
    }
    await showGitDiff(path);
  }

  async function openSourceControlGraphItem(item: GitFileHistoryItem) {
    if (workspaceSourceControlGraphScope === "file") {
      await openTimelineChanges(item);
      return;
    }
    try {
      const details = await host.getGitCommitDetails(
        sourceControlAnchorPath,
        item.revision,
      );
      setGitCommitDetails(details);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Git commit details failed";
      showInlineNotice(message, { tone: "error" });
    }
  }

  async function openTimelineSelectedCompare(item: GitFileHistoryItem) {
    const path = timelinePathOrWarn();
    if (!path || !gitTimelineCompareBase) {
      return;
    }
    if (gitTimelineCompareBase.revision === item.revision) {
      showInlineNotice("Select a different commit to compare", {
        tone: "warning",
      });
      return;
    }
    try {
      const preview = await host.getGitFileRevisionPairDiff(
        path,
        gitTimelineCompareBase.revision,
        item.revision,
      );
      setDocumentDiffPreview(preview);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Git revision compare failed";
      showInlineNotice(message, { tone: "error" });
    }
  }

  async function openGitCommitDetails(item: GitFileHistoryItem) {
    const path = timelinePathOrWarn();
    if (!path) {
      return;
    }
    try {
      const details = await host.getGitCommitDetails(path, item.revision);
      setGitCommitDetails(details);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Git commit details failed";
      showInlineNotice(message, { tone: "error" });
    }
  }

  function openTimelineItemContextMenu(
    event: ReactMouseEvent<HTMLElement>,
    item: GitFileHistoryItem,
  ) {
    const items = buildTimelineItemContextMenuItems({
      compareBase: gitTimelineCompareBase,
      copyText,
      item,
      onCompareWithSelected: () => openTimelineSelectedCompare(item),
      onOpenChanges: () => openTimelineChanges(item),
      onSelectForCompare: () => {
        setGitTimelineCompareBase(item);
        showInlineNotice(`Selected ${item.shortHash} for compare`, {
          tone: "info",
        });
      },
      onViewCommit: () => openGitCommitDetails(item),
    });
    openContextMenu(event, items, "timeline-item");
  }

  function openSourceControlChangeContextMenu(
    event: ReactMouseEvent<HTMLElement>,
    item: Parameters<
      typeof buildSourceControlChangeContextMenuItems
    >[0]["item"],
  ) {
    const items = buildSourceControlChangeContextMenuItems({
      compareWithGitRef,
      copyText,
      item,
      markNeedsAttention: onDocumentReviewNeedsAttention,
      markViewed: onDocumentReviewViewed,
      openSourceControlChange,
      resetReviewState: onDocumentReviewReset,
      showGitFileHistory,
    });
    openContextMenu(event, items, "source-control-change-item");
  }

  function openSourceControlBranchDiffContextMenu(
    event: ReactMouseEvent<HTMLElement>,
    item: GitBranchDiffEntry,
  ) {
    const items = buildSourceControlBranchDiffContextMenuItems({
      branchDiff: gitBranchDiff,
      copyText,
      item,
      openGitBranchDiffItem,
      showGitFileHistory,
    });
    openContextMenu(event, items, "source-control-branch-diff-item");
  }

  function openSourceControlGraphContextMenu(
    event: ReactMouseEvent<HTMLElement>,
    item: GitCommitGraphItem,
  ) {
    const items = buildSourceControlGraphContextMenuItems({
      compareBase: gitTimelineCompareBase,
      copyText,
      item,
      onCompareWithSelected: () => openTimelineSelectedCompare(item),
      onSelectForCompare: () => {
        setGitTimelineCompareBase(item);
        showInlineNotice(`Selected ${item.shortHash} for compare`, {
          tone: "info",
        });
      },
      onViewCommit: () => openSourceControlGraphItem(item),
    });
    openContextMenu(event, items, "source-control-graph-item");
  }

  async function openGitCommitDetailsFile(
    details: GitCommitDetails,
    path: string,
  ) {
    try {
      const preview = await host.getGitFileCommitDiff(path, details.revision);
      setDocumentDiffPreview(preview);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Git commit file diff failed";
      showInlineNotice(message, { tone: "error" });
    }
  }

  return {
    effectiveGitTimelinePath,
    gitBranchDiff,
    gitBranchDiffLoading,
    gitChanges,
    gitChangesLoading,
    gitCommitDetails,
    gitCommitGraph,
    gitCommitGraphLoading,
    gitCommitGraphLoadingMore,
    gitRefPicker,
    gitTimelineCompareBase,
    gitTimelineHistory,
    gitTimelineLoading,
    gitTimelineLoadingMore,
    openGitBranchDiffItem,
    openGitCommitDetailsFile,
    openGitRefDiff,
    openSourceControlChange,
    openSourceControlChangeContextMenu,
    openSourceControlBranchDiffContextMenu,
    openSourceControlGraphContextMenu,
    openSourceControlGraphItem,
    openTimelineChanges,
    openTimelineItemContextMenu,
    setGitCommitDetails,
    setGitRefPicker,
    setSidebarTab,
    setSourceControlBranchDiffBaseRef,
    setSourceControlGraphScope,
    loadMoreGitCommitGraph,
    loadMoreGitFileHistory,
    loadMoreGitRefs,
    reloadGitRefs,
    refreshGitChanges,
    reviewAgentChanges,
    setSourceControlView,
    showGitDiff,
    showGitFileHistory,
    compareWithGitRef,
  };
}
