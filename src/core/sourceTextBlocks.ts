import type { SourceLineOrigin } from "./asciidocInclude";
import type { SourceTextBlock } from "./types";

export function extractAsciiDocParagraphSourceBlocks(
  source: string,
  lineOrigins?: SourceLineOrigin[],
): SourceTextBlock[] {
  const lines = source.split("\n");
  const blocks: SourceTextBlock[] = [];
  let index = 0;
  let delimiter: string | null = null;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed || isNonParagraphLine(trimmed)) {
      if (isDelimiter(trimmed)) {
        delimiter = delimiter === trimmed ? null : trimmed;
      }
      index += 1;
      continue;
    }
    if (delimiter || isListLine(trimmed)) {
      index += 1;
      continue;
    }

    const start = index;
    while (index < lines.length && lines[index].trim()) {
      if (
        isNonParagraphLine(lines[index].trim()) ||
        isListLine(lines[index].trim())
      ) {
        break;
      }
      index += 1;
    }
    const end = index - 1;
    const origins = lineOrigins?.slice(start, end + 1);
    const firstOrigin = origins?.[0];
    if (
      end >= start &&
      (!origins ||
        (firstOrigin &&
          origins.every(
            (origin, offset) =>
              origin.sourcePath === firstOrigin.sourcePath &&
              origin.line === firstOrigin.line + offset,
          )))
    ) {
      blocks.push({
        id: `text-${blocks.length + 1}`,
        kind: "paragraph",
        startLine: firstOrigin?.line ?? start + 1,
        endLine: origins?.at(-1)?.line ?? end + 1,
        ...(firstOrigin
          ? { sourceLocation: { ...firstOrigin, column: 1 } }
          : {}),
      });
    }
    if (index === start) {
      index += 1;
    }
  }

  return blocks;
}

function isDelimiter(value: string) {
  return /^(?:----|\.\.\.\.|====|\*\*\*\*|____|\+\+\+\+|--|\|===)$/.test(value);
}

function isNonParagraphLine(value: string) {
  return (
    /^(?:={1,6}\s+|\[.*\]$|:\S[^:]*:|(?:image|video)::|\|)/.test(value) ||
    isDelimiter(value)
  );
}

function isListLine(value: string) {
  return /^(?:[*-]+|\.+|\d+\.)\s+/.test(value);
}
