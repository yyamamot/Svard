import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

interface SplitResizeState {
  pointerId: number;
  startX: number;
  startRatio: number;
}

interface UseViewerSplitResizeOptions {
  setSplitRatio: (ratio: number) => void;
  splitRatio: number;
}

export function useViewerSplitResize({
  setSplitRatio,
  splitRatio,
}: UseViewerSplitResizeOptions) {
  const splitResizeRef = useRef<SplitResizeState | null>(null);
  const [splitResizeState, setSplitResizeState] =
    useState<SplitResizeState | null>(null);

  function beginViewerSplitResize(event: ReactPointerEvent<HTMLElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const nextState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startRatio: splitRatio,
    };
    splitResizeRef.current = nextState;
    setSplitResizeState(nextState);
  }

  function updateViewerSplitResize(event: ReactPointerEvent<HTMLElement>) {
    const activeResize = splitResizeRef.current;
    if (!activeResize || activeResize.pointerId !== event.pointerId) {
      return;
    }

    const container = event.currentTarget.closest(".viewer-split");
    const width =
      container instanceof HTMLElement
        ? container.getBoundingClientRect().width
        : 1;
    const deltaRatio = (event.clientX - activeResize.startX) / width;
    setSplitRatio(
      Math.min(0.75, Math.max(0.25, activeResize.startRatio + deltaRatio)),
    );
  }

  function endViewerSplitResize(event: ReactPointerEvent<HTMLElement>) {
    const activeResize = splitResizeRef.current;
    if (!activeResize || activeResize.pointerId !== event.pointerId) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    splitResizeRef.current = null;
    setSplitResizeState(null);
  }

  return {
    beginViewerSplitResize,
    endViewerSplitResize,
    splitResizeState,
    updateViewerSplitResize,
  };
}
