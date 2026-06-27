import { useEffect, useMemo, useState, type RefObject } from "react";
import type { DocumentPayload, RenderResult } from "../../core/types";
import {
  buildDiagramInspectorItems,
  type DiagramRenderSnapshot,
} from "../lib/diagramInspector";
import { revealDiagramInViewer } from "../lib/diagramReveal";
import {
  buildLinkInspectorModel,
  collectResolvedDocumentLinksFromHtml,
  pruneDocumentLinksForOpenDocuments,
  type DocumentLinksByPath,
} from "../lib/documentLinkInspector";
import { buildIncludeInspectorItems } from "../lib/includeInspector";
import type { SafeHtml } from "../lib/safeHtml";

interface UseAppDocumentInspectorStateOptions {
  activeDocumentPayload: DocumentPayload | null;
  articleRef: RefObject<HTMLElement | null>;
  documentHtml: SafeHtml;
  openDocumentPaths: ReadonlySet<string>;
  preferencesOpen: boolean;
  renderResult: RenderResult | null;
  rootDirectory: string;
}

export function useAppDocumentInspectorState({
  activeDocumentPayload,
  articleRef,
  documentHtml,
  openDocumentPaths,
  preferencesOpen,
  renderResult,
  rootDirectory,
}: UseAppDocumentInspectorStateOptions) {
  const [diagramRenderSnapshot, setDiagramRenderSnapshot] =
    useState<DiagramRenderSnapshot | null>(null);
  const [selectedDiagramId, setSelectedDiagramId] = useState<string | null>(
    null,
  );
  const [documentLinksByPath, setDocumentLinksByPath] =
    useState<DocumentLinksByPath>({});

  const diagramInspectorItems = useMemo(
    () =>
      buildDiagramInspectorItems({
        document: activeDocumentPayload,
        renderResult: preferencesOpen ? null : renderResult,
        renderSnapshot: preferencesOpen ? null : diagramRenderSnapshot,
      }),
    [
      activeDocumentPayload,
      diagramRenderSnapshot,
      preferencesOpen,
      renderResult,
    ],
  );
  const includeInspectorItems = useMemo(
    () => buildIncludeInspectorItems(activeDocumentPayload),
    [activeDocumentPayload],
  );
  const linkInspectorModel = useMemo(
    () =>
      buildLinkInspectorModel({
        activePath: activeDocumentPayload?.path,
        documentLinksByPath,
        openDocumentPaths,
        rootDirectory,
      }),
    [
      activeDocumentPayload?.path,
      documentLinksByPath,
      openDocumentPaths,
      rootDirectory,
    ],
  );

  useEffect(() => {
    setDocumentLinksByPath((current) =>
      pruneDocumentLinksForOpenDocuments(current, openDocumentPaths),
    );
  }, [openDocumentPaths]);

  useEffect(() => {
    if (!activeDocumentPayload || preferencesOpen) {
      return;
    }
    const links = collectResolvedDocumentLinksFromHtml({
      document: { path: activeDocumentPayload.path },
      html: documentHtml,
    });
    setDocumentLinksByPath((current) => ({
      ...current,
      [activeDocumentPayload.path]: {
        path: activeDocumentPayload.path,
        links,
        updatedAt: Date.now(),
      },
    }));
  }, [activeDocumentPayload?.path, documentHtml, preferencesOpen]);

  useEffect(() => {
    if (
      selectedDiagramId &&
      !diagramInspectorItems.some((item) => item.id === selectedDiagramId)
    ) {
      setSelectedDiagramId(null);
    }
  }, [diagramInspectorItems, selectedDiagramId]);

  function selectDiagramFromInspector(id: string) {
    setSelectedDiagramId(id);
    requestAnimationFrame(() => {
      revealDiagramInViewer(articleRef.current, id);
    });
  }

  return {
    diagramInspectorItems,
    includeInspectorItems,
    linkInspectorModel,
    selectedDiagramId,
    selectDiagramFromInspector,
    setDiagramRenderSnapshot,
    setSelectedDiagramId,
  };
}
