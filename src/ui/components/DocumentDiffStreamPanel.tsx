import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { RefreshCw, X } from "lucide-react";
import type {
  AppConfig,
  DocumentDiffPreview,
  DocumentDiffStreamItem,
  DocumentDiffStreamPreview,
  DocumentLinkResolution,
  DocumentPayload,
  KrokiRequest,
  KrokiResult,
  LocalImageResolveContext,
  LocalImageResult,
} from "../../core/types";
import { documentFormatForPath } from "../../core/documentFormat";
import type { CopyText } from "../hooks/documentLinks/types";
import type { DocumentReviewSessionControls } from "../lib/documentReviewSession";
import {
  documentReviewStateLabel,
  emptyDocumentReviewSessionControls,
} from "../lib/documentReviewSession";
import {
  buildRenderedDiffPresentation,
  deriveGitRenderedDiffSummary,
  isRenderedDiffPresentationChangeEntry,
} from "../lib/gitRenderedDiff";
import type { GitRenderedDiffSummary } from "../lib/gitRenderedDiff";
import {
  RenderedDiffPane,
  renderedEntryChangeIndex,
  renderedListItemChangeIndex,
  renderedStructuredChildChangeIndex,
  renderedTableRowChangeIndex,
} from "./gitDiffPreview/renderedView";
import { createDiffPreviewContextMenuHandler } from "./gitDiffPreview/contextMenu";
import type { ContextMenuItem, DiagramPreviewState } from "../types";

type SectionLoadState =
  | { status: "idle" }
  | { status: "loading" }
  | {
      status: "ready";
      preview: DocumentDiffPreview;
      summary: GitRenderedDiffSummary;
    }
  | { status: "blocked"; message: string };

type DiffStreamViewMode = "full" | "changes";

