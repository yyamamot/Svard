import {
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { resolveAnchoredScrollTop } from "../../lib/diffScrollSync";
import type { RenderedDiffNavigationTarget } from "../../lib/gitRenderedDiff";
import {
  resolveChangeTargetInPane,
  resolveRenderedChangeAnchor,
} from "./renderedChangeAnchor";
import type { DiffView } from "./types";

export function useDiffScrollNavigation({
  panelRef,
  renderedLeftRef,
  renderedRightRef,
  syncingScrollRef,
  programmaticScrollElementsRef,
  syncScrollEnabled,
  view,
  changeCount,
  activeChangeIndex,
  renderedNavigationTargets,
  setActiveChangeIndex,
  setView,
}: {
  panelRef: RefObject<HTMLElement | null>;
  renderedLeftRef: RefObject<HTMLDivElement | null>;
  renderedRightRef: RefObject<HTMLDivElement | null>;
  syncingScrollRef: RefObject<boolean>;
  programmaticScrollElementsRef: RefObject<Set<HTMLDivElement>>;
  syncScrollEnabled: boolean;
  view: DiffView;
  changeCount: number;
  activeChangeIndex: number;
  renderedNavigationTargets: readonly RenderedDiffNavigationTarget[];
  setActiveChangeIndex: Dispatch<SetStateAction<number>>;
  setView: Dispatch<SetStateAction<DiffView>>;
}) {
  const programmaticScrollTargetsRef = useRef(
    new WeakMap<
      HTMLDivElement,
      { scrollTop: number; scrollLeft: number; expiresAt: number }
    >(),
  );

  function markProgrammaticScroll(
    element: HTMLDivElement,
    target = { scrollTop: element.scrollTop, scrollLeft: element.scrollLeft },
  ) {
    programmaticScrollElementsRef.current.add(element);
    programmaticScrollTargetsRef.current.set(element, {
      ...target,
      expiresAt: performance.now() + 350,
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        programmaticScrollElementsRef.current.delete(element);
      });
    });
  }

  function shouldIgnoreProgrammaticScroll(element: HTMLDivElement) {
    const target = programmaticScrollTargetsRef.current.get(element);
    if (!target) {
      return programmaticScrollElementsRef.current.has(element);
    }
    if (performance.now() > target.expiresAt) {
      programmaticScrollTargetsRef.current.delete(element);
      return false;
    }
    return (
      Math.abs(element.scrollTop - target.scrollTop) <= 2 &&
      Math.abs(element.scrollLeft - target.scrollLeft) <= 2
    );
  }

  function syncDirectScroll(
    source: HTMLDivElement,
    target: HTMLDivElement | null,
  ) {
    if (shouldIgnoreProgrammaticScroll(source)) {
      return;
    }
    if (!target || !syncScrollEnabled || syncingScrollRef.current) {
      return;
    }
    syncingScrollRef.current = true;
    target.scrollTop = source.scrollTop;
    target.scrollLeft = source.scrollLeft;
    markProgrammaticScroll(target);
    requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  }

  function syncRenderedScroll(
    source: HTMLDivElement,
    target: HTMLDivElement | null,
  ) {
    if (shouldIgnoreProgrammaticScroll(source)) {
      return;
    }
    if (!target || !syncScrollEnabled || syncingScrollRef.current) {
      return;
    }
    syncingScrollRef.current = true;
    target.scrollTop = resolveAnchoredScrollTop(source, target, {
      fallbackScrollTop: source.scrollTop,
    });
    target.scrollLeft = source.scrollLeft;
    markProgrammaticScroll(target);
    requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  }

  function scrollToChange(index: number, targetView: DiffView = view) {
    if (targetView === "preview" || targetView === "rendered") {
      scrollRenderedChangeToIndex(index);
      return;
    }
    const target = panelRef.current?.querySelector<HTMLElement>(
      `[data-change-index="${index}"]`,
    );
    target?.scrollIntoView({ block: "center", inline: "nearest" });
  }

  function scrollRenderedChangeToIndex(index: number) {
    const targets = renderedPaneTargetsForChange(index);
    const primaryTarget = targets[0];
    const syncIndex =
      primaryTarget?.target.dataset.syncIndex ??
      primaryTarget?.target.closest<HTMLElement>("[data-sync-index]")?.dataset
        .syncIndex;
    if (!syncIndex) {
      if (primaryTarget) {
        scrollRenderedTargetIntoPane(primaryTarget.pane, primaryTarget.target);
      }
      return;
    }
    if (!syncScrollEnabled) {
      if (primaryTarget) {
        scrollRenderedTargetIntoPane(primaryTarget.pane, primaryTarget.target);
      }
      return;
    }

    syncingScrollRef.current = true;
    if (primaryTarget) {
      scrollRenderedTargetIntoPane(primaryTarget.pane, primaryTarget.target);
    }
    for (const pane of [renderedLeftRef.current, renderedRightRef.current]) {
      if (pane && pane !== primaryTarget?.pane) {
        scrollRenderedPaneToSyncIndex(pane, syncIndex);
      }
    }
    requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  }

  function renderedPaneTargetsForChange(index: number) {
    const navigationTarget = renderedNavigationTargets[index];
    const primaryPane = navigationTarget
      ? renderedPaneForSide(navigationTarget.primarySide)
      : null;
    const primaryTarget = renderedTargetInPane(primaryPane, index);
    if (primaryTarget) {
      const fallbackPane =
        navigationTarget?.side === "both"
          ? renderedPaneForSide(
              navigationTarget.primarySide === "right" ? "left" : "right",
            )
          : null;
      const fallbackTarget = renderedTargetInPane(fallbackPane, index);
      return fallbackTarget ? [primaryTarget, fallbackTarget] : [primaryTarget];
    }

    return [renderedRightRef.current, renderedLeftRef.current]
      .flatMap((pane) => {
        const target = renderedTargetInPane(pane, index);
        return target ? [target] : [];
      })
      .sort((left, right) => {
        const leftDistance = Math.abs(left.pane.scrollTop);
        const rightDistance = Math.abs(right.pane.scrollTop);
        return rightDistance - leftDistance;
      });
  }

  function renderedPaneForSide(side: "left" | "right") {
    return side === "left" ? renderedLeftRef.current : renderedRightRef.current;
  }

  function renderedTargetInPane(pane: HTMLDivElement | null, index: number) {
    const target = resolveChangeTargetInPane(pane, index);
    if (!pane || !target) {
      return null;
    }
    return { pane, target };
  }

  function scrollRenderedPaneToSyncIndex(
    pane: HTMLDivElement | null,
    syncIndex: string,
  ) {
    const target = pane?.querySelector<HTMLElement>(
      `[data-sync-index="${syncIndex}"]`,
    );
    if (!pane || !target) {
      return;
    }
    scrollRenderedTargetIntoPane(pane, target);
  }

  function scrollRenderedTargetIntoPane(
    pane: HTMLDivElement,
    target: HTMLElement,
  ) {
    const paneRect = pane.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const centeredOffset = Math.max(
      0,
      (pane.clientHeight - targetRect.height) / 2,
    );
    pane.scrollTop = Math.max(
      0,
      Math.min(
        pane.scrollTop + targetRect.top - paneRect.top - centeredOffset,
        Math.max(0, pane.scrollHeight - pane.clientHeight),
      ),
    );
    pane.scrollLeft = renderedTargetHorizontalScrollLeft(pane, target);
    markProgrammaticScroll(pane);
  }

  function selectChange(index: number) {
    const nextIndex = Math.max(
      0,
      Math.min(index, Math.max(changeCount - 1, 0)),
    );
    setActiveChangeIndex(nextIndex);
    requestAnimationFrame(() => scrollToChange(nextIndex));
  }

  function moveChange(offset: number) {
    if (changeCount === 0) {
      return;
    }
    if (view === "preview" || view === "rendered") {
      const visualOrder = renderedVisualChangeOrder({
        changeCount,
        leftPane: renderedLeftRef.current,
        navigationTargets: renderedNavigationTargets,
        rightPane: renderedRightRef.current,
      });
      const currentVisualIndex = visualOrder.indexOf(activeChangeIndex);
      if (currentVisualIndex >= 0) {
        const nextVisualIndex =
          (currentVisualIndex + offset + visualOrder.length) %
          visualOrder.length;
        selectChange(visualOrder[nextVisualIndex] ?? activeChangeIndex);
        return;
      }
    }
    selectChange((activeChangeIndex + offset + changeCount) % changeCount);
  }

  function jumpToPreviewChange(index: number) {
    setView("preview");
    setActiveChangeIndex(index);
    requestAnimationFrame(() => scrollToChange(index, "preview"));
  }

  return {
    jumpToPreviewChange,
    moveChange,
    selectChange,
    syncDirectScroll,
    syncRenderedScroll,
  };
}

