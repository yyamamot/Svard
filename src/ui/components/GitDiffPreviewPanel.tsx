import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent, RefObject } from "react";
import type {
  AppConfig,
  DocumentDiffPreview,
  DocumentLinkResolution,
  DocumentPayload,
  KrokiRequest,
  KrokiResult,
  LocalImageResult,
} from "../../core/types";
import type { ContentCursorCommandHandler } from "../lib/contentCursor";
import type { RenderedDiffPresentation } from "../lib/gitRenderedDiff";
import { DiffToolbar } from "./gitDiffPreview/toolbar";
import { DiffPreviewBody } from "./gitDiffPreview/body";
import type { DiffView } from "./gitDiffPreview/types";
import { useDiffScrollNavigation } from "./gitDiffPreview/useDiffScrollNavigation";
import { useDiffPreviewSummaries } from "./gitDiffPreview/useDiffPreviewSummaries";
import { useRenderedDiffContentCursor } from "./gitDiffPreview/useRenderedDiffContentCursor";
import { useDiffPreviewInteractions } from "./gitDiffPreview/useDiffPreviewInteractions";
import { MouseGestureTrail } from "./MouseGestureTrail";
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
    context: DocumentPayload["asciidocContext"],
  ) => Promise<LocalImageResult>;
  loadDocumentContext?: (
    documentPath: string,
  ) => Promise<Pick<
    DocumentPayload,
    "includeFiles" | "asciidocContext"
  > | null>;
  renderDiagram?: (request: KrokiRequest) => Promise<KrokiResult>;
  confirmedRemoteDiagramKeys?: ReadonlySet<string>;
  krokiFallbackDiagramKeys?: ReadonlySet<string>;
  contentCursorCommandRef?: RefObject<ContentCursorCommandHandler | null>;
  contentCursorClearRef?: RefObject<(() => void) | null>;
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
  setLastMouseGesture?: (gesture: MouseGestureAutomation | null) => void;
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
  copyText,
  openContextMenu,
  openDocument,
  openPathInEditor,
  resolveDocumentLink,
  confirmExternalLink,
  openExternalUrl,
  onOpenDiagramPreview,
  showInlineNotice,
  setLastMouseGesture,
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
  }, [preview]);

  useEffect(() => {
    setActiveChangeIndex(0);
  }, [view, activeTableIndex]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeWithHandoff();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeWithHandoff]);

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
            renderedSummaryLoading={renderedSummaryLoading}
            renderedBlockCount={renderedSummary.blocks.length}
            onMoveChange={moveChange}
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
      </section>
    </div>
  );
}

export const GitDiffPreviewPanel = DocumentDiffPreviewPanel;
