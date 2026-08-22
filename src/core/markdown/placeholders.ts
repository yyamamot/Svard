import type { Options } from "markdown-it/lib/index.mjs";
import type Renderer from "markdown-it/lib/renderer.mjs";
import type Token from "markdown-it/lib/token.mjs";

export const MAX_MARKDOWN_PLACEHOLDERS = 4_096;
export const MAX_MARKDOWN_PLACEHOLDER_ID_ATTEMPTS = 8;
export const MIN_MARKDOWN_REPLACEMENT_HTML_BYTES = 1 * 1_024 * 1_024;
export const MAX_MARKDOWN_REPLACEMENT_HTML_BYTES = 32 * 1_024 * 1_024;
export const MIN_MARKDOWN_FINAL_HTML_BYTES = 2 * 1_024 * 1_024;
export const MAX_MARKDOWN_FINAL_HTML_BYTES = 64 * 1_024 * 1_024;

export const MARKDOWN_RENDER_BUDGET_ERROR =
  "Markdown rendering stopped because the safe HTML output budget was exceeded.";
export const MARKDOWN_PLACEHOLDER_INTEGRITY_ERROR =
  "Markdown rendering stopped because renderer placeholder integrity validation failed.";

export const markdownPlaceholderTokenType = "svard_renderer_placeholder";

const placeholderPrefix = "SVARD_RENDERER_PLACEHOLDER";
const dynamicBudgetMultiplier = 128;
const placeholderRegistryKey: unique symbol = Symbol(
  "svardMarkdownPlaceholderRegistry",
);

type PlaceholderRenderer = (writer: Utf8ChunkWriter) => void;

interface PlaceholderRecord {
  expectedLine: number;
  id: string;
  marker: string;
  render: PlaceholderRenderer;
}

interface PlaceholderTokenMeta {
  placeholderId: string;
}

interface PlaceholderRenderEnvironment {
  [placeholderRegistryKey]?: MarkdownPlaceholderRegistry;
}

function throwBudgetError(): never {
  throw new Error(MARKDOWN_RENDER_BUDGET_ERROR);
}

function throwIntegrityError(): never {
  throw new Error(MARKDOWN_PLACEHOLDER_INTEGRITY_ERROR);
}

