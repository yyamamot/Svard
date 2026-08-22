import type { MarkdownRendererSourceSpan } from "../types";

export interface MarkdownOriginalLineRange {
  endLine: number;
  startLine: number;
}

export class MarkdownOriginalSourceMap {
  readonly #source: string;
  readonly #lineStarts: number[] = [0];
  readonly #lineContentEnds: number[] = [];

  constructor(source: string) {
    this.#source = source;
    for (let index = 0; index < source.length; index += 1) {
      if (source.charCodeAt(index) !== 0x0a) {
        continue;
      }
      this.#lineContentEnds.push(
        index > 0 && source.charCodeAt(index - 1) === 0x0d ? index - 1 : index,
      );
      this.#lineStarts.push(index + 1);
    }
    this.#lineContentEnds.push(source.length);
  }

  get lineCount(): number {
    return this.#lineStarts.length;
  }

  trimBlankBoundaryLines(
    range: MarkdownOriginalLineRange,
  ): MarkdownOriginalLineRange | null {
    let { startLine, endLine } = range;
    while (startLine < endLine && this.#lineIsBlank(startLine)) {
      startLine += 1;
    }
    while (endLine > startLine && this.#lineIsBlank(endLine - 1)) {
      endLine -= 1;
    }
    return startLine < endLine ? { startLine, endLine } : null;
  }

  spanForLineRange(
    startLine: number,
    endLine: number,
  ): MarkdownRendererSourceSpan | null {
    if (
      !Number.isSafeInteger(startLine) ||
      !Number.isSafeInteger(endLine) ||
      startLine < 0 ||
      startLine >= endLine ||
      endLine > this.#lineStarts.length
    ) {
      return null;
    }
    const startOffset = this.#lineStarts[startLine];
    const endOffset = this.#lineContentEnds[endLine - 1];
    if (startOffset >= endOffset) {
      return null;
    }
    return { startOffset, endOffset };
  }

  #lineIsBlank(line: number): boolean {
    return /^\s*$/u.test(
      this.#source.slice(this.#lineStarts[line], this.#lineContentEnds[line]),
    );
  }
}

export function originalLineRangeForTokenMap(
  tokenMap: [number, number] | null,
  inputLineForOutputLine: readonly number[],
  originalBodyLineOffset: number,
): MarkdownOriginalLineRange | null {
  if (
    !tokenMap ||
    !Number.isSafeInteger(tokenMap[0]) ||
    !Number.isSafeInteger(tokenMap[1]) ||
    tokenMap[0] < 0 ||
    tokenMap[0] >= tokenMap[1] ||
    tokenMap[1] > inputLineForOutputLine.length
  ) {
    return null;
  }
  const mappedLines = inputLineForOutputLine.slice(tokenMap[0], tokenMap[1]);
  if (
    mappedLines.length === 0 ||
    mappedLines.some(
      (line, index) =>
        !Number.isSafeInteger(line) ||
        line < 0 ||
        (index > 0 && line !== mappedLines[index - 1] + 1),
    )
  ) {
    return null;
  }
  return {
    startLine: mappedLines[0] + originalBodyLineOffset,
    endLine: mappedLines.at(-1)! + originalBodyLineOffset + 1,
  };
}
