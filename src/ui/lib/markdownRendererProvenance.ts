import type {
  DiagramSlot,
  Heading,
  MarkdownRendererProvenance,
  SourceBlock,
  SourceSelectionBlock,
  SourceTextBlock,
} from "../../core/types";

export const MARKDOWN_RENDERER_ID_ATTRIBUTE = "data-source-renderer-id";

const RENDERER_ID_PATTERN = /^svard-renderer-([0-9a-f]{32})-([0-9a-z]+)$/u;
const expectedKeysByKind = {
  heading: [
    "headingId",
    "id",
    "kind",
    "sourceSelectionBlockId",
    "sourceSpan",
    "tagName",
  ],
  paragraph: [
    "id",
    "kind",
    "sourceSelectionBlockId",
    "sourceSpan",
    "sourceTextBlockId",
    "tagName",
  ],
  list: ["id", "kind", "sourceSelectionBlockId", "sourceSpan", "tagName"],
  source: [
    "id",
    "kind",
    "sourceBlockId",
    "sourceSelectionBlockId",
    "sourceSpan",
    "tagName",
  ],
  table: [
    "id",
    "kind",
    "sourceSelectionBlockId",
    "sourceSpan",
    "tableKind",
    "tagName",
  ],
  diagram: [
    "diagramId",
    "id",
    "kind",
    "sourceSelectionBlockId",
    "sourceSpan",
    "tagName",
  ],
  frontmatter: ["id", "kind", "sourceSpan", "tagName"],
  details: ["id", "kind", "sourceSpan", "tagName"],
} satisfies Record<MarkdownRendererProvenance["kind"], readonly string[]>;

type MarkdownRendererProvenanceMetadata = {
  headings: readonly Heading[];
  sourceBlocks: readonly SourceBlock[];
  sourceTextBlocks?: readonly SourceTextBlock[];
  sourceSelectionBlocks?: readonly SourceSelectionBlock[];
  diagramSlots?: readonly DiagramSlot[];
};

export interface ValidatedMarkdownRendererEntry {
  element: HTMLElement;
  provenance: MarkdownRendererProvenance;
}

export type MarkdownRendererProvenanceValidation =
  | { status: "absent"; entries: readonly [] }
  | { status: "rejected"; entries: readonly [] }
  | { status: "valid"; entries: readonly ValidatedMarkdownRendererEntry[] };

function splitsSurrogatePair(source: string, offset: number): boolean {
  if (offset <= 0 || offset >= source.length) return false;
  const previous = source.charCodeAt(offset - 1);
  const current = source.charCodeAt(offset);
  return (
    previous >= 0xd800 &&
    previous <= 0xdbff &&
    current >= 0xdc00 &&
    current <= 0xdfff
  );
}

function hasValidSourceSpan(
  provenance: MarkdownRendererProvenance,
  source: string,
): boolean {
  const { startOffset, endOffset } = provenance.sourceSpan ?? {};
  return (
    Number.isSafeInteger(startOffset) &&
    Number.isSafeInteger(endOffset) &&
    startOffset >= 0 &&
    startOffset < endOffset &&
    endOffset <= source.length &&
    !splitsSurrogatePair(source, startOffset) &&
    !splitsSurrogatePair(source, endOffset)
  );
}

function hasExactRecordShape(provenance: MarkdownRendererProvenance): boolean {
  if (
    typeof provenance.kind !== "string" ||
    !Object.prototype.hasOwnProperty.call(expectedKeysByKind, provenance.kind)
  ) {
    return false;
  }
  const expected = expectedKeysByKind[provenance.kind].filter(
    (key) => key !== "sourceSelectionBlockId" || key in provenance,
  );
  const actual = Object.keys(provenance).sort();
  const sortedExpected = [...expected].sort();
  const spanKeys = Object.keys(provenance.sourceSpan ?? {}).sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index]) &&
    spanKeys.length === 2 &&
    spanKeys[0] === "endOffset" &&
    spanKeys[1] === "startOffset"
  );
}

