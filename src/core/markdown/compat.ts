import { escapeHtml } from "./escape";
import { isFenceBoundary } from "./enhancements";
import { markdown } from "./markdownIt";

const compatPlaceholderPrefix = "SVARD_MARKDOWN_COMPAT_PLACEHOLDER";

function isSingleLineHtmlComment(trimmed: string): boolean {
  return /^<!--[\s\S]*-->$/.test(trimmed);
}

function parsePipeCells(line: string): string[] | null {
  const trimmed = line.replace(/\r$/, "").trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) {
    return null;
  }
  return trimmed.slice(1, -1).split("|").map((cell) => cell.trim());
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

function renderCompatPipeTable(lines: string[]): string {
  const rows = lines
    .slice(1)
    .map((line) => parsePipeCells(line))
    .filter((cells): cells is string[] => Boolean(cells));
  const body = rows
    .map(
      (cells) =>
        `<tr>${cells
          .map((cell) => `<td>${markdown.renderInline(cell)}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  return `<table><tbody>${body}</tbody></table>`;
}

export function extractMarkdownCompatibility(source: string): {
  source: string;
  replacements: Map<string, string>;
} {
  const lines = source.split("\n");
  const transformed: string[] = [];
  const replacements = new Map<string, string>();
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

    if (!inFence && isSeparatorFirstTableStart(line)) {
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
        const marker = `${compatPlaceholderPrefix}_${replacements.size}`;
        replacements.set(marker, renderCompatPipeTable(tableLines));
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

  return { source: transformed.join("\n"), replacements };
}

export function replaceMarkdownCompatibilityPlaceholders(
  html: string,
  replacements: Map<string, string>,
): string {
  let rendered = html;
  for (const [marker, replacement] of replacements) {
    const escapedMarker = escapeHtml(marker);
    rendered = rendered
      .replaceAll(`<p>${escapedMarker}</p>\n`, `${replacement}\n`)
      .replaceAll(`<p>${escapedMarker}</p>`, replacement)
      .replaceAll(escapedMarker, replacement);
  }
  return rendered;
}
