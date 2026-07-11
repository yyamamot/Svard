import { memo, type MouseEvent } from "react";
import type {
  DocumentDiffStreamItem,
  DocumentLinkResolution,
} from "../../../core/types";
import { documentFormatForPath } from "../../../core/documentFormat";
import type { CopyText } from "../../hooks/documentLinks/types";
import {
  documentReviewStateLabel,
  type DocumentReviewState,
} from "../../lib/documentReviewSession";
import type { ContextMenuItem, DiagramPreviewState } from "../../types";
import type { DiffStreamViewMode, SectionLoadState } from "./types";
import { DiffStreamRenderedSection } from "./DiffStreamRenderedSection";

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
  const key = item.documentPath ?? item.path;
  const stateLabel = documentReviewStateLabel(reviewState);
  const formatLabel = item.documentPath
    ? documentFormatLabel(documentFormatForPath(item.documentPath))
    : null;
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
        <button type="button" onClick={() => onToggle(key)} aria-expanded={expanded}>
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
            <button type="button" onClick={() => onMarkViewed(item.documentPath!)}>
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
            showInlineNotice={showInlineNotice}
          />
        ) : loadState?.status === "blocked" ? (
          <p className="diff-stream-blocker-message">{loadState.message}</p>
        ) : loadState?.status === "loading" ? (
          <p className="diff-stream-loading">Loading rendered diff</p>
        ) : (
          null
        )
      ) : null}
    </section>
  );
});

function documentFormatLabel(format: ReturnType<typeof documentFormatForPath>) {
  return format === "asciidoc" ? "AsciiDoc" : "Markdown";
}
