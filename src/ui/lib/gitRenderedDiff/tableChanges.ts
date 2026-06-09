import type {
  RenderedTableCellChange,
  RenderedTableFallback,
  RenderedTableRowSnapshot,
} from "./types";

export interface RenderedTableChangeResult {
  tableChanges: RenderedTableCellChange[];
  fallback?: RenderedTableFallback;
}

const changedCellMinimumLength = 4;
const changedCellMinimumOverlap = 0.25;

export function matchRenderedTableChanges(
  leftRows: readonly RenderedTableRowSnapshot[] | undefined,
  rightRows: readonly RenderedTableRowSnapshot[] | undefined,
): RenderedTableChangeResult {
  if (!leftRows || !rightRows) {
    return { tableChanges: [], fallback: { reason: "complex" } };
  }
  if (hasDuplicateRows(leftRows) || hasDuplicateRows(rightRows)) {
    return { tableChanges: [], fallback: { reason: "ambiguous" } };
  }
  if (hasReorderedCommonRows(leftRows, rightRows)) {
    return { tableChanges: [], fallback: { reason: "ambiguous" } };
  }

  const tableChanges: RenderedTableCellChange[] = [];
  let leftIndex = 0;
  let rightIndex = 0;
  let matchedBefore = false;

  while (leftIndex < leftRows.length || rightIndex < rightRows.length) {
    const left = leftRows[leftIndex];
    const right = rightRows[rightIndex];

    if (left && right && sameRow(left, right)) {
      leftIndex += 1;
      rightIndex += 1;
      matchedBefore = true;
      continue;
    }

    if (!left && right) {
      tableChanges.push(...rowCellChanges("added", undefined, right));
      rightIndex += 1;
      continue;
    }

    if (left && !right) {
      tableChanges.push(...rowCellChanges("removed", left, undefined));
      leftIndex += 1;
      continue;
    }

    if (left && right) {
      const nextRightMatch = rightRows
        .slice(rightIndex + 1)
        .findIndex((candidate) => sameRow(left, candidate));
      if (nextRightMatch >= 0) {
        tableChanges.push(...rowCellChanges("added", undefined, right));
        rightIndex += 1;
        continue;
      }

      const nextLeftMatch = leftRows
        .slice(leftIndex + 1)
        .findIndex((candidate) => sameRow(candidate, right));
      if (nextLeftMatch >= 0) {
        tableChanges.push(...rowCellChanges("removed", left, undefined));
        leftIndex += 1;
        continue;
      }

      const changedCells = changedCellChanges(left, right);
      if (changedCells === null) {
        return { tableChanges: [], fallback: { reason: "shape-mismatch" } };
      }
      if (
        changedCells.length > 0 &&
        !isHighConfidenceChangedRow(left, right) &&
        !isAnchoredReplacement({
          leftRows,
          rightRows,
          leftIndex,
          rightIndex,
          matchedBefore,
        })
      ) {
        return { tableChanges: [], fallback: { reason: "low-overlap" } };
      }
      tableChanges.push(...changedCells);
      leftIndex += 1;
      rightIndex += 1;
      matchedBefore = true;
    }
  }

  return { tableChanges };
}

function rowCellChanges(
  kind: "added" | "removed",
  left: RenderedTableRowSnapshot | undefined,
  right: RenderedTableRowSnapshot | undefined,
): RenderedTableCellChange[] {
  const visible = kind === "removed" ? left : right;
  if (!visible) {
    return [];
  }
  return visible.cells.map((cell) => ({
    kind,
    side: kind === "removed" ? "left" : "right",
    confidence: "high",
    leftRowIndex: left?.index,
    rightRowIndex: right?.index,
    leftCellIndex: kind === "removed" ? cell.index : undefined,
    rightCellIndex: kind === "added" ? cell.index : undefined,
  }));
}

function changedCellChanges(
  left: RenderedTableRowSnapshot,
  right: RenderedTableRowSnapshot,
): RenderedTableCellChange[] | null {
  if (left.cellCount !== right.cellCount) {
    return null;
  }
  const changes: RenderedTableCellChange[] = [];
  for (let index = 0; index < left.cellCount; index += 1) {
    const leftCell = left.cells[index];
    const rightCell = right.cells[index];
    if (!leftCell || !rightCell) {
      return null;
    }
    if (
      leftCell.normalizedTextHash === rightCell.normalizedTextHash &&
      leftCell.header === rightCell.header
    ) {
      continue;
    }
    changes.push({
      kind: "changed",
      side: "both",
      confidence: "high",
      leftRowIndex: left.index,
      rightRowIndex: right.index,
      leftCellIndex: leftCell.index,
      rightCellIndex: rightCell.index,
    });
  }
  return changes;
}

