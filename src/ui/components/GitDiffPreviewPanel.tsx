import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent, RefObject } from "react";
import type {
  AppConfig,
  DocumentDiffPreview,
  DocumentLinkResolution,
  DocumentPayload,
  KrokiRequest,
  KrokiResult,
  LocalImageResolveContext,
  LocalImageResult,
} from "../../core/types";
import type { ContentCursorCommandHandler } from "../lib/contentCursor";
import type { DiffPreviewWatchState } from "../lib/diffPreviewWatch";
import {
  copyCaptureAreaToClipboard,
  type CaptureAreaCommandHandler,
  type CaptureAreaRect,
} from "../lib/captureArea";
import { diffPreviewIdentityKey } from "../lib/diffPreviewWatch";
import type { RenderedDiffPresentation } from "../lib/gitRenderedDiff";
import { DiffToolbar } from "./gitDiffPreview/toolbar";
import { DiffPreviewBody } from "./gitDiffPreview/body";
import type { DiffView } from "./gitDiffPreview/types";
import { useDiffScrollNavigation } from "./gitDiffPreview/useDiffScrollNavigation";
import { useDiffPreviewSummaries } from "./gitDiffPreview/useDiffPreviewSummaries";
import { useRenderedDiffContentCursor } from "./gitDiffPreview/useRenderedDiffContentCursor";
import { useDiffPreviewInteractions } from "./gitDiffPreview/useDiffPreviewInteractions";
import { MouseGestureTrail } from "./MouseGestureTrail";
import { CaptureAreaOverlay } from "./CaptureAreaOverlay";
import type {
  ContextMenuItem,
  DiagramPreviewState,
  MouseGestureAutomation,
} from "../types";
import type { CopyText } from "../hooks/documentLinks/types";

export interface DiffPreviewCloseHandoff {
  preview: DocumentDiffPreview;
  renderedPresentation: RenderedDiffPresentation;
}

interface DocumentDiffPreviewPanelProps {
  preview: DocumentDiffPreview;
  chromeHidden?: boolean;
  config: AppConfig | null;
  resolveLocalImage?: (
    source: string,
    documentPath: string,
    context: LocalImageResolveContext | null | undefined,
  ) => Promise<LocalImageResult>;
  loadDocumentContext?: (
    documentPath: string,
  ) => Promise<Pick<
    DocumentPayload,
    "includeFiles" | "resourceContext" | "asciidocContext"
  > | null>;
  renderDiagram?: (request: KrokiRequest) => Promise<KrokiResult>;
  confirmedRemoteDiagramKeys?: ReadonlySet<string>;
  krokiFallbackDiagramKeys?: ReadonlySet<string>;
  contentCursorCommandRef?: RefObject<ContentCursorCommandHandler | null>;
  contentCursorClearRef?: RefObject<(() => void) | null>;
  captureAreaCommandRef?: RefObject<CaptureAreaCommandHandler | null>;
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
  onOpenDiagramPreview: (preview: DiagramPreviewState) => void;
  showInlineNotice: (
    message: string,
    options?: { tone?: "info" | "success" | "warning" | "error" },
  ) => void;
  showLightweightActionFeedback?: (message: string) => void;
  setLastMouseGesture?: (gesture: MouseGestureAutomation | null) => void;
  watchState?: DiffPreviewWatchState;
  onRefreshPreview?: () => void;
  onClose: (handoff?: DiffPreviewCloseHandoff) => void;
}

