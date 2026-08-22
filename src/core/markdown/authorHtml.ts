import { unescapeAll } from "markdown-it/lib/common/utils.mjs";

import { utf8ByteLength } from "./placeholders";

export const MAX_MARKDOWN_AUTHOR_HTML_ITEMS = 4_096;
export const MAX_MARKDOWN_AUTHOR_HTML_NESTING = 32;
export const MAX_MARKDOWN_AUTHOR_HTML_ABBR_TITLE_BYTES = 1_024;
export const MAX_MARKDOWN_AUTHOR_HTML_RESOURCE_URL_BYTES = 4_096;
export const MAX_MARKDOWN_AUTHOR_HTML_RESOURCE_TEXT_BYTES = 1_024;

export interface MarkdownAuthorHtmlSourceSpan {
  startOffset: number;
  endOffset: number;
}

export type MarkdownAuthorHtmlNode =
  | {
      type: "text";
      value: string;
      sourceSpan: MarkdownAuthorHtmlSourceSpan;
    }
  | {
      type: "element";
      tagName: MarkdownAuthorHtmlTagName;
      attributes: Readonly<Record<string, string>>;
      resource?: MarkdownAuthorHtmlResource;
      children: MarkdownAuthorHtmlNode[];
      sourceSpan: MarkdownAuthorHtmlSourceSpan;
    };

export type MarkdownAuthorHtmlResource =
  | { kind: "link"; value: string }
  | { kind: "image"; value: string };

export type MarkdownAuthorHtmlParseResult =
  | {
      status: "pass";
      nodes: MarkdownAuthorHtmlNode[];
      elementCount: number;
      visibleText: string;
    }
  | { status: "escape" };

export type MarkdownAuthorHtmlTagName =
  | "a"
  | "abbr"
  | "blockquote"
  | "br"
  | "caption"
  | "col"
  | "colgroup"
  | "dd"
  | "del"
  | "div"
  | "dl"
  | "dt"
  | "hr"
  | "ins"
  | "img"
  | "kbd"
  | "li"
  | "mark"
  | "ol"
  | "p"
  | "rp"
  | "rt"
  | "ruby"
  | "s"
  | "small"
  | "sub"
  | "sup"
  | "table"
  | "tbody"
  | "td"
  | "tfoot"
  | "th"
  | "thead"
  | "tr"
  | "ul";

