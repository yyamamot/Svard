import { isFenceBoundary, renderMarkdownInlineToWriter } from "./enhancements";
import type {
  MarkdownPlaceholderRegistry,
  Utf8ChunkWriter,
} from "./placeholders";
import {
  MARKDOWN_RENDERER_PROVENANCE_ATTRIBUTE,
  MARKDOWN_RENDERER_PROVENANCE_INTEGRITY_ERROR,
  type MarkdownRendererProvenanceRegistry,
} from "./rendererProvenance";
import type { MarkdownOriginalSourceMap } from "./sourceSpans";

function isSingleLineHtmlComment(trimmed: string): boolean {
  return /^<!--[\s\S]*-->$/.test(trimmed);
}

function parsePipeCells(line: string): string[] | null {
  const trimmed = line.replace(/\r$/, "").trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    return null;
  }
  return trimmed
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorCell(cell: string): boolean {
  return /^:?-{3,}:?$/.test(cell);
}

function isSeparatorFirstTableStart(line: string): boolean {
  const cells = parsePipeCells(line);
  return Boolean(
    cells && cells.length >= 2 && cells.every((cell) => isSeparatorCell(cell)),
  );
}

function isPipeRow(line: string): boolean {
  const cells = parsePipeCells(line);
  return Boolean(cells && cells.length >= 2);
}

function isPreviousLinePipeRow(lines: string[], index: number): boolean {
  if (index === 0) {
    return false;
  }
  return isPipeRow(lines[index - 1]);
}

function renderCompatPipeTableToWriter(
  lines: string[],
  writer: Utf8ChunkWriter,
  rendererId?: string,
): void {
  const rows = lines
    .slice(1)
    .map((line) => parsePipeCells(line))
    .filter((cells): cells is string[] => Boolean(cells));
  writer.append(
    `<table${rendererId ? ` ${MARKDOWN_RENDERER_PROVENANCE_ATTRIBUTE}="${rendererId}"` : ""}><tbody>`,
  );
  for (const cells of rows) {
    writer.append("<tr>");
    for (const cell of cells) {
      writer.append("<td>");
      renderMarkdownInlineToWriter(cell, writer);
      writer.append("</td>");
    }
    writer.append("</tr>");
  }
  writer.append("</tbody></table>");
}

export interface MarkdownCompatibilityProvenanceContext {
  originalBodyLineOffset: number;
  registry: MarkdownRendererProvenanceRegistry;
  sourceMap: MarkdownOriginalSourceMap;
}

export function extractMarkdownCompatibility(
  source: string,
  placeholders: MarkdownPlaceholderRegistry,
  provenance?: MarkdownCompatibilityProvenanceContext,
): {
  count: number;
  source: string;
} {
  const lines = source.split("\n");
  const transformed: string[] = [];
  let count = 0;
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.replace(/\r$/, "").trim();
    if (isFenceBoundary(trimmed)) {
      inFence = !inFence;
      transformed.push(line);
      continue;
    }

    if (!inFence && isSingleLineHtmlComment(trimmed)) {
      transformed.push("");
      continue;
    }

    if (
      !inFence &&
      isSeparatorFirstTableStart(line) &&
      !isPreviousLinePipeRow(lines, index)
    ) {
      const tableLines = [line];
      let tableEndIndex = index;
      for (
        let rowIndex = index + 1;
        rowIndex < lines.length && isPipeRow(lines[rowIndex]);
        rowIndex += 1
      ) {
        tableLines.push(lines[rowIndex]);
        tableEndIndex = rowIndex;
      }

      if (tableLines.length > 1) {
        const originalStartLine =
          (provenance?.originalBodyLineOffset ?? 0) + index;
        const originalEndLine =
          (provenance?.originalBodyLineOffset ?? 0) + tableEndIndex + 1;
        const sourceSpan = provenance?.sourceMap.spanForLineRange(
          originalStartLine,
          originalEndLine,
        );
        if (provenance && !sourceSpan) {
          throw new Error(MARKDOWN_RENDERER_PROVENANCE_INTEGRITY_ERROR);
        }
        placeholders.assertCanAdd();
        const rendererId =
          provenance && sourceSpan
            ? provenance.registry.add({
                kind: "table",
                tagName: "table",
                tableKind: "compatibility",
                sourceSpan,
              })
            : undefined;
        const marker = placeholders.add(index, (writer) =>
          renderCompatPipeTableToWriter(tableLines, writer, rendererId),
        );
        count += 1;
        transformed.push(marker);
        for (
          let blankIndex = index + 1;
          blankIndex <= tableEndIndex;
          blankIndex += 1
        ) {
          transformed.push("");
        }
        index = tableEndIndex;
        continue;
      }
    }

    transformed.push(line);
  }

  return { source: transformed.join("\n"), count };
}