export function DocumentDiffPreviewPanel({
  preview,
  chromeHidden = false,
  config,
  resolveLocalImage,
  loadDocumentContext,
  renderDiagram,
  confirmedRemoteDiagramKeys,
  krokiFallbackDiagramKeys,
  contentCursorCommandRef,
  contentCursorClearRef,
  captureAreaCommandRef,
  copyText,
  openContextMenu,
  openDocument,
  openPathInEditor,
  resolveDocumentLink,
  confirmExternalLink,
  openExternalUrl,
  onOpenDiagramPreview,
  showInlineNotice,
  showLightweightActionFeedback,
  setLastMouseGesture,
  watchState,
  onRefreshPreview,
  onClose,
}: DocumentDiffPreviewPanelProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const renderedLeftRef = useRef<HTMLDivElement | null>(null);
  const renderedRightRef = useRef<HTMLDivElement | null>(null);
  const syncingScrollRef = useRef(false);
  const programmaticScrollElementsRef = useRef(new Set<HTMLDivElement>());
  const [view, setView] = useState<DiffView>("preview");
  const [isExpanded, setIsExpanded] = useState(true);
  const [syncScrollEnabled, setSyncScrollEnabled] = useState(true);
  const [activeChangeIndex, setActiveChangeIndex] = useState(0);
  const [activeTableIndex, setActiveTableIndex] = useState(0);
  const [captureAreaArticle, setCaptureAreaArticle] =
    useState<HTMLElement | null>(null);
  const previewIdentityKey = diffPreviewIdentityKey(preview);
  const autoRefreshKeyRef = useRef<string | null>(null);
  const {
    changeCount,
    changeCountLabel,
    documentFormat,
    hasDiff,
    overview,
    renderedChangedEntries,
    renderedDocumentClassName,
    renderedEntrySyncIndexes,
    renderedPresentation,
    renderedSummary,
    renderedSummaryLoading,
    sourceIndexes,
    tableSummary,
    tableSummaryLoading,
    tableViewAvailable,
    title,
  } = useDiffPreviewSummaries({
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
  });
  const {
    jumpToPreviewChange,
    moveChange,
    selectChange,
    syncDirectScroll,
    syncRenderedScroll,
  } = useDiffScrollNavigation({
    panelRef,
    renderedLeftRef,
    renderedRightRef,
    syncingScrollRef,
    programmaticScrollElementsRef,
    syncScrollEnabled,
    view,
    changeCount,
    activeChangeIndex,
    renderedNavigationTargets: renderedPresentation.navigationTargets,
    setActiveChangeIndex,
    setView,
  });
  const { clearRenderedContentCursor, contentCursorActive } =
    useRenderedDiffContentCursor({
      activeChangeIndex,
      contentCursorClearRef,
      contentCursorCommandRef,
      panelRef,
      previewRelativePath: preview.relativePath,
      renderedChangedEntries,
      renderedPresentation,
      setActiveChangeIndex,
      view,
    });
  const closeWithHandoff = useCallback(() => {
    onClose({ preview, renderedPresentation });
  }, [onClose, preview, renderedPresentation]);
  const beginCaptureArea = useCallback((container?: HTMLElement) => {
    const renderedPane =
      container ?? renderedRightRef.current ?? renderedLeftRef.current;
    const article = renderedPane?.closest<HTMLElement>(
      ".git-rendered-diff-body",
    );
    if (!article) {
      return false;
    }
    setCaptureAreaArticle(article);
    return true;
  }, []);
  const copyCapturedArea = useCallback(
    async (article: HTMLElement, rect: CaptureAreaRect) => {
      try {
        await copyCaptureAreaToClipboard(article, rect);
        showLightweightActionFeedback?.("Image copied");
      } catch {
        showLightweightActionFeedback?.("Image could not be copied");
      }
    },
    [showLightweightActionFeedback],
  );
  const {
    handleContextMenuCapture,
    handleMouseGesturePointerCancel,
    handleMouseGesturePointerMove,
    handlePanelClick,
    handlePointerDown,
    handlePointerUp,
    mouseGestureTrail,
  } = useDiffPreviewInteractions({
    changeCount,
    config,
    confirmExternalLink,
    copyText,
    leftRef,
    moveChange,
    onClearRenderedContentCursor: clearRenderedContentCursor,
    onClose: closeWithHandoff,
    onOpenDiagramPreview,
    onBeginCaptureArea: (container) => {
      beginCaptureArea(container);
    },
    openContextMenu,
    openDocument,
    openExternalUrl,
    openPathInEditor,
    panelRef,
    preview,
    renderedLeftRef,
    renderedRightRef,
    resolveDocumentLink,
    rightRef,
    setLastMouseGesture,
    showInlineNotice,
    view,
  });

  useEffect(() => {
    setView("preview");
    setIsExpanded(true);
    setActiveTableIndex(0);
    setActiveChangeIndex(0);
  }, [previewIdentityKey]);

  useEffect(() => {
    setActiveChangeIndex(0);
  }, [view, activeTableIndex]);

  useEffect(() => {
    setActiveChangeIndex((current) => {
      if (changeCount === 0) {
        return 0;
      }
      return current >= changeCount ? changeCount - 1 : current;
    });
  }, [changeCount]);

  useEffect(() => {
    if (!captureAreaCommandRef) {
      return;
    }
    captureAreaCommandRef.current = () => beginCaptureArea();
    return () => {
      captureAreaCommandRef.current = null;
    };
  }, [beginCaptureArea, captureAreaCommandRef]);

  useEffect(() => {
    if (watchState?.status !== "stale") {
      autoRefreshKeyRef.current = null;
      return;
    }
    if (!onRefreshPreview || activeChangeIndex !== 0) {
      return;
    }
    const autoRefreshKey = `${previewIdentityKey}:${watchState.reason ?? ""}:${watchState.message ?? ""}`;
    if (autoRefreshKeyRef.current === autoRefreshKey) {
      return;
    }
    autoRefreshKeyRef.current = autoRefreshKey;
    onRefreshPreview();
  }, [
    activeChangeIndex,
    onRefreshPreview,
    previewIdentityKey,
    watchState?.message,
    watchState?.reason,
    watchState?.status,
  ]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && captureAreaArticle) {
        event.preventDefault();
        setCaptureAreaArticle(null);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeWithHandoff();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [captureAreaArticle, closeWithHandoff]);

  return (
    <div
      className={`git-diff-backdrop ${isExpanded ? "expanded" : ""}`}
      data-review-id="git-diff-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closeWithHandoff();
        }
      }}
    >
      <section
        ref={panelRef}
        className={`git-diff-panel ${isExpanded ? "expanded" : ""} ${chromeHidden ? "zen-mode-chrome-hidden" : ""}`}
        data-review-id="git-diff-preview-panel"
        data-zen-mode-chrome-hidden={chromeHidden ? "true" : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={
          preview.source === "file" ? "File diff preview" : "Git diff preview"
        }
        onContextMenuCapture={handleContextMenuCapture}
        onClickCapture={handlePanelClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handleMouseGesturePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handleMouseGesturePointerCancel}
      >
        <MouseGestureTrail points={mouseGestureTrail} />
        {!chromeHidden && (
          <DiffToolbar
            config={config}
            preview={preview}
            title={title}
            view={view}
            changeCount={changeCount}
            changeCountLabel={changeCountLabel}
            isExpanded={isExpanded}
            syncScrollEnabled={syncScrollEnabled}
            tableViewAvailable={tableViewAvailable}
            watchState={watchState}
            renderedSummaryLoading={renderedSummaryLoading}
            renderedBlockCount={renderedSummary.blocks.length}
            onMoveChange={moveChange}
            onRefreshPreview={onRefreshPreview}
            onViewChange={setView}
            onToggleExpanded={() => setIsExpanded((current) => !current)}
            onSyncScrollChange={setSyncScrollEnabled}
            onClose={closeWithHandoff}
          />
        )}

        <DiffPreviewBody
          activeChangeIndex={activeChangeIndex}
          activeTableIndex={activeTableIndex}
          changeCount={changeCount}
          contentCursorActive={contentCursorActive}
          documentClassName={renderedDocumentClassName}
          documentFormat={documentFormat}
          hasDiff={hasDiff}
          leftRef={leftRef}
          overview={overview}
          preview={preview}
          renderedChangedEntries={renderedChangedEntries}
          renderedEntrySyncIndexes={renderedEntrySyncIndexes}
          renderedLeftRef={renderedLeftRef}
          renderedPresentation={renderedPresentation}
          renderedRightRef={renderedRightRef}
          renderedSummary={renderedSummary}
          renderedSummaryLoading={renderedSummaryLoading}
          rightRef={rightRef}
          showChangeRuler={!chromeHidden}
          sourceIndexes={sourceIndexes}
          tableSummary={tableSummary}
          tableSummaryLoading={tableSummaryLoading}
          view={view}
          jumpToPreviewChange={jumpToPreviewChange}
          selectChange={selectChange}
          setActiveTableIndex={setActiveTableIndex}
          syncDirectScroll={syncDirectScroll}
          syncRenderedScroll={syncRenderedScroll}
        />
        {captureAreaArticle && (
          <CaptureAreaOverlay
            article={captureAreaArticle}
            viewer={captureAreaArticle}
            onCapture={(rect) =>
              void copyCapturedArea(captureAreaArticle, rect)
            }
            onClose={() => setCaptureAreaArticle(null)}
          />
        )}
      </section>
    </div>
  );
}

export const GitDiffPreviewPanel = DocumentDiffPreviewPanel;
