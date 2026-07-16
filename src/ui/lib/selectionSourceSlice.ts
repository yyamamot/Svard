import type { SourceSelectionBlock } from "../../core/types";

export interface SourceMappedSelectionUnit {
  element: HTMLElement;
  kind: SourceSelectionBlock["kind"];
  source: string;
  sourcePath: string;
  startLine: number;
  endLine: number;
}

export interface SourceSelectionSlice {
  source: string;
  sourcePath: string;
  startOffset: number;
  endOffset: number;
  blockStartOffset: number;
  blockEndOffset: number;
  startLine: number;
  endLine: number;
  text: string;
}

export interface SourceSelectionFragment {
  sourcePath: string;
  startLine: number;
  endLine: number;
  text: string;
}

export function sourceSlicesForRange(
  range: Range,
  units: SourceMappedSelectionUnit[],
): SourceSelectionSlice[] | undefined {
  if (!units.length) return undefined;
  const slices = units.map((unit, index) =>
    sourceSliceForUnit(range, unit, index, units.length),
  );
  if (slices.some((slice) => !slice)) return undefined;
  const resolved = slices as SourceSelectionSlice[];
  if (
    resolved.some((slice, index) => {
      const previous = resolved[index - 1];
      return (
        previous &&
        normalizePath(previous.sourcePath) ===
          normalizePath(slice.sourcePath) &&
        previous.source === slice.source &&
        slice.blockStartOffset < previous.blockEndOffset
      );
    })
  ) {
    return undefined;
  }
  return resolved;
}

function sourceSliceForUnit(
  range: Range,
  unit: SourceMappedSelectionUnit,
  index: number,
  length: number,
) {
  const blockStart = lineStartOffset(unit.source, unit.startLine);
  const blockEnd = lineEndOffset(unit.source, unit.endLine);
  if (
    blockStart === undefined ||
    blockEnd === undefined ||
    blockEnd < blockStart
  ) {
    return undefined;
  }

  if (index > 0 && index < length - 1) {
    return selectionSlice(unit, blockStart, blockEnd, blockStart, blockEnd);
  }

  const selectedText = selectedTextWithinUnit(
    range,
    unit.element,
    index,
    length,
  );
  if (!selectedText) return undefined;
  if (unit.kind !== "code" && selectionCoversVisibleText(range, unit.element)) {
    return selectionSlice(unit, blockStart, blockEnd, blockStart, blockEnd);
  }
  const blockText = unit.source.slice(blockStart, blockEnd);
  const relativeStart = blockText.indexOf(selectedText);
  if (
    relativeStart < 0 ||
    blockText.indexOf(selectedText, relativeStart + 1) >= 0 ||
    (unit.kind !== "code" &&
      hasMarkupBoundary(blockText, relativeStart, selectedText.length))
  ) {
    return undefined;
  }
  return selectionSlice(
    unit,
    blockStart + relativeStart,
    blockStart + relativeStart + selectedText.length,
    blockStart,
    blockEnd,
  );
}

function selectionCoversVisibleText(selection: Range, element: HTMLElement) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  let first: Text | undefined;
  let last: Text | undefined;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node as Text;
    if (
      !/\S/u.test(text.data) ||
      text.parentElement?.closest(
        '[data-selection-exclude], [hidden], [aria-hidden="true"]',
      )
    ) {
      continue;
    }
    first ??= text;
    last = text;
  }
  if (!first || !last) return false;

  const visible = document.createRange();
  visible.setStart(first, first.data.search(/\S/u));
  visible.setEnd(last, last.data.search(/\s*$/u));
  return (
    selection.compareBoundaryPoints(Range.START_TO_START, visible) <= 0 &&
    selection.compareBoundaryPoints(Range.END_TO_END, visible) >= 0
  );
}

function selectedTextWithinUnit(
  selection: Range,
  element: HTMLElement,
  index: number,
  length: number,
) {
  const range = document.createRange();
  range.selectNodeContents(element);
  if (index === 0) {
    if (!element.contains(selection.startContainer)) return undefined;
    range.setStart(selection.startContainer, selection.startOffset);
  }
  if (index === length - 1) {
    if (!element.contains(selection.endContainer)) return undefined;
    range.setEnd(selection.endContainer, selection.endOffset);
  }
  return range.toString();
}

function selectionSlice(
  unit: SourceMappedSelectionUnit,
  startOffset: number,
  endOffset: number,
  blockStartOffset: number,
  blockEndOffset: number,
): SourceSelectionSlice {
  const text = unit.source.slice(startOffset, endOffset);
  return {
    source: unit.source,
    sourcePath: unit.sourcePath,
    startOffset,
    endOffset,
    blockStartOffset,
    blockEndOffset,
    startLine: lineForOffset(unit.source, startOffset),
    endLine: lineForOffset(unit.source, Math.max(startOffset, endOffset - 1)),
    text,
  };
}

export function groupSourceSelectionSlices(
  slices: SourceSelectionSlice[],
): SourceSelectionFragment[] {
  const fragments: Array<
    SourceSelectionFragment & { source: string; lastBlockEndOffset: number }
  > = [];
  for (const slice of slices) {
    const last = fragments.at(-1);
    if (
      last &&
      normalizePath(last.sourcePath) === normalizePath(slice.sourcePath) &&
      last.source === slice.source &&
      slice.blockStartOffset >= last.lastBlockEndOffset
    ) {
      last.text +=
        slice.source.slice(last.lastBlockEndOffset, slice.blockStartOffset) +
        slice.text;
      last.endLine = slice.endLine;
      last.lastBlockEndOffset = slice.blockEndOffset;
    } else {
      fragments.push({
        source: slice.source,
        sourcePath: slice.sourcePath,
        startLine: slice.startLine,
        endLine: slice.endLine,
        text: slice.text,
        lastBlockEndOffset: slice.blockEndOffset,
      });
    }
  }
  return fragments.map(
    ({ source: _source, lastBlockEndOffset: _end, ...fragment }) => fragment,
  );
}

function lineStartOffset(source: string, line: number) {
  if (!Number.isInteger(line) || line < 1) return undefined;
  if (line === 1) return 0;
  let offset = 0;
  for (let current = 1; current < line; current += 1) {
    const next = source.indexOf("\n", offset);
    if (next < 0) return undefined;
    offset = next + 1;
  }
  return offset;
}

function lineEndOffset(source: string, line: number) {
  const start = lineStartOffset(source, line);
  if (start === undefined) return undefined;
  const newline = source.indexOf("\n", start);
  return newline < 0 ? source.length : newline;
}

function lineForOffset(source: string, offset: number) {
  let line = 1;
  for (let index = 0; index < offset; index += 1) {
    if (source[index] === "\n") line += 1;
  }
  return line;
}

function hasMarkupBoundary(source: string, start: number, length: number) {
  const before = source[start - 1] ?? "";
  const after = source[start + length] ?? "";
  return /[*_`[\]{}<>]/u.test(before) || /[*_`[\]{}<>]/u.test(after);
}

function normalizePath(path: string) {
  return path.replace(/\\/gu, "/");
}
