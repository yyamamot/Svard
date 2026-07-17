import { useEffect, useMemo, useState, type RefObject } from "react";
import type { RenderedDiffNavigationTarget } from "../../lib/gitRenderedDiff";
import {
  resolveChangeTargetInPane,
  resolveRenderedChangeAnchor,
} from "./renderedChangeAnchor";
import type { DiffView } from "./types";

export type DiffChangeRulerMarkerKind =
  | "added"
  | "removed"
  | "changed"
  | "table"
  | "diagram";

export interface DiffChangeRulerMarker {
  index: number;
  kind: DiffChangeRulerMarkerKind;
  topPercent: number;
}

export type DiffChangeRulerRenderedSide = "left" | "right";

export function clampRulerPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(100, Math.max(0, value));
}

export function changeRulerMarkerTopPercent({
  scrollHeight,
  targetTop,
}: {
  scrollHeight: number;
  targetTop: number;
}) {
  if (scrollHeight <= 0) {
    return 0;
  }
  return clampRulerPercent((targetTop / scrollHeight) * 100);
}

export function changeRulerTargetAnchorTop({
  container,
  target,
}: {
  container: HTMLElement;
  target: HTMLElement;
}) {
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  return (
    targetRect.top -
    containerRect.top +
    container.scrollTop +
    targetRect.height / 2
  );
}

function changeRulerEnabled(view: DiffView) {
  return view === "preview" || view === "rendered" || view === "source";
}

function markerKind(target: HTMLElement): DiffChangeRulerMarkerKind {
  if (
    target.querySelector('[data-review-id="git-diff-asciidoc-table-badge"]') ||
    target.querySelector('[data-review-id="git-diff-table-cell"]')
  ) {
    return "table";
  }
  if (
    target.querySelector('[data-review-id="diagram-inline-image"]') ||
    target.querySelector('[data-review-id="diagram-inline-diagnostic"]') ||
    target.querySelector(".mermaid, .plantuml, .graphviz")
  ) {
    return "diagram";
  }
  if (target.classList.contains("added")) {
    return "added";
  }
  if (target.classList.contains("removed")) {
    return "removed";
  }
  return "changed";
}

function measureMarker(
  index: number,
  panes: readonly (HTMLDivElement | null)[],
): DiffChangeRulerMarker | null {
  for (const pane of panes) {
    const target = resolveChangeTargetInPane(pane, index);
    if (!pane || !target) {
      continue;
    }
    return {
      index,
      kind: markerKind(target),
      topPercent: changeRulerMarkerTopPercent({
        scrollHeight: pane.scrollHeight,
        targetTop: changeRulerTargetAnchorTop({
          container: pane,
          target,
        }),
      }),
    };
  }
  return null;
}

export function renderedPanesForChangeRulerTarget({
  left,
  right,
  renderedSide,
  target,
}: {
  left: HTMLDivElement | null;
  right: HTMLDivElement | null;
  renderedSide?: DiffChangeRulerRenderedSide;
  target: RenderedDiffNavigationTarget | undefined;
}): HTMLDivElement[] {
  void target;
  if (renderedSide) {
    const pane = renderedSide === "left" ? left : right;
    return pane ? [pane] : [];
  }
  return [right, left].filter((pane): pane is HTMLDivElement => Boolean(pane));
}

export function isRulerMarkerActive({
  activeChangeIndex,
  markerIndex,
  renderedSide,
  target,
}: {
  activeChangeIndex: number;
  markerIndex: number;
  renderedSide?: DiffChangeRulerRenderedSide;
  target: RenderedDiffNavigationTarget | undefined;
}) {
  if (markerIndex !== activeChangeIndex) {
    return false;
  }
  if (!renderedSide) {
    return true;
  }
  return target?.side === "both" || target?.side === renderedSide;
}

function measureRenderedMarker(
  index: number,
  target: RenderedDiffNavigationTarget | undefined,
  left: HTMLDivElement | null,
  right: HTMLDivElement | null,
  renderedSide?: DiffChangeRulerRenderedSide,
): DiffChangeRulerMarker | null {
  const anchor = resolveRenderedChangeAnchor({
    changeIndex: index,
    leftPane: left,
    navigationTarget: target,
    renderedSide,
    rightPane: right,
  });
  if (!anchor) {
    return null;
  }
  return {
    index,
    kind: markerKind(anchor.semanticTarget),
    topPercent: changeRulerMarkerTopPercent({
      scrollHeight: anchor.markerScrollHeight,
      targetTop: anchor.anchorTop,
    }),
  };
}

