import { useRef } from "react";
import type { RefObject } from "react";
import type { DiffPreviewMouseGestureScrollAction } from "./mouseGestures";
import type { DiffView } from "./types";

export function useDiffPreviewGestureScroll({
  leftRef,
  panelRef,
  renderedLeftRef,
  renderedRightRef,
  rightRef,
  view,
}: {
  leftRef: RefObject<HTMLDivElement | null>;
  panelRef: RefObject<HTMLElement | null>;
  renderedLeftRef: RefObject<HTMLDivElement | null>;
  renderedRightRef: RefObject<HTMLDivElement | null>;
  rightRef: RefObject<HTMLDivElement | null>;
  view: DiffView;
}) {
  const mouseGestureScrollPaneRef = useRef<HTMLDivElement | null>(null);

  function setMouseGestureScrollTarget(target: EventTarget | null) {
    mouseGestureScrollPaneRef.current =
      scrollContainerForDiffGestureTarget(target);
  }

  function fallbackScrollContainer() {
    if (view === "preview" || view === "rendered") {
      return renderedRightRef.current ?? renderedLeftRef.current;
    }
    if (view === "source") {
      return rightRef.current ?? leftRef.current;
    }
    if (view === "table") {
      return (
        panelRef.current?.querySelector<HTMLDivElement>(
          '[data-review-id="git-diff-table-right-pane"] .git-diff-table-scroll',
        ) ??
        panelRef.current?.querySelector<HTMLDivElement>(
          '[data-review-id="git-diff-table-left-pane"] .git-diff-table-scroll',
        ) ??
        null
      );
    }
    return null;
  }

  function activeGestureScrollContainer() {
    const active = mouseGestureScrollPaneRef.current;
    if (active?.isConnected) {
      return active;
    }
    return fallbackScrollContainer();
  }

  function scrollDiffPreviewGesturePane(
    action: DiffPreviewMouseGestureScrollAction,
  ) {
    const pane = activeGestureScrollContainer();
    if (!pane) {
      return false;
    }

    const maxScrollTop = Math.max(0, pane.scrollHeight - pane.clientHeight);
    const pageStep = Math.max(1, Math.floor(pane.clientHeight * 0.85));
    const lineStep = 96;
    const nextScrollTop =
      action === "top"
        ? 0
        : action === "bottom"
          ? maxScrollTop
          : action === "pageUp"
            ? pane.scrollTop - pageStep
            : action === "pageDown"
              ? pane.scrollTop + pageStep
              : action === "lineUp"
                ? pane.scrollTop - lineStep
                : pane.scrollTop + lineStep;

    pane.scrollTop = Math.max(0, Math.min(nextScrollTop, maxScrollTop));
    return true;
  }

  return {
    scrollDiffPreviewGesturePane,
    setMouseGestureScrollTarget,
  };
}

function scrollContainerForDiffGestureTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return null;
  }
  const renderedPane = target.closest<HTMLElement>(".git-rendered-pane");
  if (renderedPane) {
    return renderedPane.querySelector<HTMLDivElement>(".git-rendered-scroll");
  }
  const sourcePane = target.closest<HTMLElement>(".git-diff-pane");
  if (sourcePane) {
    return sourcePane.querySelector<HTMLDivElement>(".git-diff-lines");
  }
  const tablePane = target.closest<HTMLElement>(".git-diff-table-pane");
  if (tablePane) {
    return tablePane.querySelector<HTMLDivElement>(".git-diff-table-scroll");
  }
  return null;
}
