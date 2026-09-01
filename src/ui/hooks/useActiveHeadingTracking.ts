import { useEffect } from "react";
import type { RenderResult } from "../../core/types";
import {
  perfDuration,
  perfNow,
  perfTraceEnabled,
  tracePerf,
} from "../lib/perfTrace";

interface UseActiveHeadingTrackingOptions {
  articleRef: React.RefObject<HTMLElement | null>;
  renderResult: RenderResult | null;
  setActiveHeadingId: (headingId: string | null) => void;
  viewerRef: React.RefObject<HTMLElement | null>;
}

export function useActiveHeadingTracking({
  articleRef,
  renderResult,
  setActiveHeadingId,
  viewerRef,
}: UseActiveHeadingTrackingOptions) {
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !renderResult) {
      return;
    }
    const tracingEnabled = perfTraceEnabled();
    const initialMeasurementStartedAt = tracingEnabled ? perfNow() : 0;
    const headings = renderResult.headings
      .map((heading) => ({
        id: heading.id,
        element: articleRef.current?.querySelector(
          `#${CSS.escape(heading.id)}`,
        ),
      }))
      .filter(
        (item): item is { id: string; element: Element } =>
          item.element !== undefined && item.element !== null,
      );
    let animationFrame: number | null = null;
    let activeHeadingId: string | null = null;
    let scrollEventCount = 0;
    let measurementCount = 0;

    function updateActiveHeading(
      trigger: "initial" | "scroll",
      startedAt = tracingEnabled ? perfNow() : 0,
    ) {
      measurementCount += 1;
      const active = headings
        .map((item) => ({
          id: item.id,
          top: item.element.getBoundingClientRect().top,
        }))
        .filter((item) => item.top <= 140)
        .at(-1);
      const nextActiveHeadingId = active?.id ?? null;
      const changed = nextActiveHeadingId !== activeHeadingId;
      if (tracingEnabled) {
        tracePerf("render.activeHeading.measure", {
          durationMs: perfDuration(startedAt),
          headingCount: headings.length,
          measurementCount,
          trigger,
          status: changed ? "changed" : "unchanged",
        });
      }
      if (changed) {
        activeHeadingId = nextActiveHeadingId;
        tracePerf("viewer.activeHeading.changed", {
          headingId: nextActiveHeadingId,
          headingCount: headings.length,
          measurementCount,
          scrollEventCount,
        });
        setActiveHeadingId(nextActiveHeadingId);
      }
    }

    function scheduleUpdateActiveHeading() {
      scrollEventCount += 1;
      if (animationFrame !== null) {
        return;
      }
      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = null;
        updateActiveHeading("scroll");
      });
    }

    viewer.addEventListener("scroll", scheduleUpdateActiveHeading, {
      passive: true,
    });
    updateActiveHeading("initial", initialMeasurementStartedAt);
    return () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      viewer.removeEventListener("scroll", scheduleUpdateActiveHeading);
    };
  }, [articleRef, renderResult, setActiveHeadingId, viewerRef]);
}
