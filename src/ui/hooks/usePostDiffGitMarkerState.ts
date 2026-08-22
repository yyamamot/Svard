import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { isSupportedDocumentPath } from "../../core/documentFormat";
import { isLineDiffTooComplex } from "../../core/types";
import type {
  AppConfig,
  DocumentDiffPreview,
  DocumentPayload,
  GitChanges,
  KrokiRequest,
  KrokiResult,
  LocalImageResolveContext,
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
import type {
  ResolveRevisionLensTargets,
  RevisionLensResolvedTarget,
  ViewerPostDiffGitMarkerContext,
} from "../types";

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
  ) => Promise<Pick<
    DocumentPayload,
    "includeFiles" | "resourceContext" | "asciidocContext"
  > | null>;
  resolveDiffLocalImage: (
    source: string,
    documentPath: string,
    context: LocalImageResolveContext | null | undefined,
  ) => Promise<LocalImageResult>;
  renderDiffDiagram: (request: KrokiRequest) => Promise<KrokiResult>;
  setDocumentDiffPreview: (preview: DocumentDiffPreview | null) => void;
  deriveRenderedDiffSummary?: typeof deriveGitRenderedDiffSummary;
}

interface UsePostDiffGitMarkerStateResult {
  activePostDiffGitMarkers: ViewerPostDiffGitMarkerContext | null;
  resolveRevisionLensTargets: ResolveRevisionLensTargets;
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
    lineDiffAvailability: preview.lineDiffAvailability ?? "available",
    hunks: preview.hunks,
  });
}

