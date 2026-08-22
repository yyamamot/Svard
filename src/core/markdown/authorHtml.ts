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
  | "br"
  | "del"
  | "ins"
  | "kbd"
  | "mark"
  | "rp"
  | "rt"
  | "ruby"
  | "s"
  | "small"
  | "sub"
  | "sup";

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
const rubyChildTags = new Set<MarkdownAuthorHtmlTagName>(["rp", "rt"]);
const asciiNamePattern = /^[A-Za-z][A-Za-z0-9-]*$/u;
const whitespacePattern = /\s/u;

interface ParsedOpeningTag {
  attributes: Record<string, string>;
  endOffset: number;
  selfClosing: boolean;
  tagName: MarkdownAuthorHtmlTagName;
}

interface ParseState {
  elementCount: number;
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
        value = source.slice(valueStartOffset, offset);
      }
    }
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
      attributes.title = normalizedTitle;
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

function parseElement(
  state: ParseState,
  startOffset: number,
  depth: number,
  parentTagName?: MarkdownAuthorHtmlTagName,
): { endOffset: number; node: MarkdownAuthorHtmlNode } | null {
  if (depth > MAX_MARKDOWN_AUTHOR_HTML_NESTING) return null;
  const opening = parseOpeningTag(state.source, startOffset);
  if (!opening) return null;
  const { tagName } = opening;
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
  if (tagName === "br") {
    if (
      !opening.selfClosing &&
      state.source.startsWith("</br", opening.endOffset)
    ) {
      return null;
    }
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
      return {
        endOffset,
        node: {
          type: "element",
          tagName,
          attributes: opening.attributes,
          children,
          sourceSpan: { startOffset, endOffset },
        },
      };
    }
    const child = parseElement(state, offset, depth + 1, tagName);
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
  const state: ParseState = { elementCount: 0, source };
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
