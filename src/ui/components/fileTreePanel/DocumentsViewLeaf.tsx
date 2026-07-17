import type { DocumentReviewSessionControls } from "../../lib/documentReviewSession";
import {
  documentReviewStateLabel,
  nextDocumentReviewPath,
  previousDocumentReviewPath,
} from "../../lib/documentReviewSession";
import type { DocumentsFilter, FilesViewMode } from "./types";

export function documentsViewHeading(viewMode: FilesViewMode): string {
  switch (viewMode) {
    case "documents-path":
      return "Docs: Loaded";
    case "documents-mkdocs":
      return "Docs: MkDocs";
    case "documents-zensical":
      return "Docs: Zensical";
    case "documents-antora":
      return "Docs: Antora";
    case "documents-vitepress":
      return "Docs: VitePress";
    case "documents-docusaurus":
      return "Docs: Docusaurus";
    default:
      return "Documents only";
  }
}

export function DocumentsChangeCountBadge({ count }: { count?: number }) {
  if (!count) {
    return null;
  }
  return (
    <span
      className="documents-change-count-badge"
      aria-label={`${count} changed documents`}
      title={`${count} changed documents`}
    >
      {count}
    </span>
  );
}

export function DocumentReviewRowControls({
  path,
  documentReviewSession,
}: {
  path: string;
  documentReviewSession: DocumentReviewSessionControls;
}) {
  const effectiveState =
    documentReviewSession.stateByPath[path] ?? "unreviewed";
  const label = documentReviewStateLabel(effectiveState);
  const compactLabel =
    effectiveState === "viewed"
      ? "V"
      : effectiveState === "needs-attention"
        ? "!"
        : "U";
  return (
    <span className="document-review-row-controls">
      <span
        className={`document-review-state document-review-state-${effectiveState}`}
        data-review-id="document-review-state"
        data-review-state={effectiveState}
        title={label}
        aria-label={label}
      >
        {compactLabel}
      </span>
    </span>
  );
}

export function DocumentsSourceFilterHeader({
  currentReviewPath,
  documentReviewSession,
  documentsChangedCount,
  documentsFilter,
  reviewSummary,
  reviewTargetPaths,
  viewMode,
  onDocumentsFilterChange,
  onOpenReviewDiff,
}: {
  currentReviewPath: string | null;
  documentReviewSession: DocumentReviewSessionControls;
  documentsChangedCount: number;
  documentsFilter: DocumentsFilter;
  reviewSummary: {
    reviewed: number;
    total: number;
    needsAttention: number;
  };
  reviewTargetPaths: string[];
  viewMode: FilesViewMode;
  onDocumentsFilterChange: (filter: DocumentsFilter) => void;
  onOpenReviewDiff: (path: string) => void;
}) {
  const nextReviewPath = nextDocumentReviewPath({
    currentPath: currentReviewPath,
    stateByPath: documentReviewSession.stateByPath,
    targetPaths: reviewTargetPaths,
  });
  const previousReviewPath = previousDocumentReviewPath({
    currentPath: currentReviewPath,
    targetPaths: reviewTargetPaths,
  });
  return (
    <div
      className="documents-view-header"
      data-review-id="documents-view-header"
    >
      <span className="documents-view-heading">
        {documentsViewHeading(viewMode)}
      </span>
      <div
        className="documents-source-filter"
        data-review-id="documents-source-filter"
        aria-label="Documents source filter"
      >
        <button
          type="button"
          className={documentsFilter === "all" ? "active" : ""}
          data-review-id="documents-source-filter-all"
          aria-pressed={documentsFilter === "all"}
          onClick={() => onDocumentsFilterChange("all")}
        >
          All
        </button>
        <button
          type="button"
          className={documentsFilter === "changed" ? "active" : ""}
          data-review-id="documents-source-filter-changed"
          aria-pressed={documentsFilter === "changed"}
          onClick={() => onDocumentsFilterChange("changed")}
        >
          {documentsChangedCount > 0
            ? `Changed ${documentsChangedCount}`
            : "Changed"}
        </button>
      </div>
      {documentsFilter === "changed" && reviewTargetPaths.length > 0 ? (
        <div
          className="document-review-session"
          data-review-id="document-review-session"
          aria-label="Review session"
        >
          <span className="document-review-session-title">Review session</span>
          <span data-review-id="document-review-session-progress">
            Reviewed {reviewSummary.reviewed} / {reviewSummary.total}
          </span>
          {reviewSummary.needsAttention > 0 ? (
            <span data-review-id="document-review-session-attention">
              Needs attention {reviewSummary.needsAttention}
            </span>
          ) : null}
          <button
            type="button"
            disabled={!previousReviewPath}
            onClick={() => {
              if (previousReviewPath) {
                onOpenReviewDiff(previousReviewPath);
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
                onOpenReviewDiff(nextReviewPath);
              }
            }}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
