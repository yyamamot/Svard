import { describe, expect, it } from "vitest";

import { renderedTargetHorizontalScrollLeft } from "../../src/ui/components/gitDiffPreview/useDiffScrollNavigation";

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
