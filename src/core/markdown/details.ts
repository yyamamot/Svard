import {
  isFenceBoundary,
  renderMarkdownFragmentToWriter,
  renderMarkdownInlineToWriter,
} from "./enhancements";
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
import type { MarkdownDetailsBlock } from "./types";

const detailsOpenPattern = /^<details(?:\s+open)?\s*>$/i;
const compactDetailsOpenPattern =
  /^<details(\s+open)?\s*>\s*<summary>(.*)<\/summary>\s*$/i;
const detailsClosePattern = /^<\/details>\s*$/i;
const summaryPattern = /^<summary>(.*)<\/summary>\s*$/i;
interface MarkdownDetailsOpening {
  bodyStartIndex: number;
  open: boolean;
  summary: string;
}

function renderMarkdownDetailsToWriter(
  block: MarkdownDetailsBlock,
  writer: Utf8ChunkWriter,
  rendererId?: string,
): void {
  writer.append(
    `<details class="markdown-details"${block.open ? " open" : ""} data-review-id="markdown-details"${rendererId ? ` ${MARKDOWN_RENDERER_PROVENANCE_ATTRIBUTE}="${rendererId}"` : ""}><summary>`,
  );
  renderMarkdownInlineToWriter(block.summary.trim(), writer);
  writer.append('</summary><div class="markdown-details-body">');
  renderMarkdownFragmentToWriter(block.body, writer);
  writer.append("</div></details>");
}

export interface MarkdownDetailsProvenanceContext {
  originalBodyLineOffset: number;
  registry: MarkdownRendererProvenanceRegistry;
  sourceMap: MarkdownOriginalSourceMap;
}

function parseMarkdownDetailsAt(
  lines: string[],
  startIndex: number,
): { block: MarkdownDetailsBlock; endIndex: number } | null {
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
    block: {
      open: parsedOpening.open,
      summary: parsedOpening.summary,
      body: bodyLines.join("\n"),
    },
    endIndex: closeIndex,
  };
}

export function extractMarkdownDetails(
  source: string,
  placeholders: MarkdownPlaceholderRegistry,
  provenance?: MarkdownDetailsProvenanceContext,
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

    const sourceSpan = provenance?.sourceMap.spanForLineRange(
      provenance.originalBodyLineOffset + index,
      provenance.originalBodyLineOffset + parsed.endIndex + 1,
    );
    if (provenance && !sourceSpan) {
      throw new Error(MARKDOWN_RENDERER_PROVENANCE_INTEGRITY_ERROR);
    }
    placeholders.assertCanAdd();
    const rendererId =
      provenance && sourceSpan
        ? provenance.registry.add({
            kind: "details",
            tagName: "details",
            sourceSpan,
          })
        : undefined;
    const marker = placeholders.add(index, (writer) =>
      renderMarkdownDetailsToWriter(parsed.block, writer, rendererId),
    );
    count += 1;
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

  return { source: transformed.join("\n"), count };
}
