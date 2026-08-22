import { renderMathBlock, renderMathInline } from "../../../core/math";
import { markSafeHtml, setElementSafeHtml, type SafeHtml } from "../safeHtml";

function htmlFragment(doc: Document, html: SafeHtml): DocumentFragment {
  const template = doc.createElement("template");
  setElementSafeHtml(template, html);
  return template.content;
}

function markRenderedMath(
  container: ParentNode,
  source: string,
  display: "inline" | "block",
) {
  const katex = container.querySelector<HTMLElement>(".katex");
  if (!katex) return;
  katex.setAttribute("data-math-source", source);
  katex.setAttribute("data-math-display", display);
}

function replaceAsciiDocInlineStemMath(doc: Document) {
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    const text = walker.currentNode as Text;
    const parent = text.parentElement;
    if (!parent || parent.closest("pre, code, .katex, .math-render-error")) {
      continue;
    }
    if (text.nodeValue?.includes("\\$")) {
      textNodes.push(text);
    }
  }

  const stemPattern = /\\+\$([\s\S]+?)\\+\$/g;
  for (const text of textNodes) {
    const value = text.nodeValue ?? "";
    stemPattern.lastIndex = 0;
    if (!stemPattern.test(value)) {
      continue;
    }
    stemPattern.lastIndex = 0;
    const fragment = doc.createDocumentFragment();
    let cursor = 0;
    for (const match of value.matchAll(stemPattern)) {
      const index = match.index ?? 0;
      if (index > cursor) {
        fragment.append(doc.createTextNode(value.slice(cursor, index)));
      }
      const wrapper = doc.createElement("span");
      wrapper.className = "math-inline";
      wrapper.append(
        htmlFragment(doc, markSafeHtml(renderMathInline(match[1].trim()))),
      );
      markRenderedMath(wrapper, match[1].trim(), "inline");
      fragment.append(wrapper);
      cursor = index + match[0].length;
    }
    if (cursor < value.length) {
      fragment.append(doc.createTextNode(value.slice(cursor)));
    }
    text.replaceWith(fragment);
  }
}

function replaceAsciiDocStemBlocks(doc: Document) {
  doc.querySelectorAll(".stemblock > .content").forEach((content) => {
    const text = content.textContent?.trim() ?? "";
    if (!text.includes("\\$")) {
      return;
    }
    const mathSource = text
      .replace(/\\\\\$[ \t]*\r?\n[ \t]*\\\$/g, "\\\\\n")
      .replace(/\\+\$/g, "")
      .trim();
    content.replaceChildren(
      htmlFragment(doc, markSafeHtml(renderMathBlock(mathSource))),
    );
    markRenderedMath(content, mathSource, "block");
    content.classList.add("math-block");
    content.setAttribute("data-review-id", "math-block");
  });
}

export function renderAsciiDocStemMath(doc: Document) {
  replaceAsciiDocStemBlocks(doc);
  replaceAsciiDocInlineStemMath(doc);
}

export function renderMarkdownMath(doc: Document) {
  doc
    .querySelectorAll<HTMLElement>(".math-inline[data-math-source]")
    .forEach((element) => {
      const source = element.getAttribute("data-math-source")?.trim();
      if (!source) {
        return;
      }
      element.replaceChildren(
        htmlFragment(doc, markSafeHtml(renderMathInline(source))),
      );
      markRenderedMath(element, source, "inline");
    });

  doc
    .querySelectorAll<HTMLElement>(".math-block[data-math-source]")
    .forEach((element) => {
      const source = element.getAttribute("data-math-source")?.trim();
      if (!source) {
        return;
      }
      element.replaceChildren(
        htmlFragment(doc, markSafeHtml(renderMathBlock(source))),
      );
      markRenderedMath(element, source, "block");
    });
}
