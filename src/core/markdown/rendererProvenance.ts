import type { MarkdownRendererProvenance } from "../types";

export const MARKDOWN_RENDERER_PROVENANCE_ATTRIBUTE = "data-source-renderer-id";
export const MAX_MARKDOWN_RENDERER_PROVENANCE_NONCE_ATTEMPTS = 8;
export const MAX_MARKDOWN_RENDERER_PROVENANCE_RECORDS = 4_096;
export const MARKDOWN_RENDERER_PROVENANCE_INTEGRITY_ERROR =
  "Markdown rendering stopped because renderer provenance integrity validation failed.";

type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;
export type MarkdownRendererProvenanceInput =
  WithoutId<MarkdownRendererProvenance>;

const identityPrefix = "svard-renderer-";
const expectedTagsByKind = {
  heading: new Set(["h1", "h2", "h3", "h4", "h5", "h6"]),
  paragraph: new Set(["p"]),
  list: new Set(["ol", "ul"]),
  source: new Set(["pre"]),
  table: new Set(["table"]),
  diagram: new Set(["div"]),
  frontmatter: new Set(["details"]),
  details: new Set(["details"]),
} satisfies Record<MarkdownRendererProvenance["kind"], ReadonlySet<string>>;

const expectedKeysByKind = {
  heading: [
    "headingId",
    "kind",
    "sourceSelectionBlockId",
    "sourceSpan",
    "tagName",
  ],
  paragraph: [
    "kind",
    "sourceSelectionBlockId",
    "sourceSpan",
    "sourceTextBlockId",
    "tagName",
  ],
  list: ["kind", "sourceSelectionBlockId", "sourceSpan", "tagName"],
  source: [
    "kind",
    "sourceBlockId",
    "sourceSelectionBlockId",
    "sourceSpan",
    "tagName",
  ],
  table: [
    "kind",
    "sourceSelectionBlockId",
    "sourceSpan",
    "tableKind",
    "tagName",
  ],
  diagram: [
    "diagramId",
    "kind",
    "sourceSelectionBlockId",
    "sourceSpan",
    "tagName",
  ],
  frontmatter: ["kind", "sourceSpan", "tagName"],
  details: ["kind", "sourceSpan", "tagName"],
} satisfies Record<MarkdownRendererProvenance["kind"], readonly string[]>;

function throwIntegrityError(): never {
  throw new Error(MARKDOWN_RENDERER_PROVENANCE_INTEGRITY_ERROR);
}

function random128BitHex(): string {
  try {
    const cryptoApi = globalThis.crypto;
    if (!cryptoApi?.getRandomValues) {
      return throwIntegrityError();
    }
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
  } catch {
    return throwIntegrityError();
  }
}

function rendererNoncesInSource(source: string): Set<string> {
  const nonces = new Set<string>();
  const pattern = /svard-renderer-([0-9a-f]{32})-/g;
  for (const match of source.matchAll(pattern)) {
    nonces.add(match[1]);
  }
  return nonces;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isUtf16Boundary(source: string, offset: number): boolean {
  if (offset <= 0 || offset >= source.length) {
    return true;
  }
  const before = source.charCodeAt(offset - 1);
  const after = source.charCodeAt(offset);
  return !(
    before >= 0xd800 &&
    before <= 0xdbff &&
    after >= 0xdc00 &&
    after <= 0xdfff
  );
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return (
    actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index])
  );
}

function hasValidOptionalSelectionId(value: Record<string, unknown>): boolean {
  return (
    !("sourceSelectionBlockId" in value) ||
    isNonEmptyString(value.sourceSelectionBlockId)
  );
}

