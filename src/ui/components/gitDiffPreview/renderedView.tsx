import type { MouseEvent, RefObject, UIEvent } from "react";
import type { DocumentFormat } from "../../../core/types";
import { sanitizeRenderedBlockHtml } from "../../lib/sanitizeHtml";
import { dangerouslySetSafeHtml, markSafeHtml } from "../../lib/safeHtml";
import {
  isRenderedDiffPresentationChangeEntry,
  renderedBlockVisualClass,
  renderedDiffListItemChangeIndex,
  renderedDiffStructuredChildChangeIndex,
  renderedDiffTableRowChangeIndex,
  renderedDiffPresentationEntryBlockKind,
  renderedDiffPresentationEntryBlocks,
  renderedDiffPresentationEntryChangeKind,
  renderedInlineDiffRanges,
  renderedListItemHighlightsForSide,
  renderedStructuredChildHighlightsForSide,
  renderedTableHighlightsForSide,
  applyRenderedListItemHighlights,
  applyRenderedStructuredChildHighlights,
  applyRenderedTableHighlights,
  applyInlineDiffHighlights,
  type GitRenderedDiffSummary,
  type RenderedBlockDiff,
  type RenderedDiffContentCursorTarget,
  type RenderedDiffFallbackReason,
  type RenderedDiffInlineDiagnostic,
  type RenderedDiffPresentation,
  type RenderedDiffPresentationEntry,
} from "../../lib/gitRenderedDiff";
import { RenderedDiffMarginMarkers } from "./RenderedDiffMarginMarkers";

export const emptyRenderedSummary: GitRenderedDiffSummary = {
  blocks: [],
};

export function renderedEntryChangeIndex(
  presentation: RenderedDiffPresentation,
  entry: RenderedDiffPresentationEntry,
  side: "left" | "right",
): number | null {
  if (
    entry.kind === "block" &&
    entry.block.kind === "changed" &&
    (entry.block.childChanges?.length ||
      entry.block.structuredChanges?.length ||
      entry.block.tableChanges?.length)
  ) {
    return null;
  }
  const changeIndex = presentation.entryChangeIndexes.get(entry.id);
  if (changeIndex === undefined) {
    return null;
  }
  const targetSide = presentation.entryTargetSides.get(entry.id);
  if (targetSide === "both" || targetSide === side) {
    return changeIndex;
  }
  return null;
}

export function renderedListItemChangeIndex(
  presentation: RenderedDiffPresentation,
  entry: RenderedDiffPresentationEntry,
  side: "left" | "right",
  itemIndex: number,
): number | null {
  return renderedDiffListItemChangeIndex(presentation, entry, side, itemIndex);
}

export function renderedTableRowChangeIndex(
  presentation: RenderedDiffPresentation,
  entry: RenderedDiffPresentationEntry,
  side: "left" | "right",
  rowIndex: number,
): number | null {
  return renderedDiffTableRowChangeIndex(presentation, entry, side, rowIndex);
}

export function renderedStructuredChildChangeIndex(
  presentation: RenderedDiffPresentation,
  entry: RenderedDiffPresentationEntry,
  side: "left" | "right",
  childIndex: number,
): number | null {
  return renderedDiffStructuredChildChangeIndex(
    presentation,
    entry,
    side,
    childIndex,
  );
}

function sentenceCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function blockKindLabel(blockKind: string): string {
  return blockKind.replace(/-/g, " ");
}

function pluralizeBlockCount(count: number): string {
  return `${count} ${count === 1 ? "block" : "blocks"}`;
}

function fallbackReasonText(
  reason: RenderedDiffFallbackReason["reason"],
): string {
  return reason.replace(/-/g, " ");
}

export function renderedDiffFallbackIndicatorLabel(
  reason: RenderedDiffFallbackReason,
): string {
  return `${sentenceCase(reason.kind)} fallback: ${fallbackReasonText(
    reason.reason,
  )}`;
}

