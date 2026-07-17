import { useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";
import type {
  PostDiffGitMarker,
  PostDiffGitMarkerKind,
} from "../lib/gitRenderedDiff";
import { applyInlineDiffHighlights } from "../lib/gitRenderedDiff";
import { perfBasename, tracePerf } from "../lib/perfTrace";
import { useRevisionLens } from "../hooks/useRevisionLens";
import type {
  ResolveRevisionLensTargets,
  ViewerPostDiffGitMarkerContext,
} from "../types";

interface PositionedPostDiffGitMarker extends PostDiffGitMarker {
  top: number;
  rangeStart: number;
  rangeEnd: number;
  rangeHeight: number;
  target: HTMLElement;
  blockTarget: HTMLElement;
}

interface DisplayPostDiffGitMarker extends PositionedPostDiffGitMarker {
  markerCount: number;
  targetMarkers: PositionedPostDiffGitMarker[];
}

interface PostDiffGitMarkersProps {
  articleRef: RefObject<HTMLElement | null>;
  context: ViewerPostDiffGitMarkerContext | null;
  displayMode: "detailed" | "subtle";
  resolveRevisionLensTargets?: ResolveRevisionLensTargets;
}

const blockSelector =
  "h1,h2,h3,h4,h5,h6,p,ul,ol,table,pre,blockquote,.admonitionblock,.markdown-alert,.imageblock,.diagram-slot,img,.math-block";

function blockKindForElement(element: Element): string | null {
  const tagName = element.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tagName)) {
    return "heading";
  }
  if (element.classList.contains("diagram-slot")) {
    return "diagram";
  }
  if (element.querySelector(".diagram-slot")) {
    return "diagram";
  }
  if (tagName === "img" || element.querySelector("img")) {
    return "image";
  }
  if (
    tagName === "p" ||
    element.classList.contains("math-block") ||
    tagName === "ul" ||
    tagName === "ol" ||
    tagName === "table" ||
    tagName === "pre" ||
    tagName === "blockquote" ||
    element.classList.contains("admonitionblock") ||
    element.classList.contains("markdown-alert")
  ) {
    return tagName;
  }
  return null;
}

function shouldSkipDescendantBlock(element: Element): boolean {
  if (element.closest(".revision-lens-replacement")) {
    return true;
  }
  if (
    element.tagName.toLowerCase() === "img" &&
    element.parentElement &&
    blockKindForElement(element.parentElement) === "image"
  ) {
    return true;
  }
  if (
    !element.classList.contains("diagram-slot") &&
    element.parentElement?.closest(".diagram-slot")
  ) {
    return true;
  }
  if (
    element.classList.contains("diagram-slot") &&
    element.parentElement &&
    blockKindForElement(element.parentElement) === "diagram"
  ) {
    return true;
  }
  return Boolean(
    element.parentElement?.closest(
      "table, pre, blockquote, ul, ol, .admonitionblock, .markdown-alert, .stemblock",
    ) && !element.classList.contains("math-block"),
  );
}

function collectBlockAnchors(article: HTMLElement): Map<string, HTMLElement> {
  const anchors = new Map<string, HTMLElement>();
  Array.from(article.querySelectorAll<HTMLElement>(blockSelector))
    .filter((element) => blockKindForElement(element) !== null)
    .filter((element) => !shouldSkipDescendantBlock(element))
    .forEach((element, index) => {
      anchors.set(`rendered-block:${index}`, element);
    });
  return anchors;
}

function topLevelListItemTarget(
  block: HTMLElement,
  itemIndex: number | undefined,
): HTMLElement | null {
  if (itemIndex === undefined) {
    return null;
  }
  if (
    block.tagName.toLowerCase() !== "ul" &&
    block.tagName.toLowerCase() !== "ol"
  ) {
    return null;
  }
  return (
    Array.from(block.children).filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement && child.tagName.toLowerCase() === "li",
    )[itemIndex] ?? null
  );
}

