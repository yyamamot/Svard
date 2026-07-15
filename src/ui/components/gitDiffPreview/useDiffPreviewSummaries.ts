import { useEffect, useMemo, useState } from "react";
import { documentFormatForPath } from "../../../core/documentFormat";
import { isLineDiffTooComplex } from "../../../core/types";
import type {
  AppConfig,
  DocumentDiffPreview,
  DocumentPayload,
  KrokiRequest,
  KrokiResult,
  LocalImageResolveContext,
  LocalImageResult,
} from "../../../core/types";
import {
  buildRenderedDiffPresentation,
  deriveGitRenderedDiffSummary,
  isRenderedDiffPresentationChangeEntry,
} from "../../lib/gitRenderedDiff";
import type { GitRenderedDiffSummary } from "../../lib/gitRenderedDiff";
import {
  deriveGitTableDiffSummary,
  type GitTableDiffSummary,
} from "../../lib/gitTableDiff";
import { overviewStats } from "./overview";
import { emptyRenderedSummary } from "./renderedView";
import { sourceChangeIndexes } from "./sourceView";
import { emptyTableSummary } from "./tableView";
import { statusLabel } from "./toolbar";
import type { DiffView } from "./types";
import { diffPreviewChangeCount } from "./body";

interface UseDiffPreviewSummariesOptions {
  activeChangeIndex: number;
  activeTableIndex: number;
  config: AppConfig | null;
  confirmedRemoteDiagramKeys?: ReadonlySet<string>;
  krokiFallbackDiagramKeys?: ReadonlySet<string>;
  loadDocumentContext?: (
    documentPath: string,
  ) => Promise<Pick<
    DocumentPayload,
    "includeFiles" | "resourceContext" | "asciidocContext"
  > | null>;
  preview: DocumentDiffPreview;
  renderDiagram?: (request: KrokiRequest) => Promise<KrokiResult>;
  resolveLocalImage?: (
    source: string,
    documentPath: string,
    context: LocalImageResolveContext | null | undefined,
  ) => Promise<LocalImageResult>;
  setActiveTableIndex: (index: number) => void;
  view: DiffView;
}