function validateInput(
  source: string,
  input: MarkdownRendererProvenanceInput,
): void {
  if (!input || typeof input !== "object") {
    return throwIntegrityError();
  }
  const value = input as unknown as Record<string, unknown>;
  const kind = value.kind;
  if (typeof kind !== "string" || !(kind in expectedTagsByKind)) {
    return throwIntegrityError();
  }
  const provenanceKind = kind as MarkdownRendererProvenance["kind"];
  const expectedKeys = expectedKeysByKind[provenanceKind].filter(
    (key) => key !== "sourceSelectionBlockId" || key in value,
  );
  if (!hasExactKeys(value, expectedKeys)) {
    return throwIntegrityError();
  }

  const tagName = value.tagName;
  if (
    typeof tagName !== "string" ||
    tagName !== tagName.toLowerCase() ||
    !expectedTagsByKind[provenanceKind].has(tagName)
  ) {
    return throwIntegrityError();
  }

  const span = value.sourceSpan;
  if (!span || typeof span !== "object") {
    return throwIntegrityError();
  }
  const sourceSpan = span as Record<string, unknown>;
  if (
    !hasExactKeys(sourceSpan, ["endOffset", "startOffset"]) ||
    !Number.isSafeInteger(sourceSpan.startOffset) ||
    !Number.isSafeInteger(sourceSpan.endOffset)
  ) {
    return throwIntegrityError();
  }
  const startOffset = sourceSpan.startOffset as number;
  const endOffset = sourceSpan.endOffset as number;
  if (
    startOffset < 0 ||
    startOffset >= endOffset ||
    endOffset > source.length ||
    !isUtf16Boundary(source, startOffset) ||
    !isUtf16Boundary(source, endOffset)
  ) {
    return throwIntegrityError();
  }

  switch (provenanceKind) {
    case "heading":
      if (
        !isNonEmptyString(value.headingId) ||
        !isNonEmptyString(value.sourceSelectionBlockId)
      ) {
        return throwIntegrityError();
      }
      break;
    case "paragraph":
      if (
        !isNonEmptyString(value.sourceTextBlockId) ||
        !hasValidOptionalSelectionId(value)
      ) {
        return throwIntegrityError();
      }
      break;
    case "list":
      if (!hasValidOptionalSelectionId(value)) {
        return throwIntegrityError();
      }
      break;
    case "source":
      if (
        !isNonEmptyString(value.sourceBlockId) ||
        !isNonEmptyString(value.sourceSelectionBlockId)
      ) {
        return throwIntegrityError();
      }
      break;
    case "table":
      if (
        (value.tableKind !== "standard" &&
          value.tableKind !== "compatibility") ||
        (value.tableKind === "compatibility" &&
          "sourceSelectionBlockId" in value) ||
        !hasValidOptionalSelectionId(value)
      ) {
        return throwIntegrityError();
      }
      break;
    case "diagram":
      if (
        !isNonEmptyString(value.diagramId) ||
        !isNonEmptyString(value.sourceSelectionBlockId)
      ) {
        return throwIntegrityError();
      }
      break;
    case "frontmatter":
    case "details":
      break;
  }
}

export class MarkdownRendererProvenanceRegistry {
  readonly #source: string;
  readonly #sourceNonces: Set<string>;
  readonly #records: MarkdownRendererProvenance[] = [];
  #nonce: string | null = null;
  #sealed = false;

  constructor(source: string) {
    this.#source = source;
    this.#sourceNonces = rendererNoncesInSource(source);
  }

  get size(): number {
    return this.#records.length;
  }

  add(input: MarkdownRendererProvenanceInput): string {
    if (
      this.#sealed ||
      this.#records.length >= MAX_MARKDOWN_RENDERER_PROVENANCE_RECORDS
    ) {
      return throwIntegrityError();
    }
    validateInput(this.#source, input);
    const nonce = this.#nonce ?? this.#createNonce();
    this.#nonce = nonce;
    const sequence = this.#records.length;
    if (!Number.isSafeInteger(sequence)) {
      return throwIntegrityError();
    }
    const id = `${identityPrefix}${nonce}-${sequence.toString(36)}`;
    this.#records.push({
      ...input,
      id,
      sourceSpan: { ...input.sourceSpan },
    } as MarkdownRendererProvenance);
    return id;
  }

  records(): readonly MarkdownRendererProvenance[] {
    this.#sealed = true;
    const records = [...this.#records].sort(
      (left, right) =>
        left.sourceSpan.startOffset - right.sourceSpan.startOffset ||
        left.sourceSpan.endOffset - right.sourceSpan.endOffset,
    );
    for (let index = 1; index < records.length; index += 1) {
      if (
        records[index - 1].sourceSpan.endOffset >
        records[index].sourceSpan.startOffset
      ) {
        return throwIntegrityError();
      }
    }
    return records;
  }

  #createNonce(): string {
    for (
      let attempt = 0;
      attempt < MAX_MARKDOWN_RENDERER_PROVENANCE_NONCE_ATTEMPTS;
      attempt += 1
    ) {
      const candidate = random128BitHex();
      if (!this.#sourceNonces.has(candidate)) {
        return candidate;
      }
    }
    return throwIntegrityError();
  }
}