function random128BitHex(): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    return throwIntegrityError();
  }

  const bytes = new Uint8Array(16);
  try {
    cryptoApi.getRandomValues(bytes);
  } catch {
    return throwIntegrityError();
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function rendererIdentityIdsInSource(source: string): Set<string> {
  const ids = new Set<string>();
  const pattern = /SVARD_RENDERER_PLACEHOLDER_([0-9a-f]{32})/g;
  for (const match of source.matchAll(pattern)) {
    ids.add(match[1]);
  }
  return ids;
}

export function utf8ByteLength(
  value: string,
  stopAfter = Number.MAX_SAFE_INTEGER,
): number {
  const limit = Math.max(0, Math.min(Number.MAX_SAFE_INTEGER, stopAfter));
  let bytes = 0;

  for (let index = 0; index < value.length; index += 1) {
    const first = value.charCodeAt(index);
    let increment: number;
    if (first <= 0x7f) {
      increment = 1;
    } else if (first <= 0x7ff) {
      increment = 2;
    } else if (first >= 0xd800 && first <= 0xdbff) {
      const second = value.charCodeAt(index + 1);
      if (second >= 0xdc00 && second <= 0xdfff) {
        increment = 4;
        index += 1;
      } else {
        increment = 3;
      }
    } else {
      increment = 3;
    }

    if (bytes > limit - increment) {
      return limit < Number.MAX_SAFE_INTEGER ? limit + 1 : limit;
    }
    bytes += increment;
  }

  return bytes;
}

function dynamicBudget(
  sourceBytes: number,
  minimumBytes: number,
  maximumBytes: number,
): number {
  const normalizedSourceBytes = Number.isFinite(sourceBytes)
    ? Math.max(0, Math.trunc(sourceBytes))
    : maximumBytes;
  const multiplicationSaturationPoint = Math.ceil(
    maximumBytes / dynamicBudgetMultiplier,
  );
  const scaledBytes =
    normalizedSourceBytes >= multiplicationSaturationPoint
      ? maximumBytes
      : normalizedSourceBytes * dynamicBudgetMultiplier;
  return Math.min(maximumBytes, Math.max(minimumBytes, scaledBytes));
}

export function markdownReplacementBudgetForSourceBytes(
  sourceBytes: number,
): number {
  return dynamicBudget(
    sourceBytes,
    MIN_MARKDOWN_REPLACEMENT_HTML_BYTES,
    MAX_MARKDOWN_REPLACEMENT_HTML_BYTES,
  );
}

export function markdownFinalHtmlBudgetForSourceBytes(
  sourceBytes: number,
): number {
  return dynamicBudget(
    sourceBytes,
    MIN_MARKDOWN_FINAL_HTML_BYTES,
    MAX_MARKDOWN_FINAL_HTML_BYTES,
  );
}

export class Utf8ChunkWriter {
  readonly #chunks: string[] = [];
  readonly #limitBytes: number;
  #byteLength = 0;
  #endsWithHighSurrogate = false;

  constructor(limitBytes: number) {
    if (
      !Number.isSafeInteger(limitBytes) ||
      limitBytes < 0 ||
      limitBytes > Number.MAX_SAFE_INTEGER
    ) {
      throwBudgetError();
    }
    this.#limitBytes = limitBytes;
  }

  get byteLength(): number {
    return this.#byteLength;
  }

  get remainingBytes(): number {
    return this.#limitBytes - this.#byteLength;
  }

  append(chunk: string): void {
    if (chunk === "") {
      return;
    }
    const first = chunk.charCodeAt(0);
    const bridgesSurrogatePair =
      this.#endsWithHighSurrogate && first >= 0xdc00 && first <= 0xdfff;
    const bridgeAdjustment = bridgesSurrogatePair ? 2 : 0;
    const chunkBytes =
      utf8ByteLength(chunk, this.remainingBytes + bridgeAdjustment) -
      bridgeAdjustment;
    if (chunkBytes > this.remainingBytes) {
      throwBudgetError();
    }
    this.#chunks.push(chunk);
    this.#byteLength += chunkBytes;
    const last = chunk.charCodeAt(chunk.length - 1);
    this.#endsWithHighSurrogate = last >= 0xd800 && last <= 0xdbff;
  }

  toString(): string {
    return this.#chunks.join("");
  }
}

export function renderMarkdownTokensToWriter(
  tokens: Token[],
  options: Options,
  env: unknown,
  renderer: Renderer,
  writer: Utf8ChunkWriter,
): void {
  const renderEnv = env as object;
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === "inline") {
      renderMarkdownTokensToWriter(
        token.children ?? [],
        options,
        renderEnv,
        renderer,
        writer,
      );
      continue;
    }

    const rule = renderer.rules[token.type];
    writer.append(
      rule
        ? rule(tokens, index, options, renderEnv, renderer)
        : renderer.renderToken(tokens, index, options),
    );
  }
}

export function renderMarkdownTokensWithinBudget(
  tokens: Token[],
  options: Options,
  env: unknown,
  renderer: Renderer,
  limitBytes: number,
): string {
  const writer = new Utf8ChunkWriter(limitBytes);
  renderMarkdownTokensToWriter(tokens, options, env, renderer, writer);
  return writer.toString();
}

export class MarkdownPlaceholderRegistry {
  readonly #records: PlaceholderRecord[] = [];
  readonly #recordsById = new Map<string, PlaceholderRecord>();
  readonly #expectedLines = new Set<number>();
  readonly #replacementBudgetBytes: number;
  readonly #sourceIdentityIds: Set<string>;
  readonly #usedIdentityIds = new Set<string>();
  readonly #renderedIds = new Set<string>();
  #bound = false;
  #replacementBytes = 0;

  constructor(originalSource: string, replacementBudgetBytes: number) {
    if (
      !Number.isSafeInteger(replacementBudgetBytes) ||
      replacementBudgetBytes < 0
    ) {
      throwBudgetError();
    }
    this.#sourceIdentityIds = rendererIdentityIdsInSource(originalSource);
    this.#replacementBudgetBytes = replacementBudgetBytes;
  }

