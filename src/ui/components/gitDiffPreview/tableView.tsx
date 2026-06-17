import type {
  GitTableDiffSummary,
  RenderedTableDiff,
  TableFallbackReason,
} from "../../lib/gitTableDiff";
import type { MouseEvent } from "react";

export const emptyTableSummary: GitTableDiffSummary = {
  renderedTables: [],
  tableMarkers: [],
};

export function fallbackMessage(
  reason: TableFallbackReason | undefined,
): string {
  switch (reason) {
    case "ambiguous":
      return "Table rows are ambiguous. Use Source view.";
    case "complex-span":
      return "This table uses spans or nested tables. Use Source view.";
    case "render-error":
      return "Table diff is not available. Use Source view.";
    case "shape-mismatch":
      return "Table row shape changed too much for visual diff. Use Source view.";
    case "table-mismatch":
      return "Table structure changed too much for visual diff. Use Source view.";
    case "no-table":
      return "No table diff is available. Use Source view.";
    default:
      return "No inline source diff is available.";
  }
}

export function changedCellCount(table: RenderedTableDiff | undefined): number {
  return table?.rowChanges.length ?? 0;
}

export function tableCellIndexes(
  table: RenderedTableDiff | undefined,
): Map<string, number> {
  const indexes = new Map<string, number>();
  table?.rowChanges.forEach((rowChange, changeIndex) => {
    const row = table.cells[rowChange.rowIndex];
    row?.forEach((cell, cellIndex) => {
      if (cell.kind !== "unchanged") {
        indexes.set(`${rowChange.rowIndex}:${cellIndex}`, changeIndex);
      }
    });
  });
  return indexes;
}

export function TableDiffPane({
  label,
  table,
  side,
  reviewId,
  changeIndexForCell,
  onContextMenu,
}: {
  label: string;
  table: RenderedTableDiff;
  side: "left" | "right";
  reviewId: string;
  changeIndexForCell: (rowIndex: number, cellIndex: number) => number | null;
  onContextMenu?: (event: MouseEvent<HTMLElement>) => void;
}) {
  function cellClass(kind: string) {
    if (
      (side === "left" && kind === "added") ||
      (side === "right" && kind === "removed")
    ) {
      return "blank";
    }
    return kind;
  }

  return (
    <section
      className="git-diff-table-pane"
      data-review-id={reviewId}
      onContextMenu={onContextMenu}
    >
      <header>{label}</header>
      <div className="git-diff-table-scroll">
        <table>
          <tbody>
            {table.cells.map((row, rowIndex) => (
              <tr key={`${side}:row:${rowIndex}`}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${side}:cell:${rowIndex}:${cellIndex}`}
                    className={`git-diff-table-cell ${cellClass(cell.kind)} ${
                      changeIndexForCell(rowIndex, cellIndex) !== null
                        ? "change-target"
                        : ""
                    }`}
                    data-review-id="git-diff-table-cell"
                    data-change-index={
                      changeIndexForCell(rowIndex, cellIndex) ?? undefined
                    }
                  >
                    {side === "left" ? cell.left : cell.right}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
