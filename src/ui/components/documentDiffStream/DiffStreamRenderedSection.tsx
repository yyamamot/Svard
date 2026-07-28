import { memo, useMemo, useRef, type MouseEvent } from "react";
import type {
  DocumentDiffPreview,
  DocumentLinkResolution,
  DocumentMediaSnapshot,
} from "../../../core/types";
import type { CopyText } from "../../hooks/documentLinks/types";
import type { GitRenderedDiffSummary } from "../../lib/gitRenderedDiff";
import {
  buildRenderedDiffPresentation,
  isRenderedDiffPresentationChangeEntry,
} from "../../lib/gitRenderedDiff";
import type { ContextMenuItem, DiagramPreviewState } from "../../types";
import { documentFormatForPath } from "../../../core/documentFormat";
import { createDiffPreviewContextMenuHandler } from "../gitDiffPreview/contextMenu";
import type { PreparedAgentChangeAction } from "../gitDiffPreview/contextMenuTypes";
import {
  RenderedDiffPane,
  renderedEntryChangeIndex,
  renderedListItemChangeIndex,
  renderedStructuredChildChangeIndex,
  renderedTableRowChangeIndex,
} from "../gitDiffPreview/renderedView";
import type { DiffStreamViewMode } from "./types";
import type { CaptureAreaVariant } from "../../lib/captureArea";
import { diffPreviewDocumentPath } from "../gitDiffPreview/contextMenuDocument";
import { renderedDiffDiagramForTarget } from "../../lib/documentMedia";

export const DiffStreamRenderedSection = memo(
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
    onPrepareAgentChange,
    onPrepareAgentSelection,
    onAddAgentMedia,
    onBeginCaptureArea,
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
    onPrepareAgentChange?: (
      target: HTMLElement,
      side: "left" | "right",
    ) => PreparedAgentChangeAction | undefined;
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
  }) {
    const leftRef = useRef<HTMLDivElement | null>(null);
    const rightRef = useRef<HTMLDivElement | null>(null);
    const pendingContextMenuRef = useRef<{
      container: HTMLElement;
      event: MouseEvent<HTMLElement>;
      side: "left" | "right";
    } | null>(null);
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
          allowLocationReference: true,
          preview,
          copyText,
          openContextMenu,
          openDocument,
          openPathInEditor,
          resolveDocumentLink,
          confirmExternalLink,
          openExternalUrl,
          onOpenDiagramPreview,
          onBeginCaptureArea: (container, variant = "plain") => {
            const section = container.closest<HTMLElement>(
              ".diff-stream-rendered-body",
            );
            if (section) onBeginCaptureArea(section, variant);
          },
          onPrepareAgentChange,
          onPrepareAgentSelection,
          onAddAgentMedia,
          resolveAgentMediaDiagram: (target, side) =>
            renderedDiffDiagramForTarget(target, visibleEntries, side),
          showInlineNotice,
        }),
      [
        confirmExternalLink,
        copyText,
        onOpenDiagramPreview,
        onPrepareAgentChange,
        onPrepareAgentSelection,
        onAddAgentMedia,
        onBeginCaptureArea,
        openContextMenu,
        openDocument,
        openExternalUrl,
        openPathInEditor,
        preview,
        resolveDocumentLink,
        showInlineNotice,
        visibleEntries,
      ],
    );
    const documentFormat = documentFormatForPath(preview.relativePath ?? "");
    const documentClassName = `markup-document format-${documentFormat}${
      documentFormat === "markdown" ? " markdown-body" : ""
    }`;

    function renderedPaneContext(target: EventTarget | null): {
      container: HTMLElement;
      side: "left" | "right";
    } | null {
      if (!(target instanceof HTMLElement)) {
        return null;
      }
      const pane = target.closest<HTMLElement>(".git-rendered-pane");
      if (!pane) {
        return null;
      }
      return {
        container: pane,
        side:
          pane.dataset.reviewId === "diff-stream-left-pane" ? "left" : "right",
      };
    }

    function handleRenderedContextMenuCapture(event: MouseEvent<HTMLElement>) {
      const context = renderedPaneContext(event.target);
      if (!context) {
        return;
      }
      if (event.buttons === 0) {
        pendingContextMenuRef.current = null;
        return;
      }
      pendingContextMenuRef.current = {
        container: context.container,
        event,
        side: context.side,
      };
      event.preventDefault();
      event.stopPropagation();
    }

    function handleRenderedMouseUpCapture(event: MouseEvent<HTMLElement>) {
      if (event.button !== 2) {
        return;
      }
      const pending = pendingContextMenuRef.current;
      if (!pending) {
        return;
      }
      pendingContextMenuRef.current = null;
      if (
        pending.event.target instanceof Node &&
        event.currentTarget.contains(pending.event.target)
      ) {
        handleDiffContextMenu(
          pending.event,
          pending.side,
          "rendered",
          pending.container,
        );
      }
    }

    if (summary.fallbackMessage && changedEntries.length === 0) {
      return (
        <p className="diff-stream-blocker-message">{summary.fallbackMessage}</p>
      );
    }
    if (visibleEntries.length === 0) {
      return (
        <p className="diff-stream-blocker-message">No rendered changes.</p>
      );
    }
    return (
      <div
        className="git-rendered-diff-body diff-stream-rendered-body"
        data-review-id="diff-stream-rendered-body"
        onContextMenuCapture={handleRenderedContextMenuCapture}
        onMouseUpCapture={handleRenderedMouseUpCapture}
      >
        <RenderedDiffPane
          label={preview.leftLabel}
          documentPath={diffPreviewDocumentPath(preview, "left")}
          entries={visibleEntries}
          side="left"
          paneRef={leftRef}
          reviewId="diff-stream-left-pane"
          blockReviewId="diff-stream-rendered-block"
          documentClassName={documentClassName}
          documentFormat={documentFormat}
          activeChangeIndex={activeChangeIndex}
          focusTableRows={true}
          showBlockMeta={viewMode !== "full"}
          inlineDiagnostics={presentation.inlineDiagnostics}
          onContextMenu={(event) =>
            handleDiffContextMenu(
              event,
              "left",
              "rendered",
              event.currentTarget,
            )
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
          syncIndexForEntry={(entry) =>
            renderedEntrySyncIndexes.get(entry.id) ?? 0
          }
          onScroll={() => undefined}
        />
        <RenderedDiffPane
          label={preview.rightLabel}
          documentPath={diffPreviewDocumentPath(preview, "right")}
          entries={visibleEntries}
          side="right"
          paneRef={rightRef}
          reviewId="diff-stream-right-pane"
          blockReviewId="diff-stream-rendered-block"
          documentClassName={documentClassName}
          documentFormat={documentFormat}
          activeChangeIndex={activeChangeIndex}
          focusTableRows={true}
          showBlockMeta={viewMode !== "full"}
          inlineDiagnostics={presentation.inlineDiagnostics}
          onContextMenu={(event) =>
            handleDiffContextMenu(
              event,
              "right",
              "rendered",
              event.currentTarget,
            )
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
          syncIndexForEntry={(entry) =>
            renderedEntrySyncIndexes.get(entry.id) ?? 0
          }
          onScroll={() => undefined}
        />
      </div>
    );
  },
);
