import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import {
  emptyDocumentReviewSessionControls,
} from "../lib/documentReviewSession";
import { MouseGestureTrail } from "./MouseGestureTrail";
import { DiffStreamChangeRuler } from "./documentDiffStream/DiffStreamChangeRuler";
import { DiffStreamSection } from "./documentDiffStream/DiffStreamSection";
import type {
  DiffStreamViewMode,
  DocumentDiffStreamPanelProps,
} from "./documentDiffStream/types";
import { useDocumentDiffStreamGestures } from "./documentDiffStream/useDocumentDiffStreamGestures";
import { useDocumentDiffStreamLoader } from "./documentDiffStream/useDocumentDiffStreamLoader";
import { useDocumentDiffStreamNavigation } from "./documentDiffStream/useDocumentDiffStreamNavigation";

export function DocumentDiffStreamPanel({
  config,
  preview,
  documentReviewSession = emptyDocumentReviewSessionControls,
  confirmedRemoteDiagramKeys,
  krokiFallbackDiagramKeys,
  getGitDiffPreview,
  copyText,
  openContextMenu,
  openDocument,
  openPathInEditor,
  resolveDocumentLink,
  confirmExternalLink,
  openExternalUrl,
  onOpenDiagramPreview,
  showInlineNotice,
  loadDocumentContext,
  renderDiagram,
  resolveLocalImage,
  setLastMouseGesture,
  contentCursorCommandRef,
  streamCommandRef,
  onClose,
  onRefresh,
}: DocumentDiffStreamPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const streamBodyRef = useRef<HTMLDivElement | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () =>
      new Set(
        preview.items
          .filter((item) => item.kind === "document")
          .map((item) => item.documentPath ?? item.path),
      ),
  );
  const [viewMode, setViewMode] = useState<DiffStreamViewMode>("full");

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const expandSection = useCallback((key: string) => {
    setExpandedPaths((current) => {
      if (current.has(key)) {
        return current;
      }
      const next = new Set(current);
      next.add(key);
      return next;
    });
  }, []);

  const { ensureSectionLoaded, loadStates, loadStatesRef } =
    useDocumentDiffStreamLoader({
      config,
      confirmedRemoteDiagramKeys,
      documentReviewSession,
      getGitDiffPreview,
      krokiFallbackDiagramKeys,
      loadDocumentContext,
      preview,
      renderDiagram,
      resolveLocalImage,
      streamBodyRef,
    });

  const {
    activeTarget,
    loadedTargets,
    moveTarget,
    scrollStream,
    selectTarget,
  } = useDocumentDiffStreamNavigation({
    contentCursorCommandRef,
    ensureSectionLoaded,
    expandSection,
    loadStates,
    loadStatesRef,
    onClose,
    panelRef,
    preview,
    streamBodyRef,
    streamCommandRef,
  });

  const {
    handleStreamContextMenu,
    handleStreamMouseDown,
    handleStreamMouseLeave,
    handleStreamMouseMove,
    handleStreamMouseUp,
    mouseGestureTrail,
  } = useDocumentDiffStreamGestures({
    changeCount: loadedTargets.length,
    closePreview: onClose,
    config,
    moveChange: moveTarget,
    scrollPane: scrollStream,
    setLastMouseGesture,
  });

  const markNeedsAttention = useCallback(
    (path: string) => documentReviewSession.markNeedsAttention(path),
    [documentReviewSession],
  );
  const markViewed = useCallback(
    (path: string) => documentReviewSession.markViewed(path),
    [documentReviewSession],
  );
  const resetReview = useCallback(
    (path: string) => documentReviewSession.reset(path),
    [documentReviewSession],
  );
  const toggleSection = useCallback(
    (key: string) => {
      setExpandedPaths((current) => {
        const next = new Set(current);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
          ensureSectionLoaded(key, "manual-toggle");
        }
        return next;
      });
    },
    [ensureSectionLoaded],
  );

  return (
    <div
      className="git-diff-backdrop expanded"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        ref={panelRef}
        className="git-diff-panel expanded diff-stream-panel"
        data-review-id="source-control-all-diffs-panel"
        data-mouse-gestures-enabled={
          config?.mouseGestures?.enabled ? "true" : "false"
        }
        aria-label="All diffs"
        onContextMenuCapture={handleStreamContextMenu}
        onMouseDownCapture={handleStreamMouseDown}
        onMouseLeave={handleStreamMouseLeave}
        onMouseMoveCapture={handleStreamMouseMove}
        onMouseUpCapture={handleStreamMouseUp}
      >
        <MouseGestureTrail points={mouseGestureTrail} />
        <header className="git-diff-toolbar diff-stream-toolbar">
          <div className="git-diff-title">
            <span>All diffs</span>
            <small>{preview.items.length} document diffs</small>
          </div>
          <div
            className="git-diff-navigation"
            data-review-id="diff-stream-navigation"
          >
            {preview.watchStatus && preview.watchStatus !== "fresh" ? (
              <span
                className={`git-diff-watch-status ${preview.watchStatus}`}
                data-watch-status={preview.watchStatus}
              >
                {preview.watchStatus === "blocked"
                  ? "Preview refresh blocked"
                  : preview.watchStatus === "refreshing"
                    ? "Refreshing"
                    : "Stale"}
              </span>
            ) : null}
            {onRefresh ? (
              <button
                type="button"
                className="git-diff-refresh-preview-button"
                data-review-id="diff-stream-refresh"
                disabled={preview.watchStatus === "refreshing"}
                onClick={onRefresh}
              >
                <RefreshCw size={13} />
                Refresh all diffs
              </button>
            ) : null}
            <div
              className="git-diff-view-toggle diff-stream-view-toggle"
              data-review-id="diff-stream-view-toggle"
            >
              <button
                type="button"
                className={viewMode === "full" ? "active" : ""}
                data-review-id="diff-stream-full-preview-view"
                aria-pressed={viewMode === "full"}
                onClick={() => setViewMode("full")}
              >
                Full Preview
              </button>
              <button
                type="button"
                className={viewMode === "changes" ? "active" : ""}
                data-review-id="diff-stream-changes-only-view"
                aria-pressed={viewMode === "changes"}
                onClick={() => setViewMode("changes")}
              >
                Changes Only
              </button>
            </div>
            <button
              type="button"
              disabled={loadedTargets.length === 0}
              onClick={() => moveTarget(-1)}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={loadedTargets.length === 0}
              onClick={() => moveTarget(1)}
            >
              Next
            </button>
            <button type="button" aria-label="Close all diffs" onClick={onClose}>
              <X size={14} />
            </button>
          </div>
        </header>
        <div className="diff-stream-body-with-ruler">
          <div ref={streamBodyRef} className="diff-stream-body">
            {preview.items.map((item, index) => (
              <DiffStreamSection
                key={`${item.status}:${item.documentPath ?? item.path}`}
                activeChangeIndex={
                  activeTarget?.fileIndex === index
                    ? activeTarget.changeIndex
                    : undefined
                }
                expanded={expandedPaths.has(item.documentPath ?? item.path)}
                index={index}
                item={item}
                loadState={loadStates[item.documentPath ?? item.path] ?? null}
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
                reviewState={
                  item.documentPath
                    ? documentReviewSession.stateByPath[item.documentPath]
                    : undefined
                }
                onMarkNeedsAttention={markNeedsAttention}
                onMarkViewed={markViewed}
                onResetReview={resetReview}
                onToggle={toggleSection}
              />
            ))}
          </div>
          <DiffStreamChangeRuler
            activeTarget={activeTarget}
            streamBodyRef={streamBodyRef}
            targets={loadedTargets}
            onSelectTarget={selectTarget}
          />
        </div>
      </section>
    </div>
  );
}
