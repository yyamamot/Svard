import { Maximize2, Minimize2, RefreshCw, X } from "lucide-react";
import type { AppConfig, DocumentDiffPreview } from "../../../core/types";
import type { DiffPreviewWatchState } from "../../lib/diffPreviewWatch";
import {
  diffPreviewWatchLabel,
  diffPreviewWatchMessage,
} from "../../lib/diffPreviewWatch";
import { ShortcutGestureHints } from "../ShortcutGestureHints";
import type { DiffView } from "./types";

export function statusLabel(status: DocumentDiffPreview["status"]): string {
  return status
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function previewSubtitle(preview: DocumentDiffPreview): string {
  return preview.source === "file" ? "File compare" : "Working tree vs HEAD";
}

export function closeLabel(preview: DocumentDiffPreview): string {
  return preview.source === "file"
    ? "Close file diff preview"
    : "Close Git diff preview";
}

export function DiffToolbar({
  config,
  preview,
  title,
  view,
  changeCount,
  changeCountLabel,
  isExpanded,
  syncScrollEnabled,
  tableViewAvailable,
  watchState,
  renderedSummaryLoading,
  renderedBlockCount,
  onMoveChange,
  onRefreshPreview,
  onViewChange,
  onToggleExpanded,
  onSyncScrollChange,
  onClose,
}: {
  config: AppConfig | null;
  preview: DocumentDiffPreview;
  title: string;
  view: DiffView;
  changeCount: number;
  changeCountLabel: string;
  isExpanded: boolean;
  syncScrollEnabled: boolean;
  tableViewAvailable: boolean;
  watchState?: DiffPreviewWatchState;
  renderedSummaryLoading: boolean;
  renderedBlockCount: number;
  onMoveChange: (offset: number) => void;
  onRefreshPreview?: () => void;
  onViewChange: (view: DiffView) => void;
  onToggleExpanded: () => void;
  onSyncScrollChange: (enabled: boolean) => void;
  onClose: () => void;
}) {
  const watchLabel = diffPreviewWatchLabel(watchState);
  const watchMessage = diffPreviewWatchMessage(watchState);
  const refreshDisabled = watchState?.status === "refreshing";
  return (
    <header className="git-diff-toolbar">
      <div className="git-diff-title">
        <span>{title}</span>
        <small>{previewSubtitle(preview)}</small>
      </div>
      <div
        className="git-diff-navigation"
        data-review-id="git-diff-change-navigation"
      >
        <span data-review-id="git-diff-change-count">{changeCountLabel}</span>
        {watchLabel && (
          <span
            className={`git-diff-watch-status ${watchState?.status ?? ""}`}
            data-review-id="git-diff-preview-watch-status"
            data-watch-status={watchState?.status}
            title={watchMessage ?? undefined}
          >
            {watchLabel}
          </span>
        )}
        {watchLabel && onRefreshPreview && (
          <button
            type="button"
            className="git-diff-refresh-preview-button"
            data-review-id="git-diff-preview-refresh"
            disabled={refreshDisabled}
            title={watchMessage ?? "Refresh preview"}
            onClick={onRefreshPreview}
          >
            <RefreshCw size={13} />
            Refresh preview
          </button>
        )}
        <button
          type="button"
          disabled={changeCount === 0}
          aria-label="Previous change"
          onClick={() => onMoveChange(-1)}
        >
          Previous
        </button>
        <button
          type="button"
          disabled={changeCount === 0}
          aria-label="Next change"
          onClick={() => onMoveChange(1)}
        >
          Next
        </button>
        <label className="git-diff-sync-toggle">
          <input
            type="checkbox"
            checked={syncScrollEnabled}
            data-review-id="git-diff-scroll-sync"
            onChange={(event) => onSyncScrollChange(event.target.checked)}
          />
          Sync scroll
        </label>
      </div>
      <div
        className="git-diff-view-toggle"
        data-review-id="git-diff-view-toggle"
      >
        <button
          type="button"
          className={view === "overview" ? "active" : ""}
          data-review-id="git-diff-overview-view"
          aria-pressed={view === "overview"}
          onClick={() => onViewChange("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          className={view === "preview" ? "active" : ""}
          data-review-id="git-diff-full-preview-view"
          aria-pressed={view === "preview"}
          disabled={renderedSummaryLoading || renderedBlockCount === 0}
          title={
            renderedBlockCount > 0
              ? "Show full document preview diff"
              : "No full document preview available"
          }
          onClick={() => onViewChange("preview")}
        >
          Full Preview
        </button>
        <button
          type="button"
          className={view === "rendered" ? "active" : ""}
          data-review-id="git-diff-rendered-view"
          aria-pressed={view === "rendered"}
          disabled={renderedSummaryLoading || renderedBlockCount === 0}
          title={
            renderedBlockCount > 0
              ? "Show changed sections only"
              : "No changes-only preview available"
          }
          onClick={() => onViewChange("rendered")}
        >
          Changes Only
        </button>
        <button
          type="button"
          className={view === "source" ? "active" : ""}
          data-review-id="git-diff-source-view"
          aria-pressed={view === "source"}
          onClick={() => onViewChange("source")}
        >
          Source
        </button>
        <button
          type="button"
          className={view === "table" ? "active" : ""}
          data-review-id="git-diff-table-view"
          aria-pressed={view === "table"}
          disabled={!tableViewAvailable}
          title={
            tableViewAvailable ? "Show table diff" : "No table diff available"
          }
          onClick={() => onViewChange("table")}
        >
          Table
        </button>
      </div>
      <div className="git-diff-window-controls">
        <ShortcutGestureHints
          config={config}
          context="diffPreview"
          openReviewId="diff-shortcut-gesture-hints-open"
          panelReviewId="diff-shortcut-gesture-hints-panel"
          placement="toolbar"
          title="Diff Preview shortcuts and gestures"
        />
        <button
          type="button"
          className="icon-button"
          data-review-id="git-diff-preview-expand"
          aria-label={isExpanded ? "Exit full screen" : "Enter full screen"}
          title={isExpanded ? "Exit full screen" : "Enter full screen"}
          onClick={onToggleExpanded}
        >
          {isExpanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
        </button>
        <button
          type="button"
          className="icon-button"
          data-review-id="git-diff-preview-close"
          aria-label={closeLabel(preview)}
          title={closeLabel(preview)}
          onClick={onClose}
        >
          <X size={15} />
        </button>
      </div>
    </header>
  );
}
