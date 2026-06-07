import type { MouseEvent, RefObject, UIEvent } from "react";
import type { DocumentFormat } from "../../../core/types";
import { sanitizeRenderedBlockHtml } from "../../lib/sanitizeHtml";
import { dangerouslySetSafeHtml, markSafeHtml } from "../../lib/safeHtml";
import {
  isRenderedDiffPresentationChangeEntry,
  renderedBlockVisualClass,
  renderedDiffPresentationEntryBlockKind,
  renderedDiffPresentationEntryBlocks,
  renderedDiffPresentationEntryChangeKind,
  renderedInlineDiffRanges,
  type GitRenderedDiffSummary,
  type InlineDiffRange,
  type RenderedBlockDiff,
  type RenderedDiffPresentation,
  type RenderedDiffPresentationEntry,
} from "../../lib/gitRenderedDiff";

export const emptyRenderedSummary: GitRenderedDiffSummary = {
  blocks: [],
};

function wrapTextNodeRange(
  root: HTMLElement,
  node: Text,
  start: number,
  end: number,
  kind: InlineDiffRange["kind"],
): void {
  if (end <= start) {
    return;
  }
  const range = root.ownerDocument.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  const marker = root.ownerDocument.createElement("span");
  marker.className = `git-inline-word-highlight ${kind}`;
  if (!node.parentElement?.closest("pre")) {
    marker.setAttribute("data-review-id", "git-diff-word-highlight");
  }
  range.surroundContents(marker);
}

interface NormalizedTextPoint {
  node: Text;
  offset: number;
}

interface NormalizedTextSegment {
  node: Text;
  start: number;
  end: number;
  kind: InlineDiffRange["kind"];
}

interface InlineDiffHighlightOptions {
  includeSourceBlocks?: boolean;
}

function isInlineDiffTextExcluded(
  element: Element | null,
  options: InlineDiffHighlightOptions = {},
): boolean {
  if (!options.includeSourceBlocks && element?.closest("pre")) {
    return true;
  }
  return Boolean(
    element?.closest(".katex, .math-inline, .math-block, .diagram-inline, svg"),
  );
}

function normalizedTextPoints(
  root: HTMLElement,
  options: InlineDiffHighlightOptions = {},
): NormalizedTextPoint[] {
  const points: NormalizedTextPoint[] = [];
  let previousWasWhitespace = true;
  const walker = root.ownerDocument.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
  );
  let node = walker.nextNode() as Text | null;
  while (node) {
    if (isInlineDiffTextExcluded(node.parentElement, options)) {
      node = walker.nextNode() as Text | null;
      continue;
    }
    for (let offset = 0; offset < node.data.length; offset += 1) {
      const char = node.data[offset] ?? "";
      if (/\s/u.test(char)) {
        if (!previousWasWhitespace) {
          points.push({ node, offset });
          previousWasWhitespace = true;
        }
        continue;
      }
      points.push({ node, offset });
      previousWasWhitespace = false;
    }
    node = walker.nextNode() as Text | null;
  }
  return points;
}

export function applyInlineDiffHighlights(
  root: HTMLElement,
  ranges: InlineDiffRange[],
  options: InlineDiffHighlightOptions = {},
): void {
  const points = normalizedTextPoints(root, options);
  const segments: NormalizedTextSegment[] = [];
  for (const range of ranges) {
    const startPoint = points[range.start];
    const endPoint = points[Math.max(range.start, range.end - 1)];
    if (!startPoint || !endPoint) {
      continue;
    }
    const firstIndex = points.indexOf(startPoint);
    const lastIndex = points.indexOf(endPoint);
    let index = firstIndex;
    while (index <= lastIndex) {
      const node = points[index]?.node;
      if (!node) {
        break;
      }
      const start = points[index]?.offset ?? 0;
      let end = start + 1;
      index += 1;
      while (index <= lastIndex && points[index]?.node === node) {
        end = (points[index]?.offset ?? end - 1) + 1;
        index += 1;
      }
      if (!node.data.slice(start, end).trim()) {
        continue;
      }
      segments.push({ node, start, end, kind: range.kind });
    }
  }

  segments
    .sort((left, right) => {
      if (left.node === right.node) {
        return right.start - left.start;
      }
      return 0;
    })
    .forEach((segment) => {
      wrapTextNodeRange(
        root,
        segment.node,
        segment.start,
        segment.end,
        segment.kind,
      );
    });
}

