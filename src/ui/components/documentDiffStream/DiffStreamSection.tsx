import { memo, useLayoutEffect, useRef, type MouseEvent } from "react";
import type {
  DocumentDiffPreview,
  DocumentDiffStreamItem,
  DocumentLinkResolution,
  DocumentMediaSnapshot,
} from "../../../core/types";
import { documentFormatForPath } from "../../../core/documentFormat";
import type { CopyText } from "../../hooks/documentLinks/types";
import {
  documentReviewStateLabel,
  type DocumentReviewState,
} from "../../lib/documentReviewSession";
import type { ContextMenuItem, DiagramPreviewState } from "../../types";
import type { DiffStreamViewMode, SectionLoadState } from "./types";
import type { CaptureAreaVariant } from "../../lib/captureArea";
import { DiffStreamRenderedSection } from "./DiffStreamRenderedSection";
import {
  allDiffsUiPerformanceNow,
  useAllDiffsUiPerformance,
} from "../../lib/allDiffsUiPerformance";

export const DiffStreamSection = memo(function DiffStreamSection({
  activeChangeIndex,
  expanded,
  index,
  item,
  loadState,
  viewMode,
  copyText,
  openContextMenu,
  openDocument,
  openPathInEditor,
  resolveDocumentLink,
  confirmExternalLink,
  openExternalUrl,
  onOpenDiagramPreview,
  onOpenDiffPreview,
  onPrepareAgentSelection,
  onAddAgentMedia,
  onBeginCaptureArea,
  showInlineNotice,
  reviewState,
  reviewEnabled = true,
  onMarkNeedsAttention,
  onMarkViewed,
  onResetReview,
  onToggle,
}: {
  activeChangeIndex?: number;
  expanded: boolean;
  index: number;
  item: DocumentDiffStreamItem;
  loadState: SectionLoadState | null;
  viewMode: DiffStreamViewMode;
  copyText: CopyText;
  openContextMenu: (
    event: MouseEvent<HTMLElement>,
    items: ContextMenuItem[],
    sourceReviewId?: string,
  ) => boolean;
  openDocument: (path: string) => Promise<void>;
  openPathInEditor: (path: string) => Promise<void>;
  resolveDocumentLink: (
    href: string,
    documentPath: string,
  ) => Promise<DocumentLinkResolution>;
  confirmExternalLink: (url: string) => Promise<boolean>;
  openExternalUrl: (url: string) => Promise<void>;
  onOpenDiagramPreview: (preview: DiagramPreviewState | null) => void;
  onOpenDiffPreview?: (preview: DocumentDiffPreview) => void;
  onPrepareAgentSelection?: (range: Range) => (() => void) | undefined;
  onAddAgentMedia?: (
    snapshot: DocumentMediaSnapshot,
    side: "left" | "right",
  ) => void;
  onBeginCaptureArea: (
    target: HTMLElement,
    variant: CaptureAreaVariant,
  ) => void;
  showInlineNotice: (
    message: string,
    options?: { tone?: "info" | "success" | "warning" | "error" },
  ) => void;
  reviewState?: DocumentReviewState;
  reviewEnabled?: boolean;
  onMarkNeedsAttention: (path: string) => void;
  onMarkViewed: (path: string) => void;
  onResetReview: (path: string) => void;
  onToggle: (key: string) => void;
}) {
  const measurement = useAllDiffsUiPerformance();
  const lastMeasuredCommitRef = useRef<number | null>(null);
  const key = item.documentPath ?? item.path;
  const stateLabel = documentReviewStateLabel(reviewState);
  const formatLabel = item.documentPath
    ? documentFormatLabel(documentFormatForPath(item.documentPath))
    : null;
  useLayoutEffect(() => {
    const startedAt =
      loadState?.status === "ready"
        ? loadState.measurementCommitStartedAt
        : undefined;
    if (
      !measurement.enabled ||
      startedAt === undefined ||
      lastMeasuredCommitRef.current === startedAt
    ) {
      return;
    }
    lastMeasuredCommitRef.current = startedAt;
    measurement.record({
      type: "ready-dom-commit",
      durationMs: allDiffsUiPerformanceNow() - startedAt,
      itemCount: 1,
    });
  }, [loadState, measurement]);
  return (
    <section
      className={`diff-stream-file-section ${item.kind}`}
      data-review-id={
        item.kind === "document"
          ? "diff-stream-file-section"
          : "diff-stream-blocker-row"
      }
      data-stream-index={index}
      data-stream-key={key}
      data-expanded={expanded ? "true" : "false"}
      data-load-status={loadState?.status ?? "idle"}
    >
      <header className="diff-stream-file-header">
        <button
          type="button"
          onClick={() => onToggle(key)}
          aria-expanded={expanded}
        >
          {expanded ? "-" : "+"}
        </button>
        <div className="diff-stream-file-title">
          <strong>{item.path}</strong>
          <span>
            {formatLabel ? `${formatLabel} - ${item.status}` : item.status}
          </span>
        </div>
        {reviewEnabled && item.kind === "document" && item.documentPath ? (
          <div className="diff-stream-review-actions">
            <span
              className={`document-review-state document-review-state-${reviewState ?? "unreviewed"}`}
              data-review-id="document-review-state"
            >
              {stateLabel}
            </span>
            <button
              type="button"
              onClick={() => onMarkViewed(item.documentPath!)}
            >
              Mark viewed
            </button>
            <button
              type="button"
              onClick={() => onMarkNeedsAttention(item.documentPath!)}
            >
              Needs attention
            </button>
            <button
              type="button"
              onClick={() => onResetReview(item.documentPath!)}
            >
              Reset
            </button>
          </div>
        ) : null}
      </header>
      {item.kind === "blocker" ? (
        <p className="diff-stream-blocker-message">
          {item.reason ?? "This file cannot be rendered in All diffs."}
        </p>
      ) : expanded ? (
        loadState?.status === "ready" ? (
          <DiffStreamRenderedSection
            activeChangeIndex={activeChangeIndex}
            preview={loadState.preview}
            summary={loadState.summary}
            viewMode={viewMode}
            copyText={copyText}
            openContextMenu={openContextMenu}
            openDocument={openDocument}
            openPathInEditor={openPathInEditor}
            resolveDocumentLink={resolveDocumentLink}
            confirmExternalLink={confirmExternalLink}
            openExternalUrl={openExternalUrl}
            onOpenDiagramPreview={onOpenDiagramPreview}
            onPrepareAgentSelection={onPrepareAgentSelection}
            onAddAgentMedia={onAddAgentMedia}
            onBeginCaptureArea={onBeginCaptureArea}
            showInlineNotice={showInlineNotice}
          />
        ) : loadState?.status === "blocked" ? (
          <div
            className="diff-stream-blocker-message"
            data-review-id={
              loadState.reason === "too-complex"
                ? "diff-stream-too-complex-blocker"
                : undefined
            }
          >
            <p>{loadState.message}</p>
            {loadState.reason === "too-complex" &&
            loadState.preview &&
            onOpenDiffPreview ? (
              <button
                type="button"
                data-review-id="diff-stream-open-source-fallback"
                onClick={() => onOpenDiffPreview(loadState.preview!)}
              >
                View source
              </button>
            ) : null}
          </div>
        ) : loadState?.status === "loading" ? (
          <p className="diff-stream-loading">Loading rendered diff</p>
        ) : null
      ) : null}
    </section>
  );
});

function documentFormatLabel(format: ReturnType<typeof documentFormatForPath>) {
  return format === "asciidoc" ? "AsciiDoc" : "Markdown";
}
