import type Token from "markdown-it/lib/token.mjs";

import { markdown } from "./markdownIt";
import { renderMarkdownTokensToWriter, Utf8ChunkWriter } from "./placeholders";

const githubAlertPattern =
  /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(?:\n)?/i;
const simpleAdmonitionPattern =
  /^\[(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/i;
const mkDocsAdmonitionPattern =
  /^!!!\s+(note|tip|important|warning|caution)(?:\s+(?:"([^"]*)"|'([^']*)'))?\s*$/i;
const taskListPattern = /^\[( |x|X)\]\s+/;

export function isFenceBoundary(line: string): boolean {
  return /^(```|~~~)/.test(line.trim());
}

export interface MarkdownSourceTransform {
  outputLineForInputLine: number[];
  source: string;
}

export function transformSimpleAdmonitionsWithLineMap(
  source: string,
): MarkdownSourceTransform {
  const lines = source.split("\n");
  const transformed: string[] = [];
  const outputLineForInputLine: number[] = [];
  let inFence = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.replace(/\r$/, "").trim();
    outputLineForInputLine[index] = transformed.length;

    if (isFenceBoundary(trimmed)) {
      inFence = !inFence;
      transformed.push(line);
      continue;
    }

    const mkDocsMatch = !inFence
      ? trimmed.match(mkDocsAdmonitionPattern)
      : null;
    if (mkDocsMatch) {
      const title = (mkDocsMatch[2] ?? mkDocsMatch[3] ?? "").trim();

      transformed.push(`> [!${mkDocsMatch[1].toUpperCase()}]`);
      if (title) {
        transformed.push(`> **${title}**`);
      }

      index += 1;
      while (index < lines.length) {
        const bodyLine = lines[index].replace(/\r$/, "");
        if (bodyLine.trim() === "") {
          outputLineForInputLine[index] = transformed.length;
          let nextContentIndex = index + 1;
          while (
            nextContentIndex < lines.length &&
            lines[nextContentIndex].replace(/\r$/, "").trim() === ""
          ) {
            nextContentIndex += 1;
          }
          if (
            nextContentIndex >= lines.length ||
            !/^( {4}|\t)/.test(lines[nextContentIndex].replace(/\r$/, ""))
          ) {
            transformed.push("");
            break;
          }
          transformed.push(">");
          index += 1;
          continue;
        }
        if (/^( {4}|\t)/.test(bodyLine)) {
          outputLineForInputLine[index] = transformed.length;
          transformed.push(`> ${bodyLine.replace(/^( {4}|\t)/, "")}`);
          index += 1;
          continue;
        }
        index -= 1;
        break;
      }
      continue;
    }

    const match = !inFence ? trimmed.match(simpleAdmonitionPattern) : null;
    if (!match) {
      transformed.push(line);
      continue;
    }

    transformed.push(`> [!${match[1].toUpperCase()}]`);
    index += 1;

    while (index < lines.length) {
      const bodyLine = lines[index];
      outputLineForInputLine[index] = transformed.length;
      if (bodyLine.replace(/\r$/, "").trim() === "") {
        transformed.push(bodyLine);
        break;
      }
      transformed.push(`> ${bodyLine}`);
      index += 1;
    }
  }

  return {
    source: transformed.join("\n"),
    outputLineForInputLine,
  };
}

export function transformSimpleAdmonitions(source: string): string {
  return transformSimpleAdmonitionsWithLineMap(source).source;
}

function newInlineHtmlToken(parentToken: Token, content: string): Token {
  const tokenConstructor = (
    parentToken as unknown as {
      constructor: new (type: string, tag: string, nesting: 0) => Token;
    }
  ).constructor;
  const token = new tokenConstructor("html_inline", "", 0);
  token.content = content;
  return token;
}

function stripInlinePrefix(inline: Token, pattern: RegExp) {
  inline.content = inline.content.replace(pattern, "");
  if (!inline.children || inline.children.length === 0) {
    return;
  }

  const firstTextIndex = inline.children.findIndex(
    (child) => child.type === "text" && pattern.test(child.content),
  );
  if (firstTextIndex < 0) {
    return;
  }

  inline.children[firstTextIndex].content = inline.children[
    firstTextIndex
  ].content.replace(pattern, "");
  if (
    inline.children[firstTextIndex].content === "" &&
    inline.children[firstTextIndex + 1]?.type === "softbreak"
  ) {
    inline.children.splice(firstTextIndex, 2);
  }
}

export function enhanceGithubAlerts(tokens: Token[]) {
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== "blockquote_open") {
      continue;
    }

    const paragraphIndex = index + 1;
    const inline = tokens[paragraphIndex + 1];
    if (
      tokens[paragraphIndex]?.type !== "paragraph_open" ||
      inline?.type !== "inline"
    ) {
      continue;
    }

    const match = inline.content.match(githubAlertPattern);
    if (!match) {
      continue;
    }

    const alertType = match[1].toLowerCase();
    token.attrJoin("class", `markdown-alert markdown-alert-${alertType}`);
    token.attrSet("data-alert", alertType);
    stripInlinePrefix(inline, githubAlertPattern);
  }
}

export function enhanceTaskLists(tokens: Token[]) {
  const listStack: Token[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === "bullet_list_open") {
      listStack.push(token);
      continue;
    }
    if (token.type === "bullet_list_close") {
      listStack.pop();
      continue;
    }
    if (token.type !== "list_item_open") {
      continue;
    }

    const paragraphIndex = index + 1;
    const inline = tokens[paragraphIndex + 1];
    if (
      tokens[paragraphIndex]?.type !== "paragraph_open" ||
      inline?.type !== "inline"
    ) {
      continue;
    }

    const match = inline.content.match(taskListPattern);
    if (!match) {
      continue;
    }

    const checked = match[1].toLowerCase() === "x";
    token.attrJoin("class", "task-list-item");
    listStack.at(-1)?.attrJoin("class", "contains-task-list");
    stripInlinePrefix(inline, taskListPattern);
    inline.children = inline.children ?? [];
    inline.children.unshift(
      newInlineHtmlToken(
        inline,
        `<input class="task-list-item-checkbox" type="checkbox" disabled${checked ? " checked" : ""}> `,
      ),
    );
  }
}

function replaceMarkdownImagesWithAltText(tokens: Token[]) {
  for (const token of tokens) {
    if (token.type === "image") {
      token.type = "text";
      token.tag = "";
      token.nesting = 0;
      token.attrs = null;
      token.children = null;
      continue;
    }
    if (token.children) {
      replaceMarkdownImagesWithAltText(token.children);
    }
  }
}

export function renderMarkdownFragmentHtml(
  source: string,
  options: { images?: "render" | "altText" } = {},
): string {
  const writer = new Utf8ChunkWriter(Number.MAX_SAFE_INTEGER);
  renderMarkdownFragmentToWriter(source, writer, options);
  return writer.toString();
}

export function renderMarkdownInlineToWriter(
  source: string,
  writer: Utf8ChunkWriter,
): void {
  const env = {};
  const tokens = markdown.parseInline(source, env);
  renderMarkdownTokensToWriter(
    tokens,
    markdown.options,
    env,
    markdown.renderer,
    writer,
  );
}

export function renderMarkdownFragmentToWriter(
  source: string,
  writer: Utf8ChunkWriter,
  options: { images?: "render" | "altText" } = {},
): void {
  if (!source.trim()) {
    return;
  }

  const env = {};
  const tokens = markdown.parse(transformSimpleAdmonitions(source), env);
  enhanceGithubAlerts(tokens);
  enhanceTaskLists(tokens);
  if (options.images === "altText") {
    replaceMarkdownImagesWithAltText(tokens);
  }
  renderMarkdownTokensToWriter(
    tokens,
    markdown.options,
    env,
    markdown.renderer,
    writer,
  );
}