const allowedTags = new Set<MarkdownAuthorHtmlTagName>([
  "a",
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
  "img",
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
const inlineTags = new Set<MarkdownAuthorHtmlTagName>([
  "a",
  "abbr",
  "br",
  "del",
  "ins",
  "img",
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
const blockRootTags = new Set<MarkdownAuthorHtmlTagName>([
  "blockquote",
  "div",
  "dl",
  "hr",
  "ol",
  "p",
  "table",
  "ul",
]);
const rubyChildTags = new Set<MarkdownAuthorHtmlTagName>(["rp", "rt"]);
const voidTags = new Set<MarkdownAuthorHtmlTagName>(["br", "col", "hr", "img"]);
const asciiNamePattern = /^[A-Za-z][A-Za-z0-9-]*$/u;
const whitespacePattern = /[\t\f ]/u;

interface ParsedOpeningTag {
  attributes: Record<string, string>;
  endOffset: number;
  resource?: MarkdownAuthorHtmlResource;
  selfClosing: boolean;
  tagName: MarkdownAuthorHtmlTagName;
}

interface ParseState {
  elementCount: number;
  mode: "block" | "inline";
  source: string;
}

export interface MarkdownAuthorContainerOpeningTag {
  endOffset: number;
  open: boolean;
}

function decodeHtmlEntities(value: string): string {
  return unescapeAll(value.replaceAll("\\", "\\\\"));
}

function readAsciiName(
  source: string,
  offset: number,
): [string, number] | null {
  let endOffset = offset;
  while (endOffset < source.length && /[A-Za-z0-9-]/u.test(source[endOffset])) {
    endOffset += 1;
  }
  const name = source.slice(offset, endOffset);
  return asciiNamePattern.test(name) ? [name.toLowerCase(), endOffset] : null;
}

function skipWhitespace(source: string, offset: number): number {
  while (offset < source.length && whitespacePattern.test(source[offset])) {
    offset += 1;
  }
  return offset;
}

type AttributeDecision =
  | { kind: "accept"; name: string; value: string }
  | {
      kind: "resource";
      resourceKind: MarkdownAuthorHtmlResource["kind"];
      value: string;
    }
  | { kind: "drop" }
  | { kind: "reject" };

function boundedDecodedAttribute(
  value: string,
  maxBytes: number,
): string | null {
  const normalized = decodeHtmlEntities(value);
  return utf8ByteLength(normalized, maxBytes) <= maxBytes ? normalized : null;
}

function boundedDimension(value: string): string | null {
  const normalized = value.replace(/^[\t\f ]+|[\t\f ]+$/gu, "");
  const match = /^(\d+)(?:px)?$/iu.exec(normalized);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 4_096
    ? String(parsed)
    : null;
}

function canonicalSafeInteger(value: string): string | null {
  if (!/^[+-]?\d+$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? String(parsed) : null;
}

function boundedSpan(value: string): string | null {
  if (!/^\d+$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 100
    ? String(parsed)
    : null;
}

function normalizeAttribute(
  tagName: MarkdownAuthorHtmlTagName,
  attributeName: string,
  value: string,
): AttributeDecision {
  if (tagName === "a" && attributeName === "href") {
    const normalized = boundedDecodedAttribute(
      value,
      MAX_MARKDOWN_AUTHOR_HTML_RESOURCE_URL_BYTES,
    );
    return normalized === null
      ? { kind: "reject" }
      : { kind: "resource", resourceKind: "link", value: normalized };
  }
  if (tagName === "img" && attributeName === "src") {
    const normalized = boundedDecodedAttribute(
      value,
      MAX_MARKDOWN_AUTHOR_HTML_RESOURCE_URL_BYTES,
    );
    return normalized === null
      ? { kind: "reject" }
      : { kind: "resource", resourceKind: "image", value: normalized };
  }
  if (
    (tagName === "a" && attributeName === "title") ||
    (tagName === "img" &&
      (attributeName === "alt" || attributeName === "title"))
  ) {
    const normalized = boundedDecodedAttribute(
      value,
      MAX_MARKDOWN_AUTHOR_HTML_RESOURCE_TEXT_BYTES,
    );
    return normalized === null
      ? { kind: "drop" }
      : { kind: "accept", name: attributeName, value: normalized };
  }
  if (
    tagName === "img" &&
    (attributeName === "width" || attributeName === "height")
  ) {
    const normalized = boundedDimension(value);
    return normalized === null
      ? { kind: "drop" }
      : { kind: "accept", name: attributeName, value: normalized };
  }
  if (tagName === "img" && attributeName === "align") {
    const normalized = value.toLowerCase();
    return ["left", "center", "right"].includes(normalized)
      ? { kind: "accept", name: "align", value: normalized }
      : { kind: "drop" };
  }
  if (tagName === "abbr" && attributeName === "title") {
    const normalizedTitle = decodeHtmlEntities(value);
    if (
      utf8ByteLength(
        normalizedTitle,
        MAX_MARKDOWN_AUTHOR_HTML_ABBR_TITLE_BYTES,
      ) > MAX_MARKDOWN_AUTHOR_HTML_ABBR_TITLE_BYTES
    ) {
      return { kind: "drop" };
    }
    return { kind: "accept", name: "title", value: normalizedTitle };
  }
  if (
    (tagName === "p" ||
      tagName === "div" ||
      tagName === "th" ||
      tagName === "td") &&
    attributeName === "align"
  ) {
    const normalized = value.toLowerCase();
    return normalized === "left" ||
      normalized === "center" ||
      normalized === "right"
      ? { kind: "accept", name: "align", value: normalized }
      : { kind: "drop" };
  }
  if (tagName === "ol") {
    if (attributeName === "reversed") {
      return { kind: "accept", name: "reversed", value: "" };
    }
    if (attributeName === "start") {
      const normalized = canonicalSafeInteger(value);
      return normalized === null
        ? { kind: "drop" }
        : { kind: "accept", name: "start", value: normalized };
    }
    if (attributeName === "type") {
      return ["1", "a", "A", "i", "I"].includes(value)
        ? { kind: "accept", name: "type", value }
        : { kind: "drop" };
    }
  }
  if (tagName === "li" && attributeName === "value") {
    const normalized = canonicalSafeInteger(value);
    return normalized === null
      ? { kind: "drop" }
      : { kind: "accept", name: "value", value: normalized };
  }
  if (
    (tagName === "th" || tagName === "td") &&
    (attributeName === "rowspan" || attributeName === "colspan")
  ) {
    const normalized = boundedSpan(value);
    return normalized === null
      ? { kind: "drop" }
      : { kind: "accept", name: attributeName, value: normalized };
  }
  if (
    (tagName === "col" || tagName === "colgroup") &&
    attributeName === "span"
  ) {
    const normalized = boundedSpan(value);
    return normalized === null
      ? { kind: "drop" }
      : { kind: "accept", name: "span", value: normalized };
  }
  if (tagName === "th" && attributeName === "scope") {
    const normalized = value.toLowerCase();
    return ["row", "col", "rowgroup", "colgroup"].includes(normalized)
      ? { kind: "accept", name: "scope", value: normalized }
      : { kind: "drop" };
  }
  return { kind: "drop" };
}

export function parseMarkdownAuthorContainerOpeningTag(
  source: string,
  expectedTagName: "details" | "summary",
): MarkdownAuthorContainerOpeningTag | null {
  if (source[0] !== "<" || source[1] === "/") return null;
  const parsedName = readAsciiName(source, 1);
  if (!parsedName || parsedName[0] !== expectedTagName) return null;
  const seenAttributes = new Set<string>();
  let offset = parsedName[1];
  let open = false;
  while (offset < source.length) {
    offset = skipWhitespace(source, offset);
    if (source[offset] === ">") return { endOffset: offset + 1, open };
    if (source.startsWith("/>", offset)) return null;
    const attributeNameResult = readAsciiName(source, offset);
    if (!attributeNameResult) return null;
    const [attributeName, nameEndOffset] = attributeNameResult;
    if (seenAttributes.has(attributeName)) return null;
    seenAttributes.add(attributeName);
    offset = skipWhitespace(source, nameEndOffset);
    if (source[offset] === "=") {
      offset = skipWhitespace(source, offset + 1);
      const quote = source[offset];
      if (quote === '"' || quote === "'") {
        const valueEndOffset = source.indexOf(quote, offset + 1);
        if (valueEndOffset < 0) return null;
        offset = valueEndOffset + 1;
      } else {
        const valueStartOffset = offset;
        while (
          offset < source.length &&
          !whitespacePattern.test(source[offset]) &&
          source[offset] !== ">"
        ) {
          if (
            source[offset] === '"' ||
            source[offset] === "'" ||
            source[offset] === "<"
          ) {
            return null;
          }
          offset += 1;
        }
        if (offset === valueStartOffset) return null;
      }
    }
    if (expectedTagName === "details" && attributeName === "open") open = true;
  }
  return null;
}

function parseOpeningTag(
  source: string,
  startOffset: number,
): ParsedOpeningTag | null {
  if (source[startOffset] !== "<" || source[startOffset + 1] === "/")
    return null;
  const parsedName = readAsciiName(source, startOffset + 1);
  if (
    !parsedName ||
    !allowedTags.has(parsedName[0] as MarkdownAuthorHtmlTagName)
  ) {
    return null;
  }
  const tagName = parsedName[0] as MarkdownAuthorHtmlTagName;
  const attributes: Record<string, string> = {};
  let resource: MarkdownAuthorHtmlResource | undefined;
  const seenAttributes = new Set<string>();
  let offset = parsedName[1];
  while (offset < source.length) {
    offset = skipWhitespace(source, offset);
    if (source[offset] === "\n" || source[offset] === "\r") return null;
    if (source.startsWith("/>", offset) || source[offset] === ">") {
      if ((tagName === "a" || tagName === "img") && !resource) return null;
      const selfClosing = source.startsWith("/>", offset);
      return {
        attributes,
        endOffset: offset + (selfClosing ? 2 : 1),
        resource,
        selfClosing,
        tagName,
      };
    }
    const attributeNameResult = readAsciiName(source, offset);
    if (!attributeNameResult) return null;
    const [attributeName, nameEndOffset] = attributeNameResult;
    if (seenAttributes.has(attributeName)) return null;
    seenAttributes.add(attributeName);
    offset = skipWhitespace(source, nameEndOffset);
    let value = "";
    if (source[offset] === "=") {
      offset = skipWhitespace(source, offset + 1);
      const quote = source[offset];
      if (quote === '"' || quote === "'") {
        const valueEndOffset = source.indexOf(quote, offset + 1);
        if (valueEndOffset < 0) return null;
        value = source.slice(offset + 1, valueEndOffset);
        if (value.includes("\n") || value.includes("\r")) return null;
        offset = valueEndOffset + 1;
      } else {
        const valueStartOffset = offset;
        while (
          offset < source.length &&
          !whitespacePattern.test(source[offset]) &&
          source[offset] !== ">"
        ) {
          if (
            source[offset] === '"' ||
            source[offset] === "'" ||
            source[offset] === "<" ||
            source[offset] === "\n" ||
            source[offset] === "\r"
          ) {
            return null;
          }
          offset += 1;
        }
        if (offset === valueStartOffset) return null;
        value = source.slice(valueStartOffset, offset);
      }
    }
    const normalized = normalizeAttribute(tagName, attributeName, value);
    if (normalized.kind === "reject") return null;
    if (normalized.kind === "resource") {
      resource = { kind: normalized.resourceKind, value: normalized.value };
    } else if (normalized.kind === "accept") {
      attributes[normalized.name] = normalized.value;
    }
  }
  return null;
}

function visibleText(nodes: readonly MarkdownAuthorHtmlNode[]): string {
  return nodes
    .map((node) =>
      node.type === "text"
        ? node.value
        : node.tagName === "img"
          ? (node.attributes.alt ?? "")
          : visibleText(node.children),
    )
    .join("");
}

function childElementNames(
  nodes: readonly MarkdownAuthorHtmlNode[],
): MarkdownAuthorHtmlTagName[] {
  return nodes.flatMap((node) =>
    node.type === "element" ? [node.tagName] : [],
  );
}

function hasOnlyWhitespaceText(
  nodes: readonly MarkdownAuthorHtmlNode[],
): boolean {
  return nodes.every(
    (node) => node.type === "element" || /^\s*$/u.test(node.value),
  );
}

function validDefinitionListChildren(
  nodes: readonly MarkdownAuthorHtmlNode[],
): boolean {
  if (!hasOnlyWhitespaceText(nodes)) return false;
  const names = childElementNames(nodes);
  let hasTerm = false;
  let descriptionsForTerm = 0;
  for (const name of names) {
    if (name === "dt") {
      if (hasTerm && descriptionsForTerm === 0) return false;
      hasTerm = true;
      descriptionsForTerm = 0;
    } else if (name === "dd" && hasTerm) {
      descriptionsForTerm += 1;
    } else {
      return false;
    }
  }
  return hasTerm && descriptionsForTerm > 0;
}

function validTableChildren(nodes: readonly MarkdownAuthorHtmlNode[]): boolean {
  if (!hasOnlyWhitespaceText(nodes)) return false;
  const names = childElementNames(nodes);
  let index = 0;
  if (names[index] === "caption") index += 1;
  while (names[index] === "colgroup") index += 1;
  if (names[index] === "thead") index += 1;
  const bodyKind = names[index];
  if (bodyKind !== "tbody" && bodyKind !== "tr") return false;
  while (names[index] === bodyKind) index += 1;
  if (names[index] === "tfoot") index += 1;
  return index === names.length;
}

function parentAllowsChild(
  parent: MarkdownAuthorHtmlTagName,
  child: MarkdownAuthorHtmlTagName,
  ancestors: readonly MarkdownAuthorHtmlTagName[],
): boolean {
  if (child === "a" && (parent === "a" || ancestors.includes("a"))) {
    return false;
  }
  if (parent === "ul" || parent === "ol") return child === "li";
  if (parent === "dl") return child === "dt" || child === "dd";
  if (parent === "table") {
    return ["caption", "colgroup", "thead", "tbody", "tfoot", "tr"].includes(
      child,
    );
  }
  if (parent === "thead" || parent === "tbody" || parent === "tfoot") {
    return child === "tr";
  }
  if (parent === "tr") return child === "th" || child === "td";
  if (parent === "colgroup") return child === "col";
  if (parent === "p" || parent === "caption" || parent === "dt") {
    return inlineTags.has(child);
  }
  if (parent === "ruby") {
    return (
      inlineTags.has(child) &&
      child !== "ruby" &&
      child !== "a" &&
      child !== "img"
    );
  }
  if (rubyChildTags.has(parent)) {
    return (
      inlineTags.has(child) &&
      child !== "ruby" &&
      child !== "a" &&
      child !== "img" &&
      !rubyChildTags.has(child)
    );
  }
  if (parent === "a") return inlineTags.has(child) && child !== "a";
  if (inlineTags.has(parent)) return inlineTags.has(child);
  if (
    parent === "div" ||
    parent === "blockquote" ||
    parent === "li" ||
    parent === "dd" ||
    parent === "th" ||
    parent === "td"
  ) {
    if (child === "table" && ancestors.includes("table")) return false;
    return inlineTags.has(child) || blockRootTags.has(child);
  }
  return false;
}

function validElementChildren(
  node: Extract<MarkdownAuthorHtmlNode, { type: "element" }>,
): boolean {
  if (
    ["ul", "ol", "table", "thead", "tbody", "tfoot", "tr", "colgroup"].includes(
      node.tagName,
    ) &&
    !hasOnlyWhitespaceText(node.children)
  ) {
    return false;
  }
  if (node.tagName === "dl") return validDefinitionListChildren(node.children);
  if (node.tagName === "table") return validTableChildren(node.children);
  if (
    node.tagName === "colgroup" &&
    node.attributes.span !== undefined &&
    childElementNames(node.children).length > 0
  ) {
    return false;
  }
  return true;
}

function parseElement(
  state: ParseState,
  startOffset: number,
  depth: number,
  parentTagName?: MarkdownAuthorHtmlTagName,
  ancestors: readonly MarkdownAuthorHtmlTagName[] = [],
): { endOffset: number; node: MarkdownAuthorHtmlNode } | null {
  if (depth > MAX_MARKDOWN_AUTHOR_HTML_NESTING) return null;
  const opening = parseOpeningTag(state.source, startOffset);
  if (!opening) return null;
  const { tagName } = opening;
  if (state.mode === "inline" && !inlineTags.has(tagName)) return null;
  if (parentTagName && !parentAllowsChild(parentTagName, tagName, ancestors)) {
    return null;
  }
  if (rubyChildTags.has(tagName) && parentTagName !== "ruby") return null;
  if (tagName === "ruby" && parentTagName === "ruby") return null;
  if (
    parentTagName &&
    rubyChildTags.has(parentTagName) &&
    (tagName === "ruby" || rubyChildTags.has(tagName))
  )
    return null;
  state.elementCount += 1;
  if (state.elementCount > MAX_MARKDOWN_AUTHOR_HTML_ITEMS) return null;
  if (voidTags.has(tagName)) {
    return {
      endOffset: opening.endOffset,
      node: {
        type: "element",
        tagName,
        attributes: opening.attributes,
        resource: opening.resource,
        children: [],
        sourceSpan: { startOffset, endOffset: opening.endOffset },
      },
    };
  }
  if (opening.selfClosing) return null;
  const children: MarkdownAuthorHtmlNode[] = [];
  let offset = opening.endOffset;
  let textStartOffset = offset;
  const appendText = (endOffset: number) => {
    if (endOffset <= textStartOffset) return;
    children.push({
      type: "text",
      value: decodeHtmlEntities(state.source.slice(textStartOffset, endOffset)),
      sourceSpan: { startOffset: textStartOffset, endOffset },
    });
  };
  while (offset < state.source.length) {
    if (state.source[offset] !== "<") {
      offset += 1;
      continue;
    }
    if (state.source.startsWith("</", offset)) {
      appendText(offset);
      const closingName = readAsciiName(state.source, offset + 2);
      if (!closingName || closingName[0] !== tagName) return null;
      const closingEndOffset = skipWhitespace(state.source, closingName[1]);
      if (state.source[closingEndOffset] !== ">") return null;
      const endOffset = closingEndOffset + 1;
      const node: Extract<MarkdownAuthorHtmlNode, { type: "element" }> = {
        type: "element",
        tagName,
        attributes: opening.attributes,
        resource: opening.resource,
        children,
        sourceSpan: { startOffset, endOffset },
      };
      if (!validElementChildren(node)) return null;
      return { endOffset, node };
    }
    const child = parseElement(state, offset, depth + 1, tagName, [
      ...ancestors,
      tagName,
    ]);
    if (!child) return null;
    appendText(offset);
    children.push(child.node);
    offset = child.endOffset;
    textStartOffset = offset;
  }
  return null;
}

export function parseMarkdownAuthorHtmlFragment(
  source: string,
): MarkdownAuthorHtmlParseResult {
  if (source.length === 0 || source.includes("\n") || source.includes("\r")) {
    return { status: "escape" };
  }
  const state: ParseState = { elementCount: 0, mode: "inline", source };
  const parsed = parseElement(state, 0, 1);
  if (!parsed || parsed.endOffset !== source.length)
    return { status: "escape" };
  const nodes = [parsed.node];
  return {
    status: "pass",
    nodes,
    elementCount: state.elementCount,
    visibleText: visibleText(nodes),
  };
}

export function parseMarkdownAuthorHtmlBlockFragment(
  source: string,
): MarkdownAuthorHtmlParseResult {
  if (source.length === 0 || source[0] !== "<") return { status: "escape" };
  const state: ParseState = { elementCount: 0, mode: "block", source };
  const parsed = parseElement(state, 0, 1);
  if (
    !parsed ||
    parsed.endOffset !== source.length ||
    parsed.node.type !== "element" ||
    !blockRootTags.has(parsed.node.tagName)
  ) {
    return { status: "escape" };
  }
  const nodes = [parsed.node];
  return {
    status: "pass",
    nodes,
    elementCount: state.elementCount,
    visibleText: visibleText(nodes),
  };
}

export function isMarkdownAuthorHtmlBlockRootTag(tagName: string): boolean {
  return blockRootTags.has(tagName.toLowerCase() as MarkdownAuthorHtmlTagName);
}
