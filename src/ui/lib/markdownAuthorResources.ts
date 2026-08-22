import type { MarkdownAuthorHtmlResourceCandidate } from "./markdownAuthorHtml";
import {
  canonicalDocumentLinkHref,
  classifyDocumentLinkHref,
  type DocumentLinkIntent,
} from "./documentLinkNavigation";
import { classifyMarkdownAuthorImageSource } from "./localImage";

const asciiEdgeWhitespace = /^[\t\n\f\r ]+|[\t\n\f\r ]+$/gu;
const absoluteDocumentPath = /^(?:\/(?!\/)|[A-Za-z]:[\\/]|\\\\)/u;

function containsAsciiControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 0x1f || codePoint === 0x7f;
  });
}

export function classifyMarkdownAuthorLinkCandidate(
  rawHref: string,
): DocumentLinkIntent {
  const href = rawHref.replace(asciiEdgeWhitespace, "");
  if (containsAsciiControlCharacter(href)) {
    return { kind: "blocked", reason: "malformed" };
  }
  if (absoluteDocumentPath.test(href)) {
    return { kind: "blocked", reason: "unsupported" };
  }
  return classifyDocumentLinkHref(href);
}

function unwrapElement(element: Element): void {
  element.replaceWith(...Array.from(element.childNodes));
}

function imagePlaceholder(image: Element): HTMLElement {
  const placeholder = image.ownerDocument.createElement("span");
  placeholder.className = "image-placeholder";
  const alt = image.getAttribute("alt")?.trim();
  placeholder.textContent = alt ? `Image: ${alt}` : "Image blocked";
  return placeholder;
}

export function blockMarkdownAuthorLink(link: Element): void {
  unwrapElement(link);
}

export function blockMarkdownAuthorImage(image: Element): void {
  image.replaceWith(imagePlaceholder(image));
}

export function semanticizeMarkdownAuthorResourcesInPlace(
  candidates: ReadonlyMap<Element, MarkdownAuthorHtmlResourceCandidate>,
): void {
  for (const [element, candidate] of candidates) {
    if (!element.isConnected) continue;
    if (candidate.kind === "link") blockMarkdownAuthorLink(element);
    else blockMarkdownAuthorImage(element);
  }
}

export function applyPathlessMarkdownAuthorResourcePolicyInPlace(
  candidates: ReadonlyMap<Element, MarkdownAuthorHtmlResourceCandidate>,
  options: { showExternalImages: boolean },
): void {
  for (const [element, candidate] of candidates) {
    if (!element.isConnected) continue;
    if (candidate.kind === "link") {
      const intent = classifyMarkdownAuthorLinkCandidate(candidate.value);
      if (intent.kind === "fragment" || intent.kind === "external") {
        element.setAttribute("href", canonicalDocumentLinkHref(intent));
      } else {
        blockMarkdownAuthorLink(element);
      }
      continue;
    }
    const intent = classifyMarkdownAuthorImageSource(candidate.value);
    if (intent.kind === "external" && options.showExternalImages) {
      element.setAttribute("src", intent.url);
      element.setAttribute("data-image-path", intent.url);
      element.setAttribute("data-image-url", intent.url);
    } else {
      blockMarkdownAuthorImage(element);
    }
  }
}
