import type { MarkdownAuthorHtmlFragment } from "../../core/types";

const INLINE_MARKER_NAME = "svard-markdown-author-html-inline";
const BLOCK_MARKER_NAME = "svard-markdown-author-html-block";
const IDENTITY_ATTRIBUTE_NAME = "data-svard-markdown-author-html-id";
const MARKER_SELECTOR = `${INLINE_MARKER_NAME},${BLOCK_MARKER_NAME},[${IDENTITY_ATTRIBUTE_NAME}]`;
const MARKER_MARKUP_PATTERN =
  /<\s*svard-markdown-author-html-(?:inline|block)\b|data-svard-markdown-author-html-id\b/iu;
const TEXT_NODE_TYPE = 3;

interface MatchedMarker {
  marker: Element;
  fragment: MarkdownAuthorHtmlFragment;
}

function markerMatchesKind(
  marker: Element,
  kind: MarkdownAuthorHtmlFragment["kind"],
): boolean {
  return (
    (kind === "inline" && marker.localName === INLINE_MARKER_NAME) ||
    (kind === "block" && marker.localName === BLOCK_MARKER_NAME)
  );
}

function splitsSurrogatePair(source: string, offset: number): boolean {
  if (offset <= 0 || offset >= source.length) {
    return false;
  }

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
  fragment: MarkdownAuthorHtmlFragment,
  source: string,
): boolean {
  const sourceSpan = fragment.sourceSpan;
  if (!sourceSpan) {
    return false;
  }

  const { startOffset, endOffset } = sourceSpan;
  return (
    Number.isInteger(startOffset) &&
    Number.isInteger(endOffset) &&
    startOffset >= 0 &&
    startOffset < endOffset &&
    endOffset <= source.length &&
    !splitsSurrogatePair(source, startOffset) &&
    !splitsSurrogatePair(source, endOffset)
  );
}

function hasSingleTextChild(marker: Element): boolean {
  return (
    marker.childNodes.length === 1 &&
    marker.firstChild?.nodeType === TEXT_NODE_TYPE
  );
}

function flattenMarker(marker: Element): void {
  marker.replaceWith(
    marker.ownerDocument.createTextNode(marker.textContent ?? ""),
  );
}

export function containsMarkdownAuthorHtmlMarkerMarkup(html: string): boolean {
  return MARKER_MARKUP_PATTERN.test(html);
}

export function normalizeMarkdownAuthorHtmlInPlace(
  body: HTMLElement,
  source: string,
  fragments: readonly MarkdownAuthorHtmlFragment[],
): void {
  const markers = Array.from(body.querySelectorAll(MARKER_SELECTOR));
  if (markers.length === 0) {
    return;
  }

  const markerIdCounts = new Map<string, number>();
  for (const marker of markers) {
    const id = marker.getAttribute(IDENTITY_ATTRIBUTE_NAME);
    if (id !== null) {
      markerIdCounts.set(id, (markerIdCounts.get(id) ?? 0) + 1);
    }
  }

  const fragmentIdCounts = new Map<string, number>();
  const fragmentsById = new Map<string, MarkdownAuthorHtmlFragment>();
  for (const fragment of fragments) {
    if (typeof fragment?.id !== "string") {
      continue;
    }
    fragmentIdCounts.set(
      fragment.id,
      (fragmentIdCounts.get(fragment.id) ?? 0) + 1,
    );
    fragmentsById.set(fragment.id, fragment);
  }

  const matched: MatchedMarker[] = [];
  const invalidMarkers = new Set<Element>();

  for (const marker of markers) {
    const id = marker.getAttribute(IDENTITY_ATTRIBUTE_NAME);
    const fragment = id === null ? undefined : fragmentsById.get(id);
    const hasOneToOneId =
      id !== null &&
      id.length > 0 &&
      markerIdCounts.get(id) === 1 &&
      fragmentIdCounts.get(id) === 1;
    const hasExpectedShape =
      marker.attributes.length === 1 &&
      marker.hasAttribute(IDENTITY_ATTRIBUTE_NAME) &&
      hasSingleTextChild(marker);
    const hasExpectedKind =
      fragment !== undefined && markerMatchesKind(marker, fragment.kind);

    if (
      !fragment ||
      !hasOneToOneId ||
      !hasExpectedShape ||
      !hasExpectedKind ||
      !hasValidSourceSpan(fragment, source)
    ) {
      invalidMarkers.add(marker);
      continue;
    }

    matched.push({ marker, fragment });
  }

  let previousEndOffset = -1;
  let sourceOrderIsValid = true;
  for (const { fragment } of matched) {
    if (fragment.sourceSpan.startOffset < previousEndOffset) {
      sourceOrderIsValid = false;
      break;
    }
    previousEndOffset = fragment.sourceSpan.endOffset;
  }

  if (!sourceOrderIsValid) {
    for (const { marker } of matched) {
      invalidMarkers.add(marker);
    }
  }

  const matchedByMarker = new Map(
    matched.map(({ marker, fragment }) => [marker, fragment]),
  );
  for (const marker of markers) {
    const fragment = matchedByMarker.get(marker);
    if (!fragment || invalidMarkers.has(marker)) {
      flattenMarker(marker);
      continue;
    }

    const { startOffset, endOffset } = fragment.sourceSpan;
    marker.replaceWith(
      marker.ownerDocument.createTextNode(source.slice(startOffset, endOffset)),
    );
  }
}