export function DiffChangeRuler({
  activeChangeIndex,
  changeCount,
  leftRef,
  onSelectChange,
  renderedLeftRef,
  renderedNavigationTargets,
  renderedRightRef,
  renderedSide,
  rightRef,
  view,
}: {
  activeChangeIndex: number;
  changeCount: number;
  leftRef: RefObject<HTMLDivElement | null>;
  onSelectChange: (index: number) => void;
  renderedLeftRef: RefObject<HTMLDivElement | null>;
  renderedNavigationTargets: readonly RenderedDiffNavigationTarget[];
  renderedRightRef: RefObject<HTMLDivElement | null>;
  renderedSide?: DiffChangeRulerRenderedSide;
  rightRef: RefObject<HTMLDivElement | null>;
  view: DiffView;
}) {
  const [markers, setMarkers] = useState<DiffChangeRulerMarker[]>([]);
  const paneRefs = useMemo(
    () =>
      view === "source"
        ? ([rightRef, leftRef] as const)
        : renderedSide === "left"
          ? ([renderedLeftRef] as const)
          : renderedSide === "right"
            ? ([renderedRightRef] as const)
            : ([renderedRightRef, renderedLeftRef] as const),
    [leftRef, renderedLeftRef, renderedRightRef, renderedSide, rightRef, view],
  );

  useEffect(() => {
    if (!changeRulerEnabled(view) || changeCount <= 0) {
      setMarkers([]);
      return;
    }

    let frame = 0;
    let resizeObserver: ResizeObserver | null = null;
    const panes = paneRefs
      .map((ref) => ref.current)
      .filter((pane): pane is HTMLDivElement => Boolean(pane));
    const renderedLeft = renderedLeftRef.current;
    const renderedRight = renderedRightRef.current;

    function measure() {
      frame = 0;
      const nextMarkers = Array.from({ length: changeCount }, (_, index) =>
        view === "source"
          ? measureMarker(index, panes)
          : measureRenderedMarker(
              index,
              renderedNavigationTargets[index],
              renderedLeft,
              renderedRight,
              renderedSide,
            ),
      ).filter((marker): marker is DiffChangeRulerMarker => Boolean(marker));
      setMarkers(nextMarkers);
    }

    function scheduleMeasure() {
      if (frame) {
        return;
      }
      frame = window.requestAnimationFrame(measure);
    }

    panes.forEach((pane) =>
      pane.addEventListener("scroll", scheduleMeasure, { passive: true }),
    );
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(scheduleMeasure);
      panes.forEach((pane) => resizeObserver?.observe(pane));
    }
    window.addEventListener("resize", scheduleMeasure);
    scheduleMeasure();

    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
      panes.forEach((pane) =>
        pane.removeEventListener("scroll", scheduleMeasure),
      );
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [
    changeCount,
    paneRefs,
    renderedLeftRef,
    renderedNavigationTargets,
    renderedRightRef,
    renderedSide,
    view,
  ]);

  if (!changeRulerEnabled(view) || changeCount <= 0) {
    return null;
  }

  return (
    <div
      className={`git-diff-change-ruler${
        renderedSide ? ` rendered-side ${renderedSide}` : ""
      }`}
      data-review-id="git-diff-change-ruler"
      data-ruler-side={renderedSide ?? "single"}
      aria-label={
        renderedSide
          ? `${renderedSide === "left" ? "Left" : "Right"} diff change ruler`
          : "Diff change ruler"
      }
    >
      {markers.map((marker) => (
        <button
          key={`change-ruler-marker:${marker.index}`}
          type="button"
          className={`git-diff-change-ruler-marker ${marker.kind} ${
            isRulerMarkerActive({
              activeChangeIndex,
              markerIndex: marker.index,
              renderedSide,
              target: renderedNavigationTargets[marker.index],
            })
              ? "active"
              : ""
          }`}
          style={{ top: `${marker.topPercent}%` }}
          data-review-id="git-diff-change-ruler-marker"
          data-change-index={marker.index}
          data-ruler-side={renderedSide ?? "single"}
          aria-label={`Go to change ${marker.index + 1}`}
          onClick={() => onSelectChange(marker.index)}
        />
      ))}
    </div>
  );
}
