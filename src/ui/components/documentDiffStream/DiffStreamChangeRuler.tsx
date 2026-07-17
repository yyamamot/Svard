import { useEffect, useState, type RefObject } from "react";
import type { RenderedDiffNavigationTarget } from "../../lib/gitRenderedDiff";
import {
  allDiffsUiPerformanceNow,
  useAllDiffsUiPerformance,
} from "../../lib/allDiffsUiPerformance";
import {
  changeRulerMarkerTopPercent,
  changeRulerTargetAnchorTop,
  type DiffChangeRulerMarkerKind,
} from "../gitDiffPreview/changeRuler";
import { diffStreamSection, diffStreamTargetElement } from "./streamTargets";
import type { DiffStreamTarget } from "./types";

interface DiffStreamRulerMarker {
  changeIndex: number;
  fileIndex: number;
  index: number;
  key: string;
  kind: DiffChangeRulerMarkerKind;
  primarySide: "left" | "right";
  targetKind: RenderedDiffNavigationTarget["targetKind"];
  topPercent: number;
}

export function DiffStreamChangeRuler({
  activeTarget,
  streamBodyRef,
  targets,
  onSelectTarget,
}: {
  activeTarget: { fileIndex: number; changeIndex: number } | null;
  streamBodyRef: RefObject<HTMLDivElement | null>;
  targets: readonly DiffStreamTarget[];
  onSelectTarget: (target: DiffStreamTarget) => void;
}) {
  const [markers, setMarkers] = useState<DiffStreamRulerMarker[]>([]);
  const measurement = useAllDiffsUiPerformance();

  useEffect(() => {
    const streamBody = streamBodyRef.current;
    if (!streamBody || targets.length === 0) {
      setMarkers([]);
      return;
    }
    const body = streamBody;
    let frame = 0;
    let resizeObserver: ResizeObserver | null = null;

    function measure() {
      const startedAt = measurement.enabled ? allDiffsUiPerformanceNow() : 0;
      frame = 0;
      const nextMarkers = targets.flatMap((target, index) => {
        const section = diffStreamSection(body, target.fileIndex);
        const markerTarget = diffStreamTargetElement(section, target);
        if (!markerTarget) {
          return [];
        }
        const targetTop = changeRulerTargetAnchorTop({
          container: body,
          target: markerTarget,
        });
        return [
          {
            changeIndex: target.changeIndex,
            fileIndex: target.fileIndex,
            index,
            key: target.key,
            kind: diffStreamMarkerKind(markerTarget),
            primarySide: target.primarySide,
            targetKind: target.targetKind,
            topPercent: changeRulerMarkerTopPercent({
              scrollHeight: body.scrollHeight,
              targetTop,
            }),
          },
        ];
      });
      setMarkers(nextMarkers);
      if (measurement.enabled) {
        measurement.record({
          type: "stream-ruler-measure",
          durationMs: allDiffsUiPerformanceNow() - startedAt,
          markerCount: nextMarkers.length,
          rectCount: nextMarkers.length * 2,
          targetCount: targets.length,
        });
      }
    }

    function scheduleMeasure() {
      if (frame === 0) {
        frame = window.requestAnimationFrame(measure);
      }
    }

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver((entries) => {
        if (measurement.enabled) {
          measurement.record({
            type: "stream-ruler-resize-callback",
            callbackCount: 1,
            entryCount: entries.length,
          });
        }
        scheduleMeasure();
      });
      resizeObserver.observe(body);
    }
    window.addEventListener("resize", scheduleMeasure);
    scheduleMeasure();

    return () => {
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [measurement, streamBodyRef, targets]);

  if (targets.length === 0) {
    return null;
  }

  return (
    <div
      className="git-diff-change-ruler diff-stream-change-ruler"
      data-review-id="diff-stream-change-ruler"
      aria-label="All diffs change ruler"
    >
      {markers.map((marker) => {
        const active =
          activeTarget?.fileIndex === marker.fileIndex &&
          activeTarget.changeIndex === marker.changeIndex;
        return (
          <button
            key={`diff-stream-ruler:${marker.fileIndex}:${marker.changeIndex}`}
            type="button"
            className={`git-diff-change-ruler-marker ${marker.kind} ${
              active ? "active" : ""
            }`}
            style={{ top: `${marker.topPercent}%` }}
            data-review-id="diff-stream-change-ruler-marker"
            data-stream-index={marker.fileIndex}
            data-change-index={marker.changeIndex}
            aria-label={`Go to change ${marker.index + 1}`}
            onClick={() => onSelectTarget(marker)}
          />
        );
      })}
    </div>
  );
}

function diffStreamMarkerKind(target: HTMLElement): DiffChangeRulerMarkerKind {
  if (
    target.classList.contains("has-table-row-changes") ||
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
