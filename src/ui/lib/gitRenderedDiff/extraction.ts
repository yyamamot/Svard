import type {
  RenderedBlock,
  RenderedBlockExtractionOptions,
  RenderedBlockKind,
  RenderedListItemSnapshot,
} from "./types";
import { normalizedText } from "./text";

function blockKindForElement(element: Element): RenderedBlockKind | null {
  const tagName = element.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tagName)) {
    return "heading";
  }
  if (element.classList.contains("diagram-slot")) {
    return "diagram";
  }
  if (element.querySelector(".diagram-slot")) {
    return "diagram";
  }
  if (tagName === "img" || element.querySelector("img")) {
    return "image";
  }
  if (tagName === "p") {
    return "paragraph";
  }
  if (element.classList.contains("math-block")) {
    return "paragraph";
  }
  if (tagName === "ul" || tagName === "ol") {
    return "list";
  }
  if (tagName === "table") {
    return "table";
  }
  if (tagName === "pre") {
    return "source-block";
  }
  if (tagName === "blockquote") {
    return "blockquote";
  }
  if (
    element.classList.contains("admonitionblock") ||
    element.classList.contains("markdown-alert")
  ) {
    return "admonition";
  }
  return null;
}

function placeholderHtml(label: string): string {
  return `<div class="git-rendered-placeholder">${label}</div>`;
}

