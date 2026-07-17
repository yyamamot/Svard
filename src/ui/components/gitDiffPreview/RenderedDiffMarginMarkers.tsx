import { useLayoutEffect, useRef, useState } from "react";
import {
  allDiffsUiPerformanceNow,
  useAllDiffsUiPerformance,
} from "../../lib/allDiffsUiPerformance";

interface RenderedDiffMarginMarker {
  height: number;
  index: number;
  top: number;
}

const renderedChangeTargetSelector = [
  ".git-rendered-block.change-target[data-change-index]",
  ".git-rendered-list-item-change[data-change-index]",
  ".git-rendered-structured-child-change[data-change-index]",
  ".git-rendered-table-row-change[data-change-index]",
].join(",");

function sameMarkers(
  left: readonly RenderedDiffMarginMarker[],
  right: readonly RenderedDiffMarginMarker[],
) {
  return (
    left.length === right.length &&
    left.every(
      (marker, index) =>
        marker.index === right[index]?.index &&
        marker.top === right[index]?.top &&
        marker.height === right[index]?.height,
    )
  );
}

export function RenderedDiffMarginMarkers({
  activeChangeIndex,
  layoutIdentity,
  side,
}: {
  activeChangeIndex?: number;
  layoutIdentity: object;
  side: "left" | "right";
}) {
  const [markers, setMarkers] = useState<RenderedDiffMarginMarker[]>([]);
  const hostRef = useRef<HTMLDivElement>(null);
  const measurement = useAllDiffsUiPerformance();

  useLayoutEffect(() => {
    const pane = hostRef.current?.parentElement;
    if (!pane) {
      setMarkers([]);
      return;
    }

    let frame = 0;
    const scrollContainer = pane.querySelector<HTMLElement>(
      ".git-rendered-scroll",
    );
    const observedTargets = new Set<HTMLElement>();
    let resizeObserver: ResizeObserver | null = null;
    const measure = () => {
      const startedAt = measurement.enabled ? allDiffsUiPerformanceNow() : 0;
      frame = 0;
      const paneRect = pane.getBoundingClientRect();
      const targets = Array.from(
        pane.querySelectorAll<HTMLElement>(renderedChangeTargetSelector),
      );
      if (resizeObserver) {
        const currentTargets = new Set(targets);
        observedTargets.forEach((target) => {
          if (!currentTargets.has(target)) {
            resizeObserver?.unobserve(target);
            observedTargets.delete(target);
          }
        });
        targets.forEach((target) => {
          if (!observedTargets.has(target)) {
            resizeObserver?.observe(target);
            observedTargets.add(target);
          }
        });
      }
      const ranges = new Map<
        number,
        { bottom: number; index: number; top: number }
      >();
      targets.forEach((target) => {
        const index = Number.parseInt(target.dataset.changeIndex ?? "", 10);
        if (!Number.isFinite(index)) {
          return;
        }
        const rect = target.getBoundingClientRect();
        const top = rect.top - paneRect.top;
        const bottom = top + Math.max(2, rect.height);
        const current = ranges.get(index);
        ranges.set(index, {
          bottom: current ? Math.max(current.bottom, bottom) : bottom,
          index,
          top: current ? Math.min(current.top, top) : top,
        });
      });
      const next = Array.from(ranges.values())
        .map(({ bottom, index, top }) => ({
          height: bottom - top,
          index,
          top,
        }))
        .sort((left, right) => left.index - right.index);
      setMarkers((current) => (sameMarkers(current, next) ? current : next));
      if (measurement.enabled) {
        measurement.record({
          type: "margin-measure",
          durationMs: allDiffsUiPerformanceNow() - startedAt,
          rectCount: targets.length + 1,
          targetCount: targets.length,
        });
      }
    };
    const scheduleMeasure = () => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(measure);
      }
    };

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver((entries) => {
        if (measurement.enabled) {
          measurement.record({
            type: "margin-resize-callback",
            callbackCount: 1,
            entryCount: entries.length,
          });
        }
        scheduleMeasure();
      });
      resizeObserver.observe(pane);
    }
    let mutationObserver: MutationObserver | null = null;
    if (typeof MutationObserver !== "undefined") {
      mutationObserver = new MutationObserver((mutations) => {
        if (measurement.enabled) {
          measurement.record({
            type: "margin-mutation-callback",
            callbackCount: 1,
            mutationCount: mutations.length,
          });
        }
        scheduleMeasure();
      });
      mutationObserver.observe(pane, {
        attributeFilter: ["class", "data-change-index"],
        attributes: true,
        childList: true,
        subtree: true,
      });
    }
    window.addEventListener("resize", scheduleMeasure);
    scrollContainer?.addEventListener("scroll", scheduleMeasure, {
      passive: true,
    });
    measure();

    return () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      scrollContainer?.removeEventListener("scroll", scheduleMeasure);
    };
  }, [layoutIdentity, measurement]);

  return (
    <div
      className={`git-rendered-margin-markers ${side}-side`}
      data-review-id="git-rendered-margin-markers"
      data-marker-side={side}
      aria-hidden="true"
      ref={hostRef}
    >
      {markers.map((marker) => (
        <span
          key={`${side}:${marker.index}`}
          className={`git-rendered-margin-marker${
            marker.index === activeChangeIndex ? " active" : ""
          }`}
          data-review-id="git-rendered-margin-marker"
          data-change-index={marker.index}
          style={{ height: marker.height, top: marker.top }}
        />
      ))}
    </div>
  );
}