export function renderedDiffPresentationEntryMetaLabel(
  entry: RenderedDiffPresentationEntry,
): {
  detail?: string;
  primary: string;
} {
  const changeKind = renderedDiffPresentationEntryChangeKind(entry);
  const action = changeKind === "added" ? "Added" : "Removed";
  if (entry.kind === "group") {
    const firstKind = renderedDiffPresentationEntryBlockKind(entry);
    return {
      primary: `${action} ${firstKind === "heading" ? "section" : "content"}`,
      detail: pluralizeBlockCount(entry.blocks.length),
    };
  }
  return {
    primary: `${sentenceCase(changeKind)} ${blockKindLabel(
      renderedDiffPresentationEntryBlockKind(entry),
    )}`,
  };
}

function DiffInlineDiagnosticNote({
  diagnostic,
}: {
  diagnostic: RenderedDiffInlineDiagnostic;
}) {
  return (
    <details
      className="diff-inline-diagnostic-note"
      data-review-id="diff-inline-diagnostic-note"
      data-diagnostic-category={diagnostic.category}
    >
      <summary>
        <span className="diff-inline-diagnostic-category">
          {diagnostic.label}
        </span>
      </summary>
      <p>{diagnostic.detail}</p>
    </details>
  );
}

export function hiddenRenderedGroupPlaceholderLabel(
  entry: Extract<RenderedDiffPresentationEntry, { kind: "group" }>,
): {
  fullLabel: string;
  primary: string;
} {
  const primary =
    entry.changeKind === "added" ? "Added on right" : "Removed on left";
  return {
    primary,
    fullLabel: `${primary} · ${pluralizeBlockCount(entry.blocks.length)}`,
  };
}