function topLevelTableRowTarget(
  block: HTMLElement,
  rowIndex: number | undefined,
): HTMLTableRowElement | null {
  if (rowIndex === undefined || block.tagName.toLowerCase() !== "table") {
    return null;
  }
  return (block as HTMLTableElement).rows[rowIndex] ?? null;
}

function markerLabel(kind: PostDiffGitMarkerKind): string {
  if (kind === "added") {
    return "Go to added change";
  }
  if (kind === "removed") {
    return "Go to removed content near here";
  }
  return "Go to changed block";
}

function clearPostDiffHighlights(article: HTMLElement | null) {
  article
    ?.querySelectorAll<HTMLElement>(
      ".post-diff-git-highlight,.post-diff-git-highlight-table-row",
    )
    .forEach((element) => {
      element.classList.remove(
        "post-diff-git-highlight",
        "post-diff-git-highlight-added",
        "post-diff-git-highlight-changed",
        "post-diff-git-highlight-removed",
        "post-diff-git-highlight-list-item",
        "post-diff-git-highlight-table-row",
        "post-diff-git-highlight-table-cell",
      );
      delete element.dataset.postDiffGitMarkerKind;
      delete element.dataset.reviewIdPostDiffGitHighlight;
    });
  article
    ?.querySelectorAll<HTMLElement>(".git-inline-word-highlight")
    .forEach((element) => {
      const parent = element.parentNode;
      if (!parent) {
        return;
      }
      while (element.firstChild) {
        parent.insertBefore(element.firstChild, element);
      }
      parent.removeChild(element);
      parent.normalize();
    });
}

function applyTableCellHighlights(marker: PositionedPostDiffGitMarker) {
  if (
    marker.targetKind !== "table-row" ||
    !(marker.target instanceof HTMLTableRowElement)
  ) {
    return;
  }
  marker.target.classList.add(
    "post-diff-git-highlight-table-row",
    `post-diff-git-highlight-${marker.kind}`,
  );
  marker.target.dataset.postDiffGitMarkerKind = marker.kind;
  marker.target.dataset.reviewIdPostDiffGitHighlight =
    "post-diff-git-highlight";

  for (const highlight of marker.tableCellHighlights ?? []) {
    const cell = marker.target.cells[highlight.cellIndex] as
      | HTMLElement
      | undefined;
    if (!cell) {
      continue;
    }
    cell.classList.add(
      "post-diff-git-highlight",
      "post-diff-git-highlight-table-cell",
      `post-diff-git-highlight-${highlight.kind}`,
    );
    cell.dataset.postDiffGitMarkerKind = highlight.kind;
    cell.dataset.reviewIdPostDiffGitHighlight = "post-diff-git-highlight";
    if (highlight.inlineDiffRanges?.length) {
      applyInlineDiffHighlights(cell, highlight.inlineDiffRanges);
    }
  }
}

function applyPostDiffHighlights(markers: PositionedPostDiffGitMarker[]) {
  const seenTargets = new Set<HTMLElement>();
  for (const marker of markers) {
    if (marker.highlightBlock === false) {
      continue;
    }
    if (marker.targetKind === "table-row") {
      applyTableCellHighlights(marker);
      continue;
    }
    if (seenTargets.has(marker.target)) {
      continue;
    }
    seenTargets.add(marker.target);
    marker.target.classList.add(
      "post-diff-git-highlight",
      `post-diff-git-highlight-${marker.kind}`,
    );
    if (marker.targetKind === "list-item") {
      marker.target.classList.add("post-diff-git-highlight-list-item");
    }
    marker.target.dataset.postDiffGitMarkerKind = marker.kind;
    marker.target.dataset.reviewIdPostDiffGitHighlight =
      "post-diff-git-highlight";
    if (marker.inlineDiffRanges && marker.inlineDiffRanges.length > 0) {
      applyInlineDiffHighlights(marker.target, marker.inlineDiffRanges, {
        includeSourceBlocks: marker.includeSourceBlocks,
      });
    }
  }
}