  get size(): number {
    return this.#records.length;
  }

  get replacementBytes(): number {
    return this.#replacementBytes;
  }

  add(expectedLine: number, render: PlaceholderRenderer): string {
    if (this.#bound) {
      return throwIntegrityError();
    }
    if (this.#records.length >= MAX_MARKDOWN_PLACEHOLDERS) {
      return throwBudgetError();
    }
    if (
      !Number.isSafeInteger(expectedLine) ||
      expectedLine < 0 ||
      this.#expectedLines.has(expectedLine)
    ) {
      return throwIntegrityError();
    }

    let id = "";
    for (
      let attempt = 0;
      attempt < MAX_MARKDOWN_PLACEHOLDER_ID_ATTEMPTS;
      attempt += 1
    ) {
      const candidateId = random128BitHex();
      if (
        !this.#sourceIdentityIds.has(candidateId) &&
        !this.#usedIdentityIds.has(candidateId)
      ) {
        id = candidateId;
        this.#usedIdentityIds.add(candidateId);
        break;
      }
    }
    if (id === "") {
      return throwIntegrityError();
    }

    const marker = `${placeholderPrefix}_${id}`;
    const record = { expectedLine, id, marker, render };
    this.#records.push(record);
    this.#recordsById.set(id, record);
    this.#expectedLines.add(expectedLine);
    return marker;
  }

  records(): readonly PlaceholderRecord[] {
    return this.#records;
  }

  remapExpectedLines(outputLineForInputLine: readonly number[]): void {
    if (this.#bound) {
      return throwIntegrityError();
    }
    const usedLines = new Set<number>();
    for (const record of this.#records) {
      const outputLine = outputLineForInputLine[record.expectedLine];
      if (
        !Number.isSafeInteger(outputLine) ||
        outputLine < 0 ||
        usedLines.has(outputLine)
      ) {
        return throwIntegrityError();
      }
      record.expectedLine = outputLine;
      usedLines.add(outputLine);
    }
    this.#expectedLines.clear();
    for (const line of usedLines) {
      this.#expectedLines.add(line);
    }
  }

  markBound(): void {
    if (this.#bound) {
      return throwIntegrityError();
    }
    this.#bound = true;
  }

  renderReplacement(id: string): string {
    if (!this.#bound || this.#renderedIds.has(id)) {
      return throwIntegrityError();
    }
    const record = this.#recordsById.get(id);
    if (!record) {
      return throwIntegrityError();
    }

    const writer = new Utf8ChunkWriter(
      this.#replacementBudgetBytes - this.#replacementBytes,
    );
    record.render(writer);
    const rendered = writer.toString();
    this.#replacementBytes += writer.byteLength;
    this.#renderedIds.add(id);
    return rendered;
  }

  assertAllRendered(): void {
    if (!this.#bound || this.#renderedIds.size !== this.#records.length) {
      throwIntegrityError();
    }
  }
}

function isExactTextChild(token: Token, marker: string): boolean {
  const children = token.children;
  if (!children || children.length !== 1) {
    return false;
  }
  const child = children[0];
  return (
    child.type === "text" &&
    child.tag === "" &&
    child.attrs === null &&
    child.map === null &&
    child.nesting === 0 &&
    child.level === 0 &&
    child.children === null &&
    child.content === marker &&
    child.markup === "" &&
    child.info === "" &&
    child.meta === null &&
    child.block === false &&
    child.hidden === false
  );
}

function hasExactMap(token: Token, line: number): boolean {
  return Boolean(
    token.map && token.map[0] === line && token.map[1] === line + 1,
  );
}

