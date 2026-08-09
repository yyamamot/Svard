import { escapeHtml } from "./escape";
import { isFenceBoundary, renderMarkdownFragmentHtml } from "./enhancements";
import { markdown } from "./markdownIt";
import type { MarkdownDetailsBlock } from "./types";

const detailsOpenPattern = /^<details(?:\s+open)?\s*>$/i;
const compactDetailsOpenPattern =
  /^<details(\s+open)?\s*>\s*<summary>(.*)<\/summary>\s*$/i;
const detailsClosePattern = /^<\/details>\s*$/i;
const summaryPattern = /^<summary>(.*)<\/summary>\s*$/i;
const detailsPlaceholderPrefix = "SVARD_MARKDOWN_DETAILS_PLACEHOLDER";

interface MarkdownDetailsOpening {
  bodyStartIndex: number;
  open: boolean;
  summary: string;
}

function renderMarkdownDetailsHtml(block: MarkdownDetailsBlock): string {
  const summaryHtml = markdown.renderInline(block.summary.trim());
  const bodyHtml = renderMarkdownFragmentHtml(block.body);
  return `<details class="markdown-details"${block.open ? " open" : ""} data-review-id="markdown-details"><summary>${summaryHtml}</summary><div class="markdown-details-body">${bodyHtml}</div></details>`;
}

function parseMarkdownDetailsAt(
  lines: string[],
  startIndex: number,
): { endIndex: number; html: string } | null {
  const opening = lines[startIndex].replace(/\r$/, "").trim();
  let parsedOpening: MarkdownDetailsOpening | null = null;
  const compactMatch = opening.match(compactDetailsOpenPattern);
  if (compactMatch) {
    parsedOpening = {
      bodyStartIndex: startIndex + 1,
      open: Boolean(compactMatch[1]),
      summary: compactMatch[2],
    };
  } else if (detailsOpenPattern.test(opening)) {
    const summaryLine = lines[startIndex + 1]?.replace(/\r$/, "").trim();
    const summaryMatch = summaryLine?.match(summaryPattern);
    if (summaryMatch) {
      parsedOpening = {
        bodyStartIndex: startIndex + 2,
        open: /\sopen\s*>$/i.test(opening),
        summary: summaryMatch[1],
      };
    }
  }

  if (!parsedOpening) {
    return null;
  }

  const bodyLines: string[] = [];
  let closeIndex = -1;
  for (
    let index = parsedOpening.bodyStartIndex;
    index < lines.length;
    index += 1
  ) {
    const trimmed = lines[index].replace(/\r$/, "").trim();
    if (detailsClosePattern.test(trimmed)) {
      closeIndex = index;
      break;
    }
    bodyLines.push(lines[index]);
  }

  if (closeIndex < 0) {
    return null;
  }

  const hasUnsupportedNestedMarkup = bodyLines.some((line) => {
    const trimmed = line.replace(/\r$/, "").trim();
    return (
      /^<details(?:\s|>)/i.test(trimmed) || /^<summary(?:\s|>)/i.test(trimmed)
    );
  });
  if (hasUnsupportedNestedMarkup) {
    return null;
  }

  return {
    endIndex: closeIndex,
    html: renderMarkdownDetailsHtml({
      open: parsedOpening.open,
      summary: parsedOpening.summary,
      body: bodyLines.join("\n"),
    }),
  };
}

export function extractMarkdownDetails(source: string): {
  source: string;
  replacements: Map<string, string>;
} {
  const lines = source.split("\n");
  const replacements = new Map<string, string>();
  const transformed: string[] = [];
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.replace(/\r$/, "").trim();
    if (isFenceBoundary(trimmed)) {
      inFence = !inFence;
      transformed.push(line);
      continue;
    }

    const parsed = !inFence ? parseMarkdownDetailsAt(lines, index) : null;
    if (!parsed) {
      if (!inFence && /^<details(?:\s|>)/i.test(trimmed)) {
        transformed.push(line);
        for (let rawIndex = index + 1; rawIndex < lines.length; rawIndex += 1) {
          transformed.push(lines[rawIndex]);
          if (
            detailsClosePattern.test(lines[rawIndex].replace(/\r$/, "").trim())
          ) {
            index = rawIndex;
            break;
          }
          index = rawIndex;
        }
        continue;
      }
      transformed.push(line);
      continue;
    }

    const marker = `${detailsPlaceholderPrefix}_${replacements.size}`;
    replacements.set(marker, parsed.html);
    transformed.push(marker);
    for (
      let blankIndex = index + 1;
      blankIndex <= parsed.endIndex;
      blankIndex += 1
    ) {
      transformed.push("");
    }
    index = parsed.endIndex;
  }

  return { source: transformed.join("\n"), replacements };
}

export function replaceMarkdownDetailsPlaceholders(
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
