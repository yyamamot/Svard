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
import { parseMarkdownAuthorContainerOpeningTag } from "./authorHtml";
import {
  scanMarkdownAuthorHtml,
  type MarkdownAuthorHtmlRegistry,
} from "./authorHtmlRuntime";

const detailsClosePattern = /^<\/details>\s*$/i;
interface MarkdownDetailsOpening {
  bodyStartIndex: number;
  open: boolean;
  summary: string;
  summaryLineIndex: number;
  summaryStartInLine: number;
}

function parseSummaryLine(
  source: string,
): { startOffset: number; summary: string } | null {
  const leadingWhitespace = source.match(/^\s*/u)?.[0].length ?? 0;
  const trimmedStart = source.slice(leadingWhitespace);
  const opening = parseMarkdownAuthorContainerOpeningTag(
    trimmedStart,
    "summary",
  );
  if (!opening) return null;
  const remainder = trimmedStart.slice(opening.endOffset);
  const closing = remainder.match(/<\/summary>\s*$/iu);
  if (!closing || closing.index === undefined) return null;
  return {
    startOffset: leadingWhitespace + opening.endOffset,
    summary: remainder.slice(0, closing.index),
  };
}

function renderMarkdownDetailsToWriter(
  block: MarkdownDetailsBlock,
  writer: Utf8ChunkWriter,
  rendererId?: string,
  authorHtmlRegistry?: MarkdownAuthorHtmlRegistry,
): void {
  writer.append(
    `<details class="markdown-details"${block.open ? " open" : ""} data-review-id="markdown-details"${rendererId ? ` ${MARKDOWN_RENDERER_PROVENANCE_ATTRIBUTE}="${rendererId}"` : ""}><summary>`,
  );
  renderMarkdownInlineToWriter(
    block.summary.trim(),
    writer,
    authorHtmlRegistry,
  );
  writer.append('</summary><div class="markdown-details-body">');
  renderMarkdownFragmentToWriter(block.body, writer, {
    authorHtmlRegistry,
  });
  writer.append("</div></details>");
}

export interface MarkdownDetailsProvenanceContext {
  originalBodyLineOffset: number;
  registry: MarkdownRendererProvenanceRegistry;
  sourceMap: MarkdownOriginalSourceMap;
  authorHtmlRegistry?: MarkdownAuthorHtmlRegistry;
}

function parseMarkdownDetailsAt(
  lines: string[],
  startIndex: number,
): {
  block: MarkdownDetailsBlock;
  endIndex: number;
  opening: MarkdownDetailsOpening;
} | null {
  const opening = lines[startIndex].replace(/\r$/, "").trim();
  let parsedOpening: MarkdownDetailsOpening | null = null;
  const detailsOpening = parseMarkdownAuthorContainerOpeningTag(
    opening,
    "details",
  );
  if (detailsOpening) {
    const remainder = opening.slice(detailsOpening.endOffset);
    const compactSummary = parseSummaryLine(remainder);
    if (compactSummary) {
      parsedOpening = {
        bodyStartIndex: startIndex + 1,
        open: detailsOpening.open,
        summary: compactSummary.summary,
        summaryLineIndex: startIndex,
        summaryStartInLine:
          lines[startIndex].toLowerCase().indexOf("<details") +
          detailsOpening.endOffset +
          compactSummary.startOffset,
      };
    } else if (remainder.trim() === "") {
      const summarySource = lines[startIndex + 1]?.replace(/\r$/, "");
      const summary = summarySource ? parseSummaryLine(summarySource) : null;
      if (summary) {
        parsedOpening = {
          bodyStartIndex: startIndex + 2,
          open: detailsOpening.open,
          summary: summary.summary,
          summaryLineIndex: startIndex + 1,
          summaryStartInLine: summary.startOffset,
        };
      }
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
    opening: parsedOpening,
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
    let block = parsed.block;
    if (provenance?.authorHtmlRegistry) {
      const opening = parsed.opening;
      const summaryLineStart = provenance.sourceMap.startOffsetForLine(
        provenance.originalBodyLineOffset + opening.summaryLineIndex,
      );
      const bodyLineStart = provenance.sourceMap.startOffsetForLine(
        provenance.originalBodyLineOffset + opening.bodyStartIndex,
      );
      if (summaryLineStart === null || bodyLineStart === null) {
        throw new Error(MARKDOWN_RENDERER_PROVENANCE_INTEGRITY_ERROR);
      }
      const summary = scanMarkdownAuthorHtml(
        block.summary,
        summaryLineStart + opening.summaryStartInLine,
        provenance.authorHtmlRegistry,
      ).source;
      const body = scanMarkdownAuthorHtml(
        block.body,
        bodyLineStart,
        provenance.authorHtmlRegistry,
      ).source;
      block = { ...block, summary, body };
    }
    const rendererId =
      provenance && sourceSpan
        ? provenance.registry.add({
            kind: "details",
            tagName: "details",
            sourceSpan,
          })
        : undefined;
    const marker = placeholders.add(index, (writer) =>
      renderMarkdownDetailsToWriter(
        block,
        writer,
        rendererId,
        provenance?.authorHtmlRegistry,
      ),
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