export function renderedVisualChangeOrder({
  changeCount,
  leftPane,
  navigationTargets,
  rightPane,
}: {
  changeCount: number;
  leftPane: HTMLDivElement | null;
  navigationTargets: readonly RenderedDiffNavigationTarget[];
  rightPane: HTMLDivElement | null;
}) {
  const scored = Array.from({ length: changeCount }, (_, index) => {
    const anchor = resolveRenderedChangeAnchor({
      changeIndex: index,
      leftPane,
      navigationTarget: navigationTargets[index],
      rightPane,
    });
    const center = anchor?.anchorTop ?? Number.POSITIVE_INFINITY;
    return { center, index };
  });

  return scored
    .sort((left, right) => {
      if (left.center !== right.center) {
        return left.center - right.center;
      }
      return left.index - right.index;
    })
    .map((item) => item.index);
}

export function renderedTargetHorizontalScrollLeft(
  pane: HTMLDivElement,
  target: HTMLElement,
) {
  const paneRect = pane.getBoundingClientRect();
  const padding = 24;
  const changedCells = Array.from(
    target.querySelectorAll<HTMLElement>(".git-rendered-table-cell-change"),
  );
  const cellTarget =
    changedCells.find((cell) => {
      const cellRect = cell.getBoundingClientRect();
      return (
        cellRect.left < paneRect.left + padding ||
        cellRect.right > paneRect.right - padding
      );
    }) ??
    changedCells[0] ??
    target;
  const targetRect = cellTarget.getBoundingClientRect();
  if (targetRect.left < paneRect.left + padding) {
    return Math.max(
      0,
      pane.scrollLeft + targetRect.left - paneRect.left - padding,
    );
  }
  if (targetRect.right > paneRect.right - padding) {
    return Math.max(
      0,
      Math.min(
        pane.scrollLeft + targetRect.right - paneRect.right + padding,
        Math.max(0, pane.scrollWidth - pane.clientWidth),
      ),
    );
  }
  return pane.scrollLeft;
}
