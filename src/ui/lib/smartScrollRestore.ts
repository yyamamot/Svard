import type { SmartScrollAnchor } from "../types";
import { expandCollapsedSectionsContaining } from "./sectionCollapse";

interface CaptureSmartScrollAnchorOptions {
  activeHeadingId: string | null;
  article: HTMLElement | null;
  path: string;
  viewer: HTMLElement | null;
}

interface RestoreSmartScrollAnchorOptions {
  anchor: SmartScrollAnchor;
  article: HTMLElement | null;
  setActiveHeadingId?: (headingId: string | null) => void;
  viewer: HTMLElement | null;
}

export function captureSmartScrollAnchor({
  activeHeadingId,
  article,
  path,
  viewer,
}: CaptureSmartScrollAnchorOptions): SmartScrollAnchor | null {
  if (!viewer || !article) {
    return null;
  }

  const sourceTarget = nearestSourceMappedElement(article, viewer);
  return {
    path,
    ...(activeHeadingId ? { headingId: activeHeadingId } : {}),
    ...(sourceTarget?.sourceLine
      ? { sourceLine: sourceTarget.sourceLine }
      : {}),
    ...(sourceTarget?.sourceReference
      ? { sourceReference: sourceTarget.sourceReference }
      : {}),
    scrollTop: Math.round(viewer.scrollTop),
    viewportOffset: sourceTarget ? Math.round(sourceTarget.viewportOffset) : 0,
  };
}

export function restoreSmartScrollAnchor({
  anchor,
  article,
  setActiveHeadingId,
  viewer,
}: RestoreSmartScrollAnchorOptions): boolean {
  if (!viewer || !article) {
    return false;
  }

  const heading = uniqueHeadingById(article, anchor.headingId);
  if (heading) {
    expandCollapsedSectionsContaining(heading);
    scrollElementToAnchor(viewer, heading, 0);
    setActiveHeadingId?.(anchor.headingId ?? null);
    return true;
  }

  const exactSource = uniqueSourceReferenceTarget(
    article,
    anchor.sourceReference,
  );
  if (exactSource) {
    expandCollapsedSectionsContaining(exactSource);
    scrollElementToAnchor(viewer, exactSource, anchor.viewportOffset);
    return true;
  }

  const nearbySource = nearestSourceLineTarget(article, anchor.sourceLine);
  if (nearbySource) {
    expandCollapsedSectionsContaining(nearbySource);
    scrollElementToAnchor(viewer, nearbySource, anchor.viewportOffset);
    return true;
  }

  scrollViewerTo(viewer, anchor.scrollTop);
  return true;
}

function nearestSourceMappedElement(article: HTMLElement, viewer: HTMLElement) {
  const candidates = [
    ...article.querySelectorAll<HTMLElement>("[data-source-line]"),
  ]
    .map((element) => {
      const sourceLine = Number(element.getAttribute("data-source-line"));
      if (!Number.isFinite(sourceLine)) {
        return null;
      }
      const rect = element.getBoundingClientRect();
      const viewerRect = viewer.getBoundingClientRect();
      return {
        element,
        sourceLine,
        sourceReference:
          element.getAttribute("data-source-reference") ?? undefined,
        viewportOffset: rect.top - viewerRect.top,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort((left, right) => {
    const leftDistance = Math.abs(left.viewportOffset);
    const rightDistance = Math.abs(right.viewportOffset);
    return leftDistance - rightDistance;
  })[0];
}

function uniqueHeadingById(article: HTMLElement, headingId?: string) {
  if (!headingId) {
    return null;
  }
  const matches = [
    ...article.querySelectorAll<HTMLElement>(`#${cssEscape(headingId)}`),
  ];
  return matches.length === 1 ? matches[0] : null;
}

function cssEscape(value: string): string {
  return globalThis.CSS?.escape
    ? globalThis.CSS.escape(value)
    : value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function uniqueSourceReferenceTarget(
  article: HTMLElement,
  sourceReference?: string,
) {
  if (!sourceReference) {
    return null;
  }
  const matches = [
    ...article.querySelectorAll<HTMLElement>("[data-source-reference]"),
  ].filter(
    (element) =>
      element.getAttribute("data-source-reference") === sourceReference,
  );
  return matches.length === 1 ? matches[0] : null;
}

function nearestSourceLineTarget(article: HTMLElement, sourceLine?: number) {
  if (!sourceLine) {
    return null;
  }
  const candidates = [
    ...article.querySelectorAll<HTMLElement>("[data-source-line]"),
  ]
    .map((element) => {
      const line = Number(element.getAttribute("data-source-line"));
      return Number.isFinite(line) ? { element, line } : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (candidates.length === 0) {
    return null;
  }

  return [...candidates].sort(
    (left, right) =>
      Math.abs(left.line - sourceLine) - Math.abs(right.line - sourceLine),
  )[0].element;
}

function scrollElementToAnchor(
  viewer: HTMLElement,
  target: HTMLElement,
  viewportOffset: number,
) {
  const viewerRect = viewer.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  scrollViewerTo(
    viewer,
    viewer.scrollTop + targetRect.top - viewerRect.top - viewportOffset,
  );
}

function scrollViewerTo(viewer: HTMLElement, top: number) {
  if (typeof viewer.scrollTo === "function") {
    viewer.scrollTo({ top, behavior: "auto" });
    return;
  }
  viewer.scrollTop = top;
}