function isDiffRenderableImageSource(
  src: string | null | undefined,
  options: Pick<RenderedBlockExtractionOptions, "showExternalImages"> = {},
): boolean {
  const value = src ?? "";
  return (
    /^data:image\/(?:svg\+xml|png|jpe?g|gif|webp)(?:[;,]|$)/iu.test(value) ||
    (options.showExternalImages === true && /^https?:\/\//iu.test(value))
  );
}

function imagePlaceholderLabel(
  image: Element | null | undefined,
  options: Pick<RenderedBlockExtractionOptions, "showExternalImages"> = {},
): string {
  const alt = normalizedText(image?.getAttribute("alt"));
  const src = normalizedText(image?.getAttribute("src"));
  if (alt) {
    return `Image: ${alt}`;
  }
  if (options.showExternalImages === true && src) {
    return `Image: ${src}`;
  }
  return src ? "External image blocked" : "Image placeholder";
}

function imageElementForBlock(element: Element): Element | null {
  return element.matches("img") ? element : element.querySelector("img");
}

function imageSignatureForElement(
  element: Element,
  options: Pick<RenderedBlockExtractionOptions, "showExternalImages"> = {},
): string | undefined {
  const image = imageElementForBlock(element);
  if (!image) {
    return undefined;
  }
  const alt = normalizedText(image.getAttribute("alt"));
  const src = normalizedText(image.getAttribute("src"));
  if (!alt && !src) {
    return undefined;
  }
  const sourceKind = isDiffRenderableImageSource(src, options)
    ? "renderable"
    : "placeholder";
  return `image:${sourceKind}:${alt}:${src}`;
}

function sanitizeImagesForDiffHtml(
  element: Element,
  options: Pick<RenderedBlockExtractionOptions, "showExternalImages"> = {},
): Element | string {
  if (element.matches("img")) {
    return isDiffRenderableImageSource(element.getAttribute("src"), options)
      ? element
      : placeholderHtml(imagePlaceholderLabel(element, options));
  }

  element.querySelectorAll("img").forEach((image) => {
    if (isDiffRenderableImageSource(image.getAttribute("src"), options)) {
      return;
    }
    const replacement = element.ownerDocument.createElement("span");
    replacement.className = "git-rendered-placeholder";
    replacement.textContent = imagePlaceholderLabel(image, options);
    image.replaceWith(replacement);
  });
  return element;
}

function safeBlockHtml(
  element: Element,
  kind: RenderedBlockKind,
  options: RenderedBlockExtractionOptions = {},
): string {
  if (kind === "diagram") {
    const clone = element.cloneNode(true) as Element;
    clone.querySelectorAll("script").forEach((item) => item.remove());
    if (
      !clone.querySelector(
        ".diagram-inline,.diagram-inline-diagnostic,.diagram-inline-image,svg,img",
      )
    ) {
      return placeholderHtml("Diagram placeholder");
    }
    return clone.outerHTML;
  }
  if (kind === "image") {
    const clone = element.cloneNode(true) as Element;
    clone.querySelectorAll("script,style").forEach((item) => item.remove());
    const sanitized = sanitizeImagesForDiffHtml(clone, options);
    return typeof sanitized === "string" ? sanitized : sanitized.outerHTML;
  }

  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll("script,style").forEach((item) => item.remove());
  sanitizeImagesForDiffHtml(clone, options);
  clone.querySelectorAll(".diagram-slot").forEach((slot) => {
    const replacement = clone.ownerDocument.createElement("div");
    replacement.className = "git-rendered-placeholder";
    replacement.textContent = "Diagram placeholder";
    slot.replaceWith(replacement);
  });
  return clone.outerHTML;
}

function blockText(element: Element, kind: RenderedBlockKind): string {
  if (kind === "list") {
    return Array.from(element.children)
      .filter((child) => child.tagName.toLowerCase() === "li")
      .map((child) => normalizedText(child.textContent))
      .filter(Boolean)
      .join(" ");
  }
  return normalizedText(element.textContent);
}

function textHash(value: string): string {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function textSegmentHashes(value: string): string[] {
  const normalized = normalizedText(value).toLowerCase();
  const tokens = normalized
    .split(/[\s、。,.():/|`*_+\-[\]{}]+/u)
    .filter(Boolean);
  const segments =
    tokens.length > 1
      ? tokens
      : characterNgrams(normalized).filter((segment) => segment.length > 0);
  return Array.from(new Set(segments.map(textHash))).sort();
}

function characterNgrams(value: string): string[] {
  const compact = Array.from(value).filter(
    (character) => !/\s/u.test(character),
  );
  if (compact.length <= 2) {
    return compact.join("") ? [compact.join("")] : [];
  }
  const grams: string[] = [];
  for (let index = 0; index <= compact.length - 2; index += 1) {
    grams.push(`${compact[index]}${compact[index + 1]}`);
  }
  return grams;
}

function directListItemText(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll("ul,ol").forEach((list) => list.remove());
  return normalizedText(clone.textContent);
}

function nestedListSignature(element: Element): string {
  return Array.from(element.querySelectorAll(":scope > ul, :scope > ol"))
    .map((list) => normalizedText(list.textContent))
    .filter(Boolean)
    .join(" ");
}

function listItemSnapshots(element: Element): RenderedListItemSnapshot[] {
  if (blockKindForElement(element) !== "list") {
    return [];
  }
  return Array.from(element.children)
    .filter((child) => child.tagName.toLowerCase() === "li")
    .map((item, index) => {
      const text = normalizedText(item.textContent);
      const directText = directListItemText(item);
      const nestedSignature = nestedListSignature(item);
      return {
        index,
        normalizedTextHash: textHash(text),
        directTextHash: textHash(directText),
        nestedSignatureHash: textHash(nestedSignature),
        textSegmentHashes: textSegmentHashes(text),
        textLength: text.length,
        directTextLength: directText.length,
      };
    });
}

function shouldSkipDescendantBlock(element: Element): boolean {
  if (
    element.tagName.toLowerCase() === "img" &&
    element.parentElement &&
    blockKindForElement(element.parentElement) === "image"
  ) {
    return true;
  }
  if (
    !element.classList.contains("diagram-slot") &&
    element.parentElement?.closest(".diagram-slot")
  ) {
    return true;
  }
  if (
    element.classList.contains("diagram-slot") &&
    element.parentElement &&
    isRenderedBlockCandidateElement(element.parentElement) &&
    blockKindForElement(element.parentElement) === "diagram"
  ) {
    return true;
  }
  return Boolean(
    element.parentElement?.closest(
      "table, pre, blockquote, ul, ol, .admonitionblock, .markdown-alert, .stemblock",
    ) && !element.classList.contains("math-block"),
  );
}

function isRenderedBlockCandidateElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  return (
    /^h[1-6]$/.test(tagName) ||
    ["p", "ul", "ol", "table", "pre", "blockquote", "img"].includes(tagName) ||
    element.classList.contains("math-block") ||
    element.classList.contains("admonitionblock") ||
    element.classList.contains("markdown-alert") ||
    element.classList.contains("imageblock") ||
    element.classList.contains("diagram-slot")
  );
}

export function extractRenderedBlocksFromHtml(
  html: string,
  options: RenderedBlockExtractionOptions = {},
): RenderedBlock[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const candidates = Array.from(
    doc.body.querySelectorAll(
      "h1,h2,h3,h4,h5,h6,p,ul,ol,table,pre,blockquote,.admonitionblock,.markdown-alert,.imageblock,.diagram-slot,img,.math-block",
    ),
  );
  const blocks: RenderedBlock[] = [];
  for (const element of candidates) {
    if (shouldSkipDescendantBlock(element)) {
      continue;
    }
    const kind = blockKindForElement(element);
    if (!kind) {
      continue;
    }
    const text =
      kind === "diagram"
        ? normalizedText(element.textContent) ||
          normalizedText(element.getAttribute("data-diagram-type")) ||
          "Diagram placeholder"
        : kind === "image"
          ? normalizedText(
              element.matches("img")
                ? element.getAttribute("alt")
                : element.querySelector("img")?.getAttribute("alt"),
            ) ||
            (options.showExternalImages === true
              ? normalizedText(
                  element.matches("img")
                    ? element.getAttribute("src")
                    : element.querySelector("img")?.getAttribute("src"),
                )
              : "") ||
            "Image placeholder"
          : blockText(element, kind);
    blocks.push({
      id: `rendered-block:${blocks.length}`,
      kind,
      tagName: element.tagName.toLowerCase(),
      text,
      html: safeBlockHtml(element, kind, options),
      listItems: kind === "list" ? listItemSnapshots(element) : undefined,
      signature:
        kind === "diagram"
          ? diagramSignatureForElement(element, options.diagramSignatures)
          : kind === "image"
            ? imageSignatureForElement(element, options)
            : undefined,
    });
  }
  return blocks;
}

function diagramSignatureForElement(
  element: Element,
  signatures: ReadonlyMap<string, string> | undefined,
): string | undefined {
  if (!signatures) {
    return undefined;
  }
  const slot =
    element.classList.contains("diagram-slot") &&
    element.getAttribute("data-diagram-id")
      ? element
      : element.querySelector(".diagram-slot[data-diagram-id]");
  const id = slot?.getAttribute("data-diagram-id");
  return id ? signatures.get(id) : undefined;
}