function hasPostDiffHighlight(marker: PositionedPostDiffGitMarker): boolean {
  if (marker.highlightBlock === false) {
    return true;
  }
  if (marker.targetKind === "table-row") {
    return (marker.tableCellHighlights ?? []).every((highlight) => {
      if (!(marker.target instanceof HTMLTableRowElement)) {
        return false;
      }
      const cell = marker.target.cells[highlight.cellIndex] as
        | HTMLElement
        | undefined;
      if (!cell?.classList.contains("post-diff-git-highlight-table-cell")) {
        return false;
      }
      return (highlight.inlineDiffRanges ?? []).every((range) =>
        cell.querySelector(`.git-inline-word-highlight.${range.kind}`),
      );
    });
  }
  if (!marker.target.classList.contains("post-diff-git-highlight")) {
    return false;
  }
  if (!marker.inlineDiffRanges || marker.inlineDiffRanges.length === 0) {
    return true;
  }
  return marker.inlineDiffRanges.every((range) =>
    marker.target.querySelector(`.git-inline-word-highlight.${range.kind}`),
  );
}

function compactDisplayMarkers(
  markers: PositionedPostDiffGitMarker[],
): DisplayPostDiffGitMarker[] {
  const groups: DisplayPostDiffGitMarker[] = [];
  for (const marker of markers) {
    const previous = groups[groups.length - 1];
    const previousLast =
      previous?.targetMarkers[previous.targetMarkers.length - 1] ?? null;
    const isAdjacent =
      previousLast &&
      previousLast.kind === marker.kind &&
      Math.abs(previousLast.changeIndex - marker.changeIndex) <= 1 &&
      marker.rangeStart - previousLast.rangeEnd <= 24;
    if (previous && isAdjacent) {
      previous.targetMarkers.push(marker);
      previous.markerCount += 1;
      previous.rangeStart = Math.min(
        ...previous.targetMarkers.map((item) => item.rangeStart),
      );
      previous.rangeEnd = Math.max(
        ...previous.targetMarkers.map((item) => item.rangeEnd),
      );
      previous.rangeHeight = previous.rangeEnd - previous.rangeStart;
      previous.top = previous.rangeStart + previous.rangeHeight / 2;
      continue;
    }
    groups.push({
      ...marker,
      markerCount: 1,
      targetMarkers: [marker],
    });
  }
  return groups;
}

