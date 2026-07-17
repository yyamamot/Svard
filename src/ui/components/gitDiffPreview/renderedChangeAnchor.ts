import type { RenderedDiffNavigationTarget } from "../../lib/gitRenderedDiff";

export type RenderedChangeAnchorSide = "left" | "right";

export interface RenderedChangeAnchor {
  anchorTop: number;
  changeIndex: number;
  markerPane: HTMLDivElement;
  markerScrollHeight: number;
  markerTarget: HTMLElement;
  primaryTarget: HTMLElement | null;
  semanticTarget: HTMLElement;
  syncIndex?: string;
}

export function resolveChangeTargetInPane(
  pane: HTMLElement | null | undefined,
  index: number,
) {
  return pane?.querySelector<HTMLElement>(`[data-change-index="${index}"]`);
}

export function resolveRenderedChangeAnchor({
  changeIndex,
  leftPane,
  navigationTarget,
  renderedSide,
  rightPane,
}: {
  changeIndex: number;
  leftPane: HTMLDivElement | null;
  navigationTarget: RenderedDiffNavigationTarget | undefined;
  renderedSide?: RenderedChangeAnchorSide;
  rightPane: HTMLDivElement | null;
}): RenderedChangeAnchor | null {
  const primaryPane = navigationTarget
    ? renderedPaneForTargetSide(
        navigationTarget.primarySide,
        leftPane,
        rightPane,
      )
    : null;
  const primaryTarget =
    resolveChangeTargetInPane(primaryPane, changeIndex) ?? null;
  const leftTarget = resolveChangeTargetInPane(leftPane, changeIndex) ?? null;
  const rightTarget = resolveChangeTargetInPane(rightPane, changeIndex) ?? null;
  const semanticTarget =
    primaryTarget ??
    rightTarget ??
    leftTarget ??
    renderedSideTarget({
      changeIndex,
      leftPane,
      renderedSide,
      rightPane,
    });
  if (!semanticTarget) {
    return null;
  }
  const syncIndex = targetSyncIndex(semanticTarget);
  const markerCandidate = renderedMarkerCandidate({
    changeIndex,
    leftPane,
    navigationTarget,
    primaryTarget,
    renderedSide,
    rightPane,
    rightTarget,
    semanticTarget,
    syncIndex,
  });
  if (!markerCandidate) {
    return null;
  }

  const anchorTop = renderedTargetVisualCenter(
    markerCandidate.pane,
    markerCandidate.target,
  );

  return {
    anchorTop,
    changeIndex,
    markerPane: markerCandidate.pane,
    markerScrollHeight: markerCandidate.pane.scrollHeight,
    markerTarget: markerCandidate.target,
    primaryTarget: primaryTarget ?? null,
    semanticTarget,
    syncIndex,
  };
}

function renderedMarkerCandidate({
  changeIndex,
  leftPane,
  navigationTarget,
  primaryTarget,
  renderedSide,
  rightPane,
  rightTarget,
  semanticTarget,
  syncIndex,
}: {
  changeIndex: number;
  leftPane: HTMLDivElement | null;
  navigationTarget: RenderedDiffNavigationTarget | undefined;
  primaryTarget: HTMLElement | null;
  renderedSide?: RenderedChangeAnchorSide;
  rightPane: HTMLDivElement | null;
  rightTarget: HTMLElement | null;
  semanticTarget: HTMLElement;
  syncIndex?: string;
}): { pane: HTMLDivElement; target: HTMLElement } | null {
  if (renderedSide) {
    const pane = renderedPaneForTargetSide(renderedSide, leftPane, rightPane);
    const target = resolveChangeTargetInPane(pane, changeIndex);
    return pane && target ? { pane, target } : null;
  }

  const rightRow = syncIndex
    ? resolveSyncRowInPane(rightPane, syncIndex)
    : null;
  if (rightPane && rightRow) {
    return { pane: rightPane, target: rightRow };
  }
  if (rightPane && rightTarget) {
    return { pane: rightPane, target: rightTarget };
  }

  const semanticPane = paneContainingTarget({
    leftPane,
    rightPane,
    target: semanticTarget,
  });
  if (semanticPane) {
    return { pane: semanticPane, target: semanticTarget };
  }

  const primaryPane = navigationTarget
    ? renderedPaneForTargetSide(
        navigationTarget.primarySide,
        leftPane,
        rightPane,
      )
    : null;
  return primaryPane && primaryTarget
    ? { pane: primaryPane, target: primaryTarget }
    : null;
}

function renderedSideTarget({
  changeIndex,
  leftPane,
  renderedSide,
  rightPane,
}: {
  changeIndex: number;
  leftPane: HTMLDivElement | null;
  renderedSide?: RenderedChangeAnchorSide;
  rightPane: HTMLDivElement | null;
}): HTMLElement | null {
  const pane = renderedSide
    ? renderedPaneForTargetSide(renderedSide, leftPane, rightPane)
    : null;
  return resolveChangeTargetInPane(pane, changeIndex) ?? null;
}

function renderedPaneForTargetSide(
  side: "left" | "right",
  leftPane: HTMLDivElement | null,
  rightPane: HTMLDivElement | null,
) {
  return side === "left" ? leftPane : rightPane;
}

function renderedTargetVisualCenter(pane: HTMLDivElement, target: HTMLElement) {
  const paneRect = pane.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  return pane.scrollTop + targetRect.top - paneRect.top + targetRect.height / 2;
}

function targetSyncIndex(target: HTMLElement) {
  return (
    target.dataset.syncIndex ??
    target.closest<HTMLElement>("[data-sync-index]")?.dataset.syncIndex
  );
}

function resolveSyncRowInPane(
  pane: HTMLDivElement | null | undefined,
  syncIndex: string,
) {
  return pane?.querySelector<HTMLElement>(
    `[data-sync-index="${cssEscape(syncIndex)}"]`,
  );
}

function paneContainingTarget({
  leftPane,
  rightPane,
  target,
}: {
  leftPane: HTMLDivElement | null;
  rightPane: HTMLDivElement | null;
  target: HTMLElement;
}) {
  if (rightPane?.contains(target)) {
    return rightPane;
  }
  if (leftPane?.contains(target)) {
    return leftPane;
  }
  return null;
}

function cssEscape(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, "\\$&");
}
