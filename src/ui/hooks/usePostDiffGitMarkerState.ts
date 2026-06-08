import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { isSupportedDocumentPath } from "../../core/documentFormat";
import type {
  AppConfig,
  DocumentDiffPreview,
  DocumentPayload,
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
import { shouldInvalidatePostDiffGitMarkersForWorkspaceFileChange } from "../lib/postDiffGitMarkerRefresh";
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

  const closeDocumentDiffPreview = useCallback(
    (handoff?: DiffPreviewCloseHandoff) => {
      setDocumentDiffPreview(null);

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

      const context = buildPostDiffGitMarkerContext({
        activeDocumentPath: documentPayload.path,
        preview: handoff.preview,
        renderedPresentation: handoff.renderedPresentation,
      });

      if (!context) {
        clearPostDiffGitMarkers("no-matching-context");
        return;
      }

      const nextContext: ViewerPostDiffGitMarkerContext = {
        ...context,
        documentPath: documentPayload.path,
        documentUpdatedAt: documentPayload.updatedAt ?? null,
      };
      setPostDiffGitMarkersByPath((current) => ({
        ...current,
        [documentPayload.path]: nextContext,
      }));
      tracePerf("postDiffGitMarkers.context", {
        basename: perfBasename(documentPayload.path),
        markerCount: context.totalCount,
        renderedCount: context.renderedCount,
        visible: context.renderedCount > 0,
      });
    },
    [
      clearPostDiffGitMarkers,
      config?.experimental.postDiffGitMarkers,
      documentPayload,
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
        invalidatePostDiffGitMarkersForActiveDocument("git-refresh");
      } else {
        tracePerf("postDiffGitMarkers.refreshSkip", decision.trace);
      }
      refreshGitChanges(reason);
    },
    [documentPayload?.path, invalidatePostDiffGitMarkersForActiveDocument],
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
    if (
      existingContext &&
      (existingContext.documentUpdatedAt ?? null) === documentUpdatedAt
    ) {
      return;
    }
    if (existingContext) {
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
        setPostDiffGitMarkersByPath((current) => ({
          ...current,
          [activePath]: nextContext,
        }));
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
    invalidatePostDiffGitMarkersForActiveDocument,
    handleWorkspaceFileChangeRefresh,
  };
}
