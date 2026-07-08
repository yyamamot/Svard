import { describe, expect, it } from "vitest";

import {
  renderedTargetHorizontalScrollLeft,
  renderedVisualChangeOrder,
} from "../../src/ui/components/gitDiffPreview/useDiffScrollNavigation";
import { resolveRenderedChangeAnchor } from "../../src/ui/components/gitDiffPreview/renderedChangeAnchor";
import type { RenderedDiffNavigationTarget } from "../../src/ui/lib/gitRenderedDiff";

function elementWithRect({
  clientWidth = 200,
  scrollLeft = 0,
  scrollWidth = 600,
  rect,
}: {
  clientWidth?: number;
  scrollLeft?: number;
  scrollWidth?: number;
  rect: Pick<DOMRect, "left" | "right">;
}) {
  const element = document.createElement("div") as HTMLDivElement;
  Object.defineProperty(element, "clientWidth", {
    configurable: true,
    value: clientWidth,
  });
  Object.defineProperty(element, "scrollLeft", {
    configurable: true,
    value: scrollLeft,
    writable: true,
  });
  Object.defineProperty(element, "scrollWidth", {
    configurable: true,
    value: scrollWidth,
  });
  element.getBoundingClientRect = () =>
    ({
      bottom: 0,
      height: 0,
      left: rect.left,
      right: rect.right,
      top: 0,
      width: rect.right - rect.left,
    }) as DOMRect;
  return element;
}

