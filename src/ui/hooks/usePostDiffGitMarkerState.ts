import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { isSupportedDocumentPath } from "../../core/documentFormat";
import type {
  AppConfig,
  DocumentDiffPreview,
  DocumentPayload,
  GitChanges,
  KrokiRequest,
  KrokiResult,
  LocalImageResult,
  RenderResult,
} from "../../core/types";
import type { DiffPreviewCloseHandoff } from "../components/GitDiffPreviewPanel";
import {
  buildPostDiffGitMarkerContext,
  buildRenderedDiffPresentation,
  deriveGitRenderedDiffSummary,
} from "../lib/gitRenderedDiff";
import { perfBasename, tracePerf } from "../lib/perfTrace";
import {
  shouldInvalidatePostDiffGitMarkersForWorkspaceFileChange,
  shouldRefreshPostDiffGitMarkersForGitChanges,
} from "../lib/postDiffGitMarkerRefresh";
import type { ViewerPostDiffGitMarkerContext } from "../types";

interface WorkspaceFileChangeRefreshEvent {
  reason: string;
  changedPath: string | null;
}

interface UsePostDiffGitMarkerStateInput {
  config: AppConfig | null;
  documentPayload: DocumentPayload | null;
  documentDiffPreview: DocumentDiffPreview | null;
  renderResult: RenderResult | null;
  confirmedRemoteDiagramKeys: ReadonlySet<string>;
  krokiFallbackDiagramKeys: ReadonlySet<string>;
  getGitDiffPreview: (path: string) => Promise<DocumentDiffPreview>;
  loadDiffDocumentContext: (
    documentPath: string,
  ) => Promise<Pick<DocumentPayload, "includeFiles" | "asciidocContext"> | null>;
  resolveDiffLocalImage: (
    source: string,
    documentPath: string,
    context: DocumentPayload["asciidocContext"],
  ) => Promise<LocalImageResult>;
  renderDiffDiagram: (request: KrokiRequest) => Promise<KrokiResult>;
  setDocumentDiffPreview: (preview: DocumentDiffPreview | null) => void;
}

interface UsePostDiffGitMarkerStateResult {
  activePostDiffGitMarkers: ViewerPostDiffGitMarkerContext | null;
  closeDocumentDiffPreview: (handoff?: DiffPreviewCloseHandoff) => void;
  invalidatePostDiffGitMarkersForActiveDocument: (reason: string) => void;
  handleGitChangesRefreshComplete: (
    reason: string,
    changes: GitChanges,
  ) => void;
  handleWorkspaceFileChangeRefresh: (
    event: WorkspaceFileChangeRefreshEvent,
    refreshGitChanges: (reason?: string) => void,
  ) => void;
}

function sortedValues(values: ReadonlySet<string>): string[] {
  return Array.from(values).sort();
}

function postDiffGitMarkerRenderSignature({
  config,
  confirmedRemoteDiagramKeys,
  krokiFallbackDiagramKeys,
}: {
  config: AppConfig;
  confirmedRemoteDiagramKeys: ReadonlySet<string>;
  krokiFallbackDiagramKeys: ReadonlySet<string>;
}): string {
  return JSON.stringify({
    theme: config.theme,
    diagram: config.diagram,
    kroki: config.kroki,
    security: config.security,
    diagramPlaceholderRendering:
      config.experimental.diagramPlaceholderRendering,
    confirmedRemoteDiagramKeys: sortedValues(confirmedRemoteDiagramKeys),
    krokiFallbackDiagramKeys: sortedValues(krokiFallbackDiagramKeys),
  });
}

function gitDiffPreviewHandoffSignature(preview: DocumentDiffPreview): string {
  return JSON.stringify({
    leftLabel: preview.leftLabel,
    relativePath: preview.relativePath ?? null,
    rightLabel: preview.rightLabel,
    status: preview.status,
    hunks: preview.hunks,
  });
}

function postDiffGitMarkerContextSignature(
  context: ViewerPostDiffGitMarkerContext,
): string {
  return JSON.stringify({
    renderedCount: context.renderedCount,
    totalCount: context.totalCount,
    markers: context.markers,
    tableSummary: context.tableSummary ?? null,
  });
}

