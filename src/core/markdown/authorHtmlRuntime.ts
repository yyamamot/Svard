import type { Options } from "markdown-it/lib/index.mjs";
import type Renderer from "markdown-it/lib/renderer.mjs";
import type StateInline from "markdown-it/lib/rules_inline/state_inline.mjs";
import type Token from "markdown-it/lib/token.mjs";

import type { MarkdownAuthorHtmlFragment } from "../types";
import {
  MAX_MARKDOWN_AUTHOR_HTML_ITEMS,
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
  #nonce = "";
  readonly #records: MarkdownAuthorHtmlRecord[] = [];
  readonly #recordsById = new Map<string, MarkdownAuthorHtmlRecord>();
  readonly #recordsByMarker = new Map<string, MarkdownAuthorHtmlRecord>();
  readonly #consumedIds = new Set<string>();
  #itemCount = 0;

  constructor(originalSource: string) {
    this.#originalSource = originalSource;
  }

  get size(): number {
    return this.#records.length;
  }

  add(
    source: string,
    sourceSpan: MarkdownAuthorHtmlSourceSpan,
    parsed: Extract<MarkdownAuthorHtmlParseResult, { status: "pass" }>,
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
      fragment: { id, kind: "inline", sourceSpan },
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

  matchAt(source: string, offset: number): MarkdownAuthorHtmlRecord | null {
    if (this.#nonce === "") return null;
    const prefix = `${authorMarkerPrefix}_${this.#nonce}_`;
    if (!source.startsWith(prefix, offset)) return null;
    let endOffset = offset + prefix.length;
    while (/[0-9]/u.test(source[endOffset] ?? "")) endOffset += 1;
    if (source[endOffset] === ">") endOffset += 1;
    return this.#recordsByMarker.get(source.slice(offset, endOffset)) ?? null;
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
  const record = registry.matchAt(state.src, state.pos);
  if (!record) return false;
  const token = state.push(markdownAuthorHtmlTokenType, "", 0);
  token.content = record.visibleText;
  token.meta = {
    authorHtmlId: record.fragment.id,
  } satisfies MarkdownAuthorHtmlTokenMeta;
  state.pos += record.marker.length;
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
    token.type !== markdownAuthorHtmlTokenType ||
    token.tag !== "" ||
    token.attrs !== null ||
    token.nesting !== 0 ||
    token.children !== null ||
    token.markup !== "" ||
    token.info !== "" ||
    token.block !== false ||
    token.hidden !== false ||
    !meta ||
    Object.keys(meta).length !== 1 ||
    typeof meta.authorHtmlId !== "string" ||
    !registry
  ) {
    return throwAuthorIntegrityError();
  }
  const record = registry.consume(meta.authorHtmlId);
  return `<svard-markdown-author-html-inline data-svard-markdown-author-html-id="${record.fragment.id}">${escapeHtml(record.source)}</svard-markdown-author-html-inline>`;
}

function openingTagNameAt(source: string, offset: number): string | null {
  if (source[offset] !== "<" || source[offset + 1] === "/") return null;
  const match = source.slice(offset + 1).match(/^([A-Za-z][A-Za-z0-9-]*)/u);
  return match?.[1].toLowerCase() ?? null;
}

function tagEndOffset(source: string, offset: number): number | null {
  let quote = "";
  for (let index = offset; index < source.length; index += 1) {
    const character = source[index];
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

function htmlLikeRoot(source: string, startOffset: number): HtmlLikeRootResult {
  const rootName = openingTagNameAt(source, startOffset);
  if (!rootName) return { status: "malformed" };
  const stack: string[] = [];
  let offset = startOffset;
  while (offset < source.length) {
    const nextTagOffset = source.indexOf("<", offset);
    if (nextTagOffset < 0) return { status: "malformed" };
    const endOffset = tagEndOffset(source, nextTagOffset);
    if (endOffset === null) return { status: "malformed" };
    const rawTag = source.slice(nextTagOffset, endOffset);
    const closing = rawTag.match(/^<\/\s*([A-Za-z][A-Za-z0-9-]*)\s*>$/u);
    if (closing) {
      if (stack.at(-1) !== closing[1].toLowerCase()) {
        return { status: "malformed" };
      }
      stack.pop();
      if (stack.length === 0) return { status: "complete", endOffset };
      offset = endOffset;
      continue;
    }
    const opening = rawTag.match(/^<\s*([A-Za-z][A-Za-z0-9-]*)\b[\s\S]*>$/u);
    if (!opening) return { status: "malformed" };
    const tagName = opening[1].toLowerCase();
    const isVoid = tagName === "br" || /\/\s*>$/u.test(rawTag);
    if (!isVoid) stack.push(tagName);
    else if (stack.length === 0) return { status: "complete", endOffset };
    offset = endOffset;
  }
  return { status: "malformed" };
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

export function scanMarkdownAuthorHtml(
  source: string,
  absoluteStartOffset: number,
  registry: MarkdownAuthorHtmlRegistry,
): { count: number; source: string } {
  if (!source.includes("<")) return { count: 0, source };
  const initialSize = registry.size;
  const lines = source.split("\n");
  const commentLines = standaloneCommentRanges(lines);
  const shieldedDetailsLines = detailsShieldedLines(lines);
  const transformed: string[] = [];
  let fence: MarkdownFenceState | null = null;
  let inInlineComment = false;
  let offset = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (inInlineComment) {
      const scanned = scanAuthorHtmlLine(
        line,
        absoluteStartOffset + offset,
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
      const scanned = scanAuthorHtmlLine(
        line,
        absoluteStartOffset + offset,
        registry,
      );
      inInlineComment = scanned.inComment;
      transformed.push(scanned.source);
    }
    offset += line.length + 1;
  }
  return { count: registry.size - initialSize, source: transformed.join("\n") };
}