function sameRow(
  left: RenderedTableRowSnapshot,
  right: RenderedTableRowSnapshot,
): boolean {
  return (
    left.normalizedTextHash === right.normalizedTextHash &&
    left.cellCount === right.cellCount
  );
}

function hasDuplicateRows(rows: readonly RenderedTableRowSnapshot[]): boolean {
  const hashes = new Set<string>();
  for (const row of rows) {
    if (hashes.has(row.normalizedTextHash)) {
      return true;
    }
    hashes.add(row.normalizedTextHash);
  }
  return false;
}

function hasReorderedCommonRows(
  leftRows: readonly RenderedTableRowSnapshot[],
  rightRows: readonly RenderedTableRowSnapshot[],
): boolean {
  const rightOrder = new Map(
    rightRows.map((row, index) => [row.normalizedTextHash, index]),
  );
  let previousRightIndex = -1;
  for (const leftRow of leftRows) {
    const rightIndex = rightOrder.get(leftRow.normalizedTextHash);
    if (rightIndex === undefined) {
      continue;
    }
    if (rightIndex < previousRightIndex) {
      return true;
    }
    previousRightIndex = rightIndex;
  }
  return false;
}

function isAnchoredReplacement({
  leftRows,
  rightRows,
  leftIndex,
  rightIndex,
  matchedBefore,
}: {
  leftRows: readonly RenderedTableRowSnapshot[];
  rightRows: readonly RenderedTableRowSnapshot[];
  leftIndex: number;
  rightIndex: number;
  matchedBefore: boolean;
}): boolean {
  const left = leftRows[leftIndex];
  const right = rightRows[rightIndex];
  if (!left || !right || left.cellCount !== right.cellCount) {
    return false;
  }
  return (
    (matchedBefore && isEndPair(leftRows, rightRows, leftIndex, rightIndex)) ||
    hasCommonRowAfter(leftRows, rightRows, leftIndex + 1, rightIndex + 1)
  );
}

function isEndPair(
  leftRows: readonly RenderedTableRowSnapshot[],
  rightRows: readonly RenderedTableRowSnapshot[],
  leftIndex: number,
  rightIndex: number,
): boolean {
  return (
    leftIndex === leftRows.length - 1 && rightIndex === rightRows.length - 1
  );
}

function hasCommonRowAfter(
  leftRows: readonly RenderedTableRowSnapshot[],
  rightRows: readonly RenderedTableRowSnapshot[],
  leftStart: number,
  rightStart: number,
): boolean {
  const rightHashes = new Set(
    rightRows.slice(rightStart).map((row) => row.normalizedTextHash),
  );
  return leftRows
    .slice(leftStart)
    .some((row) => rightHashes.has(row.normalizedTextHash));
}

function isHighConfidenceChangedRow(
  left: RenderedTableRowSnapshot,
  right: RenderedTableRowSnapshot,
): boolean {
  if (left.cellCount !== right.cellCount) {
    return false;
  }
  for (let index = 0; index < left.cellCount; index += 1) {
    const leftCell = left.cells[index];
    const rightCell = right.cells[index];
    if (!leftCell || !rightCell) {
      return false;
    }
    if (leftCell.normalizedTextHash === rightCell.normalizedTextHash) {
      continue;
    }
    if (!isHighConfidenceChangedCell(leftCell, rightCell)) {
      return false;
    }
  }
  return true;
}

function isHighConfidenceChangedCell(
  left: RenderedTableRowSnapshot["cells"][number],
  right: RenderedTableRowSnapshot["cells"][number],
): boolean {
  if (Math.min(left.textLength, right.textLength) < changedCellMinimumLength) {
    return false;
  }
  return (
    segmentOverlap(left.textSegmentHashes, right.textSegmentHashes) >=
    changedCellMinimumOverlap
  );
}

function segmentOverlap(leftHashes: string[], rightHashes: string[]): number {
  if (leftHashes.length === 0 || rightHashes.length === 0) {
    return 0;
  }
  const rightSet = new Set(rightHashes);
  const shared = new Set(leftHashes.filter((hash) => rightSet.has(hash)));
  const union = new Set([...leftHashes, ...rightHashes]);
  return shared.size / union.size;
}
