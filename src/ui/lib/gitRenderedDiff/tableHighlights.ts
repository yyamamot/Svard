import type {
  RenderedBlockDiff,
  RenderedTableCellChangeKind,
} from "./types";
import { applyInlineDiffHighlights } from "./inlineHighlights";
import { renderedInlineDiffRanges } from "./text";

export interface RenderedTableCellHighlight {
  active?: boolean;
  cellIndex: number;
  changeIndex?: number;
  kind: RenderedTableCellChangeKind;
  rowIndex: number;
}

export function renderedTableHighlightsForSide({
  activeChangeIndex,
  block,
  changeIndexForRow,
  side,
}: {
  activeChangeIndex?: number;
  block: RenderedBlockDiff;
  changeIndexForRow: (rowIndex: number) => number | null;
  side: "left" | "right";
}): RenderedTableCellHighlight[] {
  if (block.kind !== "changed" || block.blockKind !== "table") {
    return [];
  }
  return (block.tableChanges ?? []).flatMap((tableChange) => {
    const rowIndex =
      side === "left" ? tableChange.leftRowIndex : tableChange.rightRowIndex;
    const cellIndex =
      side === "left" ? tableChange.leftCellIndex : tableChange.rightCellIndex;
    if (rowIndex === undefined || cellIndex === undefined) {
      return [];
    }
    const changeIndex = changeIndexForRow(rowIndex) ?? undefined;
    return [
      {
        active:
          changeIndex !== undefined && activeChangeIndex === changeIndex,
        cellIndex,
        changeIndex,
        kind: tableChange.kind,
        rowIndex,
      },
    ];
  });
}

export function applyRenderedTableHighlights({
  highlights,
  html,
  leftHtml,
  rightHtml,
  side,
}: {
  highlights: readonly RenderedTableCellHighlight[];
  html: string;
  leftHtml?: string;
  rightHtml?: string;
  side: "left" | "right";
}): string {
  if (highlights.length === 0 || !html.includes("<table")) {
    return html;
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.body.querySelector("table");
  if (!table) {
    return html;
  }
  const leftCellTexts = cellTextsByPosition(leftHtml);
  const rightCellTexts = cellTextsByPosition(rightHtml);
  const highlightsByRow = new Map<number, RenderedTableCellHighlight[]>();
  highlights.forEach((highlight) => {
    const rowHighlights = highlightsByRow.get(highlight.rowIndex) ?? [];
    rowHighlights.push(highlight);
    highlightsByRow.set(highlight.rowIndex, rowHighlights);
  });

  Array.from(table.rows).forEach((row, rowIndex) => {
    const rowHighlights = highlightsByRow.get(rowIndex);
    if (!rowHighlights?.length) {
      return;
    }
    const rowKind = rowHighlights.some((highlight) => highlight.kind === "changed")
      ? "changed"
      : (rowHighlights[0]?.kind ?? "changed");
    const rowChangeIndex = rowHighlights.find(
      (highlight) => highlight.changeIndex !== undefined,
    )?.changeIndex;
    const rowActive = rowHighlights.some((highlight) => highlight.active);
    row.classList.add("git-rendered-table-row-change", rowKind);
    row.setAttribute("data-review-id", "git-rendered-table-row-change");
    if (rowChangeIndex !== undefined) {
      row.setAttribute("data-change-index", String(rowChangeIndex));
    }
    if (rowActive) {
      row.classList.add("active-change");
      row.setAttribute("data-active-change", "true");
      row.classList.add("content-cursor-active");
      row.setAttribute("data-content-cursor-active", "true");
    }

    rowHighlights.forEach((highlight) => {
      const cell = row.cells[highlight.cellIndex] as HTMLElement | undefined;
      if (!cell) {
        return;
      }
      cell.classList.add("git-rendered-table-cell-change", highlight.kind);
      cell.setAttribute("data-review-id", "git-rendered-table-cell-change");
      if (highlight.kind !== "changed") {
        return;
      }
      const leftText = leftCellTexts.get(cellKey(rowIndex, highlight.cellIndex));
      const rightText = rightCellTexts.get(cellKey(rowIndex, highlight.cellIndex));
      if (!leftText || !rightText) {
        return;
      }
      const ranges = renderedInlineDiffRanges(leftText, rightText, side);
      if (ranges.length > 0) {
        applyInlineDiffHighlights(cell, ranges);
      }
    });
  });

  return doc.body.innerHTML;
}

function cellTextsByPosition(html: string | undefined): Map<string, string> {
  const texts = new Map<string, string>();
  if (!html?.includes("<table")) {
    return texts;
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.body.querySelector("table");
  if (!table) {
    return texts;
  }
  Array.from(table.rows).forEach((row, rowIndex) => {
    Array.from(row.cells).forEach((cell, cellIndex) => {
      texts.set(cellKey(rowIndex, cellIndex), cell.textContent ?? "");
    });
  });
  return texts;
}

function cellKey(rowIndex: number, cellIndex: number): string {
  return `${rowIndex}:${cellIndex}`;
}
