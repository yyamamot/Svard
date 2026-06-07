import type { Heading, SourceBlock, SourceLocation } from "./types";
import type { SourceLineOrigin } from "./asciidocInclude";

export function sourceLocationAt(
  source: string,
  index: number,
  lineOrigins?: SourceLineOrigin[],
): SourceLocation {
  const prefix = source.slice(0, index);
  const lines = prefix.split("\n");
  const line = lines.length;
  const origin = lineOrigins?.[line - 1];
  return {
    line: origin?.line ?? line,
    column: lines.at(-1)!.length + 1,
    ...(origin?.sourcePath ? { sourcePath: origin.sourcePath } : {}),
  };
}

export function extractHeadingSourceLocations(
  source: string,
  lineOrigins?: SourceLineOrigin[],
): SourceLocation[] {
  const locations: SourceLocation[] = [];
  const headingPattern = /^(={1,6})\s+(.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = headingPattern.exec(source)) !== null) {
    locations.push(sourceLocationAt(source, match.index, lineOrigins));
  }

  return locations;
}

export function extractHeadings(
  html: string,
  source: string,
  lineOrigins?: SourceLineOrigin[],
): Heading[] {
  const headings: Heading[] = [];
  const sourceLocations = extractHeadingSourceLocations(source, lineOrigins);
  const pattern = /<h([1-6])[^>]* id="([^"]+)"[^>]*>(.*?)<\/h\1>/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html)) !== null) {
    const sourceLocation = sourceLocations[headings.length];
    headings.push({
      level: Number(match[1]),
      id: match[2],
      text: match[3].replace(/<[^>]*>/g, ""),
      ...(sourceLocation ? { sourceLocation } : {}),
    });
  }

  return headings;
}

export function extractSourceBlocks(
  source: string,
  lineOrigins?: SourceLineOrigin[],
): SourceBlock[] {
  const blocks: SourceBlock[] = [];
  const pattern = /^\[source(?:,([^\]]+))?\]\s*\n----/gm;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const language = match[1]?.split(",")[0]?.trim();
    blocks.push({
      id: `source-${blocks.length + 1}`,
      ...(language ? { language } : {}),
      sourceLocation: sourceLocationAt(source, match.index, lineOrigins),
    });
  }

  return blocks;
}