function hasExpectedTag(
  provenance: MarkdownRendererProvenance,
  element: HTMLElement,
): boolean {
  if (
    typeof provenance.tagName !== "string" ||
    provenance.tagName !== provenance.tagName.toLowerCase() ||
    element.localName !== provenance.tagName
  ) {
    return false;
  }
  switch (provenance.kind) {
    case "heading":
      return /^h[1-6]$/u.test(element.localName);
    case "paragraph":
      return element.localName === "p";
    case "list":
      return element.localName === "ul" || element.localName === "ol";
    case "source":
      return (
        element.localName === "pre" &&
        element.querySelector(":scope > code") !== null
      );
    case "table":
      return element.localName === "table";
    case "diagram":
      return (
        element.localName === "div" &&
        element.classList.contains("diagram-slot")
      );
    case "frontmatter":
      return (
        element.localName === "details" &&
        element.classList.contains("markdown-frontmatter") &&
        element.querySelector(":scope > summary") !== null
      );
    case "details":
      return (
        element.localName === "details" &&
        element.classList.contains("markdown-details") &&
        element.querySelector(":scope > summary") !== null &&
        element.querySelector(":scope > .markdown-details-body") !== null
      );
  }
}

function uniqueById<T extends { id: string }>(items: readonly T[]) {
  const index = new Map<string, T>();
  const duplicates = new Set<string>();
  for (const item of items) {
    if (typeof item?.id !== "string" || item.id.length === 0) continue;
    if (index.has(item.id)) duplicates.add(item.id);
    index.set(item.id, item);
  }
  return { index, duplicates };
}

interface UniqueIndex<T> {
  index: Map<string, T>;
  duplicates: Set<string>;
}

function hasValidFootnoteNavigation(body: HTMLElement): boolean {
  const reservedIdElements = Array.from(
    body.querySelectorAll<HTMLElement>(
      '[id^="svard-footnote-ref-"],[id^="svard-footnote-item-"]',
    ),
  );
  const refsByItem = new Map<string, Set<string>>();
  const itemElements = new Map<string, HTMLElement>();

  for (const element of reservedIdElements) {
    const id = element.id;
    const refMatch =
      /^svard-footnote-ref-([1-9]\d*)(?:-([2-9]|[1-9]\d+))?$/u.exec(id);
    if (refMatch) {
      if (
        element.localName !== "a" ||
        !element.parentElement?.classList.contains("footnote-ref")
      ) {
        return false;
      }
      const itemId = `svard-footnote-item-${refMatch[1]}`;
      if (element.getAttribute("href") !== `#${itemId}`) return false;
      const refs = refsByItem.get(itemId) ?? new Set<string>();
      refs.add(id);
      refsByItem.set(itemId, refs);
      continue;
    }

    const itemMatch = /^svard-footnote-item-([1-9]\d*)$/u.exec(id);
    if (
      !itemMatch ||
      element.localName !== "li" ||
      !element.classList.contains("footnote-item")
    ) {
      return false;
    }
    itemElements.set(id, element);
  }

  const navigationLinks = Array.from(
    body.querySelectorAll<HTMLAnchorElement>(
      'a[href^="#svard-footnote-ref-"],a[href^="#svard-footnote-item-"]',
    ),
  );
  for (const link of navigationLinks) {
    if (link.id.startsWith("svard-footnote-ref-")) continue;
    if (!link.classList.contains("footnote-backref")) return false;
    const item = link.closest<HTMLElement>('li[id^="svard-footnote-item-"]');
    const refId = link.getAttribute("href")?.slice(1) ?? "";
    if (!item || !refsByItem.get(item.id)?.has(refId)) return false;
  }

  if (refsByItem.size !== itemElements.size) return false;
  for (const [itemId, refs] of refsByItem) {
    const item = itemElements.get(itemId);
    if (!item) return false;
    const noteNumber = itemId.slice("svard-footnote-item-".length);
    const expectedRefs = new Set(
      Array.from({ length: refs.size }, (_, index) =>
        index === 0
          ? `svard-footnote-ref-${noteNumber}`
          : `svard-footnote-ref-${noteNumber}-${index + 1}`,
      ),
    );
    if (Array.from(refs).some((refId) => !expectedRefs.has(refId))) {
      return false;
    }
    const backrefs = Array.from(
      item.querySelectorAll<HTMLAnchorElement>("a.footnote-backref"),
    ).map((link) => link.getAttribute("href")?.slice(1) ?? "");
    const uniqueBackrefs = new Set(backrefs);
    if (
      backrefs.length !== refs.size ||
      uniqueBackrefs.size !== refs.size ||
      backrefs.some((refId) => !refs.has(refId))
    ) {
      return false;
    }
  }
  return true;
}

