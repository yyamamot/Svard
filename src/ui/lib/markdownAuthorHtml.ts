import {
  parseMarkdownAuthorHtmlBlockFragment,
  parseMarkdownAuthorHtmlFragment,
  type MarkdownAuthorHtmlNode,
} from "../../core/markdown/authorHtml";
import type { MarkdownAuthorHtmlFragment } from "../../core/types";

const INLINE_MARKER_NAME = "svard-markdown-author-html-inline";
const BLOCK_MARKER_NAME = "svard-markdown-author-html-block";
const IDENTITY_ATTRIBUTE_NAME = "data-svard-markdown-author-html-id";
const RENDERER_IDENTITY_ATTRIBUTE_NAME = "data-source-renderer-id";
const MARKER_SELECTOR = `${INLINE_MARKER_NAME},${BLOCK_MARKER_NAME},[${IDENTITY_ATTRIBUTE_NAME}]`;
const MARKER_MARKUP_PATTERN =
  /<\s*svard-markdown-author-html-(?:inline|block)\b|data-svard-markdown-author-html-id\b/iu;
const TEXT_NODE_TYPE = 3;
const SAFE_ELEMENT_NAMES = new Set([
  "abbr",
  "blockquote",
  "br",
  "caption",
  "col",
  "colgroup",
  "dd",
  "del",
  "div",
  "dl",
  "dt",
  "hr",
  "ins",
  "kbd",
  "li",
  "mark",
  "ol",
  "p",
  "rp",
  "rt",
  "ruby",
  "s",
  "small",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "ul",
]);
export const MARKDOWN_SAFE_HTML_BLOCK_CLASS = "markdown-safe-html-block";

interface MatchedMarker {
  marker: Element;
  fragment: MarkdownAuthorHtmlFragment;
}

interface PreparedMarker extends MatchedMarker {
  blockRoots: Element[];
  replacement: DocumentFragment | Text;
  outcome: "pass" | "escape";
}

export interface MarkdownAuthorHtmlNormalizationCounts {
  passedCount: number;
  escapedCount: number;
  rejectedCount: number;
}

