import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

import type {
  AppConfig,
  DocumentDiffPreview,
  DocumentDiffStreamPreview,
  DocumentPayload,
  GitChanges,
  HostAdapter,
  RenderResult,
  WorkspacePerformanceMode,
} from "../../core/types";
import type { ContextMenuItem, InlineNoticeOptions } from "../types";
import {
  freshDiffPreviewWatchState,
  watchedGitDiffPreviewPath,
  type DiffPreviewWatchReason,
  type DiffPreviewWatchState,
} from "../lib/diffPreviewWatch";
import { uniqueDocumentReviewPaths } from "../lib/documentReviewSession";
import { buildDocumentDiffStreamItems } from "../lib/documentDiffStream";
import { shouldInvalidatePostDiffGitMarkersForGitRefreshReason } from "../lib/postDiffGitMarkerRefresh";
import { useDocumentReviewSession } from "./useDocumentReviewSession";
import { usePostDiffGitMarkerState } from "./usePostDiffGitMarkerState";
import { useSourceControlActions } from "./useSourceControlActions";

type RefreshSourceControlEvent = {
  reason: string;
  changedPath: string | null;
};

export function useAppSourceControlReview({
  activeDocumentPayload,
  confirmedRemoteDiagramKeys,
  config,
  copyText,
  documentDiffPreview,
  documentPayload,
  getGitDiffPreview,
  host,
  krokiFallbackDiagramKeys,
  loadDiffDocumentContext,
  openContextMenu,
  persistWorkspace,
  renderDiffDiagram,
  renderResult,
  resolveDiffLocalImage,
  rootDirectory,
  setDocumentDiffPreview,
  showInlineNotice,
  workspacePerformanceMode,
}: {
  activeDocumentPayload: DocumentPayload | null;
  confirmedRemoteDiagramKeys: ReadonlySet<string>;
  config: AppConfig | null;
  copyText: (label: string, value: string) => void | Promise<void>;
  documentDiffPreview: DocumentDiffPreview | null;
  documentPayload: DocumentPayload | null;
  getGitDiffPreview: (path: string) => Promise<DocumentDiffPreview>;
  host: HostAdapter;
  krokiFallbackDiagramKeys: ReadonlySet<string>;
  loadDiffDocumentContext: (
    path: string,
  ) => Promise<Pick<
    DocumentPayload,
    "includeFiles" | "resourceContext" | "asciidocContext"
  > | null>;
  openContextMenu: (
    event: ReactMouseEvent<HTMLElement>,
    items: ContextMenuItem[],
    source: string,
  ) => void;
  persistWorkspace: (patch: Partial<AppConfig["workspace"]>) => Promise<void>;
  renderDiffDiagram: Parameters<
    typeof usePostDiffGitMarkerState
  >[0]["renderDiffDiagram"];
  renderResult: RenderResult | null;
  resolveDiffLocalImage: Parameters<
    typeof usePostDiffGitMarkerState
  >[0]["resolveDiffLocalImage"];
  rootDirectory: string;
  setDocumentDiffPreview: (preview: DocumentDiffPreview | null) => void;
  showInlineNotice: (message: string, options?: InlineNoticeOptions) => void;
  workspacePerformanceMode: WorkspacePerformanceMode;
}) {
  const [documentDiffStreamPreview, setDocumentDiffStreamPreview] =
    useState<DocumentDiffStreamPreview | null>(null);
  const [diffPreviewWatchState, setDiffPreviewWatchState] =
    useState<DiffPreviewWatchState>(freshDiffPreviewWatchState);
  const diffPreviewRefreshRequestRef = useRef(0);
  const documentReviewViewedRef = useRef<((path: string) => void) | null>(null);
  const documentReviewNeedsAttentionRef = useRef<
    ((path: string) => void) | null
  >(null);
  const documentReviewResetRef = useRef<((path: string) => void) | null>(null);
  const activeDiffPreviewWatchPath = useMemo(
    () => watchedGitDiffPreviewPath(documentDiffPreview),
    [documentDiffPreview],
  );

  const setFreshDocumentDiffPreview = useCallback(
    (preview: DocumentDiffPreview | null) => {
      setDocumentDiffPreview(preview);
      if (preview) {
        setDocumentDiffStreamPreview(null);
      }
      setDiffPreviewWatchState(freshDiffPreviewWatchState);
    },
    [setDocumentDiffPreview],
  );

  useEffect(() => {
    if (!activeDiffPreviewWatchPath) {
      setDiffPreviewWatchState(freshDiffPreviewWatchState);
    }
  }, [activeDiffPreviewWatchPath]);

  const {
    activePostDiffGitMarkers,
    closeDocumentDiffPreview,
    handleGitChangesRefreshComplete,
    handleWorkspaceFileChangeRefresh,
    invalidatePostDiffGitMarkersForActiveDocument,
    resolveRevisionLensTargets,
  } = usePostDiffGitMarkerState({
    config,
    documentPayload,
    documentDiffPreview,
    renderResult,
    confirmedRemoteDiagramKeys,
    krokiFallbackDiagramKeys,
    getGitDiffPreview,
    loadDiffDocumentContext,
    resolveDiffLocalImage,
    renderDiffDiagram,
    setDocumentDiffPreview: setFreshDocumentDiffPreview,
  });

  const markActiveDiffPreviewStale = useCallback(
    (reason: DiffPreviewWatchReason) => {
      if (!activeDiffPreviewWatchPath) {
        return;
      }
      setDiffPreviewWatchState((current) =>
        current.status === "refreshing"
          ? current
          : {
              status: "stale",
              reason,
              message: "Preview changed on disk",
            },
      );
    },
    [activeDiffPreviewWatchPath],
  );

  const handleReviewWatchGitChangesRefreshComplete = useCallback(
    (reason: string, changes: GitChanges) => {
      handleGitChangesRefreshComplete(reason, changes);
      if (reason === "metadata-event" || reason === "visibility-restore") {
        markActiveDiffPreviewStale(reason);
        setDocumentDiffStreamPreview((current) =>
          current
            ? {
                ...current,
                watchStatus:
                  current.watchStatus === "refreshing" ? "refreshing" : "stale",
                message: "Changed files were updated",
              }
            : current,
        );
      }
    },
    [handleGitChangesRefreshComplete, markActiveDiffPreviewStale],
  );

  const refreshActiveDiffPreview = useCallback(async () => {
    const path = activeDiffPreviewWatchPath;
    if (!path) {
      return;
    }
    const requestId = diffPreviewRefreshRequestRef.current + 1;
    diffPreviewRefreshRequestRef.current = requestId;
    setDiffPreviewWatchState((current) => ({
      status: "refreshing",
      reason: current.reason,
      message: "Preview changed on disk",
    }));
    try {
      const preview = await getGitDiffPreview(path);
      if (diffPreviewRefreshRequestRef.current !== requestId) {
        return;
      }
      setFreshDocumentDiffPreview({
        ...preview,
        source: preview.source ?? "git",
        leftPath: preview.leftPath ?? path,
        rightPath: preview.rightPath ?? path,
      });
      documentReviewViewedRef.current?.(path);
    } catch (error) {
      if (diffPreviewRefreshRequestRef.current !== requestId) {
        return;
      }
      setDiffPreviewWatchState({
        status: "blocked",
        message: "Preview refresh blocked",
      });
      showInlineNotice(
        error instanceof Error ? error.message : "Preview refresh blocked",
        { tone: "warning" },
      );
    }
  }, [
    activeDiffPreviewWatchPath,
    getGitDiffPreview,
    setFreshDocumentDiffPreview,
    showInlineNotice,
  ]);

  const sourceControl = useSourceControlActions({
    config,
    copyText,
    documentPayload: activeDocumentPayload,
    host,
    openContextMenu,
    onGitChangesRefreshComplete: handleReviewWatchGitChangesRefreshComplete,
    onDocumentReviewNeedsAttention: (path) =>
      documentReviewNeedsAttentionRef.current?.(path),
    onDocumentReviewReset: (path) => documentReviewResetRef.current?.(path),
    onDocumentReviewViewed: (path) => documentReviewViewedRef.current?.(path),
    onGitRefresh: (reason) => {
      if (shouldInvalidatePostDiffGitMarkersForGitRefreshReason(reason)) {
        invalidatePostDiffGitMarkersForActiveDocument("git-refresh");
      }
    },
    persistWorkspace,
    rootDirectory,
    setDocumentDiffPreview: setFreshDocumentDiffPreview,
    workspacePerformanceMode,
    showInlineNotice,
  });

  const openSourceControlAllDiffs = useCallback(
    (preview: DocumentDiffStreamPreview) => {
      setDocumentDiffPreview(null);
      setDocumentDiffStreamPreview(preview);
    },
    [setDocumentDiffPreview],
  );

  const openDocumentDiffPreviewFromStream = useCallback(
    (preview: DocumentDiffPreview) => {
      setFreshDocumentDiffPreview(preview);
    },
    [setFreshDocumentDiffPreview],
  );

  const refreshDocumentDiffStream = useCallback(() => {
    setDocumentDiffStreamPreview((current) =>
      current
        ? {
            ...current,
            watchStatus: "refreshing",
            message: "Refreshing changed files",
          }
        : current,
    );
    sourceControl.refreshGitChanges("all-diffs-refresh");
  }, [sourceControl]);

  useEffect(() => {
    if (
      !documentDiffStreamPreview ||
      documentDiffStreamPreview.watchStatus !== "refreshing" ||
      sourceControl.gitChanges?.status !== "ok"
    ) {
      return;
    }
    setDocumentDiffStreamPreview((current) =>
      current?.watchStatus === "refreshing"
        ? {
            ...current,
            repositoryRoot: sourceControl.gitChanges?.repositoryRoot,
            items: buildDocumentDiffStreamItems(
              sourceControl.gitChanges?.items ?? [],
              { repositoryRoot: sourceControl.gitChanges?.repositoryRoot },
            ),
            watchStatus: "fresh",
            message: null,
          }
        : current,
    );
  }, [documentDiffStreamPreview, sourceControl.gitChanges]);

  const documentReviewTargetPaths = useMemo(
    () =>
      uniqueDocumentReviewPaths(
        sourceControl.gitChanges?.status === "ok"
          ? sourceControl.gitChanges.items
              .map((item) => item.documentPath)
              .filter((path): path is string => Boolean(path))
          : [],
      ),
    [sourceControl.gitChanges],
  );
  const documentReviewSession = useDocumentReviewSession(
    documentReviewTargetPaths,
  );

  useEffect(() => {
    documentReviewViewedRef.current = documentReviewSession.markViewed;
    documentReviewNeedsAttentionRef.current =
      documentReviewSession.markNeedsAttention;
    documentReviewResetRef.current = documentReviewSession.reset;
    return () => {
      documentReviewViewedRef.current = null;
      documentReviewNeedsAttentionRef.current = null;
      documentReviewResetRef.current = null;
    };
  }, [
    documentReviewSession.markNeedsAttention,
    documentReviewSession.markViewed,
    documentReviewSession.reset,
  ]);

  const refreshSourceControlFromFileTree = useCallback(
    (event: RefreshSourceControlEvent) => {
      if (
        activeDiffPreviewWatchPath &&
        event.changedPath === activeDiffPreviewWatchPath
      ) {
        markActiveDiffPreviewStale("file-watch");
      }
      handleWorkspaceFileChangeRefresh(event, sourceControl.refreshGitChanges);
    },
    [
      activeDiffPreviewWatchPath,
      handleWorkspaceFileChangeRefresh,
      markActiveDiffPreviewStale,
      sourceControl.refreshGitChanges,
    ],
  );

  return {
    activeDiffPreviewWatchPath,
    activePostDiffGitMarkers,
    closeDocumentDiffPreview,
    closeDocumentDiffStreamPreview: () => setDocumentDiffStreamPreview(null),
    diffPreviewWatchState,
    documentDiffStreamPreview,
    documentReviewSession,
    openDocumentDiffPreviewFromStream,
    openSourceControlAllDiffs,
    refreshActiveDiffPreview,
    refreshDocumentDiffStream,
    refreshSourceControlFromFileTree,
    resolveRevisionLensTargets,
    sourceControl,
  };
}
