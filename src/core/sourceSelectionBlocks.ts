import type { SourceLineOrigin } from "./asciidocInclude";
import type { DocumentFormat, SourceSelectionBlock } from "./types";

const diagramTypes = new Set(["mermaid", "plantuml", "graphviz", "dot"]);

export function extractSourceSelectionBlocks(
  source: string,
  format: DocumentFormat,
  lineOrigins?: SourceLineOrigin[],
): SourceSelectionBlock[] {
  const lines = source.split("\n");
  const ranges = format === "markdown" ? markdownRanges(lines) : asciidocRanges(lines);
  const counters = new Map<string, number>();
  const blocks: SourceSelectionBlock[] = [];
  for (const range of ranges) {
    const location = locationForRange(range.start, range.end, lineOrigins);
    if (!location) continue;
    const count = (counters.get(range.kind) ?? 0) + 1;
    counters.set(range.kind, count);
    blocks.push({
      id: `selection-${range.kind}-${count}`,
      kind: range.kind,
      startLine: location.startLine,
      endLine: location.endLine,
      ...(location.sourcePath ? { sourceLocation: { sourcePath: location.sourcePath, line: location.startLine } } : {}),
    });
  }
  return blocks;
}

type RangeKind = SourceSelectionBlock["kind"];
interface LineRange { kind: RangeKind; start: number; end: number }

function markdownRanges(lines: string[]): LineRange[] {
  const ranges: LineRange[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }
    if (/^#{1,6}\s+/.test(line)) { ranges.push({ kind: "heading", start: index, end: index }); index += 1; continue; }
    const fence = /^\s*(`{3,}|~{3,})\s*([^\s]*)/.exec(line);
    if (fence) {
      const marker = fence[1][0]; const length = fence[1].length; let end = index + 1;
      while (end < lines.length && !new RegExp(`^\\s*${marker}{${length},}\\s*$`).test(lines[end])) end += 1;
      if (end >= lines.length) { index += 1; continue; }
      ranges.push({ kind: diagramTypes.has(fence[2].toLowerCase()) ? "diagram" : "code", start: index, end });
      index = end + 1; continue;
    }
    if (isMarkdownTable(lines, index)) {
      let end = index + 2;
      while (end < lines.length && /^\s*\|/.test(lines[end])) end += 1;
      ranges.push({ kind: "table", start: index, end: end - 1 }); index = end; continue;
    }
    if (isSimpleMarkdownList(line)) {
      let end = index + 1;
      while (end < lines.length && (isSimpleMarkdownList(lines[end]) || !lines[end].trim())) end += 1;
      if (lines.slice(index, end).some((item) => /^\s{2,}(?:[-*+] |\d+\. )/.test(item))) { index = end; continue; }
      ranges.push({ kind: "list", start: index, end: lastContentLine(lines, index, end) }); index = end; continue;
    }
    const start = index;
    while (index < lines.length && lines[index].trim() && !/^#{1,6}\s+/.test(lines[index]) && !/^\s*(`{3,}|~{3,})/.test(lines[index]) && !isSimpleMarkdownList(lines[index]) && !isMarkdownTable(lines, index)) index += 1;
    if (index > start) ranges.push({ kind: "paragraph", start, end: index - 1 }); else index += 1;
  }
  return ranges;
}

function asciidocRanges(lines: string[]): LineRange[] {
  const ranges: LineRange[] = [];
  for (let index = 0; index < lines.length;) {
    const line = lines[index]; const trimmed = line.trim();
    if (!trimmed || /^:\S/.test(trimmed)) { index += 1; continue; }
    if (/^={1,6}\s+/.test(trimmed)) { ranges.push({ kind: "heading", start: index, end: index }); index += 1; continue; }
    if (trimmed === "|===") {
      let end = index + 1; while (end < lines.length && lines[end].trim() !== "|===") end += 1;
      if (end < lines.length) { ranges.push({ kind: "table", start: index, end }); index = end + 1; continue; }
    }
    const attribute = /^\[([^\]]+)\]$/.exec(trimmed);
    const delimiter = attribute ? lines[index + 1]?.trim() : undefined;
    if (attribute && (delimiter === "----" || delimiter === "....")) {
      let end = index + 2; while (end < lines.length && lines[end].trim() !== delimiter) end += 1;
      if (end < lines.length) {
        const type = attribute[1].split(",")[0].trim().toLowerCase();
        ranges.push({ kind: diagramTypes.has(type) ? "diagram" : type === "source" ? "code" : "paragraph", start: index, end });
        index = end + 1; continue;
      }
    }
    if (isSimpleAsciiDocList(trimmed)) {
      let end = index + 1; while (end < lines.length && (isSimpleAsciiDocList(lines[end].trim()) || !lines[end].trim())) end += 1;
      if (lines.slice(index, end).some((item) => /^\s+[*-]\s+/.test(item))) { index = end; continue; }
      ranges.push({ kind: "list", start: index, end: lastContentLine(lines, index, end) }); index = end; continue;
    }
    if (/^(?:\[.*\]|(?:image|video)::|----|\.\.\.\.|====|\*\*\*\*|____|\+\+\+\+|--)$/.test(trimmed)) { index += 1; continue; }
    const start = index;
    while (index < lines.length && lines[index].trim() && !/^={1,6}\s+/.test(lines[index].trim()) && !isSimpleAsciiDocList(lines[index].trim()) && lines[index].trim() !== "|===") index += 1;
    if (index > start) ranges.push({ kind: "paragraph", start, end: index - 1 }); else index += 1;
  }
  return ranges;
}

function locationForRange(start: number, end: number, origins?: SourceLineOrigin[]) {
  if (!origins) return { startLine: start + 1, endLine: end + 1, sourcePath: undefined };
  const range = origins.slice(start, end + 1); const first = range[0];
  if (!first || !range.every((origin, offset) => origin.sourcePath === first.sourcePath && origin.line === first.line + offset)) return undefined;
  return { startLine: first.line, endLine: range.at(-1)!.line, sourcePath: first.sourcePath };
}

function isSimpleMarkdownList(line: string) { return /^(?:[-*+] |\d+\. )/.test(line); }
function isSimpleAsciiDocList(line: string) { return /^(?:[*-]|\d+\.)\s+/.test(line); }
function isMarkdownTable(lines: string[], index: number) { return /\|/.test(lines[index] ?? "") && /^\s*\|?\s*:?-{3,}/.test(lines[index + 1] ?? ""); }
function lastContentLine(lines: string[], start: number, end: number) { let index = end - 1; while (index > start && !lines[index].trim()) index -= 1; return index; }
