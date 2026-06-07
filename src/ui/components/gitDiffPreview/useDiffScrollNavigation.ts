import {
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import { resolveAnchoredScrollTop } from "../../lib/diffScrollSync";
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
    const syncIndex = primaryTarget?.target.dataset.syncIndex;
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
    scrollRenderedPaneToSyncIndex(renderedLeftRef.current, syncIndex);
    scrollRenderedPaneToSyncIndex(renderedRightRef.current, syncIndex);
    requestAnimationFrame(() => {
      syncingScrollRef.current = false;
    });
  }

  function renderedPaneTargetsForChange(index: number) {
    return [renderedRightRef.current, renderedLeftRef.current]
      .flatMap((pane) => {
        if (!pane) {
          return [];
        }
        const target = pane.querySelector<HTMLElement>(
          `[data-change-index="${index}"]`,
        );
        return target ? [{ pane, target }] : [];
      })
      .sort((left, right) => {
        const leftDistance = Math.abs(left.pane.scrollTop);
        const rightDistance = Math.abs(right.pane.scrollTop);
        return rightDistance - leftDistance;
      });
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
