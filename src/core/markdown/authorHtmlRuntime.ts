import type { Options } from "markdown-it/lib/index.mjs";
import type Renderer from "markdown-it/lib/renderer.mjs";
import type StateBlock from "markdown-it/lib/rules_block/state_block.mjs";
import type StateInline from "markdown-it/lib/rules_inline/state_inline.mjs";
import type Token from "markdown-it/lib/token.mjs";

import type { MarkdownAuthorHtmlFragment } from "../types";
import {
  MAX_MARKDOWN_AUTHOR_HTML_ITEMS,
  isMarkdownAuthorHtmlBlockRootTag,
  parseMarkdownAuthorHtmlBlockFragment,
  parseMarkdownAuthorHtmlFragment,
  type MarkdownAuthorHtmlParseResult,
  type MarkdownAuthorHtmlSourceSpan,
  type MarkdownAuthorHtmlTagName,
} from "./authorHtml";
import { escapeHtml } from "./escape";
import { MARKDOWN_RENDER_BUDGET_ERROR } from "./placeholders";

export const MAX_MARKDOWN_AUTHOR_HTML_ID_ATTEMPTS = 8;
export const MARKDOWN_AUTHOR_HTML_INTEGRITY_ERROR =
  "Markdown rendering stopped because author HTML provenance integrity validation failed.";
export const markdownAuthorHtmlTokenType = "svard_author_html";
export const markdownAuthorHtmlBlockTokenType = "svard_author_html_block";

const authorMarkerPrefix = "<SVARD_MARKDOWN_AUTHOR_HTML";
const authorRegistryKey: unique symbol = Symbol(
  "svardMarkdownAuthorHtmlRegistry",
);
const allowedTags = new Set<MarkdownAuthorHtmlTagName>([
  "abbr",
  "br",
  "del",
  "ins",
  "kbd",
  "mark",
  "rp",
  "rt",
  "ruby",
  "s",
  "small",
  "sub",
  "sup",
]);

interface MarkdownAuthorHtmlRecord {
  fragment: MarkdownAuthorHtmlFragment;
  marker: string;
  source: string;
  visibleText: string;
}

export interface MarkdownAuthorHtmlBlockLineRange {
  endLine: number;
  startLine: number;
}

interface MarkdownAuthorHtmlTokenMeta {
  authorHtmlId: string;
}

interface MarkdownAuthorHtmlEnvironment {
  [authorRegistryKey]?: MarkdownAuthorHtmlRegistry;
}

function throwAuthorIntegrityError(): never {
  throw new Error(MARKDOWN_AUTHOR_HTML_INTEGRITY_ERROR);
}

function throwAuthorBudgetError(): never {
  throw new Error(MARKDOWN_RENDER_BUDGET_ERROR);
}