export interface MarkdownAuthorHtmlNormalizationResult extends MarkdownAuthorHtmlNormalizationCounts {
  blockRootElements: Set<Element>;
  sourceActionExcludedElements: Set<Element>;
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
  fragment: MarkdownAuthorHtmlFragment,
  source: string,
): boolean {
  const sourceSpan = fragment.sourceSpan;
  if (!sourceSpan) return false;
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

function isAllowedAttribute(
  tagName: string,
  name: string,
  value: string,
): boolean {
  if (tagName === "abbr") return name === "title";
  if (["p", "div", "th", "td"].includes(tagName) && name === "align") {
    return ["left", "center", "right"].includes(value);
  }
  if (tagName === "ol") {
    return (
      name === "start" ||
      name === "reversed" ||
      (name === "type" && ["1", "a", "A", "i", "I"].includes(value))
    );
  }
  if (tagName === "li") return name === "value";
  if (
    ["th", "td"].includes(tagName) &&
    (name === "rowspan" || name === "colspan")
  ) {
    return true;
  }
  if (["col", "colgroup"].includes(tagName) && name === "span") return true;
  if (tagName === "th" && name === "scope") {
    return ["row", "col", "rowgroup", "colgroup"].includes(value);
  }
  return false;
}

function appendSafeNodes(
  document: Document,
  parent: DocumentFragment | Element,
  nodes: readonly MarkdownAuthorHtmlNode[],
): boolean {
  for (const node of nodes) {
    if (node.type === "text") {
      parent.append(document.createTextNode(node.value));
      continue;
    }
    if (!SAFE_ELEMENT_NAMES.has(node.tagName)) return false;
    const attributeEntries = Object.entries(node.attributes);
    if (
      attributeEntries.some(
        ([name, value]) => !isAllowedAttribute(node.tagName, name, value),
      )
    ) {
      return false;
    }
    const element = document.createElement(node.tagName);
    for (const [name, value] of attributeEntries) {
      element.setAttribute(name, value);
    }
    if (!appendSafeNodes(document, element, node.children)) return false;
    parent.append(element);
  }
  return true;
}

function rejectedResult(
  markers: readonly Element[],
): MarkdownAuthorHtmlNormalizationResult {
  for (const marker of markers) flattenMarker(marker);
  return {
    passedCount: 0,
    escapedCount: 0,
    rejectedCount: markers.length,
    blockRootElements: new Set<Element>(),
    sourceActionExcludedElements: new Set<Element>(),
  };
}

export function containsMarkdownAuthorHtmlMarkerMarkup(html: string): boolean {
  return MARKER_MARKUP_PATTERN.test(html);
}

export function normalizeMarkdownAuthorHtmlInPlace(
  body: HTMLElement,
  source: string,
  fragments: readonly MarkdownAuthorHtmlFragment[],
): MarkdownAuthorHtmlNormalizationResult {
  const markers = Array.from(body.querySelectorAll(MARKER_SELECTOR));
  if (markers.length === 0) {
    return {
      passedCount: 0,
      escapedCount: 0,
      rejectedCount: 0,
      blockRootElements: new Set<Element>(),
      sourceActionExcludedElements: new Set<Element>(),
    };
  }

  const markerIdCounts = new Map<string, number>();
  for (const marker of markers) {
    const id = marker.getAttribute(IDENTITY_ATTRIBUTE_NAME);
    if (id !== null) markerIdCounts.set(id, (markerIdCounts.get(id) ?? 0) + 1);
  }

  const fragmentIdCounts = new Map<string, number>();
  const fragmentsById = new Map<string, MarkdownAuthorHtmlFragment>();
  for (const fragment of fragments) {
    if (typeof fragment?.id !== "string") continue;
    fragmentIdCounts.set(
      fragment.id,
      (fragmentIdCounts.get(fragment.id) ?? 0) + 1,
    );
    fragmentsById.set(fragment.id, fragment);
  }

  const matched: MatchedMarker[] = [];
  for (const marker of markers) {
    const id = marker.getAttribute(IDENTITY_ATTRIBUTE_NAME);
    const fragment = id === null ? undefined : fragmentsById.get(id);
    if (
      !fragment ||
      id === null ||
      id.length === 0 ||
      markerIdCounts.get(id) !== 1 ||
      fragmentIdCounts.get(id) !== 1 ||
      marker.attributes.length !== 1 ||
      !marker.hasAttribute(IDENTITY_ATTRIBUTE_NAME) ||
      !hasSingleTextChild(marker) ||
      !markerMatchesKind(marker, fragment.kind) ||
      !hasValidSourceSpan(fragment, source)
    ) {
      return rejectedResult(markers);
    }
    matched.push({ marker, fragment });
  }

  let previousEndOffset = -1;
  for (const { fragment } of matched) {
    if (fragment.sourceSpan.startOffset < previousEndOffset) {
      return rejectedResult(markers);
    }
    previousEndOffset = fragment.sourceSpan.endOffset;
  }

  const prepared: PreparedMarker[] = [];
  for (const match of matched) {
    const { startOffset, endOffset } = match.fragment.sourceSpan;
    const fragmentSource = source.slice(startOffset, endOffset);
    const parsed =
      match.fragment.kind === "block"
        ? parseMarkdownAuthorHtmlBlockFragment(fragmentSource)
        : parseMarkdownAuthorHtmlFragment(fragmentSource);
    if (parsed.status !== "pass") {
      prepared.push({
        ...match,
        blockRoots: [],
        replacement: match.marker.ownerDocument.createTextNode(fragmentSource),
        outcome: "escape",
      });
      continue;
    }
    const replacement = match.marker.ownerDocument.createDocumentFragment();
    if (
      !appendSafeNodes(match.marker.ownerDocument, replacement, parsed.nodes)
    ) {
      return rejectedResult(markers);
    }
    const blockRoots =
      match.fragment.kind === "block" ? Array.from(replacement.children) : [];
    if (match.fragment.kind === "block" && blockRoots.length !== 1) {
      return rejectedResult(markers);
    }
    blockRoots.forEach((root) =>
      root.classList.add(MARKDOWN_SAFE_HTML_BLOCK_CLASS),
    );
    prepared.push({ ...match, blockRoots, replacement, outcome: "pass" });
  }

  const sourceActionExcludedElements = new Set<Element>();
  const blockRootElements = new Set<Element>();
  let passedCount = 0;
  let escapedCount = 0;
  for (const item of prepared) {
    if (item.outcome === "pass") {
      passedCount += 1;
      for (const root of item.blockRoots) {
        blockRootElements.add(root);
        sourceActionExcludedElements.add(root);
        root
          .querySelectorAll("h1,h2,h3,h4,h5,h6,p,ul,ol,dl,table,pre,blockquote")
          .forEach((element) => sourceActionExcludedElements.add(element));
      }
      for (
        let ancestor = item.marker.parentElement;
        ancestor && ancestor !== body;
        ancestor = ancestor.parentElement
      ) {
        if (
          ancestor.hasAttribute(RENDERER_IDENTITY_ATTRIBUTE_NAME) ||
          ancestor.matches("h1,h2,h3,h4,h5,h6,p,ul,ol,table,pre")
        ) {
          sourceActionExcludedElements.add(ancestor);
        }
      }
    } else {
      escapedCount += 1;
    }
    item.marker.replaceWith(item.replacement);
  }

  return {
    passedCount,
    escapedCount,
    rejectedCount: 0,
    blockRootElements,
    sourceActionExcludedElements,
  };
}