export function RenderedDiffPane({
  label,
  documentPath,
  entries,
  side,
  reviewId,
  blockReviewId,
  contentCursorActive,
  documentClassName,
  documentFormat = "markdown",
  activeChangeIndex,
  focusTableRows = false,
  showBlockMeta = true,
  showInlineWordDiff = true,
  inlineDiagnostics = [],
  changeIndexForEntry,
  changeIndexForListItem,
  changeIndexForStructuredChild,
  changeIndexForTableRow,
  syncIndexForEntry,
  onContextMenu,
  onScroll,
  paneRef,
}: {
  label: string;
  documentPath?: string | null;
  entries: RenderedDiffPresentationEntry[];
  side: "left" | "right";
  reviewId: string;
  blockReviewId: string;
  contentCursorActive?: RenderedDiffContentCursorTarget | null;
  documentClassName: string;
  documentFormat?: DocumentFormat;
  activeChangeIndex?: number;
  focusTableRows?: boolean;
  showBlockMeta?: boolean;
  showInlineWordDiff?: boolean;
  inlineDiagnostics?: RenderedDiffInlineDiagnostic[];
  changeIndexForEntry: (entry: RenderedDiffPresentationEntry) => number | null;
  changeIndexForListItem: (
    entry: RenderedDiffPresentationEntry,
    itemIndex: number,
  ) => number | null;
  changeIndexForStructuredChild: (
    entry: RenderedDiffPresentationEntry,
    childIndex: number,
  ) => number | null;
  changeIndexForTableRow: (
    entry: RenderedDiffPresentationEntry,
    rowIndex: number,
  ) => number | null;
  syncIndexForEntry: (entry: RenderedDiffPresentationEntry) => number;
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
  paneRef: RefObject<HTMLDivElement | null>;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
}) {
  function highlightedBlockHtml(
    entry: RenderedDiffPresentationEntry,
    block: RenderedBlockDiff,
  ): string | null {
    const visibleBlock = side === "left" ? block.left : block.right;
    if (!visibleBlock) {
      return null;
    }
    const itemHighlights = renderedListItemHighlightsForSide({
      activeChangeIndex,
      block,
      changeIndexForItem: (itemIndex) =>
        changeIndexForListItem(entry, itemIndex),
      contentCursorActiveForItem: (childChangeIndex) =>
        contentCursorActive?.side === side &&
        contentCursorActive.entryId === entry.id &&
        contentCursorActive.childChangeIndex === childChangeIndex,
      side,
    });
    const tableHighlights = renderedTableHighlightsForSide({
      activeChangeIndex,
      block,
      changeIndexForRow: (rowIndex) => changeIndexForTableRow(entry, rowIndex),
      contentCursorActiveForRow: (rowIndex) =>
        contentCursorActive?.side === side &&
        contentCursorActive.entryId === entry.id &&
        contentCursorActive.tableRowIndex === rowIndex,
      side,
    });
    if (
      focusTableRows &&
      block.kind === "changed" &&
      block.blockKind === "table" &&
      block.tableChanges?.length &&
      tableHighlights.length === 0
    ) {
      return null;
    }
    const structuredHighlights = renderedStructuredChildHighlightsForSide({
      activeChangeIndex,
      block,
      changeIndexForChild: (childIndex) =>
        changeIndexForStructuredChild(entry, childIndex),
      contentCursorActiveForChild: (childIndex) =>
        contentCursorActive?.side === side &&
        contentCursorActive.entryId === entry.id &&
        contentCursorActive.structuredChildIndex === childIndex,
      side,
    });
    const applyChildHighlights = (html: string) =>
      applyRenderedTableHighlights({
        focusRows: focusTableRows,
        highlights: tableHighlights,
        html: applyRenderedStructuredChildHighlights(
          applyRenderedListItemHighlights(html, itemHighlights),
          structuredHighlights,
        ),
        leftHtml: block.left?.html,
        rightHtml: block.right?.html,
        side,
      });
    if (!showInlineWordDiff || block.blockKind === "diagram") {
      return applyChildHighlights(visibleBlock.html);
    }
    if (structuredHighlights.length > 0 || tableHighlights.length > 0) {
      return applyChildHighlights(visibleBlock.html);
    }

    const ranges =
      block.kind === "changed" && block.left?.text && block.right?.text
        ? renderedInlineDiffRanges(block.left.text, block.right.text, side)
        : [];
    if (ranges.length === 0) {
      return applyChildHighlights(visibleBlock.html);
    }

    const doc = new DOMParser().parseFromString(visibleBlock.html, "text/html");
    applyInlineDiffHighlights(doc.body, ranges, {
      includeSourceBlocks: block.blockKind === "source-block",
    });
    return applyChildHighlights(doc.body.innerHTML);
  }

  function renderVisibleBlock(
    entry: RenderedDiffPresentationEntry,
    block: RenderedBlockDiff,
    key?: string,
  ) {
    const visibleBlock = side === "left" ? block.left : block.right;
    const highlightedHtml = highlightedBlockHtml(entry, block);
    if (!visibleBlock) {
      return null;
    }
    if (
      focusTableRows &&
      block.kind === "changed" &&
      block.blockKind === "table" &&
      block.tableChanges?.length &&
      highlightedHtml === null
    ) {
      return null;
    }
    return (
      <div
        key={key ?? block.id}
        className="git-rendered-block-content"
        dangerouslySetInnerHTML={dangerouslySetSafeHtml(
          block.blockKind === "diagram"
            ? markSafeHtml(visibleBlock.html)
            : sanitizeRenderedBlockHtml(highlightedHtml ?? visibleBlock.html, {
                format: documentFormat,
              }),
        )}
      />
    );
  }

  function entrySideClass(entry: RenderedDiffPresentationEntry): string {
    if (entry.kind === "block") {
      return renderedBlockVisualClass(entry.block, side);
    }
    const hiddenOnSide =
      (side === "left" && entry.changeKind === "added") ||
      (side === "right" && entry.changeKind === "removed");
    return hiddenOnSide ? "blank" : entry.changeKind;
  }

  function renderEntryBody(entry: RenderedDiffPresentationEntry) {
    const blocks = renderedDiffPresentationEntryBlocks(entry);
    if (entry.kind === "group") {
      const hiddenOnSide =
        (side === "left" && entry.changeKind === "added") ||
        (side === "right" && entry.changeKind === "removed");
      if (hiddenOnSide) {
        const label = hiddenRenderedGroupPlaceholderLabel(entry);
        return (
          <div
            className="git-rendered-placeholder compact"
            data-review-id="git-rendered-placeholder-group"
            title={label.fullLabel}
            aria-label={label.fullLabel}
          >
            {label.primary}
          </div>
        );
      }
      return (
        <div className="git-rendered-block-group">
          {blocks.map((block) => (
            <div
              key={`${block.id}:${side}`}
              className="git-rendered-group-item"
            >
              {renderVisibleBlock(entry, block)}
            </div>
          ))}
        </div>
      );
    }

    const visible = renderVisibleBlock(entry, entry.block);
    if (visible) {
      return visible;
    }
    return (
      <div className="git-rendered-placeholder">
        {side === "left" ? "Added on right" : "Removed on left"}
      </div>
    );
  }

  const inlineDiagnosticsByEntry = new Map<
    string,
    RenderedDiffInlineDiagnostic[]
  >();
  for (const diagnostic of inlineDiagnostics) {
    const diagnostics = inlineDiagnosticsByEntry.get(diagnostic.entryId) ?? [];
    diagnostics.push(diagnostic);
    inlineDiagnosticsByEntry.set(diagnostic.entryId, diagnostics);
  }

  return (
    <section
      className="git-rendered-pane"
      data-review-id={reviewId}
      data-capture-document-path={documentPath ?? undefined}
      data-capture-revision-label={label}
      data-capture-side={side}
      onContextMenu={onContextMenu}
    >
      <header>{label}</header>
      <div
        className={`git-rendered-scroll ${documentClassName}`}
        ref={paneRef}
        onScroll={onScroll}
      >
        {entries.map((entry) => {
          const sideClass = entrySideClass(entry);
          const changeIndex = changeIndexForEntry(entry);
          const syncIndex = syncIndexForEntry(entry);
          const meta = renderedDiffPresentationEntryMetaLabel(entry);
          const diagnostics = inlineDiagnosticsByEntry.get(entry.id) ?? [];
          const hasListItemChanges =
            entry.kind === "block" &&
            entry.block.kind === "changed" &&
            Boolean(entry.block.childChanges?.length);
          const hasTableRowChanges =
            entry.kind === "block" &&
            entry.block.kind === "changed" &&
            Boolean(entry.block.tableChanges?.length);
          const hasStructuredChildChanges =
            entry.kind === "block" &&
            entry.block.kind === "changed" &&
            Boolean(entry.block.structuredChanges?.length);
          const isContentCursorActive =
            contentCursorActive?.side === side &&
            contentCursorActive.entryId === entry.id &&
            contentCursorActive.childChangeIndex === undefined &&
            contentCursorActive.structuredChildIndex === undefined &&
            contentCursorActive.tableRowIndex === undefined;
          const isActiveChange =
            changeIndex !== null && activeChangeIndex === changeIndex;
          return (
            <article
              key={`${entry.id}:${side}`}
              className={`git-rendered-block ${sideClass} ${side}-side ${
                changeIndex !== null ? "change-target" : ""
              } ${hasListItemChanges ? "has-list-item-changes" : ""} ${
                hasStructuredChildChanges ? "has-structured-child-changes" : ""
              } ${hasTableRowChanges ? "has-table-row-changes" : ""} ${
                isActiveChange ? "active-change" : ""
              } ${isContentCursorActive ? "content-cursor-active" : ""}`}
              data-review-id={
                isContentCursorActive ? "content-cursor-active" : blockReviewId
              }
              data-active-change={isActiveChange ? "true" : undefined}
              data-content-cursor-active={
                isContentCursorActive ? "true" : undefined
              }
              data-sync-index={syncIndex}
              data-change-index={changeIndex ?? undefined}
            >
              {showBlockMeta &&
                sideClass !== "blank" &&
                isRenderedDiffPresentationChangeEntry(entry) && (
                  <div className="git-rendered-block-meta">
                    {showBlockMeta && <strong>{meta.primary}</strong>}
                    {showBlockMeta && meta.detail && (
                      <>
                        <span aria-hidden="true">·</span>
                        <em>{meta.detail}</em>
                      </>
                    )}
                  </div>
                )}
              {sideClass !== "blank" &&
                diagnostics.map((diagnostic) => (
                  <DiffInlineDiagnosticNote
                    key={diagnostic.id}
                    diagnostic={diagnostic}
                  />
                ))}
              {renderEntryBody(entry)}
            </article>
          );
        })}
      </div>
      <RenderedDiffMarginMarkers
        activeChangeIndex={activeChangeIndex}
        layoutIdentity={entries}
        side={side}
      />
    </section>
  );
}