function isExactPlaceholderTriple(
  tokens: Token[],
  index: number,
  line: number,
  marker: string,
): boolean {
  const open = tokens[index - 1];
  const inline = tokens[index];
  const close = tokens[index + 1];
  return Boolean(
    open &&
    open.type === "paragraph_open" &&
    open.tag === "p" &&
    open.attrs === null &&
    hasExactMap(open, line) &&
    open.nesting === 1 &&
    open.level === 0 &&
    open.children === null &&
    open.content === "" &&
    open.markup === "" &&
    open.info === "" &&
    open.meta === null &&
    open.block === true &&
    open.hidden === false &&
    inline.type === "inline" &&
    inline.tag === "" &&
    inline.attrs === null &&
    hasExactMap(inline, line) &&
    inline.nesting === 0 &&
    inline.level === 1 &&
    inline.content === marker &&
    inline.markup === "" &&
    inline.info === "" &&
    inline.meta === null &&
    inline.block === true &&
    inline.hidden === false &&
    isExactTextChild(inline, marker) &&
    close &&
    close.type === "paragraph_close" &&
    close.tag === "p" &&
    close.attrs === null &&
    close.map === null &&
    close.nesting === -1 &&
    close.level === 0 &&
    close.children === null &&
    close.content === "" &&
    close.markup === "" &&
    close.info === "" &&
    close.meta === null &&
    close.block === true &&
    close.hidden === false,
  );
}

export function bindMarkdownPlaceholderTokens(
  tokens: Token[],
  transformedSource: string,
  registry: MarkdownPlaceholderRegistry,
): void {
  const records = registry.records();
  if (records.length === 0) {
    registry.markBound();
    return;
  }

  const recordsByMarker = new Map(
    records.map((record) => [record.marker, record]),
  );
  const lines = transformedSource.split("\n");
  for (const record of records) {
    if (lines[record.expectedLine] !== record.marker) {
      return throwIntegrityError();
    }
  }

  const matches: Array<{ inlineIndex: number; record: PlaceholderRecord }> = [];
  const matchedIds = new Set<string>();
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === markdownPlaceholderTokenType) {
      return throwIntegrityError();
    }
    if (token.type !== "inline") {
      continue;
    }
    const record = recordsByMarker.get(token.content);
    if (!record) {
      continue;
    }
    if (
      matchedIds.has(record.id) ||
      !isExactPlaceholderTriple(
        tokens,
        index,
        record.expectedLine,
        record.marker,
      )
    ) {
      return throwIntegrityError();
    }
    matchedIds.add(record.id);
    matches.push({ inlineIndex: index, record });
  }
  if (matchedIds.size !== records.length) {
    return throwIntegrityError();
  }

  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const { inlineIndex, record } = matches[index];
    const token = tokens[inlineIndex - 1];
    token.type = markdownPlaceholderTokenType;
    token.tag = "";
    token.attrs = null;
    token.nesting = 0;
    token.level = 0;
    token.children = null;
    token.content = "";
    token.markup = "";
    token.info = "";
    token.meta = { placeholderId: record.id } satisfies PlaceholderTokenMeta;
    token.block = true;
    token.hidden = false;
    tokens.splice(inlineIndex, 2);
  }
  registry.markBound();
}

export function attachMarkdownPlaceholderRegistry(
  env: object,
  registry: MarkdownPlaceholderRegistry,
): void {
  Object.defineProperty(env, placeholderRegistryKey, {
    configurable: false,
    enumerable: false,
    value: registry,
    writable: false,
  });
}

export function renderMarkdownPlaceholderToken(
  tokens: Token[],
  index: number,
  _options: Options,
  env: unknown,
): string {
  const token = tokens[index];
  const meta = token.meta as Partial<PlaceholderTokenMeta> | null;
  const registry = (env as PlaceholderRenderEnvironment | null)?.[
    placeholderRegistryKey
  ];
  if (
    token.type !== markdownPlaceholderTokenType ||
    token.tag !== "" ||
    token.attrs !== null ||
    token.nesting !== 0 ||
    token.level !== 0 ||
    token.children !== null ||
    token.content !== "" ||
    token.markup !== "" ||
    token.info !== "" ||
    token.block !== true ||
    token.hidden !== false ||
    !meta ||
    Object.keys(meta).length !== 1 ||
    typeof meta.placeholderId !== "string" ||
    !registry
  ) {
    return throwIntegrityError();
  }
  return registry.renderReplacement(meta.placeholderId);
}
