import { useEffect, useMemo, useState, type RefObject } from "react";
import type { RenderedDiffNavigationTarget } from "../../lib/gitRenderedDiff";
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

export function resolveChangeTargetInPane(
  pane: HTMLElement | null | undefined,
  index: number,
) {
  return pane?.querySelector<HTMLElement>(`[data-change-index="${index}"]`);
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

function renderedPanesForTarget({
  left,
  right,
  target,
}: {
  left: HTMLDivElement | null;
  right: HTMLDivElement | null;
  target: RenderedDiffNavigationTarget | undefined;
}): HTMLDivElement[] {
  const primary = target?.primarySide === "left" ? left : right;
  const secondary = target?.primarySide === "left" ? right : left;
  return [primary, secondary].filter((pane): pane is HTMLDivElement =>
    Boolean(pane),
  );
}

function measureRenderedMarker(
  index: number,
  target: RenderedDiffNavigationTarget | undefined,
  left: HTMLDivElement | null,
  right: HTMLDivElement | null,
): DiffChangeRulerMarker | null {
  return measureMarker(index, renderedPanesForTarget({ left, right, target }));
}

export function DiffChangeRuler({
  activeChangeIndex,
  changeCount,
  leftRef,
  onSelectChange,
  renderedLeftRef,
  renderedNavigationTargets,
  renderedRightRef,
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
  rightRef: RefObject<HTMLDivElement | null>;
  view: DiffView;
}) {
  const [markers, setMarkers] = useState<DiffChangeRulerMarker[]>([]);
  const paneRefs = useMemo(
    () =>
      view === "source"
        ? ([rightRef, leftRef] as const)
        : ([renderedRightRef, renderedLeftRef] as const),
    [leftRef, renderedLeftRef, renderedRightRef, rightRef, view],
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
    view,
  ]);

  if (!changeRulerEnabled(view) || changeCount <= 0) {
    return null;
  }

  return (
    <div
      className="git-diff-change-ruler"
      data-review-id="git-diff-change-ruler"
      aria-label="Diff change ruler"
    >
      {markers.map((marker) => (
        <button
          key={`change-ruler-marker:${marker.index}`}
          type="button"
          className={`git-diff-change-ruler-marker ${marker.kind} ${
            marker.index === activeChangeIndex ? "active" : ""
          }`}
          style={{ top: `${marker.topPercent}%` }}
          data-review-id="git-diff-change-ruler-marker"
          data-change-index={marker.index}
          aria-label={`Go to change ${marker.index + 1}`}
          onClick={() => onSelectChange(marker.index)}
        />
      ))}
    </div>
  );
}
