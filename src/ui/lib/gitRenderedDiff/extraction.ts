import type {
  RenderedBlock,
  RenderedBlockExtractionOptions,
  RenderedBlockKind,
  RenderedListItemSnapshot,
  RenderedStructuredChildSnapshot,
  RenderedTableRowSnapshot,
} from "./types";
import { normalizedText } from "./text";

function blockKindForElement(element: Element): RenderedBlockKind | null {
  const tagName = element.tagName.toLowerCase();
  if (/^h[1-6]$/.test(tagName)) {
    return "heading";
  }
  if (isDiagramRoot(element)) {
    return "diagram";
  }
  if (element.querySelector(".diagram-slot,.diagram-inline")) {
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
  if (tagName === "dl" || element.classList.contains("dlist")) {
    return "definition-list";
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
  if (kind === "definition-list") {
    return structuredChildSnapshots(element)
      .map((child) => child.normalizedTextHash)
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

function tableRowSnapshots(
  element: Element,
): RenderedTableRowSnapshot[] | undefined {
  if (blockKindForElement(element) !== "table") {
    return undefined;
  }
  if (
    element.querySelector("table") !== null ||
    Array.from(element.querySelectorAll("th,td")).some((cell) => {
      const colspan = Number(cell.getAttribute("colspan") ?? "1");
      const rowspan = Number(cell.getAttribute("rowspan") ?? "1");
      return colspan > 1 || rowspan > 1;
    })
  ) {
    return undefined;
  }
  const table = element as HTMLTableElement;
  return Array.from(table.rows).map((row, rowIndex) => {
    const cells = Array.from(row.cells).map((cell, cellIndex) => {
      const text = normalizedText(cell.textContent);
      return {
        index: cellIndex,
        normalizedTextHash: textHash(text),
        textSegmentHashes: textSegmentHashes(text),
        textLength: text.length,
        header: cell.tagName.toLowerCase() === "th",
      };
    });
    const rowText = normalizedText(
      cells.map((cell) => cell.normalizedTextHash).join(" "),
    );
    return {
      index: rowIndex,
      normalizedTextHash: textHash(rowText),
      cellCount: cells.length,
      cells,
    };
  });
}

function definitionListElement(element: Element): Element | null {
  if (element.tagName.toLowerCase() === "dl") {
    return element;
  }
  return element.querySelector(":scope > dl");
}

function definitionListSnapshots(
  element: Element,
): RenderedStructuredChildSnapshot[] {
  const list = definitionListElement(element);
  if (!list) {
    return [];
  }
  const snapshots: RenderedStructuredChildSnapshot[] = [];
  const children = Array.from(list.children);
  let index = 0;
  while (index < children.length) {
    const term = children[index];
    if (!term || term.tagName.toLowerCase() !== "dt") {
      index += 1;
      continue;
    }
    const descriptions: Element[] = [];
    index += 1;
    while (
      index < children.length &&
      children[index]?.tagName.toLowerCase() === "dd"
    ) {
      descriptions.push(children[index] as Element);
      index += 1;
    }
    const termText = normalizedText(term.textContent);
    const descriptionText = normalizedText(
      descriptions.map((item) => item.textContent).join(" "),
    );
    const text = normalizedText(`${termText} ${descriptionText}`);
    snapshots.push({
      index: snapshots.length,
      role: "definition-item",
      normalizedTextHash: textHash(text),
      primaryHash: textHash(termText),
      secondaryHash: textHash(descriptionText),
      textSegmentHashes: textSegmentHashes(text),
      textLength: text.length,
    });
  }
  return snapshots;
}

function admonitionType(element: Element): string {
  if (element.classList.contains("markdown-alert")) {
    const match = Array.from(element.classList).find((className) =>
      className.startsWith("markdown-alert-"),
    );
    return match ?? "markdown-alert";
  }
  const match = Array.from(element.classList).find((className) =>
    ["caution", "important", "note", "tip", "warning"].includes(className),
  );
  return match ?? "admonition";
}

function admonitionContentElement(element: Element): Element | null {
  if (element.classList.contains("admonitionblock")) {
    return element.querySelector("td.content");
  }
  if (element.classList.contains("markdown-alert")) {
    return element;
  }
  return null;
}

function markdownAlertContentText(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  clone
    .querySelectorAll(".markdown-alert-title")
    .forEach((item) => item.remove());
  return normalizedText(clone.textContent);
}

function admonitionContentSnapshots(
  element: Element,
): RenderedStructuredChildSnapshot[] {
  const content = admonitionContentElement(element);
  if (!content) {
    return [];
  }
  const type = admonitionType(element);
  const text = element.classList.contains("markdown-alert")
    ? markdownAlertContentText(element)
    : normalizedText(content.textContent);
  return [
    {
      index: 0,
      role: "admonition-content",
      normalizedTextHash: textHash(text),
      primaryHash: textHash(type),
      secondaryHash: textHash(text),
      textSegmentHashes: textSegmentHashes(text),
      textLength: text.length,
    },
  ];
}

function structuredChildSnapshots(
  element: Element,
): RenderedStructuredChildSnapshot[] {
  const kind = blockKindForElement(element);
  if (kind === "definition-list") {
    return definitionListSnapshots(element);
  }
  if (kind === "admonition") {
    return admonitionContentSnapshots(element);
  }
  return [];
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
    !isDiagramRoot(element) &&
    element.parentElement?.closest(".diagram-slot,.diagram-inline")
  ) {
    return true;
  }
  if (
    isDiagramRoot(element) &&
    element.parentElement &&
    isRenderedBlockCandidateElement(element.parentElement) &&
    blockKindForElement(element.parentElement) === "diagram"
  ) {
    return true;
  }
  return Boolean(
    element.parentElement?.closest(
      "table, pre, blockquote, ul, ol, dl, .dlist, .admonitionblock, .markdown-alert, .stemblock",
    ) && !element.classList.contains("math-block"),
  );
}

function isRenderedBlockCandidateElement(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  return (
    /^h[1-6]$/.test(tagName) ||
    ["p", "ul", "ol", "dl", "table", "pre", "blockquote", "img"].includes(
      tagName,
    ) ||
    element.classList.contains("math-block") ||
    element.classList.contains("dlist") ||
    element.classList.contains("admonitionblock") ||
    element.classList.contains("markdown-alert") ||
    element.classList.contains("imageblock") ||
    isDiagramRoot(element)
  );
}

export function extractRenderedBlocksFromHtml(
  html: string,
  options: RenderedBlockExtractionOptions = {},
): RenderedBlock[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const candidates = Array.from(
    doc.body.querySelectorAll(
      "h1,h2,h3,h4,h5,h6,p,ul,ol,dl,.dlist,table,pre,blockquote,.admonitionblock,.markdown-alert,.imageblock,.diagram-slot,.diagram-inline,img,.math-block",
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
      structuredChildren:
        kind === "definition-list" || kind === "admonition"
          ? structuredChildSnapshots(element)
          : undefined,
      tableRows: kind === "table" ? tableRowSnapshots(element) : undefined,
      signature:
        kind === "diagram"
          ? diagramSignatureForElement(element, options.diagramSignatures)
          : kind === "image"
            ? imageSignatureForElement(element, options)
            : undefined,
      diagram:
        kind === "diagram"
          ? diagramSourceForElement(element, options.diagramSources)
          : undefined,
    });
  }
  return blocks;
}

function diagramSourceForElement(
  element: Element,
  sources: ReadonlyMap<string, { type: string; source: string }> | undefined,
): { type: string; source: string } | undefined {
  if (!sources) return undefined;
  const slot = diagramElementWithId(element);
  const id = slot?.getAttribute("data-diagram-id");
  return id ? sources.get(id) : undefined;
}

function diagramSignatureForElement(
  element: Element,
  signatures: ReadonlyMap<string, string> | undefined,
): string | undefined {
  if (!signatures) {
    return undefined;
  }
  const slot = diagramElementWithId(element);
  const id = slot?.getAttribute("data-diagram-id");
  return id ? signatures.get(id) : undefined;
}

function isDiagramRoot(element: Element) {
  return (
    element.classList.contains("diagram-slot") ||
    element.classList.contains("diagram-inline")
  );
}

function diagramElementWithId(element: Element) {
  return isDiagramRoot(element) && element.hasAttribute("data-diagram-id")
    ? element
    : element.querySelector(
        ".diagram-slot[data-diagram-id],.diagram-inline[data-diagram-id]",
      );
}
