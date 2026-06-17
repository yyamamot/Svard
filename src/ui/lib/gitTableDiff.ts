import { documentFormatForPath } from "../../core/documentFormat";
import { renderDocument } from "../../core/renderDocument";
import type { DocumentDiffPreview, DocumentFormat } from "../../core/types";

export type TableCellDiffKind = "unchanged" | "added" | "removed" | "changed";

export type TableFallbackReason =
  | "complex-span"
  | "ambiguous"
  | "render-error"
  | "no-table"
  | "shape-mismatch"
  | "table-mismatch";

export interface TableCellDiff {
  left: string;
  right: string;
  kind: TableCellDiffKind;
}

export interface TableRowDiff {
  kind: Exclude<TableCellDiffKind, "unchanged">;
  rowIndex: number;
  side: "left" | "right" | "both";
}

export interface RenderedTableDiff {
  id: string;
  format: DocumentFormat;
  label: string;
  cells: TableCellDiff[][];
  rowChanges: TableRowDiff[];
}

export interface TableBlockMarker {
  id: string;
  startLine: number;
  endLine: number;
  side: "left" | "right";
}

export interface GitTableDiffSummary {
  renderedTables: RenderedTableDiff[];
  tableMarkers: TableBlockMarker[];
  fallbackReason?: TableFallbackReason;
}

interface RenderedTable {
  label: string;
  rows: string[][];
  complex: boolean;
}

interface SourceTableBlock {
  startLine: number;
  endLine: number;
}

function splitLines(value?: string | null): string[] {
  return value ? value.split(/\r?\n/) : [];
}

function normalizedText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function labelForTable(table: HTMLTableElement, index: number): string {
  const caption = normalizedText(table.caption?.textContent);
  if (caption) {
    return `Table ${index + 1} · ${caption}`;
  }

  let previous = table.previousElementSibling;
  while (previous) {
    if (/^H[1-6]$/.test(previous.tagName)) {
      const heading = normalizedText(previous.textContent);
      if (heading) {
        return `Table ${index + 1} · ${heading}`;
      }
    }
    previous = previous.previousElementSibling;
  }

  return `Table ${index + 1}`;
}

export function extractRenderedTablesFromHtml(html: string): RenderedTable[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.querySelectorAll("table")).map((table, index) => {
    const complex =
      table.querySelector("table") !== null ||
      Array.from(table.querySelectorAll("th,td")).some((cell) => {
        const colSpan = Number(cell.getAttribute("colspan") ?? "1");
        const rowSpan = Number(cell.getAttribute("rowspan") ?? "1");
        return colSpan > 1 || rowSpan > 1;
      });
    const rows = Array.from(table.rows).map((row) =>
      Array.from(row.cells).map((cell) => normalizedText(cell.textContent)),
    );
    return { label: labelForTable(table, index), rows, complex };
  });
}

export interface RenderedTableCompareResult {
  cells: TableCellDiff[][];
  rowChanges: TableRowDiff[];
  fallbackReason?: TableFallbackReason;
}

export function compareRenderedTable(
  leftRows: string[][] = [],
  rightRows: string[][] = [],
): RenderedTableCompareResult {
  const leftSignatures = leftRows.map(rowSignature);
  const rightSignatures = rightRows.map(rowSignature);
  if (hasDuplicateValues(leftSignatures) || hasDuplicateValues(rightSignatures)) {
    return { cells: [], rowChanges: [], fallbackReason: "ambiguous" };
  }
  if (hasReorderedCommonRows(leftSignatures, rightSignatures)) {
    return { cells: [], rowChanges: [], fallbackReason: "ambiguous" };
  }

  const matches = alignRowsBySignature(leftSignatures, rightSignatures);
  const cells: TableCellDiff[][] = [];
  const rowChanges: TableRowDiff[] = [];
  let leftIndex = 0;
  let rightIndex = 0;

  for (const match of matches) {
    const gap = appendRowGap({
      cells,
      leftRows: leftRows.slice(leftIndex, match.leftIndex),
      rightRows: rightRows.slice(rightIndex, match.rightIndex),
      rowChanges,
    });
    if (gap) {
      return gap;
    }
    const rowIndex = cells.length;
    cells.push(rowCells(leftRows[match.leftIndex], rightRows[match.rightIndex]));
    if (rowHasChanges(cells[rowIndex])) {
      rowChanges.push({ kind: "changed", rowIndex, side: "both" });
    }
    leftIndex = match.leftIndex + 1;
    rightIndex = match.rightIndex + 1;
  }

  const tail = appendRowGap({
    cells,
    leftRows: leftRows.slice(leftIndex),
    rightRows: rightRows.slice(rightIndex),
    rowChanges,
  });
  if (tail) {
    return tail;
  }

  return { cells, rowChanges };
}

function hasTableChanges(table: RenderedTableDiff): boolean {
  return table.rowChanges.length > 0;
}

function rowSignature(row: string[]): string {
  return row.map(normalizedText).join("\u001f");
}

function hasDuplicateValues(values: readonly string[]): boolean {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      return true;
    }
    seen.add(value);
  }
  return false;
}