interface DocumentDiffStreamPanelProps {
  config: AppConfig | null;
  preview: DocumentDiffStreamPreview;
  documentReviewSession?: DocumentReviewSessionControls;
  confirmedRemoteDiagramKeys?: ReadonlySet<string>;
  krokiFallbackDiagramKeys?: ReadonlySet<string>;
  getGitDiffPreview: (path: string) => Promise<DocumentDiffPreview>;
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
  loadDocumentContext?: (
    documentPath: string,
  ) => Promise<Pick<
    DocumentPayload,
    "includeFiles" | "resourceContext" | "asciidocContext"
  > | null>;
  renderDiagram?: (request: KrokiRequest) => Promise<KrokiResult>;
  resolveLocalImage?: (
    source: string,
    documentPath: string,
    context: LocalImageResolveContext | null | undefined,
  ) => Promise<LocalImageResult>;
  onClose: () => void;
  onRefresh?: () => void;
}

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
  onClose,
  onRefresh,
}: DocumentDiffStreamPanelProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(
    () =>
      new Set(
        preview.items
          .filter((item) => item.kind === "document")
          .map((item) => item.documentPath ?? item.path),
      ),
  );
  const [loadStates, setLoadStates] = useState<Record<string, SectionLoadState>>(
    {},
  );
  const [activeTarget, setActiveTarget] = useState<{
    fileIndex: number;
    changeIndex: number;
  } | null>(null);
  const [viewMode, setViewMode] = useState<DiffStreamViewMode>("full");
  const requestIds = useRef<Record<string, number>>({});

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

  useEffect(() => {
    for (const item of preview.items) {
      const key = item.documentPath ?? item.path;
      if (item.kind !== "document" || !item.documentPath) {
        continue;
      }
      if (!expandedPaths.has(key) || loadStates[key]?.status) {
        continue;
      }
      const requestId = (requestIds.current[key] ?? 0) + 1;
      const documentPath = item.documentPath;
      requestIds.current[key] = requestId;
      setLoadStates((current) => ({
        ...current,
        [key]: { status: "loading" },
      }));
      getGitDiffPreview(documentPath)
        .then(async (diffPreview) => {
          const normalizedPreview = {
            ...diffPreview,
            source: diffPreview.source ?? "git",
            leftPath: diffPreview.leftPath ?? documentPath,
            rightPath: diffPreview.rightPath ?? documentPath,
          };
          const summary = await deriveGitRenderedDiffSummary(
            normalizedPreview,
            {
              config,
              loadDocumentContext,
              resolveLocalImage,
              renderDiagram,
              confirmedRemoteDiagramKeys,
              krokiFallbackDiagramKeys,
            },
          );
          if (requestIds.current[key] !== requestId) {
            return;
          }
          setLoadStates((current) => ({
            ...current,
            [key]: {
              status: "ready",
              preview: normalizedPreview,
              summary,
            },
          }));
          documentReviewSession.markViewed(documentPath);
        })
        .catch((error) => {
          if (requestIds.current[key] !== requestId) {
            return;
          }
          setLoadStates((current) => ({
            ...current,
            [key]: {
              status: "blocked",
              message:
                error instanceof Error
                  ? "This file cannot be previewed right now."
                  : "Preview failed.",
            },
          }));
        });
    }
  }, [
    config,
    confirmedRemoteDiagramKeys,
    documentReviewSession,
    expandedPaths,
    getGitDiffPreview,
    krokiFallbackDiagramKeys,
    loadDocumentContext,
    loadStates,
    preview.items,
    renderDiagram,
    resolveLocalImage,
  ]);

  const loadedTargets = useMemo(
    () =>
      preview.items.flatMap((item, fileIndex) => {
        const key = item.documentPath ?? item.path;
        const state = loadStates[key];
        if (state?.status !== "ready") {
          return [];
        }
        const presentation = buildRenderedDiffPresentation(
          state.summary.blocks,
        );
        return presentation.navigationTargets.map((_, changeIndex) => ({
          fileIndex,
          changeIndex,
          key,
        }));
      }),
    [loadStates, preview.items],
  );

  function moveTarget(offset: number) {
    if (loadedTargets.length === 0) {
      return;
    }
    const currentIndex = activeTarget
      ? loadedTargets.findIndex(
          (target) =>
            target.fileIndex === activeTarget.fileIndex &&
            target.changeIndex === activeTarget.changeIndex,
        )
      : -1;
    const nextIndex =
      (currentIndex + offset + loadedTargets.length) % loadedTargets.length;
    const target = loadedTargets[nextIndex];
    setActiveTarget({
      fileIndex: target.fileIndex,
      changeIndex: target.changeIndex,
    });
    document
      .querySelector<HTMLElement>(
        `[data-review-id="diff-stream-file-section"][data-stream-index="${target.fileIndex}"]`,
      )
      ?.scrollIntoView({ block: "start" });
  }

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
        className="git-diff-panel expanded diff-stream-panel"
        data-review-id="source-control-all-diffs-panel"
        aria-label="All diffs"
      >
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
        <div className="diff-stream-body">
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
              onMarkNeedsAttention={(path) =>
                documentReviewSession.markNeedsAttention(path)
              }
              onMarkViewed={(path) => documentReviewSession.markViewed(path)}
              onResetReview={(path) => documentReviewSession.reset(path)}
              onToggle={() => {
                const key = item.documentPath ?? item.path;
                setExpandedPaths((current) => {
                  const next = new Set(current);
                  if (next.has(key)) {
                    next.delete(key);
                  } else {
                    next.add(key);
                  }
                  return next;
                });
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function DiffStreamSection({
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
  reviewState?: "unreviewed" | "viewed" | "needs-attention";
  onMarkNeedsAttention: (path: string) => void;
  onMarkViewed: (path: string) => void;
  onResetReview: (path: string) => void;
  onToggle: () => void;
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
      data-expanded={expanded ? "true" : "false"}
      data-load-status={loadState?.status ?? "idle"}
    >
      <header className="diff-stream-file-header">
        <button type="button" onClick={onToggle} aria-expanded={expanded}>
          {expanded ? "-" : "+"}
        </button>
        <div className="diff-stream-file-title">
          <strong>{item.path}</strong>
          <span>
            {formatLabel ? `${formatLabel} - ${item.status}` : item.status}
          </span>
        </div>
        {item.kind === "document" && item.documentPath ? (
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
        ) : (
          <p className="diff-stream-loading">Loading rendered diff</p>
        )
      ) : null}
    </section>
  );
}

function documentFormatLabel(format: ReturnType<typeof documentFormatForPath>) {
  return format === "asciidoc" ? "AsciiDoc" : "Markdown";
}

function DiffStreamRenderedSection({
  activeChangeIndex,
  preview,
  summary,
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
}: {
  activeChangeIndex?: number;
  preview: DocumentDiffPreview;
  summary: GitRenderedDiffSummary;
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
}) {
  const leftRef = useRef<HTMLDivElement | null>(null);
  const rightRef = useRef<HTMLDivElement | null>(null);
  const presentation = useMemo(
    () => buildRenderedDiffPresentation(summary.blocks),
    [summary.blocks],
  );
  const changedEntries = useMemo(
    () => presentation.entries.filter(isRenderedDiffPresentationChangeEntry),
    [presentation.entries],
  );
  const visibleEntries =
    viewMode === "full" ? presentation.entries : changedEntries;
  const renderedEntrySyncIndexes = useMemo(
    () =>
      new Map(presentation.entries.map((entry, index) => [entry.id, index])),
    [presentation.entries],
  );
  const handleDiffContextMenu = useMemo(
    () =>
      createDiffPreviewContextMenuHandler({
        preview,
        copyText,
        openContextMenu,
        openDocument,
        openPathInEditor,
        resolveDocumentLink,
        confirmExternalLink,
        openExternalUrl,
        onOpenDiagramPreview,
        showInlineNotice,
      }),
    [
      confirmExternalLink,
      copyText,
      onOpenDiagramPreview,
      openContextMenu,
      openDocument,
      openExternalUrl,
      openPathInEditor,
      preview,
      resolveDocumentLink,
      showInlineNotice,
    ],
  );
  const documentFormat = documentFormatForPath(preview.relativePath ?? "");
  const documentClassName = `markup-document format-${documentFormat}${
    documentFormat === "markdown" ? " markdown-body" : ""
  }`;
  if (summary.fallbackMessage && changedEntries.length === 0) {
    return <p className="diff-stream-blocker-message">{summary.fallbackMessage}</p>;
  }
  if (visibleEntries.length === 0) {
    return <p className="diff-stream-blocker-message">No rendered changes.</p>;
  }
  return (
    <div
      className="git-rendered-diff-body diff-stream-rendered-body"
      data-review-id="diff-stream-rendered-body"
    >
      <RenderedDiffPane
        label={preview.leftLabel}
        entries={visibleEntries}
        side="left"
        paneRef={leftRef}
        reviewId="diff-stream-left-pane"
        blockReviewId="diff-stream-rendered-block"
        documentClassName={documentClassName}
        documentFormat={documentFormat}
        activeChangeIndex={activeChangeIndex}
        focusTableRows={true}
        inlineDiagnostics={presentation.inlineDiagnostics}
        onContextMenu={(event) =>
          handleDiffContextMenu(event, "left", "rendered", event.currentTarget)
        }
        changeIndexForEntry={(entry) =>
          renderedEntryChangeIndex(presentation, entry, "left")
        }
        changeIndexForListItem={(entry, itemIndex) =>
          renderedListItemChangeIndex(presentation, entry, "left", itemIndex)
        }
        changeIndexForStructuredChild={(entry, childIndex) =>
          renderedStructuredChildChangeIndex(
            presentation,
            entry,
            "left",
            childIndex,
          )
        }
        changeIndexForTableRow={(entry, rowIndex) =>
          renderedTableRowChangeIndex(presentation, entry, "left", rowIndex)
        }
        syncIndexForEntry={(entry) => renderedEntrySyncIndexes.get(entry.id) ?? 0}
        onScroll={() => undefined}
      />
      <RenderedDiffPane
        label={preview.rightLabel}
        entries={visibleEntries}
        side="right"
        paneRef={rightRef}
        reviewId="diff-stream-right-pane"
        blockReviewId="diff-stream-rendered-block"
        documentClassName={documentClassName}
        documentFormat={documentFormat}
        activeChangeIndex={activeChangeIndex}
        focusTableRows={true}
        inlineDiagnostics={presentation.inlineDiagnostics}
        onContextMenu={(event) =>
          handleDiffContextMenu(event, "right", "rendered", event.currentTarget)
        }
        changeIndexForEntry={(entry) =>
          renderedEntryChangeIndex(presentation, entry, "right")
        }
        changeIndexForListItem={(entry, itemIndex) =>
          renderedListItemChangeIndex(presentation, entry, "right", itemIndex)
        }
        changeIndexForStructuredChild={(entry, childIndex) =>
          renderedStructuredChildChangeIndex(
            presentation,
            entry,
            "right",
            childIndex,
          )
        }
        changeIndexForTableRow={(entry, rowIndex) =>
          renderedTableRowChangeIndex(presentation, entry, "right", rowIndex)
        }
        syncIndexForEntry={(entry) => renderedEntrySyncIndexes.get(entry.id) ?? 0}
        onScroll={() => undefined}
      />
    </div>
  );
}