describe("diff preview scroll navigation", () => {
  function paneWithTargets(
    targets: Array<{ index?: number; top: number; syncIndex?: string }>,
  ) {
    const pane = document.createElement("div") as HTMLDivElement;
    Object.defineProperty(pane, "scrollTop", {
      configurable: true,
      value: 120,
      writable: true,
    });
    Object.defineProperty(pane, "scrollHeight", {
      configurable: true,
      value: 1000,
    });
    pane.getBoundingClientRect = () =>
      ({
        bottom: 500,
        height: 400,
        left: 0,
        right: 300,
        top: 100,
        width: 300,
      }) as DOMRect;

    for (const target of targets) {
      const element = document.createElement("div");
      if (typeof target.index === "number") {
        element.dataset.changeIndex = String(target.index);
      }
      if (target.syncIndex) {
        element.dataset.syncIndex = target.syncIndex;
      }
      element.getBoundingClientRect = () =>
        ({
          bottom: target.top + 24,
          height: 24,
          left: 0,
          right: 300,
          top: target.top,
          width: 300,
        }) as DOMRect;
      pane.append(element);
    }
    return pane;
  }

  it("orders rendered navigation by visual target position instead of change index", () => {
    const leftPane = paneWithTargets([
      { index: 0, top: 260 },
      { index: 1, top: 180 },
    ]);
    const targets = [
      { index: 0, primarySide: "left", side: "left" },
      { index: 1, primarySide: "left", side: "left" },
    ] as RenderedDiffNavigationTarget[];

    expect(
      renderedVisualChangeOrder({
        changeCount: 2,
        leftPane,
        navigationTargets: targets,
        rightPane: null,
      }),
    ).toEqual([1, 0]);
  });

  it("keeps one-sided replacement targets stable within the same rendered row", () => {
    const leftPane = paneWithTargets([{ index: 0, top: 260, syncIndex: "5" }]);
    const rightPane = paneWithTargets([{ index: 1, top: 180, syncIndex: "5" }]);
    const targets = [
      { index: 0, primarySide: "left", side: "left" },
      { index: 1, primarySide: "right", side: "right" },
    ] as RenderedDiffNavigationTarget[];

    expect(
      renderedVisualChangeOrder({
        changeCount: 2,
        leftPane,
        navigationTargets: targets,
        rightPane,
      }),
    ).toEqual([0, 1]);
  });

  it("uses the same sync-row anchor for rendered navigation and ruler positioning", () => {
    const leftPane = paneWithTargets([{ index: 0, top: 260, syncIndex: "5" }]);
    const rightPane = paneWithTargets([{ index: 1, top: 180, syncIndex: "5" }]);
    const targets = [
      { index: 0, primarySide: "left", side: "left" },
      { index: 1, primarySide: "right", side: "right" },
    ] as RenderedDiffNavigationTarget[];

    const leftAnchor = resolveRenderedChangeAnchor({
      changeIndex: 0,
      leftPane,
      navigationTarget: targets[0],
      rightPane,
    });
    const rightAnchor = resolveRenderedChangeAnchor({
      changeIndex: 1,
      leftPane,
      navigationTarget: targets[1],
      rightPane,
    });

    expect(leftAnchor?.anchorTop).toBe(rightAnchor?.anchorTop);
    expect(leftAnchor?.markerPane).toBe(rightPane);
    expect(leftAnchor?.semanticTarget.dataset.changeIndex).toBe("0");
    expect(
      renderedVisualChangeOrder({
        changeCount: 2,
        leftPane,
        navigationTargets: targets,
        rightPane,
      }),
    ).toEqual([0, 1]);
  });

  it("projects left-only rendered markers onto the right sync row", () => {
    const leftPane = paneWithTargets([{ index: 0, top: 260, syncIndex: "5" }]);
    const rightPane = paneWithTargets([{ top: 180, syncIndex: "5" }]);
    const targets = [
      { index: 0, primarySide: "left", side: "left" },
    ] as RenderedDiffNavigationTarget[];

    const anchor = resolveRenderedChangeAnchor({
      changeIndex: 0,
      leftPane,
      navigationTarget: targets[0],
      rightPane,
    });

    expect(anchor?.markerPane).toBe(rightPane);
    expect(anchor?.markerTarget.dataset.syncIndex).toBe("5");
    expect(anchor?.markerTarget.dataset.changeIndex).toBeUndefined();
    expect(anchor?.semanticTarget.dataset.changeIndex).toBe("0");
    expect(anchor?.anchorTop).toBe(212);
  });

  it("uses the right pane target for both-side rendered navigation", () => {
    const leftPane = paneWithTargets([{ index: 0, top: 220 }]);
    const rightPane = paneWithTargets([{ index: 0, top: 140 }]);
    const targets = [
      { index: 0, primarySide: "left", side: "both" },
    ] as RenderedDiffNavigationTarget[];

    const anchor = resolveRenderedChangeAnchor({
      changeIndex: 0,
      leftPane,
      navigationTarget: targets[0],
      rightPane,
    });

    expect(anchor?.markerPane).toBe(rightPane);
    expect(anchor?.anchorTop).toBe(172);
  });

  it("keeps unresolved rendered targets in stable index order after visible targets", () => {
    const leftPane = paneWithTargets([{ index: 1, top: 180 }]);
    const targets = [
      { index: 0, primarySide: "left", side: "left" },
      { index: 1, primarySide: "left", side: "left" },
      { index: 2, primarySide: "left", side: "left" },
    ] as RenderedDiffNavigationTarget[];

    expect(
      renderedVisualChangeOrder({
        changeCount: 3,
        leftPane,
        navigationTargets: targets,
        rightPane: null,
      }),
    ).toEqual([1, 0, 2]);
  });

  it("keeps horizontal scroll when the changed table cell is visible", () => {
    const pane = elementWithRect({
      rect: { left: 0, right: 200 },
      scrollLeft: 80,
    });
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.className = "git-rendered-table-cell-change";
    cell.getBoundingClientRect = () =>
      ({
        bottom: 0,
        height: 0,
        left: 48,
        right: 150,
        top: 0,
        width: 102,
      }) as DOMRect;
    row.append(cell);

    expect(renderedTargetHorizontalScrollLeft(pane, row)).toBe(80);
  });

  it("scrolls horizontally toward an offscreen changed table cell", () => {
    const pane = elementWithRect({
      clientWidth: 200,
      rect: { left: 0, right: 200 },
      scrollLeft: 80,
      scrollWidth: 600,
    });
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.className = "git-rendered-table-cell-change";
    cell.getBoundingClientRect = () =>
      ({
        bottom: 0,
        height: 0,
        left: 260,
        right: 340,
        top: 0,
        width: 80,
      }) as DOMRect;
    row.append(cell);

    expect(renderedTargetHorizontalScrollLeft(pane, row)).toBe(244);
  });

  it("prefers an offscreen changed table cell over a visible changed cell", () => {
    const pane = elementWithRect({
      clientWidth: 200,
      rect: { left: 0, right: 200 },
      scrollLeft: 80,
      scrollWidth: 600,
    });
    const row = document.createElement("tr");
    const visibleCell = document.createElement("td");
    visibleCell.className = "git-rendered-table-cell-change";
    visibleCell.getBoundingClientRect = () =>
      ({
        bottom: 0,
        height: 0,
        left: 48,
        right: 150,
        top: 0,
        width: 102,
      }) as DOMRect;
    const offscreenCell = document.createElement("td");
    offscreenCell.className = "git-rendered-table-cell-change";
    offscreenCell.getBoundingClientRect = () =>
      ({
        bottom: 0,
        height: 0,
        left: 260,
        right: 340,
        top: 0,
        width: 80,
      }) as DOMRect;
    row.append(visibleCell, offscreenCell);

    expect(renderedTargetHorizontalScrollLeft(pane, row)).toBe(244);
  });
});
