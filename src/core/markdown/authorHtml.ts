import { unescapeAll } from "markdown-it/lib/common/utils.mjs";

import { utf8ByteLength } from "./placeholders";

export const MAX_MARKDOWN_AUTHOR_HTML_ITEMS = 4_096;
export const MAX_MARKDOWN_AUTHOR_HTML_NESTING = 32;
export const MAX_MARKDOWN_AUTHOR_HTML_ABBR_TITLE_BYTES = 1_024;

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
      children: MarkdownAuthorHtmlNode[];
      sourceSpan: MarkdownAuthorHtmlSourceSpan;
    };

export type MarkdownAuthorHtmlParseResult =
  | {
      status: "pass";
      nodes: MarkdownAuthorHtmlNode[];
      elementCount: number;
      visibleText: string;
    }
  | { status: "escape" };

export type MarkdownAuthorHtmlTagName =
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
const inlineTags = new Set<MarkdownAuthorHtmlTagName>([
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
const voidTags = new Set<MarkdownAuthorHtmlTagName>(["br", "col", "hr"]);
const asciiNamePattern = /^[A-Za-z][A-Za-z0-9-]*$/u;
const whitespacePattern = /[\t\f ]/u;

interface ParsedOpeningTag {
  attributes: Record<string, string>;
  endOffset: number;
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

type NormalizedAttribute =
  | { name: string; value: string }
  | { name: null }
  | null;

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
): NormalizedAttribute {
  if (tagName === "abbr" && attributeName === "title") {
    const normalizedTitle = decodeHtmlEntities(value);
    if (
      utf8ByteLength(
        normalizedTitle,
        MAX_MARKDOWN_AUTHOR_HTML_ABBR_TITLE_BYTES,
      ) > MAX_MARKDOWN_AUTHOR_HTML_ABBR_TITLE_BYTES
    ) {
      return null;
    }
    return { name: "title", value: normalizedTitle };
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
      ? { name: "align", value: normalized }
      : null;
  }
  if (tagName === "ol") {
    if (attributeName === "reversed") return { name: "reversed", value: "" };
    if (attributeName === "start") {
      const normalized = canonicalSafeInteger(value);
      return normalized === null ? null : { name: "start", value: normalized };
    }
    if (attributeName === "type") {
      return ["1", "a", "A", "i", "I"].includes(value)
        ? { name: "type", value }
        : null;
    }
  }
  if (tagName === "li" && attributeName === "value") {
    const normalized = canonicalSafeInteger(value);
    return normalized === null ? null : { name: "value", value: normalized };
  }
  if (
    (tagName === "th" || tagName === "td") &&
    (attributeName === "rowspan" || attributeName === "colspan")
  ) {
    const normalized = boundedSpan(value);
    return normalized === null
      ? null
      : { name: attributeName, value: normalized };
  }
  if (
    (tagName === "col" || tagName === "colgroup") &&
    attributeName === "span"
  ) {
    const normalized = boundedSpan(value);
    return normalized === null ? null : { name: "span", value: normalized };
  }
  if (tagName === "th" && attributeName === "scope") {
    const normalized = value.toLowerCase();
    return ["row", "col", "rowgroup", "colgroup"].includes(normalized)
      ? { name: "scope", value: normalized }
      : null;
  }
  return { name: null };
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
  const seenAttributes = new Set<string>();
  let offset = parsedName[1];
  while (offset < source.length) {
    offset = skipWhitespace(source, offset);
    if (source[offset] === "\n" || source[offset] === "\r") return null;
    if (source.startsWith("/>", offset)) {
      return { attributes, endOffset: offset + 2, selfClosing: true, tagName };
    }
    if (source[offset] === ">") {
      return { attributes, endOffset: offset + 1, selfClosing: false, tagName };
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
    if (normalized === null) return null;
    if (normalized.name !== null) {
      attributes[normalized.name] = normalized.value;
    }
  }
  return null;
}

function visibleText(nodes: readonly MarkdownAuthorHtmlNode[]): string {
  return nodes
    .map((node) =>
      node.type === "text" ? node.value : visibleText(node.children),
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
  if (parent === "ruby") return inlineTags.has(child) && child !== "ruby";
  if (rubyChildTags.has(parent)) {
    return (
      inlineTags.has(child) && child !== "ruby" && !rubyChildTags.has(child)
    );
  }
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
  if (
    state.mode === "block" &&
    parentTagName &&
    !parentAllowsChild(parentTagName, tagName, ancestors)
  ) {
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
