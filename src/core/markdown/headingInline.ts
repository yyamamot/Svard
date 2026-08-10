import type Token from "markdown-it/lib/token.mjs";

import type { HeadingInlineNode } from "../types";

interface HeadingInlineMetadata {
  text: string;
  inline?: HeadingInlineNode[];
}

type ContainerNode = Extract<
  HeadingInlineNode,
  { type: "strong" | "emphasis" }
>;

interface Frame {
  type: "root" | ContainerNode["type"];
  children: HeadingInlineNode[];
}

function appendText(children: HeadingInlineNode[], value: string) {
  if (!value) {
    return;
  }
  const previous = children.at(-1);
  if (previous?.type === "text") {
    previous.value += value;
    return;
  }
  children.push({ type: "text", value });
}

function closeContainer(stack: Frame[], type: ContainerNode["type"]) {
  const frame = stack.at(-1);
  if (!frame || frame.type !== type || stack.length === 1) {
    return;
  }
  stack.pop();
  if (frame.children.length > 0) {
    stack.at(-1)!.children.push({ type, children: frame.children });
  }
}

function safeGeneratedInlineText(token: Token): string | undefined {
  const metadata = token.meta as { svardHeadingText?: unknown } | null;
  return typeof metadata?.svardHeadingText === "string"
    ? metadata.svardHeadingText
    : undefined;
}

function plainText(nodes: HeadingInlineNode[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text" || node.type === "code") {
        return node.value;
      }
      return plainText(node.children);
    })
    .join("");
}

function hasFormatting(nodes: HeadingInlineNode[]): boolean {
  return nodes.some((node) => node.type !== "text");
}

export function headingInlineMetadata(
  tokens: Token[] | null | undefined,
): HeadingInlineMetadata {
  const root: Frame = { type: "root", children: [] };
  const stack: Frame[] = [root];

  for (const token of tokens ?? []) {
    const children = stack.at(-1)!.children;
    switch (token.type) {
      case "text":
        appendText(children, token.content);
        break;
      case "code_inline":
        children.push({ type: "code", value: token.content });
        break;
      case "strong_open":
        stack.push({ type: "strong", children: [] });
        break;
      case "strong_close":
        closeContainer(stack, "strong");
        break;
      case "em_open":
        stack.push({ type: "emphasis", children: [] });
        break;
      case "em_close":
        closeContainer(stack, "emphasis");
        break;
      case "image":
        appendText(children, token.content);
        break;
      case "softbreak":
      case "hardbreak":
        appendText(children, " ");
        break;
      case "html_inline": {
        const safeText = safeGeneratedInlineText(token);
        if (safeText) {
          appendText(children, safeText);
        }
        break;
      }
      default:
        if (token.nesting === 0) {
          appendText(children, token.content);
        }
        break;
    }
  }

  while (stack.length > 1) {
    const frame = stack.pop()!;
    for (const child of frame.children) {
      root.children.push(child);
    }
  }

  const text = plainText(root.children).replace(/\s+/gu, " ").trim();
  return {
    text,
    ...(hasFormatting(root.children) ? { inline: root.children } : {}),
  };
}