function random128BitHex(): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) return throwAuthorIntegrityError();
  const bytes = new Uint8Array(16);
  try {
    cryptoApi.getRandomValues(bytes);
  } catch {
    return throwAuthorIntegrityError();
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function authorNonce(originalSource: string): string {
  for (
    let attempt = 0;
    attempt < MAX_MARKDOWN_AUTHOR_HTML_ID_ATTEMPTS;
    attempt += 1
  ) {
    const candidate = random128BitHex();
    if (!originalSource.includes(`${authorMarkerPrefix}_${candidate}_`)) {
      return candidate;
    }
  }
  return throwAuthorIntegrityError();
}

export class MarkdownAuthorHtmlRegistry {
  readonly #originalSource: string;
  readonly #lineStarts: number[];
  #nonce = "";
  readonly #records: MarkdownAuthorHtmlRecord[] = [];
  readonly #recordsById = new Map<string, MarkdownAuthorHtmlRecord>();
  readonly #recordsByMarker = new Map<string, MarkdownAuthorHtmlRecord>();
  readonly #consumedIds = new Set<string>();
  #itemCount = 0;

  constructor(originalSource: string) {
    this.#originalSource = originalSource;
    this.#lineStarts = [0];
    for (let index = 0; index < originalSource.length; index += 1) {
      if (originalSource[index] === "\n") this.#lineStarts.push(index + 1);
    }
  }

  get size(): number {
    return this.#records.length;
  }

  add(
    source: string,
    sourceSpan: MarkdownAuthorHtmlSourceSpan,
    parsed: Extract<MarkdownAuthorHtmlParseResult, { status: "pass" }>,
    kind: MarkdownAuthorHtmlFragment["kind"] = "inline",
  ): string {
    if (
      !Number.isSafeInteger(sourceSpan.startOffset) ||
      !Number.isSafeInteger(sourceSpan.endOffset) ||
      sourceSpan.startOffset < 0 ||
      sourceSpan.startOffset >= sourceSpan.endOffset ||
      sourceSpan.endOffset > this.#originalSource.length ||
      this.#originalSource.slice(
        sourceSpan.startOffset,
        sourceSpan.endOffset,
      ) !== source
    ) {
      return throwAuthorIntegrityError();
    }
    const nextItemCount = this.#itemCount + parsed.elementCount + 1;
    if (nextItemCount > MAX_MARKDOWN_AUTHOR_HTML_ITEMS) {
      return throwAuthorBudgetError();
    }
    if (this.#nonce === "") this.#nonce = authorNonce(this.#originalSource);
    const sequence = this.#records.length + 1;
    const id = `${this.#nonce}-${sequence}`;
    const marker = `${authorMarkerPrefix}_${this.#nonce}_${sequence}>`;
    const record: MarkdownAuthorHtmlRecord = {
      fragment: { id, kind, sourceSpan },
      marker,
      source,
      visibleText: parsed.visibleText,
    };
    this.#itemCount = nextItemCount;
    this.#records.push(record);
    this.#recordsById.set(id, record);
    this.#recordsByMarker.set(marker, record);
    return marker;
  }

  matchAt(
    source: string,
    offset: number,
    kind?: MarkdownAuthorHtmlFragment["kind"],
  ): MarkdownAuthorHtmlRecord | null {
    if (this.#nonce === "") return null;
    const prefix = `${authorMarkerPrefix}_${this.#nonce}_`;
    if (!source.startsWith(prefix, offset)) return null;
    let endOffset = offset + prefix.length;
    while (/[0-9]/u.test(source[endOffset] ?? "")) endOffset += 1;
    if (source[endOffset] === ">") endOffset += 1;
    const record = this.#recordsByMarker.get(source.slice(offset, endOffset));
    return record && (!kind || record.fragment.kind === kind) ? record : null;
  }

  consume(id: string): MarkdownAuthorHtmlRecord {
    if (this.#consumedIds.has(id)) return throwAuthorIntegrityError();
    const record = this.#recordsById.get(id);
    if (!record) return throwAuthorIntegrityError();
    this.#consumedIds.add(id);
    return record;
  }

  assertAllConsumed(): void {
    if (this.#consumedIds.size !== this.#records.length) {
      throwAuthorIntegrityError();
    }
  }

  fragments(): readonly MarkdownAuthorHtmlFragment[] {
    return this.#records
      .map((record) => record.fragment)
      .sort(
        (left, right) =>
          left.sourceSpan.startOffset - right.sourceSpan.startOffset,
      );
  }

  blockLineRanges(): readonly MarkdownAuthorHtmlBlockLineRange[] {
    const lineForOffset = (offset: number): number => {
      let low = 0;
      let high = this.#lineStarts.length;
      while (low + 1 < high) {
        const middle = Math.floor((low + high) / 2);
        if (this.#lineStarts[middle] <= offset) low = middle;
        else high = middle;
      }
      return low + 1;
    };
    return this.#records
      .filter((record) => record.fragment.kind === "block")
      .map(({ fragment }) => ({
        startLine: lineForOffset(fragment.sourceSpan.startOffset),
        endLine: lineForOffset(fragment.sourceSpan.endOffset - 1),
      }));
  }

  sourceForMarker(marker: string): string | undefined {
    return this.#recordsByMarker.get(marker)?.source;
  }

  restoreMarkers(value: string): string {
    if (this.#nonce === "" || !value.includes(`${authorMarkerPrefix}_`)) {
      return value;
    }
    const pattern = new RegExp(
      `${authorMarkerPrefix}_${this.#nonce}_[0-9]+>`,
      "gu",
    );
    return value.replace(
      pattern,
      (marker) => this.sourceForMarker(marker) ?? marker,
    );
  }
}

export function containsMarkdownAuthorHtmlToken(
  tokens: readonly Token[] | null | undefined,
): boolean {
  return Boolean(
    tokens?.some(
      (token) =>
        token.type === markdownAuthorHtmlTokenType ||
        token.type === markdownAuthorHtmlBlockTokenType ||
        containsMarkdownAuthorHtmlToken(token.children),
    ),
  );
}

export function attachMarkdownAuthorHtmlRegistry(
  env: object,
  registry: MarkdownAuthorHtmlRegistry,
): void {
  const existing = (env as MarkdownAuthorHtmlEnvironment)[authorRegistryKey];
  if (existing && existing !== registry) return throwAuthorIntegrityError();
  if (existing === registry) return;
  Object.defineProperty(env, authorRegistryKey, {
    configurable: false,
    enumerable: false,
    value: registry,
    writable: false,
  });
}

export function parseMarkdownAuthorHtmlInlineToken(
  state: StateInline,
): boolean {
  const registry = (state.env as MarkdownAuthorHtmlEnvironment)[
    authorRegistryKey
  ];
  if (!registry) return false;
  const record = registry.matchAt(state.src, state.pos, "inline");
  if (!record) return false;
  const token = state.push(markdownAuthorHtmlTokenType, "", 0);
  token.content = record.visibleText;
  token.meta = {
    authorHtmlId: record.fragment.id,
  } satisfies MarkdownAuthorHtmlTokenMeta;
  state.pos += record.marker.length;
  return true;
}

export function parseMarkdownAuthorHtmlBlockToken(
  state: StateBlock,
  startLine: number,
  _endLine: number,
  silent: boolean,
): boolean {
  const registry = (state.env as MarkdownAuthorHtmlEnvironment)[
    authorRegistryKey
  ];
  if (!registry) return false;
  const offset = state.bMarks[startLine] + state.tShift[startLine];
  const record = registry.matchAt(state.src, offset, "block");
  if (!record) return false;
  const lineEnd = state.eMarks[startLine];
  if (state.src.slice(offset + record.marker.length, lineEnd).trim()) {
    return false;
  }
  if (silent) return true;
  const token = state.push(markdownAuthorHtmlBlockTokenType, "", 0);
  token.block = true;
  token.map = [startLine, startLine + 1];
  token.meta = {
    authorHtmlId: record.fragment.id,
  } satisfies MarkdownAuthorHtmlTokenMeta;
  state.line = startLine + 1;
  return true;
}

export function renderMarkdownAuthorHtmlToken(
  tokens: Token[],
  index: number,
  _options: Options,
  env: unknown,
  _renderer: Renderer,
): string {
  const token = tokens[index];
  const meta = token.meta as Partial<MarkdownAuthorHtmlTokenMeta> | null;
  const registry = (env as MarkdownAuthorHtmlEnvironment | null)?.[
    authorRegistryKey
  ];
  if (
    (token.type !== markdownAuthorHtmlTokenType &&
      token.type !== markdownAuthorHtmlBlockTokenType) ||
    token.tag !== "" ||
    token.attrs !== null ||
    token.nesting !== 0 ||
    token.children !== null ||
    token.markup !== "" ||
    token.info !== "" ||
    token.block !== (token.type === markdownAuthorHtmlBlockTokenType) ||
    token.hidden !== false ||
    !meta ||
    Object.keys(meta).length !== 1 ||
    typeof meta.authorHtmlId !== "string" ||
    !registry
  ) {
    return throwAuthorIntegrityError();
  }
  const record = registry.consume(meta.authorHtmlId);
  const markerName =
    record.fragment.kind === "block"
      ? "svard-markdown-author-html-block"
      : "svard-markdown-author-html-inline";
  if (
    (record.fragment.kind === "block") !==
    (token.type === markdownAuthorHtmlBlockTokenType)
  ) {
    return throwAuthorIntegrityError();
  }
  return `<${markerName} data-svard-markdown-author-html-id="${record.fragment.id}">${escapeHtml(record.source)}</${markerName}>${record.fragment.kind === "block" ? "\n" : ""}`;
}

function openingTagNameAt(source: string, offset: number): string | null {
  if (source[offset] !== "<" || source[offset + 1] === "/") return null;
  const match = source.slice(offset + 1).match(/^([A-Za-z][A-Za-z0-9-]*)/u);
  return match?.[1].toLowerCase() ?? null;
}

function tagEndOffset(
  source: string,
  offset: number,
  limit = source.length,
): number | null {
  let quote = "";
  for (let index = offset; index < limit; index += 1) {
    const character = source[index];
    if (character === "\n" || character === "\r") return null;
    if (quote) {
      if (character === quote) quote = "";
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === ">") return index + 1;
  }
  return null;
}

type HtmlLikeRootResult =
  | { status: "complete"; endOffset: number }
  | { status: "malformed" };

function htmlLikeRoot(
  source: string,
  startOffset: number,
  cache?: Map<number, HtmlLikeRootResult>,
  limit = source.length,
): HtmlLikeRootResult {
  const cached = cache?.get(startOffset);
  if (cached) return cached;
  const rootName = openingTagNameAt(source, startOffset);
  if (!rootName) return { status: "malformed" };
  const stack: { name: string; startOffset: number }[] = [];
  const malformed = (): HtmlLikeRootResult => {
    const result = { status: "malformed" } as const;
    for (const entry of stack) cache?.set(entry.startOffset, result);
    cache?.set(startOffset, result);
    return result;
  };
  let offset = startOffset;
  while (offset < limit) {
    const nextTagOffset = source.indexOf("<", offset);
    if (nextTagOffset < 0 || nextTagOffset >= limit) return malformed();
    const endOffset = tagEndOffset(source, nextTagOffset, limit);
    if (endOffset === null) return malformed();
    const rawTag = source.slice(nextTagOffset, endOffset);
    const closing = rawTag.match(/^<\/\s*([A-Za-z][A-Za-z0-9-]*)\s*>$/u);
    if (closing) {
      if (stack.at(-1)?.name !== closing[1].toLowerCase()) {
        return malformed();
      }
      const closed = stack.pop();
      const result = { status: "complete", endOffset } as const;
      if (closed) cache?.set(closed.startOffset, result);
      if (stack.length === 0) return result;
      offset = endOffset;
      continue;
    }
    const opening = rawTag.match(/^<\s*([A-Za-z][A-Za-z0-9-]*)\b[\s\S]*>$/u);
    if (!opening) return malformed();
    const tagName = opening[1].toLowerCase();
    const isVoid =
      tagName === "br" ||
      tagName === "hr" ||
      tagName === "col" ||
      /\/\s*>$/u.test(rawTag);
    if (!isVoid) stack.push({ name: tagName, startOffset: nextTagOffset });
    else {
      const result = { status: "complete", endOffset } as const;
      cache?.set(nextTagOffset, result);
      if (stack.length === 0) return result;
    }
    offset = endOffset;
  }
  return malformed();
}

function isEscaped(source: string, offset: number): boolean {
  let slashCount = 0;
  for (
    let index = offset - 1;
    index >= 0 && source[index] === "\\";
    index -= 1
  ) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

interface ScanAuthorHtmlLineResult {
  inComment: boolean;
  source: string;
}

function scanAuthorHtmlLine(
  line: string,
  absoluteLineOffset: number,
  registry: MarkdownAuthorHtmlRegistry,
  startsInComment = false,
): ScanAuthorHtmlLineResult {
  let output = "";
  let offset = 0;
  let inComment = startsInComment;
  while (offset < line.length) {
    if (
      inComment ||
      (!isEscaped(line, offset) && line.startsWith("<!--", offset))
    ) {
      const commentStart = offset;
      const closeOffset = line.indexOf("-->", inComment ? offset : offset + 4);
      if (closeOffset < 0) {
        output += line.slice(commentStart);
        return { inComment: true, source: output };
      }
      const endOffset = closeOffset + 3;
      output += line.slice(commentStart, endOffset);
      offset = endOffset;
      inComment = false;
      continue;
    }
    if (line[offset] === "`") {
      let runEnd = offset + 1;
      while (line[runEnd] === "`") runEnd += 1;
      const delimiter = line.slice(offset, runEnd);
      const closeOffset = line.indexOf(delimiter, runEnd);
      const endOffset =
        closeOffset < 0 ? runEnd : closeOffset + delimiter.length;
      output += line.slice(offset, endOffset);
      offset = endOffset;
      continue;
    }
    if (line[offset] !== "<" || isEscaped(line, offset)) {
      output += line[offset];
      offset += 1;
      continue;
    }
    const tagName = openingTagNameAt(line, offset);
    if (!tagName) {
      output += line[offset];
      offset += 1;
      continue;
    }
    const root = htmlLikeRoot(line, offset);
    if (root.status === "malformed") {
      output += line.slice(offset);
      break;
    }
    const candidate = line.slice(offset, root.endOffset);
    if (allowedTags.has(tagName as MarkdownAuthorHtmlTagName)) {
      const parsed = parseMarkdownAuthorHtmlFragment(candidate);
      if (parsed.status === "pass") {
        output += registry.add(
          candidate,
          {
            startOffset: absoluteLineOffset + offset,
            endOffset: absoluteLineOffset + root.endOffset,
          },
          parsed,
        );
        offset = root.endOffset;
        continue;
      }
    }
    output += candidate;
    offset = root.endOffset;
  }
  return { inComment, source: output };
}

interface MarkdownFenceState {
  length: number;
  marker: "`" | "~";
}

function markdownFenceOpening(line: string): MarkdownFenceState | null {
  const source = line.endsWith("\r") ? line.slice(0, -1) : line;
  let offset = 0;
  while (source[offset] === " ") offset += 1;
  if (offset > 3) return null;
  const marker = source[offset];
  if (marker !== "`" && marker !== "~") return null;
  let runEnd = offset;
  while (source[runEnd] === marker) runEnd += 1;
  const length = runEnd - offset;
  if (length < 3) return null;
  if (marker === "`" && source.slice(runEnd).includes("`")) return null;
  return { length, marker };
}

function isMarkdownFenceClosing(
  line: string,
  fence: MarkdownFenceState,
): boolean {
  const source = line.endsWith("\r") ? line.slice(0, -1) : line;
  let offset = 0;
  while (source[offset] === " ") offset += 1;
  if (offset > 3 || source[offset] !== fence.marker) return false;
  let runEnd = offset;
  while (source[runEnd] === fence.marker) runEnd += 1;
  return (
    runEnd - offset >= fence.length && /^[\t ]*$/u.test(source.slice(runEnd))
  );
}

function standaloneCommentRanges(lines: readonly string[]): {
  hidden: ReadonlySet<number>;
  literal: ReadonlySet<number>;
} {
  const hidden = new Set<number>();
  const literal = new Set<number>();
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].replace(/\r$/u, "").trim();
    if (!/^<!--/u.test(trimmed)) continue;
    const sameLineClose = trimmed.indexOf("-->", 4);
    if (sameLineClose >= 0) {
      if (/^\s*$/u.test(trimmed.slice(sameLineClose + 3))) hidden.add(index);
      continue;
    }
    let closeIndex = index + 1;
    while (
      closeIndex < lines.length &&
      !/-->\s*$/u.test(lines[closeIndex].replace(/\r$/u, "").trim())
    ) {
      closeIndex += 1;
    }
    if (closeIndex >= lines.length) {
      for (
        let literalIndex = index;
        literalIndex < lines.length;
        literalIndex += 1
      ) {
        literal.add(literalIndex);
      }
      break;
    }
    for (let hiddenIndex = index; hiddenIndex <= closeIndex; hiddenIndex += 1) {
      hidden.add(hiddenIndex);
    }
    index = closeIndex;
  }
  return { hidden, literal };
}

function detailsShieldedLines(lines: readonly string[]): ReadonlySet<number> {
  const shielded = new Set<number>();
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].replace(/\r$/u, "").trim();
    if (!/^<details(?:\s|>)/iu.test(trimmed)) continue;
    let endIndex = index;
    while (
      endIndex + 1 < lines.length &&
      !/<\/details>\s*$/iu.test(lines[endIndex].replace(/\r$/u, "").trim())
    ) {
      endIndex += 1;
    }
    for (
      let shieldedIndex = index;
      shieldedIndex <= endIndex;
      shieldedIndex += 1
    ) {
      shielded.add(shieldedIndex);
    }
    index = endIndex;
  }
  return shielded;
}

interface ScannedAuthorHtmlBlock {
  consumedLines: number;
  lines: string[];
}

function scanAuthorHtmlBlockAtLine(
  source: string,
  lines: readonly string[],
  lineOffsets: readonly number[],
  nextBlankLines: readonly number[],
  lineIndex: number,
  absoluteLineOffset: number,
  registry: MarkdownAuthorHtmlRegistry,
  rootCache: Map<number, HtmlLikeRootResult>,
): ScannedAuthorHtmlBlock | null {
  const firstLine = lines[lineIndex].replace(/\r$/u, "");
  const opening = /^( {0,3})<([A-Za-z][A-Za-z0-9-]*)\b/u.exec(firstLine);
  if (!opening) return null;
  const prefix = opening[1];
  const tagName = opening[2].toLowerCase();
  const blockRoot = isMarkdownAuthorHtmlBlockRootTag(tagName);
  if (!blockRoot && allowedTags.has(tagName as MarkdownAuthorHtmlTagName)) {
    return null;
  }
  const rootStartOffset = lineOffsets[lineIndex] + prefix.length;
  const firstLineEndOffset = lineOffsets[lineIndex] + firstLine.length;
  const openingEnd = tagEndOffset(source, rootStartOffset, firstLineEndOffset);
  const literalEndLine = nextBlankLines[lineIndex];
  const literalBlock = (): ScannedAuthorHtmlBlock => {
    const consumedLines = literalEndLine - lineIndex;
    return {
      consumedLines,
      lines: [...lines.slice(lineIndex, lineIndex + consumedLines)],
    };
  };
  if (openingEnd === null || openingEnd > firstLineEndOffset) {
    return literalBlock();
  }
  const root = htmlLikeRoot(source, rootStartOffset, rootCache);
  if (root.status === "malformed") {
    return literalBlock();
  }
  let endLine = lineIndex;
  while (
    endLine + 1 < lineOffsets.length &&
    lineOffsets[endLine + 1] < root.endOffset
  ) {
    endLine += 1;
  }
  const consumedLines = endLine - lineIndex + 1;
  const endLineContentEnd =
    lineOffsets[endLine] + lines[endLine].replace(/\r$/u, "").length;
  const suffix = source.slice(root.endOffset, endLineContentEnd);
  if (!/^[\t ]*\r?$/u.test(suffix)) {
    return null;
  }
  const candidate = source.slice(rootStartOffset, root.endOffset);
  if (!blockRoot) {
    return {
      consumedLines,
      lines: [...lines.slice(lineIndex, lineIndex + consumedLines)],
    };
  }
  const parsed = parseMarkdownAuthorHtmlBlockFragment(candidate);
  if (parsed.status !== "pass") {
    return {
      consumedLines,
      lines: [...lines.slice(lineIndex, lineIndex + consumedLines)],
    };
  }
  const marker = registry.add(
    candidate,
    {
      startOffset: absoluteLineOffset + prefix.length,
      endOffset: absoluteLineOffset + (root.endOffset - lineOffsets[lineIndex]),
    },
    parsed,
    "block",
  );
  const output = [
    `${prefix}${marker}${lines[lineIndex].endsWith("\r") ? "\r" : ""}`,
  ];
  for (let offset = 1; offset < consumedLines; offset += 1) {
    output.push(lines[lineIndex + offset].endsWith("\r") ? "\r" : "");
  }
  return { consumedLines, lines: output };
}

export function scanMarkdownAuthorHtml(
  source: string,
  absoluteStartOffset: number,
  registry: MarkdownAuthorHtmlRegistry,
  options: { allowBlocks?: boolean } = {},
): { count: number; source: string } {
  if (!source.includes("<")) return { count: 0, source };
  const initialSize = registry.size;
  const lines = source.split("\n");
  const commentLines = standaloneCommentRanges(lines);
  const shieldedDetailsLines = detailsShieldedLines(lines);
  const transformed: string[] = [];
  const lineOffsets: number[] = [];
  const nextBlankLines = new Array<number>(lines.length);
  let nextLineOffset = 0;
  for (const line of lines) {
    lineOffsets.push(nextLineOffset);
    nextLineOffset += line.length + 1;
  }
  let nextBlankLine = lines.length;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    nextBlankLines[index] = nextBlankLine;
    if (lines[index].replace(/\r$/u, "").trim() === "") {
      nextBlankLine = index;
    }
  }
  let fence: MarkdownFenceState | null = null;
  let inInlineComment = false;
  const blockRootCache = new Map<number, HtmlLikeRootResult>();
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const absoluteLineOffset = absoluteStartOffset + lineOffsets[index];
    if (inInlineComment) {
      const scanned = scanAuthorHtmlLine(
        line,
        absoluteLineOffset,
        registry,
        true,
      );
      inInlineComment = scanned.inComment;
      transformed.push(scanned.source);
    } else if (fence) {
      if (isMarkdownFenceClosing(line, fence)) fence = null;
      transformed.push(line);
    } else if (markdownFenceOpening(line)) {
      fence = markdownFenceOpening(line);
      transformed.push(line);
    } else if (shieldedDetailsLines.has(index)) {
      transformed.push(line);
    } else if (commentLines.hidden.has(index)) {
      transformed.push("");
    } else if (commentLines.literal.has(index)) {
      transformed.push(line);
    } else {
      const block =
        options.allowBlocks === false
          ? null
          : scanAuthorHtmlBlockAtLine(
              source,
              lines,
              lineOffsets,
              nextBlankLines,
              index,
              absoluteLineOffset,
              registry,
              blockRootCache,
            );
      if (block) {
        transformed.push(...block.lines);
        index += block.consumedLines - 1;
        continue;
      }
      const scanned = scanAuthorHtmlLine(line, absoluteLineOffset, registry);
      inInlineComment = scanned.inComment;
      transformed.push(scanned.source);
    }
  }
  return { count: registry.size - initialSize, source: transformed.join("\n") };
}