export function usePostDiffGitMarkerState({
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
  setDocumentDiffPreview,
}: UsePostDiffGitMarkerStateInput): UsePostDiffGitMarkerStateResult {
  const [postDiffGitMarkersByPath, setPostDiffGitMarkersByPath] = useState<
    Record<string, ViewerPostDiffGitMarkerContext>
  >({});
  const [postDiffGitMarkerRefreshToken, setPostDiffGitMarkerRefreshToken] =
    useState(0);
  const initialPostDiffGitMarkerSignaturesRef = useRef<Record<string, string>>(
    {},
  );
  const initialPostDiffGitMarkerGenerationRef = useRef(0);
  const closePostDiffGitMarkerGenerationRef = useRef(0);
  const pendingPostDiffGitMarkerRefreshPathsRef = useRef<Map<string, string>>(
    new Map(),
  );
  const activeDocumentPathRef = useRef<string | null>(
    documentPayload?.path ?? null,
  );

  activeDocumentPathRef.current = documentPayload?.path ?? null;

  const activePostDiffGitMarkers = useMemo(() => {
    const path = documentPayload?.path ?? null;
    return path ? (postDiffGitMarkersByPath[path] ?? null) : null;
  }, [documentPayload?.path, postDiffGitMarkersByPath]);

  const clearPostDiffGitMarkers = useCallback(
    (reason: string) => {
      setPostDiffGitMarkersByPath((current) => {
        const activePath = documentPayload?.path ?? null;
        if (!activePath) {
          return current;
        }
        const markerContext = current[activePath];
        if (!markerContext) {
          return current;
        }
        tracePerf("postDiffGitMarkers.clear", {
          basename: perfBasename(markerContext.documentPath),
          markerCount: markerContext.totalCount,
          renderedCount: markerContext.renderedCount,
          reason,
          cleared: true,
        });
        const next = { ...current };
        delete next[activePath];
        return next;
      });
    },
    [documentPayload?.path],
  );

  const invalidatePostDiffGitMarkersForActiveDocument = useCallback(
    (reason: string) => {
      const path = documentPayload?.path ?? null;
      if (!path) {
        return;
      }
      delete initialPostDiffGitMarkerSignaturesRef.current[path];
      clearPostDiffGitMarkers(reason);
      setPostDiffGitMarkerRefreshToken((current) => current + 1);
    },
    [clearPostDiffGitMarkers, documentPayload?.path],
  );

  const refreshPostDiffGitMarkersForActiveDocument = useCallback(
    (reason: string) => {
      const path = documentPayload?.path ?? null;
      if (!path) {
        return;
      }
      delete initialPostDiffGitMarkerSignaturesRef.current[path];
      pendingPostDiffGitMarkerRefreshPathsRef.current.set(path, reason);
      tracePerf("postDiffGitMarkers.refreshKeep", {
        basename: perfBasename(path),
        reason,
      });
      setPostDiffGitMarkerRefreshToken((current) => current + 1);
    },
    [documentPayload?.path],
  );

  const closeDocumentDiffPreview = useCallback(
    (handoff?: DiffPreviewCloseHandoff) => {
      setDocumentDiffPreview(null);
      const generation = closePostDiffGitMarkerGenerationRef.current + 1;
      closePostDiffGitMarkerGenerationRef.current = generation;

      if (
        !handoff ||
        !config?.experimental.postDiffGitMarkers ||
        !documentPayload
      ) {
        clearPostDiffGitMarkers(
          handoff ? "disabled-or-missing-document" : "no-handoff",
        );
        return;
      }

      const activePath = documentPayload.path;
      const closeHandoff = handoff;
      const documentUpdatedAt = documentPayload.updatedAt ?? null;

      async function commitWorkingTreeHandoff() {
        try {
          const workingTreePreview = await getGitDiffPreview(activePath);
          if (
            closePostDiffGitMarkerGenerationRef.current !== generation ||
            activeDocumentPathRef.current !== activePath
          ) {
            return;
          }
          if (
            workingTreePreview.status === "clean" ||
            workingTreePreview.hunks.length === 0
          ) {
            clearPostDiffGitMarkers("handoff-working-tree-clean");
            tracePerf("postDiffGitMarkers.handoffSkip", {
              basename: perfBasename(activePath),
              reason:
                workingTreePreview.status === "clean" ? "clean" : "empty",
              status: workingTreePreview.status,
            });
            return;
          }
          if (
            gitDiffPreviewHandoffSignature(workingTreePreview) !==
            gitDiffPreviewHandoffSignature(closeHandoff.preview)
          ) {
            clearPostDiffGitMarkers("history-or-non-working-tree");
            tracePerf("postDiffGitMarkers.handoffSkip", {
              basename: perfBasename(activePath),
              reason: "history-or-non-working-tree",
              status: workingTreePreview.status,
            });
            return;
          }

          const context = buildPostDiffGitMarkerContext({
            activeDocumentPath: activePath,
            preview: closeHandoff.preview,
            renderedPresentation: closeHandoff.renderedPresentation,
          });

          if (!context) {
            clearPostDiffGitMarkers("no-matching-context");
            return;
          }

          const nextContext: ViewerPostDiffGitMarkerContext = {
            ...context,
            documentPath: activePath,
            documentUpdatedAt,
          };
          setPostDiffGitMarkersByPath((current) => ({
            ...current,
            [activePath]: nextContext,
          }));
          tracePerf("postDiffGitMarkers.context", {
            basename: perfBasename(activePath),
            markerCount: context.totalCount,
            renderedCount: context.renderedCount,
            visible: context.renderedCount > 0,
          });
        } catch {
          if (
            closePostDiffGitMarkerGenerationRef.current !== generation ||
            activeDocumentPathRef.current !== activePath
          ) {
            return;
          }
          clearPostDiffGitMarkers("handoff-working-tree-error");
          tracePerf("postDiffGitMarkers.handoffSkip", {
            basename: perfBasename(activePath),
            reason: "error",
          });
        }
      }

      void commitWorkingTreeHandoff();
    },
    [
      clearPostDiffGitMarkers,
      config?.experimental.postDiffGitMarkers,
      documentPayload,
      getGitDiffPreview,
      setDocumentDiffPreview,
    ],
  );

  const handleWorkspaceFileChangeRefresh = useCallback(
    (
      event: WorkspaceFileChangeRefreshEvent,
      refreshGitChanges: (reason?: string) => void,
    ) => {
      const reason = `file-tree-${event.reason}`;
      const decision =
        shouldInvalidatePostDiffGitMarkersForWorkspaceFileChange({
          activeDocumentPath: documentPayload?.path ?? null,
          changedPath: event.changedPath,
          reason,
        });
      if (decision.shouldInvalidate) {
        refreshPostDiffGitMarkersForActiveDocument("git-refresh");
      } else {
        tracePerf("postDiffGitMarkers.refreshSkip", decision.trace);
      }
      refreshGitChanges(reason);
    },
    [documentPayload?.path, refreshPostDiffGitMarkersForActiveDocument],
  );

  const handleGitChangesRefreshComplete = useCallback(
    (reason: string, changes: GitChanges) => {
      const activePath = documentPayload?.path ?? null;
      const decision = shouldRefreshPostDiffGitMarkersForGitChanges({
        activeDocumentPath: activePath,
        changes,
        hasActiveMarkerContext: Boolean(
          activePath && postDiffGitMarkersByPath[activePath],
        ),
        reason,
      });
      if (decision.shouldRefresh) {
        refreshPostDiffGitMarkersForActiveDocument("git-metadata-refresh");
      } else {
        tracePerf("postDiffGitMarkers.refreshSkip", decision.trace);
      }
    },
    [
      documentPayload?.path,
      postDiffGitMarkersByPath,
      refreshPostDiffGitMarkersForActiveDocument,
    ],
  );

  useEffect(() => {
    if (documentDiffPreview) {
      clearPostDiffGitMarkers("diff-preview-open");
    }
  }, [clearPostDiffGitMarkers, documentDiffPreview]);

  useEffect(() => {
    if (!config?.experimental.postDiffGitMarkers) {
      initialPostDiffGitMarkerSignaturesRef.current = {};
      setPostDiffGitMarkersByPath((current) => {
        Object.values(current).forEach((markerContext) => {
          tracePerf("postDiffGitMarkers.clear", {
            basename: perfBasename(markerContext.documentPath),
            markerCount: markerContext.totalCount,
            renderedCount: markerContext.renderedCount,
            reason: "setting-disabled",
            cleared: true,
          });
        });
        return {};
      });
    }
  }, [config?.experimental.postDiffGitMarkers]);

  useEffect(() => {
    const path = documentPayload?.path ?? null;
    if (!config?.experimental.postDiffGitMarkers || !documentPayload || !path) {
      return;
    }
    if (!renderResult) {
      return;
    }
    if (documentDiffPreview) {
      return;
    }
    if (!isSupportedDocumentPath(path)) {
      clearPostDiffGitMarkers("unsupported-document");
      return;
    }

    const activePath = path;
    const documentUpdatedAt = documentPayload.updatedAt ?? null;
    const existingContext = postDiffGitMarkersByPath[activePath] ?? null;
    const hasPendingRefresh =
      pendingPostDiffGitMarkerRefreshPathsRef.current.has(activePath);
    const pendingRefreshReason =
      pendingPostDiffGitMarkerRefreshPathsRef.current.get(activePath) ?? null;
    const shouldPreserveExistingContextOnRefreshMiss =
      Boolean(existingContext) &&
      pendingRefreshReason === "git-metadata-refresh";
    if (
      existingContext &&
      (existingContext.documentUpdatedAt ?? null) === documentUpdatedAt &&
      !hasPendingRefresh
    ) {
      return;
    }
    if (existingContext && !hasPendingRefresh) {
      clearPostDiffGitMarkers("document-updated");
    }

    const renderSignature = postDiffGitMarkerRenderSignature({
      config,
      confirmedRemoteDiagramKeys,
      krokiFallbackDiagramKeys,
    });
    const requestSignature = JSON.stringify({
      path: activePath,
      updatedAt: documentUpdatedAt,
      refreshToken: postDiffGitMarkerRefreshToken,
      renderSignature,
    });
    if (
      initialPostDiffGitMarkerSignaturesRef.current[activePath] ===
      requestSignature
    ) {
      return;
    }

    const generation = initialPostDiffGitMarkerGenerationRef.current + 1;
    initialPostDiffGitMarkerGenerationRef.current = generation;
    let cancelled = false;

    async function buildInitialMarkerContext() {
      try {
        const preview = await getGitDiffPreview(activePath);
        if (cancelled) {
          return;
        }
        if (preview.status === "clean" || preview.hunks.length === 0) {
          pendingPostDiffGitMarkerRefreshPathsRef.current.delete(activePath);
          clearPostDiffGitMarkers("initial-clean");
          tracePerf("postDiffGitMarkers.initialSkip", {
            basename: perfBasename(activePath),
            status: preview.status,
            reason: preview.status === "clean" ? "clean" : "empty",
          });
          return;
        }
        const renderedSummary = await deriveGitRenderedDiffSummary(preview, {
          config,
          loadDocumentContext: loadDiffDocumentContext,
          resolveLocalImage: resolveDiffLocalImage,
          renderDiagram: renderDiffDiagram,
          confirmedRemoteDiagramKeys,
          krokiFallbackDiagramKeys,
        });
        if (
          cancelled ||
          initialPostDiffGitMarkerGenerationRef.current !== generation
        ) {
          return;
        }
        const renderedPresentation = buildRenderedDiffPresentation(
          renderedSummary.blocks,
        );
        const context = buildPostDiffGitMarkerContext({
          activeDocumentPath: activePath,
          preview,
          renderedPresentation,
        });
        if (!context) {
          pendingPostDiffGitMarkerRefreshPathsRef.current.delete(activePath);
          if (shouldPreserveExistingContextOnRefreshMiss) {
            tracePerf("postDiffGitMarkers.initialSkip", {
              basename: perfBasename(activePath),
              status: preview.status,
              reason: "no-matching-context-preserved",
            });
            return;
          }
          clearPostDiffGitMarkers("initial-no-matching-context");
          tracePerf("postDiffGitMarkers.initialSkip", {
            basename: perfBasename(activePath),
            status: preview.status,
            reason: "no-matching-context",
          });
          return;
        }
        const nextContext: ViewerPostDiffGitMarkerContext = {
          ...context,
          documentPath: activePath,
          documentUpdatedAt,
        };
        initialPostDiffGitMarkerSignaturesRef.current[activePath] =
          requestSignature;
        pendingPostDiffGitMarkerRefreshPathsRef.current.delete(activePath);
        setPostDiffGitMarkersByPath((current) => {
          const previousContext = current[activePath] ?? null;
          if (
            previousContext &&
            postDiffGitMarkerContextSignature(previousContext) ===
              postDiffGitMarkerContextSignature(nextContext)
          ) {
            tracePerf("postDiffGitMarkers.refreshKeep", {
              basename: perfBasename(activePath),
              reason: "same-context",
              markerCount: context.totalCount,
              renderedCount: context.renderedCount,
            });
            return current;
          }
          return {
            ...current,
            [activePath]: nextContext,
          };
        });
        tracePerf("postDiffGitMarkers.initialContext", {
          basename: perfBasename(activePath),
          status: preview.status,
          markerCount: context.totalCount,
          renderedCount: context.renderedCount,
          visible: context.renderedCount > 0,
        });
      } catch {
        if (cancelled) {
          return;
        }
        pendingPostDiffGitMarkerRefreshPathsRef.current.delete(activePath);
        if (shouldPreserveExistingContextOnRefreshMiss) {
          tracePerf("postDiffGitMarkers.initialSkip", {
            basename: perfBasename(activePath),
            reason: "error-preserved",
          });
          return;
        }
        clearPostDiffGitMarkers("initial-error");
        tracePerf("postDiffGitMarkers.initialSkip", {
          basename: perfBasename(activePath),
          reason: "error",
        });
      }
    }

    void buildInitialMarkerContext();

    return () => {
      cancelled = true;
    };
  }, [
    clearPostDiffGitMarkers,
    config,
    confirmedRemoteDiagramKeys,
    documentDiffPreview,
    documentPayload,
    getGitDiffPreview,
    krokiFallbackDiagramKeys,
    loadDiffDocumentContext,
    postDiffGitMarkersByPath,
    postDiffGitMarkerRefreshToken,
    renderResult,
    renderDiffDiagram,
    resolveDiffLocalImage,
  ]);

  return {
    activePostDiffGitMarkers,
    closeDocumentDiffPreview,
    handleGitChangesRefreshComplete,
    invalidatePostDiffGitMarkersForActiveDocument,
    handleWorkspaceFileChangeRefresh,
  };
}