function isUniqueReference<T>(id: string, collection: UniqueIndex<T>): boolean {
  return (
    typeof id === "string" &&
    id.length > 0 &&
    collection.index.has(id) &&
    !collection.duplicates.has(id)
  );
}

function validateMetadataReference(
  provenance: MarkdownRendererProvenance,
  element: HTMLElement,
  startLine: number,
  publicIdCounts: ReadonlyMap<string, number>,
  indexes: {
    headings: UniqueIndex<Heading>;
    sourceBlocks: UniqueIndex<SourceBlock>;
    sourceTextBlocks: UniqueIndex<SourceTextBlock>;
    sourceSelectionBlocks: UniqueIndex<SourceSelectionBlock>;
    diagramSlots: UniqueIndex<DiagramSlot>;
  },
): boolean {
  const validSelection = (id: string | undefined, kind: string) => {
    if (id === undefined) return true;
    if (!isUniqueReference(id, indexes.sourceSelectionBlocks)) return false;
    return indexes.sourceSelectionBlocks.index.get(id)?.kind === kind;
  };
  const validRequiredSelection = (id: string | undefined, kind: string) =>
    id !== undefined && validSelection(id, kind);
  const locationStartsAt = (line: number | undefined) => line === startLine;

  switch (provenance.kind) {
    case "heading": {
      if (
        !isUniqueReference(provenance.headingId, indexes.headings) ||
        !validRequiredSelection(provenance.sourceSelectionBlockId, "heading")
      ) {
        return false;
      }
      const heading = indexes.headings.index.get(provenance.headingId);
      if (
        !heading ||
        element.localName !== `h${heading.level}` ||
        element.getAttribute("id") !== heading.id ||
        !locationStartsAt(heading.sourceLocation?.line) ||
        !locationStartsAt(
          indexes.sourceSelectionBlocks.index.get(
            provenance.sourceSelectionBlockId,
          )?.startLine,
        )
      ) {
        return false;
      }
      return publicIdCounts.get(heading.id) === 1;
    }
    case "paragraph":
      if (
        !isUniqueReference(
          provenance.sourceTextBlockId,
          indexes.sourceTextBlocks,
        ) ||
        !validSelection(provenance.sourceSelectionBlockId, "paragraph")
      ) {
        return false;
      }
      return (
        locationStartsAt(
          indexes.sourceTextBlocks.index.get(provenance.sourceTextBlockId)
            ?.startLine,
        ) &&
        (provenance.sourceSelectionBlockId === undefined ||
          locationStartsAt(
            indexes.sourceSelectionBlocks.index.get(
              provenance.sourceSelectionBlockId,
            )?.startLine,
          ))
      );
    case "list":
      return (
        validSelection(provenance.sourceSelectionBlockId, "list") &&
        (provenance.sourceSelectionBlockId === undefined ||
          locationStartsAt(
            indexes.sourceSelectionBlocks.index.get(
              provenance.sourceSelectionBlockId,
            )?.startLine,
          ))
      );
    case "source":
      if (
        !isUniqueReference(provenance.sourceBlockId, indexes.sourceBlocks) ||
        !validRequiredSelection(provenance.sourceSelectionBlockId, "code")
      ) {
        return false;
      }
      return (
        locationStartsAt(
          indexes.sourceBlocks.index.get(provenance.sourceBlockId)
            ?.sourceLocation?.line,
        ) &&
        locationStartsAt(
          indexes.sourceSelectionBlocks.index.get(
            provenance.sourceSelectionBlockId,
          )?.startLine,
        )
      );
    case "table": {
      if (provenance.tableKind === "compatibility") {
        return !("sourceSelectionBlockId" in provenance);
      }
      const selectionId = provenance.sourceSelectionBlockId;
      return (
        provenance.tableKind === "standard" &&
        validSelection(selectionId, "table") &&
        (selectionId === undefined ||
          locationStartsAt(
            indexes.sourceSelectionBlocks.index.get(selectionId)?.startLine,
          ))
      );
    }
    case "diagram":
      if (
        !isUniqueReference(provenance.diagramId, indexes.diagramSlots) ||
        !validRequiredSelection(provenance.sourceSelectionBlockId, "diagram")
      ) {
        return false;
      }
      return (
        element.getAttribute("data-diagram-id") === provenance.diagramId &&
        locationStartsAt(
          indexes.diagramSlots.index.get(provenance.diagramId)?.sourceLocation
            ?.line,
        ) &&
        locationStartsAt(
          indexes.sourceSelectionBlocks.index.get(
            provenance.sourceSelectionBlockId,
          )?.startLine,
        )
      );
    case "frontmatter":
    case "details":
      return true;
  }
}