export function useDiffPreviewSummaries({
  activeChangeIndex,
  activeTableIndex,
  config,
  confirmedRemoteDiagramKeys,
  krokiFallbackDiagramKeys,
  loadDocumentContext,
  preview,
  renderDiagram,
  resolveLocalImage,
  setActiveTableIndex,
  view,
}: UseDiffPreviewSummariesOptions) {
  const [tableSummary, setTableSummary] =
    useState<GitTableDiffSummary>(emptyTableSummary);
  const [tableSummaryLoading, setTableSummaryLoading] = useState(false);
  const [renderedSummary, setRenderedSummary] =
    useState<GitRenderedDiffSummary>(emptyRenderedSummary);
  const [renderedSummaryLoading, setRenderedSummaryLoading] = useState(false);
  const lineDiffTooComplex = isLineDiffTooComplex(preview);
  const effectiveRenderedSummary = lineDiffTooComplex
    ? emptyRenderedSummary
    : renderedSummary;
  const effectiveTableSummary = lineDiffTooComplex
    ? emptyTableSummary
    : tableSummary;
  const hasDiff = !lineDiffTooComplex && preview.hunks.length > 0;
  const relativePath = preview.relativePath ?? "Current document";
  const documentFormat = documentFormatForPath(preview.relativePath ?? "");
  const renderedDocumentClassName = `markup-document format-${documentFormat}${
    documentFormat === "markdown" ? " markdown-body" : ""
  }`;
  const title = `${relativePath} · ${statusLabel(preview.status)}`;
  const renderedPresentation = useMemo(
    () => buildRenderedDiffPresentation(effectiveRenderedSummary.blocks),
    [effectiveRenderedSummary.blocks],
  );
  const renderedEntrySyncIndexes = useMemo(
    () =>
      new Map(
        renderedPresentation.entries.map((entry, index) => [entry.id, index]),
      ),
    [renderedPresentation.entries],
  );
  const renderedChangedEntries = useMemo(
    () =>
      renderedPresentation.entries.filter(
        isRenderedDiffPresentationChangeEntry,
      ),
    [renderedPresentation.entries],
  );
  const sourceIndexes = useMemo(() => sourceChangeIndexes(preview), [preview]);
  const sourceChangeCount = sourceIndexes.size;
  const renderedChangeCount = renderedPresentation.navigationTargets.length;
  const overview = overviewStats({
    activeChangeIndex,
    preview,
    renderedSummary: effectiveRenderedSummary,
    renderedPresentation,
    tableSummary: effectiveTableSummary,
  });
  const changeCount = diffPreviewChangeCount({
    activeTableIndex,
    renderedChangeCount,
    sourceChangeCount,
    tableSummary: effectiveTableSummary,
    view,
  });
  const changeCountLabel = diffPreviewChangeCountLabel({
    changeCount,
    view,
  });
  const tableViewAvailable =
    !lineDiffTooComplex &&
    (effectiveTableSummary.renderedTables.length > 0 ||
      effectiveTableSummary.tableMarkers.length > 0);

  useEffect(() => {
    if (lineDiffTooComplex) {
      setRenderedSummary(emptyRenderedSummary);
      setRenderedSummaryLoading(false);
      return;
    }
    let cancelled = false;
    setRenderedSummary(emptyRenderedSummary);
    setRenderedSummaryLoading(true);
    deriveGitRenderedDiffSummary(preview, {
      config,
      loadDocumentContext,
      resolveLocalImage,
      renderDiagram,
      confirmedRemoteDiagramKeys,
      krokiFallbackDiagramKeys,
      perfOwner: "single-preview",
    })
      .then((summary) => {
        if (!cancelled) {
          setRenderedSummary(summary);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRenderedSummary({
            blocks: [],
            fallbackMessage:
              "Changes-only preview is not available. Use Source view.",
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setRenderedSummaryLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    config,
    confirmedRemoteDiagramKeys,
    krokiFallbackDiagramKeys,
    loadDocumentContext,
    lineDiffTooComplex,
    preview,
    renderDiagram,
    resolveLocalImage,
  ]);

  useEffect(() => {
    if (lineDiffTooComplex) {
      setTableSummary(emptyTableSummary);
      setTableSummaryLoading(false);
      setActiveTableIndex(0);
      return;
    }
    let cancelled = false;
    setTableSummary(emptyTableSummary);
    setTableSummaryLoading(true);
    deriveGitTableDiffSummary(preview, { perfOwner: "single-preview" })
      .then((summary) => {
        if (!cancelled) {
          setTableSummary(summary);
          setActiveTableIndex(0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTableSummary({
            renderedTables: [],
            tableMarkers: [],
            fallbackReason: "render-error",
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setTableSummaryLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [lineDiffTooComplex, preview, setActiveTableIndex]);

  return {
    changeCount,
    changeCountLabel,
    documentFormat,
    hasDiff,
    overview,
    renderedChangedEntries,
    renderedDocumentClassName,
    renderedEntrySyncIndexes,
    renderedPresentation,
    renderedSummary: effectiveRenderedSummary,
    renderedSummaryLoading: lineDiffTooComplex ? false : renderedSummaryLoading,
    sourceIndexes,
    tableSummary: effectiveTableSummary,
    tableSummaryLoading: lineDiffTooComplex ? false : tableSummaryLoading,
    tableViewAvailable,
    title,
  };
}

function pluralize(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function diffPreviewChangeCountLabel({
  changeCount,
  view,
}: {
  changeCount: number;
  view: DiffView;
}): string {
  if (view === "preview" || view === "rendered") {
    return pluralize(changeCount, "rendered change", "rendered changes");
  }
  if (view === "source") {
    return pluralize(changeCount, "source change", "source changes");
  }
  if (view === "table") {
    return pluralize(changeCount, "table change", "table changes");
  }
  return pluralize(changeCount, "source change", "source changes");
}
