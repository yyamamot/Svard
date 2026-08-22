import { isFenceBoundary, renderMarkdownInlineToWriter } from "./enhancements";
import type {
  MarkdownPlaceholderRegistry,
  Utf8ChunkWriter,
} from "./placeholders";

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
): void {
  const rows = lines
    .slice(1)
    .map((line) => parsePipeCells(line))
    .filter((cells): cells is string[] => Boolean(cells));
  writer.append("<table><tbody>");
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

export function extractMarkdownCompatibility(
  source: string,
  placeholders: MarkdownPlaceholderRegistry,
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
        const marker = placeholders.add(index, (writer) =>
          renderCompatPipeTableToWriter(tableLines, writer),
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