/**
 * Reads renderer provenance without mutating DOM or metadata. Callers must
 * remove the private identity attribute after consuming this result.
 */
export function validateMarkdownRendererProvenance(
  body: HTMLElement,
  source: string,
  provenanceRecords: readonly MarkdownRendererProvenance[],
  metadata: MarkdownRendererProvenanceMetadata,
): MarkdownRendererProvenanceValidation {
  const elements = Array.from(
    body.querySelectorAll<HTMLElement>(`[${MARKDOWN_RENDERER_ID_ATTRIBUTE}]`),
  );
  if (body.hasAttribute(MARKDOWN_RENDERER_ID_ATTRIBUTE)) elements.unshift(body);
  if (elements.length === 0 && provenanceRecords.length === 0) {
    return { status: "absent", entries: [] };
  }
  if (elements.length !== provenanceRecords.length || elements.length === 0) {
    return { status: "rejected", entries: [] };
  }

  const publicIdCounts = new Map<string, number>();
  const publicIdElements = Array.from(
    body.querySelectorAll<HTMLElement>("[id]"),
  );
  if (body.hasAttribute("id")) publicIdElements.unshift(body);
  for (const element of publicIdElements) {
    const id = element.getAttribute("id") ?? "";
    publicIdCounts.set(id, (publicIdCounts.get(id) ?? 0) + 1);
  }
  if (
    Array.from(publicIdCounts).some(
      ([id, count]) => id.length === 0 || count !== 1,
    )
  ) {
    return { status: "rejected", entries: [] };
  }
  if (!hasValidFootnoteNavigation(body)) {
    return { status: "rejected", entries: [] };
  }

  const recordsById = new Map<string, MarkdownRendererProvenance>();
  const recordIdCounts = new Map<string, number>();
  let previousRecordEndOffset = -1;
  for (const provenance of provenanceRecords) {
    if (
      typeof provenance?.id !== "string" ||
      !hasValidSourceSpan(provenance, source) ||
      provenance.sourceSpan.startOffset < previousRecordEndOffset
    ) {
      return { status: "rejected", entries: [] };
    }
    previousRecordEndOffset = provenance.sourceSpan.endOffset;
    recordIdCounts.set(
      provenance.id,
      (recordIdCounts.get(provenance.id) ?? 0) + 1,
    );
    recordsById.set(provenance.id, provenance);
  }

  const elementIdCounts = new Map<string, number>();
  for (const element of elements) {
    const id = element.getAttribute(MARKDOWN_RENDERER_ID_ATTRIBUTE) ?? "";
    elementIdCounts.set(id, (elementIdCounts.get(id) ?? 0) + 1);
  }

  const indexes = {
    headings: uniqueById(metadata.headings),
    sourceBlocks: uniqueById(metadata.sourceBlocks),
    sourceTextBlocks: uniqueById(metadata.sourceTextBlocks ?? []),
    sourceSelectionBlocks: uniqueById(metadata.sourceSelectionBlocks ?? []),
    diagramSlots: uniqueById(metadata.diagramSlots ?? []),
  };
  const sourceNonces = new Set(
    Array.from(
      source.matchAll(/svard-renderer-([0-9a-f]{32})-/gu),
      (match) => match[1],
    ),
  );
  const referencedMetadataIds = new Set<string>();
  const entries: ValidatedMarkdownRendererEntry[] = [];
  let previousEndOffset = -1;
  let lineScanOffset = 0;
  let sourceLine = 1;
  let rendererNonce: string | undefined;

  for (const element of elements) {
    const id = element.getAttribute(MARKDOWN_RENDERER_ID_ATTRIBUTE) ?? "";
    const provenance = recordsById.get(id);
    const identityMatch = RENDERER_ID_PATTERN.exec(id);
    const nonce = identityMatch?.[1];
    const validSpan = provenance
      ? hasValidSourceSpan(provenance, source)
      : false;
    if (
      provenance &&
      validSpan &&
      provenance.sourceSpan.startOffset >= lineScanOffset
    ) {
      for (
        let offset = lineScanOffset;
        offset < provenance.sourceSpan.startOffset;
        offset += 1
      ) {
        if (source.charCodeAt(offset) === 0x0a) sourceLine += 1;
      }
      lineScanOffset = provenance.sourceSpan.startOffset;
    }
    if (
      !provenance ||
      !identityMatch ||
      (rendererNonce !== undefined && nonce !== rendererNonce) ||
      sourceNonces.has(nonce ?? "") ||
      recordIdCounts.get(id) !== 1 ||
      elementIdCounts.get(id) !== 1 ||
      !hasExactRecordShape(provenance) ||
      !validSpan ||
      provenance.sourceSpan.startOffset < previousEndOffset ||
      !hasExpectedTag(provenance, element) ||
      !validateMetadataReference(
        provenance,
        element,
        sourceLine,
        publicIdCounts,
        indexes,
      )
    ) {
      return { status: "rejected", entries: [] };
    }
    rendererNonce = nonce;

    const referenceIds = [
      "headingId" in provenance
        ? `heading\0${provenance.headingId}`
        : undefined,
      "sourceBlockId" in provenance
        ? `sourceBlock\0${provenance.sourceBlockId}`
        : undefined,
      "sourceTextBlockId" in provenance
        ? `sourceText\0${provenance.sourceTextBlockId}`
        : undefined,
      "sourceSelectionBlockId" in provenance &&
      provenance.sourceSelectionBlockId !== undefined
        ? `selection\0${provenance.sourceSelectionBlockId}`
        : undefined,
      "diagramId" in provenance
        ? `diagram\0${provenance.diagramId}`
        : undefined,
    ].filter((value): value is string => value !== undefined);
    if (
      referenceIds.some((referenceId) => referencedMetadataIds.has(referenceId))
    ) {
      return { status: "rejected", entries: [] };
    }
    referenceIds.forEach((referenceId) =>
      referencedMetadataIds.add(referenceId),
    );
    previousEndOffset = provenance.sourceSpan.endOffset;
    entries.push({ element, provenance });
  }

  return { status: "valid", entries };
}