export function renderedEntryChangeIndex(
  presentation: RenderedDiffPresentation,
  entry: RenderedDiffPresentationEntry,
  side: "left" | "right",
): number | null {
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

function sentenceCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function blockKindLabel(blockKind: string): string {
  return blockKind.replace(/-/g, " ");
}

function pluralizeBlockCount(count: number): string {
  return `${count} ${count === 1 ? "block" : "blocks"}`;
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
  entries,
  side,
  reviewId,
  blockReviewId,
  contentCursorActive,
  documentClassName,
  documentFormat = "markdown",
  showBlockMeta = true,
  showInlineWordDiff = true,
  changeIndexForEntry,
  syncIndexForEntry,
  onContextMenu,
  onScroll,
  paneRef,
}: {
  label: string;
  entries: RenderedDiffPresentationEntry[];
  side: "left" | "right";
  reviewId: string;
  blockReviewId: string;
  contentCursorActive?: { side: "left" | "right"; entryId: string } | null;
  documentClassName: string;
  documentFormat?: DocumentFormat;
  showBlockMeta?: boolean;
  showInlineWordDiff?: boolean;
  changeIndexForEntry: (entry: RenderedDiffPresentationEntry) => number | null;
  syncIndexForEntry: (entry: RenderedDiffPresentationEntry) => number;
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
  paneRef: RefObject<HTMLDivElement | null>;
  onScroll: (event: UIEvent<HTMLDivElement>) => void;
}) {
  function highlightedBlockHtml(block: RenderedBlockDiff): string | null {
    const visibleBlock = side === "left" ? block.left : block.right;
    if (!visibleBlock || !showInlineWordDiff || block.blockKind === "diagram") {
      return visibleBlock?.html ?? null;
    }

    const ranges =
      block.kind === "changed" && block.left?.text && block.right?.text
        ? renderedInlineDiffRanges(block.left.text, block.right.text, side)
        : [];
    if (ranges.length === 0) {
      return visibleBlock.html;
    }

    const doc = new DOMParser().parseFromString(visibleBlock.html, "text/html");
    applyInlineDiffHighlights(doc.body, ranges, {
      includeSourceBlocks: block.blockKind === "source-block",
    });
    return doc.body.innerHTML;
  }

  function renderVisibleBlock(block: RenderedBlockDiff, key?: string) {
    const visibleBlock = side === "left" ? block.left : block.right;
    const highlightedHtml = highlightedBlockHtml(block);
    if (!visibleBlock) {
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
              {renderVisibleBlock(block)}
            </div>
          ))}
        </div>
      );
    }

    const visible = renderVisibleBlock(entry.block);
    if (visible) {
      return visible;
    }
    return (
      <div className="git-rendered-placeholder">
        {side === "left" ? "Added on right" : "Removed on left"}
      </div>
    );
  }

  return (
    <section
      className="git-rendered-pane"
      data-review-id={reviewId}
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
          const isContentCursorActive =
            contentCursorActive?.side === side &&
            contentCursorActive.entryId === entry.id;
          return (
            <article
              key={`${entry.id}:${side}`}
              className={`git-rendered-block ${sideClass} ${side}-side ${
                changeIndex !== null ? "change-target" : ""
              } ${isContentCursorActive ? "content-cursor-active" : ""}`}
              data-review-id={
                isContentCursorActive ? "content-cursor-active" : blockReviewId
              }
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
                    <strong>{meta.primary}</strong>
                    {meta.detail && (
                      <>
                        <span aria-hidden="true">·</span>
                        <em>{meta.detail}</em>
                      </>
                    )}
                  </div>
                )}
              {renderEntryBody(entry)}
            </article>
          );
        })}
      </div>
    </section>
  );
}
