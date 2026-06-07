import { documentFormatForPath } from "../../core/documentFormat";
import { renderDocument } from "../../core/renderDocument";
import type { DocumentDiffPreview, DocumentFormat } from "../../core/types";

export type TableCellDiffKind = "unchanged" | "added" | "removed" | "changed";

export type TableFallbackReason =
  | "complex-span"
  | "render-error"
  | "no-table"
  | "table-mismatch";

export interface TableCellDiff {
  left: string;
  right: string;
  kind: TableCellDiffKind;
}

export interface RenderedTableDiff {
  id: string;
  format: DocumentFormat;
  label: string;
  cells: TableCellDiff[][];
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

export function compareRenderedTable(
  leftRows: string[][] = [],
  rightRows: string[][] = [],
): TableCellDiff[][] {
  const height = Math.max(leftRows.length, rightRows.length);
  const width = Math.max(
    0,
    ...leftRows.map((row) => row.length),
    ...rightRows.map((row) => row.length),
  );
  return Array.from({ length: height }, (_, rowIndex) =>
    Array.from({ length: width }, (_, columnIndex) => {
      const left = leftRows[rowIndex]?.[columnIndex] ?? "";
      const right = rightRows[rowIndex]?.[columnIndex] ?? "";
      const hasLeft = leftRows[rowIndex]?.[columnIndex] !== undefined;
      const hasRight = rightRows[rowIndex]?.[columnIndex] !== undefined;
      const kind: TableCellDiffKind =
        !hasLeft && hasRight
          ? "added"
          : hasLeft && !hasRight
            ? "removed"
            : left === right
              ? "unchanged"
              : "changed";
      return { left, right, kind };
    }),
  );
}

function hasCellChanges(cells: TableCellDiff[][]): boolean {
  return cells.some((row) => row.some((cell) => cell.kind !== "unchanged"));
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

  const renderedTables = Array.from({ length: tableCount }, (_, index) => {
    const left = leftTables[index];
    const right = rightTables[index];
    const cells = compareRenderedTable(left?.rows, right?.rows);
    return {
      id: `rendered-table:${index}`,
      format,
      label: right?.label ?? left?.label ?? `Table ${index + 1}`,
      cells,
    };
  }).filter((table) => hasCellChanges(table.cells));

  return {
    renderedTables,
    tableMarkers,
    fallbackReason:
      renderedTables.length === 0 && tableMarkers.length > 0
        ? "no-table"
        : undefined,
  };
}
