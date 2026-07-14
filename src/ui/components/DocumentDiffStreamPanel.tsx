import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { emptyDocumentReviewSessionControls } from "../lib/documentReviewSession";
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
import { CaptureAreaOverlay } from "./CaptureAreaOverlay";
import {
  captureAreaFailureNotice,
  captureAreaReferenceForRect,
  copyCaptureAreaToClipboard,
  type CaptureAreaRect,
  type CaptureAreaVariant,
} from "../lib/captureArea";

export function DocumentDiffStreamPanel({
  config,
  preview,
  documentReviewSession = emptyDocumentReviewSessionControls,
  confirmedRemoteDiagramKeys,
  krokiFallbackDiagramKeys,
  getGitDiffPreview,
  getGitBranchFileDiff,
  getGitFileCommitDiff,
  copyText,
  openContextMenu,
  openDocument,
  openPathInEditor,
  resolveDocumentLink,
  confirmExternalLink,
  openExternalUrl,
  onOpenDiagramPreview,
  onOpenDiffPreview,
  showInlineNotice,
  showLightweightActionFeedback = () => undefined,
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
  const filesPickerRef = useRef<HTMLDivElement | null>(null);
  const filesButtonRef = useRef<HTMLButtonElement | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () =>
      new Set(
        preview.items
          .filter((item) => item.kind === "document")
          .map((item) => item.documentPath ?? item.path),
      ),
  );
  const [viewMode, setViewMode] = useState<DiffStreamViewMode>("full");
  const [filesOpen, setFilesOpen] = useState(false);
  const [fileFilter, setFileFilter] = useState("");
  const [activeFileIndex, setActiveFileIndex] = useState(0);
  const [captureAreaState, setCaptureAreaState] = useState<{
    index: number;
    target: HTMLElement;
    variant: CaptureAreaVariant;
  } | null>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (captureAreaState) {
          setCaptureAreaState(null);
          return;
        }
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [captureAreaState, onClose]);

  useEffect(() => {
    if (!filesOpen) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (!filesPickerRef.current?.contains(event.target as Node))
        setFilesOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, [filesOpen]);

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
      getGitDiffPreview,
      getGitBranchFileDiff,
      getGitFileCommitDiff,
      krokiFallbackDiagramKeys,
      loadDocumentContext,
      preview,
      renderDiagram,
      resolveLocalImage,
      streamBodyRef,
    });

  const captureTargetForIndex = useCallback(
    (index: number) => {
      const item = preview.items[index];
      if (!item || item.kind !== "document") return null;
      const key = item.documentPath ?? item.path;
      if (!expandedPaths.has(key) || loadStates[key]?.status !== "ready") {
        return null;
      }
      return (
        streamBodyRef.current
          ?.querySelector<HTMLElement>(`[data-stream-index="${index}"]`)
          ?.querySelector<HTMLElement>(".diff-stream-rendered-body") ?? null
      );
    },
    [expandedPaths, loadStates, preview.items],
  );

  const canCaptureCurrentArea = useCallback(
    () => Boolean(captureTargetForIndex(activeFileIndex)),
    [activeFileIndex, captureTargetForIndex],
  );

  const beginCurrentCaptureArea = useCallback(
    (variant: CaptureAreaVariant) => {
      const target = captureTargetForIndex(activeFileIndex);
      if (!target) return false;
      setCaptureAreaState({ index: activeFileIndex, target, variant });
      return true;
    },
    [activeFileIndex, captureTargetForIndex],
  );

  const beginSectionCaptureArea = useCallback(
    (target: HTMLElement, variant: CaptureAreaVariant) => {
      const section = target.closest<HTMLElement>("[data-stream-index]");
      const index = Number(section?.dataset.streamIndex);
      if (!Number.isInteger(index) || captureTargetForIndex(index) !== target) {
        return;
      }
      setActiveFileIndex(index);
      setCaptureAreaState({ index, target, variant });
    },
    [captureTargetForIndex],
  );

  const copyCapturedArea = useCallback(
    async (
      target: HTMLElement,
      rect: CaptureAreaRect,
      variant: CaptureAreaVariant,
    ) => {
      try {
        const referenceText =
          variant === "reference"
            ? captureAreaReferenceForRect(target, rect)
            : undefined;
        await copyCaptureAreaToClipboard(target, rect, referenceText);
        showLightweightActionFeedback(
          variant === "reference"
            ? "Image with reference copied"
            : "Image copied",
        );
      } catch {
        showInlineNotice(captureAreaFailureNotice, { tone: "warning" });
      }
    },
    [showInlineNotice, showLightweightActionFeedback],
  );

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
    beginCaptureArea: beginCurrentCaptureArea,
    canCaptureArea: canCaptureCurrentArea,
  });

  useEffect(() => {
    if (!captureAreaState) return;
    const currentTarget = captureTargetForIndex(captureAreaState.index);
    if (
      captureAreaState.index !== activeFileIndex ||
      currentTarget !== captureAreaState.target ||
      !captureAreaState.target.isConnected
    ) {
      setCaptureAreaState(null);
    }
  }, [activeFileIndex, captureAreaState, captureTargetForIndex]);

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

  const supportsReviewSession = preview.source === "git-changes-stream";
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
  const filteredFiles = useMemo(() => {
    const query = fileFilter.trim().toLowerCase();
    return preview.items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !query || item.path.toLowerCase().includes(query));
  }, [fileFilter, preview.items]);
  const currentFile = preview.items[activeFileIndex] ?? preview.items[0];

  useEffect(() => {
    if (
      !supportsReviewSession ||
      !currentFile ||
      currentFile.kind !== "document"
    ) {
      return;
    }
    const documentPath = currentFile.documentPath;
    const key = currentFile.documentPath ?? currentFile.path;
    const reviewState = documentPath
      ? (documentReviewSession.stateByPath[documentPath] ?? "unreviewed")
      : "unreviewed";
    if (
      !documentPath ||
      !expandedPaths.has(key) ||
      loadStates[key]?.status !== "ready" ||
      reviewState !== "unreviewed"
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (
        (documentReviewSession.stateByPath[documentPath] ?? "unreviewed") ===
        "unreviewed"
      ) {
        markViewed(documentPath);
      }
    }, 700);
    return () => window.clearTimeout(timer);
  }, [
    currentFile,
    documentReviewSession.stateByPath,
    expandedPaths,
    loadStates,
    markViewed,
    supportsReviewSession,
  ]);

  const syncActiveFileToViewport = useCallback(() => {
    const body = streamBodyRef.current;
    if (!body) return;
    const sections = Array.from(
      body.querySelectorAll<HTMLElement>("[data-stream-index]"),
    );
    const bodyTop = body.getBoundingClientRect().top;
    const current = sections.reduce(
      (best, section) =>
        Math.abs(section.getBoundingClientRect().top - bodyTop) <
        Math.abs((best?.getBoundingClientRect().top ?? Infinity) - bodyTop)
          ? section
          : best,
      sections[0],
    );
    const index = Number(current?.dataset.streamIndex);
    if (Number.isInteger(index)) setActiveFileIndex(index);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(syncActiveFileToViewport);
    return () => window.cancelAnimationFrame(frame);
  }, [expandedPaths, loadStates, preview.items, syncActiveFileToViewport]);

  const selectFile = useCallback(
    (index: number) => {
      const item = preview.items[index];
      if (!item) return;
      const key = item.documentPath ?? item.path;
      setActiveFileIndex(index);
      expandSection(key);
      if (item.kind === "document") ensureSectionLoaded(key, "navigation");
      const section = streamBodyRef.current?.querySelector<HTMLElement>(
        `[data-stream-index="${index}"]`,
      );
      section?.scrollIntoView({ block: "center" });
      setFilesOpen(false);
      filesButtonRef.current?.focus();
    },
    [ensureSectionLoaded, expandSection, preview.items],
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
          <div className="diff-stream-title-group">
            <div className="git-diff-title">
              <span>All diffs</span>
              <small>{preview.items.length} document diffs</small>
              {preview.comparisonLabel ? (
                <small>{preview.comparisonLabel}</small>
              ) : null}
            </div>
            <div className="diff-stream-files-picker" ref={filesPickerRef}>
              <button
                ref={filesButtonRef}
                type="button"
                data-review-id="diff-stream-files-picker"
                aria-expanded={filesOpen}
                onClick={() => setFilesOpen((open) => !open)}
              >
                Files ({preview.items.length})
              </button>
              {filesOpen ? (
                <div
                  className="diff-stream-files-popover"
                  role="dialog"
                  aria-label="All diffs files"
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setFilesOpen(false);
                      filesButtonRef.current?.focus();
                    }
                  }}
                >
                  <input
                    autoFocus
                    value={fileFilter}
                    onChange={(event) =>
                      setFileFilter(event.currentTarget.value)
                    }
                    placeholder="Filter files"
                    aria-label="Filter all diffs files"
                  />
                  <div role="listbox">
                    {filteredFiles.map(({ item, index }) => (
                      <button
                        key={`${item.path}:${index}`}
                        type="button"
                        role="option"
                        aria-selected={activeFileIndex === index}
                        className={activeFileIndex === index ? "active" : ""}
                        onClick={() => selectFile(index)}
                      >
                        <strong>{item.path}</strong>
                        <small>
                          {item.kind === "blocker"
                            ? (item.reason ?? item.status)
                            : item.status}
                        </small>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            {currentFile ? (
              <div
                className="diff-stream-current-file"
                data-review-id="diff-stream-current-file"
                title={currentFile.path}
              >
                <span>Current:</span> <strong>{currentFile.path}</strong>
              </div>
            ) : null}
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
            {preview.source === "git-changes-stream" && onRefresh ? (
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
            <button
              type="button"
              aria-label="Close all diffs"
              onClick={onClose}
            >
              <X size={14} />
            </button>
          </div>
        </header>
        <div className="diff-stream-body-with-ruler">
          <div
            ref={streamBodyRef}
            className="diff-stream-body"
            onScroll={syncActiveFileToViewport}
          >
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
                onOpenDiffPreview={onOpenDiffPreview}
                onBeginCaptureArea={beginSectionCaptureArea}
                showInlineNotice={showInlineNotice}
                reviewState={
                  supportsReviewSession && item.documentPath
                    ? documentReviewSession.stateByPath[item.documentPath]
                    : undefined
                }
                reviewEnabled={supportsReviewSession}
                onMarkNeedsAttention={
                  supportsReviewSession ? markNeedsAttention : () => {}
                }
                onMarkViewed={supportsReviewSession ? markViewed : () => {}}
                onResetReview={supportsReviewSession ? resetReview : () => {}}
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
        {captureAreaState && streamBodyRef.current ? (
          <CaptureAreaOverlay
            article={captureAreaState.target}
            viewer={streamBodyRef.current}
            onCapture={(rect) =>
              void copyCapturedArea(
                captureAreaState.target,
                rect,
                captureAreaState.variant,
              )
            }
            onClose={() => setCaptureAreaState(null)}
          />
        ) : null}
      </section>
    </div>
  );
}