export function PostDiffGitMarkers({
  articleRef,
  context,
  displayMode,
  resolveRevisionLensTargets,
}: PostDiffGitMarkersProps) {
  const [markers, setMarkers] = useState<DisplayPostDiffGitMarker[]>([]);
  const [overlayStyle, setOverlayStyle] = useState<CSSProperties | null>(null);
  const highlightedContextRef = useRef<ViewerPostDiffGitMarkerContext | null>(
    null,
  );
  const activePointerIdRef = useRef<number | null>(null);
  const suppressNextClickRef = useRef(false);
  const {
    hint: revisionLensHint,
    beginPointerHold,
    cancelPointerHold,
    endPointerHold,
    movePointerHold,
    prepareMarkers: prepareRevisionLensMarkers,
  } = useRevisionLens({
    articleRef,
    contextIdentity: `${context?.documentPath ?? "none"}:${context?.documentUpdatedAt ?? "none"}:${context?.revisionLensGeneration ?? 0}:${displayMode}:${context?.markers.map((marker) => marker.id).join("|") ?? ""}`,
    resolveTargets: resolveRevisionLensTargets,
  });

  useLayoutEffect(() => {
    if (!context || context.markers.length === 0) {
      setMarkers([]);
      setOverlayStyle(null);
      clearPostDiffHighlights(articleRef.current);
      highlightedContextRef.current = null;
      return;
    }

    let animationFrame = 0;
    let boundArticle: HTMLElement | null = null;
    let boundPane: HTMLElement | null = null;
    let observer: MutationObserver | null = null;
    const bindTargets = (article: HTMLElement, pane: HTMLElement) => {
      if (boundArticle === article && boundPane === pane) {
        return;
      }
      observer?.disconnect();
      boundPane?.removeEventListener("scroll", updateMarkers);
      boundArticle = article;
      boundPane = pane;
      observer =
        typeof MutationObserver !== "undefined"
          ? new MutationObserver(() => {
              window.cancelAnimationFrame(animationFrame);
              animationFrame = window.requestAnimationFrame(updateMarkers);
            })
          : null;
      observer?.observe(article, {
        childList: true,
        subtree: true,
      });
      pane.addEventListener("scroll", updateMarkers, { passive: true });
    };
    const updateMarkers = () => {
      const article = articleRef.current;
      const pane = article?.closest<HTMLElement>(".viewer-pane") ?? null;
      if (!article || !pane) {
        setMarkers([]);
        setOverlayStyle(null);
        return;
      }
      bindTargets(article, pane);

      const articleRect = article.getBoundingClientRect();
      const paneRect = pane.getBoundingClientRect();
      const anchors = collectBlockAnchors(article);
      const positioned = context.markers
        .map((marker) => {
          const blockTarget = marker.anchorBlockId
            ? anchors.get(marker.anchorBlockId)
            : article;
          if (!blockTarget) {
            return null;
          }
          const itemTarget =
            marker.targetKind === "list-item"
              ? topLevelListItemTarget(blockTarget, marker.anchorItemIndex)
              : null;
          const tableRowTarget =
            marker.targetKind === "table-row"
              ? topLevelTableRowTarget(blockTarget, marker.anchorTableRowIndex)
              : null;
          const target = itemTarget ?? tableRowTarget ?? blockTarget;
          const rect = target.getBoundingClientRect();
          return {
            ...marker,
            blockTarget,
            target,
            top: rect.top + rect.height / 2,
            rangeStart: rect.top,
            rangeEnd: rect.top + rect.height,
            rangeHeight: rect.height,
          };
        })
        .filter(
          (marker): marker is PositionedPostDiffGitMarker => marker !== null,
        );
      const needsHighlight =
        displayMode === "detailed" &&
        (highlightedContextRef.current !== context ||
          positioned.some((marker) => !hasPostDiffHighlight(marker)));
      if (displayMode === "subtle" && highlightedContextRef.current) {
        clearPostDiffHighlights(article);
        highlightedContextRef.current = null;
      } else if (needsHighlight && positioned.length > 0) {
        clearPostDiffHighlights(article);
        applyPostDiffHighlights(positioned);
        highlightedContextRef.current = context;
      }

      setOverlayStyle({
        left: `${Math.max(paneRect.left + 4, articleRect.left - 18)}px`,
        top: "0px",
      });
      setMarkers(compactDisplayMarkers(positioned));
    };

    animationFrame = window.requestAnimationFrame(updateMarkers);
    window.addEventListener("resize", updateMarkers);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      observer?.disconnect();
      clearPostDiffHighlights(articleRef.current);
      highlightedContextRef.current = null;
      boundPane?.removeEventListener("scroll", updateMarkers);
      window.removeEventListener("resize", updateMarkers);
    };
  }, [articleRef, context, displayMode]);

  if (!context || markers.length === 0 || !overlayStyle) {
    return null;
  }

  return (
    <>
      <nav
        className={`post-diff-git-markers ${displayMode}`}
        data-review-id="post-diff-git-markers"
        data-display-mode={displayMode}
        data-marker-count={String(context.totalCount)}
        data-rendered-marker-count={String(markers.length)}
        data-table-cell-marker-count={String(
          context.tableSummary.tableCellMarkerCount,
        )}
        data-table-added-row-marker-count={String(
          context.tableSummary.tableAddedRowMarkerCount,
        )}
        data-table-block-fallback-count={String(
          context.tableSummary.tableBlockFallbackCount,
        )}
        data-table-not-applicable-count={String(
          context.tableSummary.tableNotApplicableCount,
        )}
        data-table-reason-counts={JSON.stringify(
          context.tableSummary.reasonCounts,
        )}
        aria-label="Post-diff git markers"
        style={overlayStyle}
      >
        {markers.map((marker) => (
          <button
            key={marker.id}
            type="button"
            className={`post-diff-git-marker ${marker.kind}`}
            data-review-id="post-diff-git-marker"
            data-marker-kind={marker.kind}
            aria-label={`${markerLabel(marker.kind)} ${marker.changeIndex + 1} of ${context.totalCount}. Press and hold to view Base. Hold B while focused.`}
            title={`${markerLabel(marker.kind)}. Press and hold to view Base.`}
            style={
              {
                top: `${marker.top}px`,
                "--post-diff-marker-range-height": `${marker.rangeHeight}px`,
              } as CSSProperties
            }
            onClick={() => {
              if (suppressNextClickRef.current) {
                suppressNextClickRef.current = false;
                return;
              }
              const target = marker.targetMarkers[0]?.target ?? marker.target;
              target.scrollIntoView({ block: "center" });
              prepareRevisionLensMarkers(
                marker.targetMarkers.map((lensTarget) => ({
                  marker: lensTarget,
                  blockTarget: lensTarget.blockTarget,
                  interactionTarget: lensTarget.target,
                })),
              );
              tracePerf("postDiffGitMarkers.click", {
                basename: perfBasename(context.documentPath),
                kind: marker.kind,
                markerCount: context.totalCount,
                renderedCount: context.renderedCount,
                clicked: true,
              });
            }}
            onFocus={() => {
              prepareRevisionLensMarkers(
                marker.targetMarkers.map((lensTarget) => ({
                  marker: lensTarget,
                  blockTarget: lensTarget.blockTarget,
                  interactionTarget: lensTarget.target,
                })),
              );
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) {
                return;
              }
              event.stopPropagation();
              activePointerIdRef.current = event.pointerId;
              suppressNextClickRef.current = false;
              try {
                event.currentTarget.setPointerCapture(event.pointerId);
              } catch {
                // Pointer capture is not available in every browser harness.
              }
              beginPointerHold(
                marker.targetMarkers.map((lensTarget) => ({
                  marker: lensTarget,
                  blockTarget: lensTarget.blockTarget,
                  interactionTarget: lensTarget.target,
                })),
                { x: event.clientX, y: event.clientY },
              );
            }}
            onPointerMove={(event) => {
              if (activePointerIdRef.current === event.pointerId) {
                event.stopPropagation();
                movePointerHold({ x: event.clientX, y: event.clientY });
              }
            }}
            onPointerUp={(event) => {
              if (activePointerIdRef.current !== event.pointerId) {
                return;
              }
              event.stopPropagation();
              suppressNextClickRef.current = endPointerHold();
              activePointerIdRef.current = null;
              try {
                event.currentTarget.releasePointerCapture(event.pointerId);
              } catch {
                // Pointer capture is not available in every browser harness.
              }
            }}
            onPointerCancel={(event) => {
              event.stopPropagation();
              activePointerIdRef.current = null;
              suppressNextClickRef.current = false;
              cancelPointerHold();
            }}
          />
        ))}
      </nav>
      {revisionLensHint && (
        <div
          className={`revision-lens-hint ${revisionLensHint.tone}`}
          data-review-id="revision-lens-hint"
          data-revision-lens-phase={revisionLensHint.tone}
          data-selection-exclude="true"
          style={{ left: revisionLensHint.left, top: revisionLensHint.top }}
        >
          {revisionLensHint.message}
        </div>
      )}
    </>
  );
}