function hasReorderedCommonRows(
  leftSignatures: readonly string[],
  rightSignatures: readonly string[],
): boolean {
  const rightIndexes = new Map(
    rightSignatures.map((signature, index) => [signature, index]),
  );
  let previousRightIndex = -1;
  for (const signature of leftSignatures) {
    const rightIndex = rightIndexes.get(signature);
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

function alignRowsBySignature(
  leftSignatures: readonly string[],
  rightSignatures: readonly string[],
): Array<{ leftIndex: number; rightIndex: number }> {
  const rows = leftSignatures.length + 1;
  const columns = rightSignatures.length + 1;
  const scores = Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => 0),
  );

  for (let leftIndex = leftSignatures.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (
      let rightIndex = rightSignatures.length - 1;
      rightIndex >= 0;
      rightIndex -= 1
    ) {
      scores[leftIndex][rightIndex] =
        leftSignatures[leftIndex] === rightSignatures[rightIndex]
          ? scores[leftIndex + 1][rightIndex + 1] + 1
          : Math.max(
              scores[leftIndex + 1][rightIndex],
              scores[leftIndex][rightIndex + 1],
            );
    }
  }

  const matches: Array<{ leftIndex: number; rightIndex: number }> = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < leftSignatures.length && rightIndex < rightSignatures.length) {
    if (
      leftSignatures[leftIndex] === rightSignatures[rightIndex] &&
      scores[leftIndex][rightIndex] ===
        scores[leftIndex + 1][rightIndex + 1] + 1
    ) {
      matches.push({ leftIndex, rightIndex });
      leftIndex += 1;
      rightIndex += 1;
    } else if (
      scores[leftIndex + 1][rightIndex] >= scores[leftIndex][rightIndex + 1]
    ) {
      leftIndex += 1;
    } else {
      rightIndex += 1;
    }
  }
  return matches;
}

function appendRowGap({
  cells,
  leftRows,
  rightRows,
  rowChanges,
}: {
  cells: TableCellDiff[][];
  leftRows: string[][];
  rightRows: string[][];
  rowChanges: TableRowDiff[];
}): RenderedTableCompareResult | null {
  if (leftRows.length === 0 && rightRows.length === 0) {
    return null;
  }
  if (leftRows.length === 0) {
    for (const right of rightRows) {
      const rowIndex = cells.length;
      cells.push(rowCells(undefined, right, "added"));
      rowChanges.push({ kind: "added", rowIndex, side: "right" });
    }
    return null;
  }
  if (rightRows.length === 0) {
    for (const left of leftRows) {
      const rowIndex = cells.length;
      cells.push(rowCells(left, undefined, "removed"));
      rowChanges.push({ kind: "removed", rowIndex, side: "left" });
    }
    return null;
  }
  const pairedRows = Math.min(leftRows.length, rightRows.length);
  for (let index = 0; index < pairedRows; index += 1) {
    if (leftRows[index]?.length !== rightRows[index]?.length) {
      return { cells: [], rowChanges: [], fallbackReason: "shape-mismatch" };
    }
    const rowIndex = cells.length;
    cells.push(rowCells(leftRows[index], rightRows[index]));
    if (rowHasChanges(cells[rowIndex])) {
      rowChanges.push({ kind: "changed", rowIndex, side: "both" });
    }
  }
  for (const right of rightRows.slice(pairedRows)) {
    const rowIndex = cells.length;
    cells.push(rowCells(undefined, right, "added"));
    rowChanges.push({ kind: "added", rowIndex, side: "right" });
  }
  for (const left of leftRows.slice(pairedRows)) {
    const rowIndex = cells.length;
    cells.push(rowCells(left, undefined, "removed"));
    rowChanges.push({ kind: "removed", rowIndex, side: "left" });
  }
  return null;
}

function rowCells(
  leftRow: string[] | undefined,
  rightRow: string[] | undefined,
  forcedKind?: "added" | "removed",
): TableCellDiff[] {
  const width = Math.max(leftRow?.length ?? 0, rightRow?.length ?? 0);
  return Array.from({ length: width }, (_, columnIndex) => {
    const left = leftRow?.[columnIndex] ?? "";
    const right = rightRow?.[columnIndex] ?? "";
    const hasLeft = leftRow?.[columnIndex] !== undefined;
    const hasRight = rightRow?.[columnIndex] !== undefined;
    const kind: TableCellDiffKind =
      forcedKind ??
      (!hasLeft && hasRight
        ? "added"
        : hasLeft && !hasRight
          ? "removed"
          : left === right
            ? "unchanged"
            : "changed");
    return { left, right, kind };
  });
}

function rowHasChanges(row: readonly TableCellDiff[] | undefined): boolean {
  return Boolean(row?.some((cell) => cell.kind !== "unchanged"));
}

function extractAsciiDocTableBlocks(
  source?: string | null,
): SourceTableBlock[] {
  const lines = splitLines(source);
  const blocks: SourceTableBlock[] = [];
  let startLine: number | null = null;
  lines.forEach((line, index) => {
    if (line.trim() !== "|===") {
      return;
    }
    const lineNumber = index + 1;
    if (startLine === null) {
      startLine = lineNumber;
      return;
    }
    blocks.push({ startLine, endLine: lineNumber });
    startLine = null;
  });
  return blocks;
}

function splitMarkdownTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|");
}

function isMarkdownTableSeparator(line: string): boolean {
  const cells = splitMarkdownTableRow(line);
  return (
    cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()))
  );
}

function looksLikeMarkdownTableRow(line: string): boolean {
  return line.includes("|") && splitMarkdownTableRow(line).length >= 2;
}

function extractMarkdownTableBlocks(
  source?: string | null,
): SourceTableBlock[] {
  const lines = splitLines(source);
  const blocks: SourceTableBlock[] = [];
  let index = 0;
  while (index < lines.length - 1) {
    if (
      looksLikeMarkdownTableRow(lines[index]) &&
      isMarkdownTableSeparator(lines[index + 1])
    ) {
      const startLine = index + 1;
      index += 2;
      while (index < lines.length && looksLikeMarkdownTableRow(lines[index])) {
        index += 1;
      }
      blocks.push({ startLine, endLine: index });
      continue;
    }
    index += 1;
  }
  return blocks;
}

function lineOverlapsBlock(
  line: number | null | undefined,
  block: SourceTableBlock,
): boolean {
  return Boolean(line && line >= block.startLine && line <= block.endLine);
}

function changedTableMarkersForSide(
  preview: DocumentDiffPreview,
  side: "left" | "right",
  format: DocumentFormat,
): TableBlockMarker[] {
  const source = side === "left" ? preview.leftText : preview.rightText;
  const blocks =
    format === "markdown"
      ? extractMarkdownTableBlocks(source)
      : extractAsciiDocTableBlocks(source);
  return blocks.flatMap((block, index) => {
    const changed = preview.hunks.some((hunk) =>
      hunk.lines.some(
        (line) =>
          line.kind !== "context" &&
          lineOverlapsBlock(
            side === "left" ? line.oldLine : line.newLine,
            block,
          ),
      ),
    );
    return changed
      ? [{ id: `${side}:${index}`, side, ...block } satisfies TableBlockMarker]
      : [];
  });
}

export function changedTableMarkers(
  preview: DocumentDiffPreview,
  format = documentFormatForPath(preview.relativePath ?? ""),
): TableBlockMarker[] {
  return [
    ...changedTableMarkersForSide(preview, "left", format),
    ...changedTableMarkersForSide(preview, "right", format),
  ];
}

async function renderTablesFromSource(
  source: string | null | undefined,
  format: DocumentFormat,
): Promise<RenderedTable[]> {
  if (!source) {
    return [];
  }
  const result = await renderDocument({ format, source });
  return extractRenderedTablesFromHtml(result.html);
}

export async function deriveGitTableDiffSummary(
  preview: DocumentDiffPreview,
): Promise<GitTableDiffSummary> {
  const format = documentFormatForPath(preview.relativePath ?? "");
  const tableMarkers = changedTableMarkers(preview, format);

  let leftTables: RenderedTable[];
  let rightTables: RenderedTable[];
  try {
    [leftTables, rightTables] = await Promise.all([
      renderTablesFromSource(preview.leftText, format),
      renderTablesFromSource(preview.rightText, format),
    ]);
  } catch {
    return {
      renderedTables: [],
      tableMarkers,
      fallbackReason: tableMarkers.length > 0 ? "render-error" : "no-table",
    };
  }

  if (
    leftTables.some((table) => table.complex) ||
    rightTables.some((table) => table.complex)
  ) {
    return {
      renderedTables: [],
      tableMarkers,
      fallbackReason: "complex-span",
    };
  }

  const tableCount = Math.max(leftTables.length, rightTables.length);
  if (tableCount === 0) {
    return {
      renderedTables: [],
      tableMarkers,
      fallbackReason: tableMarkers.length > 0 ? "no-table" : undefined,
    };
  }

  if (Math.abs(leftTables.length - rightTables.length) > 1) {
    return {
      renderedTables: [],
      tableMarkers,
      fallbackReason: "table-mismatch",
    };
  }

  const renderedTables: RenderedTableDiff[] = [];
  for (let index = 0; index < tableCount; index += 1) {
    const left = leftTables[index];
    const right = rightTables[index];
    const comparison = compareRenderedTable(left?.rows, right?.rows);
    if (comparison.fallbackReason) {
      return {
        renderedTables: [],
        tableMarkers,
        fallbackReason: comparison.fallbackReason,
      };
    }
    renderedTables.push({
      id: `rendered-table:${index}`,
      format,
      label: right?.label ?? left?.label ?? `Table ${index + 1}`,
      cells: comparison.cells,
      rowChanges: comparison.rowChanges,
    });
  }
  const changedTables = renderedTables.filter(hasTableChanges);

  return {
    renderedTables: changedTables,
    tableMarkers,
    fallbackReason:
      changedTables.length === 0 && tableMarkers.length > 0
        ? "no-table"
        : undefined,
  };
}