function previewTargetsDocument(
  preview: DocumentDiffPreview,
  documentPath: string,
): boolean {
  if (preview.leftPath === documentPath || preview.rightPath === documentPath) {
    return true;
  }
  if (preview.source === "file" || !preview.relativePath) {
    return false;
  }
  const normalizedDocumentPath = documentPath.replaceAll("\\", "/");
  const normalizedRelativePath = preview.relativePath
    .replaceAll("\\", "/")
    .replace(/^\.\//u, "")
    .replace(/^\/+|\/+$/gu, "");
  return Boolean(
    normalizedRelativePath &&
    (normalizedDocumentPath === normalizedRelativePath ||
      normalizedDocumentPath.endsWith(`/${normalizedRelativePath}`)),
  );
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
  deriveRenderedDiffSummary = deriveGitRenderedDiffSummary,
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
  const revisionLensAbortControllerRef = useRef<AbortController | null>(null);
  const pendingPostDiffGitMarkerRefreshPathsRef = useRef<Map<string, string>>(
    new Map(),
  );
  const blockedPostDiffGitMarkerDocumentVersionsRef = useRef<
    Record<string, string | null>
  >({});
  const activeDocumentPathRef = useRef<string | null>(
    documentPayload?.path ?? null,
  );

  activeDocumentPathRef.current = documentPayload?.path ?? null;

  useEffect(
    () => () => {
      revisionLensAbortControllerRef.current?.abort();
      revisionLensAbortControllerRef.current = null;
    },
    [documentPayload?.path],
  );

  const activePostDiffGitMarkers = useMemo(() => {
    const path = documentPayload?.path ?? null;
    return path ? (postDiffGitMarkersByPath[path] ?? null) : null;
  }, [documentPayload?.path, postDiffGitMarkersByPath]);

  const resolveRevisionLensTargets = useCallback<ResolveRevisionLensTargets>(
    async (targets) => {
      revisionLensAbortControllerRef.current?.abort();
      const controller = new AbortController();
      revisionLensAbortControllerRef.current = controller;
      const activePath = documentPayload?.path ?? null;
      const unavailable = (): RevisionLensResolvedTarget[] =>
        targets.map((target) => ({ ...target, status: "unavailable" }));
      if (
        !activePath ||
        !config?.experimental.postDiffGitMarkers ||
        targets.length === 0
      ) {
        return unavailable();
      }
      try {
        const preview = await getGitDiffPreview(activePath);
        if (
          activeDocumentPathRef.current !== activePath ||
          preview.rightLabel !== "Working Tree" ||
          isLineDiffTooComplex(preview) ||
          !previewTargetsDocument(preview, activePath)
        ) {
          return unavailable();
        }
        const summary = await deriveRenderedDiffSummary(preview, {
          config,
          loadDocumentContext: loadDiffDocumentContext,
          resolveLocalImage: resolveDiffLocalImage,
          renderDiagram: async () => ({
            status: "disabled",
            cacheStatus: "disabled",
          }),
          confirmedRemoteDiagramKeys: new Set<string>(),
          krokiFallbackDiagramKeys: new Set<string>(),
          perfOwner: "normal-viewer-marker",
          signal: controller.signal,
        });
        if (
          controller.signal.aborted ||
          activeDocumentPathRef.current !== activePath
        ) {
          return unavailable();
        }
        const blocks = new Map(
          summary.blocks.map((block) => [block.id, block]),
        );
        return targets.map((target): RevisionLensResolvedTarget => {
          const block = blocks.get(target.diffBlockId);
          if (!block) {
            return { ...target, status: "unavailable" };
          }
          if (block.kind === "added") {
            return { ...target, status: "added", blockKind: block.blockKind };
          }
          const base = block.left;
          if (!base) {
            return { ...target, status: "unavailable" };
          }
          if (block.blockKind === "diagram" && !/<svg\b/iu.test(base.html)) {
            return {
              ...target,
              status: "unavailable",
              blockKind: block.blockKind,
            };
          }
          return {
            ...target,
            status:
              target.kind === "removed" || block.kind === "removed"
                ? "removed"
                : "base",
            blockKind: block.blockKind,
            html: base.html,
            hideCurrent: block.kind !== "removed",
          };
        });
      } catch {
        return unavailable();
      }
    },
    [
      config,
      documentPayload?.path,
      deriveRenderedDiffSummary,
      getGitDiffPreview,
      loadDiffDocumentContext,
      resolveDiffLocalImage,
    ],
  );

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
      delete blockedPostDiffGitMarkerDocumentVersionsRef.current[path];
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
      delete blockedPostDiffGitMarkerDocumentVersionsRef.current[path];
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

      if (isLineDiffTooComplex(closeHandoff.preview)) {
        if (previewTargetsDocument(closeHandoff.preview, activePath)) {
          blockedPostDiffGitMarkerDocumentVersionsRef.current[activePath] =
            documentUpdatedAt;
        }
        pendingPostDiffGitMarkerRefreshPathsRef.current.delete(activePath);
        clearPostDiffGitMarkers("line-diff-too-complex");
        return;
      }

      async function commitWorkingTreeHandoff() {
        try {
          const workingTreePreview = await getGitDiffPreview(activePath);
          if (
            closePostDiffGitMarkerGenerationRef.current !== generation ||
            activeDocumentPathRef.current !== activePath
          ) {
            return;
          }
          if (isLineDiffTooComplex(workingTreePreview)) {
            blockedPostDiffGitMarkerDocumentVersionsRef.current[activePath] =
              documentUpdatedAt;
            pendingPostDiffGitMarkerRefreshPathsRef.current.delete(activePath);
            clearPostDiffGitMarkers("handoff-line-diff-too-complex");
            return;
          }
          if (
            workingTreePreview.status === "clean" ||
            workingTreePreview.hunks.length === 0
          ) {
            clearPostDiffGitMarkers("handoff-working-tree-clean");
            tracePerf("postDiffGitMarkers.handoffSkip", {
              basename: perfBasename(activePath),
              reason: workingTreePreview.status === "clean" ? "clean" : "empty",
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
            perfOwner: "normal-viewer-marker",
            perfMode: "handoff",
          });

          if (!context) {
            clearPostDiffGitMarkers("no-matching-context");
            return;
          }

          const nextContext: ViewerPostDiffGitMarkerContext = {
            ...context,
            documentPath: activePath,
            documentUpdatedAt,
            revisionLensGeneration: generation,
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
      const decision = shouldInvalidatePostDiffGitMarkersForWorkspaceFileChange(
        {
          activeDocumentPath: documentPayload?.path ?? null,
          changedPath: event.changedPath,
          reason,
        },
      );
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
      const path = documentPayload?.path ?? null;
      if (
        path &&
        isLineDiffTooComplex(documentDiffPreview) &&
        previewTargetsDocument(documentDiffPreview, path)
      ) {
        blockedPostDiffGitMarkerDocumentVersionsRef.current[path] =
          documentPayload?.updatedAt ?? null;
      } else if (
        path &&
        documentDiffPreview.rightLabel === "Working Tree" &&
        previewTargetsDocument(documentDiffPreview, path)
      ) {
        delete blockedPostDiffGitMarkerDocumentVersionsRef.current[path];
      }
      clearPostDiffGitMarkers("diff-preview-open");
    }
  }, [clearPostDiffGitMarkers, documentDiffPreview, documentPayload]);

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
    if (
      Object.prototype.hasOwnProperty.call(
        blockedPostDiffGitMarkerDocumentVersionsRef.current,
        activePath,
      ) &&
      blockedPostDiffGitMarkerDocumentVersionsRef.current[activePath] ===
        documentUpdatedAt
    ) {
      clearPostDiffGitMarkers("line-diff-too-complex");
      return;
    }
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
    const controller = new AbortController();

    async function buildInitialMarkerContext() {
      try {
        const preview = await getGitDiffPreview(activePath);
        if (cancelled) {
          return;
        }
        if (isLineDiffTooComplex(preview)) {
          blockedPostDiffGitMarkerDocumentVersionsRef.current[activePath] =
            documentUpdatedAt;
          initialPostDiffGitMarkerSignaturesRef.current[activePath] =
            requestSignature;
          pendingPostDiffGitMarkerRefreshPathsRef.current.delete(activePath);
          clearPostDiffGitMarkers("initial-line-diff-too-complex");
          return;
        }
        delete blockedPostDiffGitMarkerDocumentVersionsRef.current[activePath];
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
          perfOwner: "normal-viewer-marker",
          signal: controller.signal,
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
          perfOwner: "normal-viewer-marker",
          perfMode: "initial",
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
          revisionLensGeneration: generation,
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
            return {
              ...current,
              [activePath]: {
                ...previousContext,
                revisionLensGeneration: generation,
              },
            };
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
      controller.abort();
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
    resolveRevisionLensTargets,
  };
}
