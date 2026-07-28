import type {
  DocumentPayload,
  DocumentSelectionSnapshot,
  RenderResult,
  SelectionBlock,
  SelectionCodeBlock,
  SelectionDiagnostic,
  SelectionImageBlock,
  SelectionImageResource,
  SelectionProseBlock,
  SelectionProseRole,
  SelectionProvenance,
  SelectionTableBlock,
  SelectionTableCell,
} from "../../core/types";
import { maximumSelectionBytes } from "../../core/types/selection";
import { sectionLabelForRange } from "./locationReference";
import { selectionImageToPng } from "./imageClipboard";

const excludedSelector =
  '[data-selection-exclude], [hidden], [aria-hidden="true"], script, style, iframe, form, input, textarea, select, button';
const unsupportedSelector =
  "iframe,object,embed,video,audio,canvas,form,input,textarea,select";
const blockSelector = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "ul",
  "ol",
  "dl",
  "blockquote",
  ".admonitionblock",
  ".admonition",
  ".markdown-alert",
  ".source-block-frame",
  "pre",
  "table",
  ".imageblock",
  "figure",
  ".diagram-slot",
  ".diagram-inline",
  ".diagram-inline-image",
  ".katex-display",
].join(",");

export interface ExtractDocumentSelectionInput {
  article: HTMLElement;
  document: DocumentPayload;
  range: Range;
  renderResult?: Pick<
    RenderResult,
    "headings" | "sourceSelectionBlocks"
  > | null;
  snapshotId?: string;
}

export function cloneViewerSelectionRange(
  article: HTMLElement | null,
): Range | null {
  const selection = window.getSelection();
  if (!article || !selection?.rangeCount || selection.isCollapsed) return null;
  const range = selection.getRangeAt(0);
  if (
    !nodeInside(article, range.startContainer) ||
    !nodeInside(article, range.endContainer)
  ) {
    return null;
  }
  return range.cloneRange();
}

export function revealDocumentSelection(
  article: HTMLElement | null,
  snapshot: DocumentSelectionSnapshot,
): boolean {
  if (!article || !snapshot.plainText) return false;
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.parentElement?.closest(excludedSelector)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT;
    },
  });
  let node = walker.nextNode();
  while (node) {
    nodes.push(node as Text);
    node = walker.nextNode();
  }
  const combined = nodes.map((text) => text.data).join("");
  const start = combined.indexOf(snapshot.plainText);
  if (start < 0 || combined.indexOf(snapshot.plainText, start + 1) >= 0) {
    return false;
  }
  const startPoint = textPointForOffset(nodes, start);
  const endPoint = textPointForOffset(nodes, start + snapshot.plainText.length);
  if (!startPoint || !endPoint) return false;
  const range = document.createRange();
  range.setStart(startPoint.node, startPoint.offset);
  range.setEnd(endPoint.node, endPoint.offset);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  startPoint.node.parentElement?.scrollIntoView({
    block: "center",
    behavior: "smooth",
  });
  return true;
}

export async function extractDocumentSelection({
  article,
  document,
  range,
  renderResult,
  snapshotId = crypto.randomUUID(),
}: ExtractDocumentSelectionInput): Promise<DocumentSelectionSnapshot> {
  const diagnostics: SelectionDiagnostic[] = [];
  if (
    range.collapsed ||
    !nodeInside(article, range.startContainer) ||
    !nodeInside(article, range.endContainer)
  ) {
    diagnostics.push({
      severity: "blocking",
      code: range.collapsed ? "collapsed" : "outsideViewer",
      message: "Select content inside one document viewer.",
    });
    return emptySnapshot(snapshotId, document, diagnostics);
  }

  const fragment = range.cloneContents();
  if (fragment.querySelector(unsupportedSelector)) {
    diagnostics.push({
      severity: "blocking",
      code: "unsupportedElement",
      message:
        "The selection contains embedded content that cannot be attached.",
    });
  }

  const candidates = topLevelSelectionBlocks(article).filter((element) =>
    intersects(range, element),
  );
  const blocks: SelectionBlock[] = [];
  const imageResources: SelectionImageResource[] = [];
  for (const element of candidates) {
    if (element.matches("table")) {
      blocks.push(extractTable(element as HTMLTableElement, range));
      continue;
    }
    if (isImageBlock(element)) {
      const extracted = await extractImageRichBlock(element, range);
      for (const item of extracted) {
        if (!item) {
          diagnostics.push({
            severity: "blocking",
            code: "imageUnavailable",
            message: "An image in the selection could not be prepared.",
          });
        } else if ("resource" in item) {
          blocks.push(item.block);
          imageResources.push(item.resource);
        } else {
          blocks.push(item.block);
        }
      }
      continue;
    }
    if (isCodeBlock(element)) {
      blocks.push(extractCodeBlock(element, range));
      continue;
    }
    const prose = extractProseBlock(element, range);
    if (prose.plainText || prose.markdown) blocks.push(prose);
  }

  const plainText = visibleSelectionText(range);
  const serializedBytes = new TextEncoder().encode(
    blocks.map(selectionBlockText).filter(Boolean).join("\n\n"),
  ).byteLength;
  if (serializedBytes > maximumSelectionBytes) {
    diagnostics.push({
      severity: "blocking",
      code: "selectionTooLarge",
      message: "The selection is larger than 256 KiB.",
    });
  }
  const imageBytes = imageResources.reduce(
    (total, resource) => total + resource.byteLength,
    0,
  );
  if (imageResources.length > 4 || imageBytes > 20 * 1024 * 1024) {
    diagnostics.push({
      severity: "blocking",
      code: "turnLimitExceeded",
      message:
        imageResources.length > 4
          ? "A selection can contain no more than 4 images."
          : "The selected images are larger than 20 MiB.",
    });
  }
  if (
    !blocks.length &&
    !diagnostics.some((item) => item.severity === "blocking")
  ) {
    diagnostics.push({
      severity: "blocking",
      code: "unsupportedElement",
      message: "The selected content could not be represented safely.",
    });
  }

  const provenance = selectionProvenance(
    candidates,
    document,
    renderResult?.sourceSelectionBlocks ?? [],
    plainText,
  );
  if (!provenance.length || provenance.some((item) => !item.exact)) {
    diagnostics.push({
      severity: "warning",
      code: "sourceAmbiguous",
      message:
        "The visible selection is exact, but its original source range is ambiguous.",
    });
  }

  return {
    snapshotId,
    documentPath: document.path,
    documentRevision: document.updatedAt,
    sectionLabel: sectionLabelForRange({
      article,
      range,
      headings: renderResult?.headings,
    }),
    plainText,
    blocks,
    imageResources,
    provenance,
    diagnostics,
  };
}

export function selectionHasBlockingDiagnostic(
  snapshot: DocumentSelectionSnapshot,
): boolean {
  return snapshot.diagnostics.some((item) => item.severity === "blocking");
}

export function selectionSnapshotText(
  snapshot: DocumentSelectionSnapshot,
): string {
  return snapshot.blocks.map(selectionBlockText).filter(Boolean).join("\n\n");
}

export function selectionPlainCopy(
  snapshot: DocumentSelectionSnapshot,
): string {
  if (!snapshot.imageResources.length) return snapshot.plainText;
  return snapshot.blocks
    .map((block) => {
      if (block.type === "image") return `[Image: ${block.label}]`;
      if (block.type === "prose") return block.plainText;
      if (block.type === "code") return block.text;
      return block.rows
        .map((row) =>
          row.cells
            .map((cell) =>
              cell.blocks
                .map((item) =>
                  item.type === "code" ? item.text : item.plainText,
                )
                .join(" "),
            )
            .join("\t"),
        )
        .join("\n");
    })
    .filter(Boolean)
    .join("\n\n");
}

export function selectionTextReference(
  snapshot: DocumentSelectionSnapshot,
): string {
  const first = snapshot.provenance[0];
  const location = first
    ? `${first.sourcePath}:${first.startLine}${
        first.endLine === first.startLine ? "" : `-${first.endLine}`
      }`
    : snapshot.documentPath;
  return [
    `File: ${location}`,
    snapshot.diffContext
      ? `Revision: ${snapshot.diffContext.revisionLabel} (${snapshot.diffContext.side})`
      : "",
    snapshot.diffContext
      ? `Comparison: ${snapshot.diffContext.comparisonLabel}`
      : "",
    snapshot.sectionLabel ? `Section: ${snapshot.sectionLabel}` : "",
    "Selected content:",
    selectionSnapshotText(snapshot),
  ]
    .filter(Boolean)
    .join("\n");
}

export function selectionOriginalTextReference(
  snapshot: DocumentSelectionSnapshot,
  source: string,
): string | undefined {
  if (
    snapshot.provenance.length !== 1 ||
    !snapshot.provenance[0].exact ||
    !snapshot.plainText
  ) {
    return undefined;
  }
  const provenance = snapshot.provenance[0];
  const lines = source.replace(/\r\n?/gu, "\n").split("\n");
  const sourceSlice = lines
    .slice(provenance.startLine - 1, provenance.endLine)
    .join("\n");
  const first = sourceSlice.indexOf(snapshot.plainText);
  if (
    first < 0 ||
    sourceSlice.indexOf(
      snapshot.plainText,
      first + snapshot.plainText.length,
    ) >= 0
  ) {
    return undefined;
  }
  return [
    `File: ${provenance.sourcePath}:${provenance.startLine}${
      provenance.endLine === provenance.startLine
        ? ""
        : `-${provenance.endLine}`
    }`,
    "Original source:",
    sourceSlice.slice(first, first + snapshot.plainText.length),
  ].join("\n");
}

function emptySnapshot(
  snapshotId: string,
  document: DocumentPayload,
  diagnostics: SelectionDiagnostic[],
): DocumentSelectionSnapshot {
  return {
    snapshotId,
    documentPath: document.path,
    documentRevision: document.updatedAt,
    plainText: "",
    blocks: [],
    imageResources: [],
    provenance: [],
    diagnostics,
  };
}

function nodeInside(article: HTMLElement, node: Node) {
  return node === article || article.contains(node);
}

function textPointForOffset(nodes: Text[], absoluteOffset: number) {
  let traversed = 0;
  for (const node of nodes) {
    const next = traversed + node.data.length;
    if (absoluteOffset <= next) {
      return {
        node,
        offset: Math.max(
          0,
          Math.min(node.data.length, absoluteOffset - traversed),
        ),
      };
    }
    traversed = next;
  }
  return undefined;
}

function intersects(range: Range, element: Element) {
  try {
    return range.intersectsNode(element);
  } catch {
    return false;
  }
}

function topLevelSelectionBlocks(article: HTMLElement) {
  const all = Array.from(article.querySelectorAll<HTMLElement>(blockSelector));
  return all.filter(
    (element) =>
      !element.closest(excludedSelector) &&
      !all.some((other) => other !== element && other.contains(element)),
  );
}

function restrictedFragment(element: HTMLElement, selection: Range) {
  const range = document.createRange();
  range.selectNodeContents(element);
  if (element.contains(selection.startContainer)) {
    range.setStart(selection.startContainer, selection.startOffset);
  }
  if (element.contains(selection.endContainer)) {
    range.setEnd(selection.endContainer, selection.endOffset);
  }
  return { fragment: range.cloneContents(), text: range.toString() };
}

function extractProseBlock(
  element: HTMLElement,
  selection: Range,
): SelectionProseBlock {
  const { fragment, text } = restrictedFragment(element, selection);
  removeExcluded(fragment);
  return {
    type: "prose",
    role: proseRole(element),
    markdown: serializeChildren(fragment).trim(),
    plainText: visibleFragmentText(fragment, text),
  };
}

function proseRole(element: HTMLElement): SelectionProseRole {
  if (/^H[1-6]$/u.test(element.tagName)) return "heading";
  if (element.matches("ul,ol")) return "list";
  if (element.matches("dl")) return "definitionList";
  if (element.matches("blockquote")) return "quote";
  if (element.matches(".admonitionblock,.admonition,.markdown-alert"))
    return "admonition";
  return "paragraph";
}

function isCodeBlock(element: HTMLElement) {
  return (
    element.matches(".source-block-frame,pre") && !element.closest("table")
  );
}

function extractCodeBlock(
  element: HTMLElement,
  selection: Range,
): SelectionCodeBlock {
  const pre = element.matches("pre")
    ? element
    : element.querySelector<HTMLElement>("pre");
  const target = pre ?? element;
  const { text } = restrictedFragment(target, selection);
  const language =
    Array.from(target.querySelector("code")?.classList ?? [])
      .find((name) => name.startsWith("language-"))
      ?.slice("language-".length) || undefined;
  return { type: "code", text, language };
}

function extractTable(
  table: HTMLTableElement,
  selection: Range,
): SelectionTableBlock {
  return {
    type: "table",
    rows: Array.from(table.rows)
      .map((row) => ({
        cells: Array.from(row.cells)
          .filter((cell) => intersects(selection, cell))
          .map((cell): SelectionTableCell => {
            const { fragment, text } = restrictedFragment(cell, selection);
            removeExcluded(fragment);
            const code = cell.querySelector("pre");
            const blocks: Array<SelectionProseBlock | SelectionCodeBlock> =
              code && intersects(selection, code)
                ? [
                    {
                      type: "code",
                      text: restrictedFragment(code, selection).text,
                    },
                  ]
                : [
                    {
                      type: "prose",
                      role: cell.querySelector("ul,ol") ? "list" : "paragraph",
                      markdown: serializeChildren(fragment).trim(),
                      plainText: visibleFragmentText(fragment, text),
                    },
                  ];
            return {
              rowSpan: cell.rowSpan || 1,
              columnSpan: cell.colSpan || 1,
              blocks,
            };
          }),
      }))
      .filter((row) => row.cells.length > 0),
  };
}

function isImageBlock(element: HTMLElement) {
  return Boolean(
    element.matches(
      ".imageblock,figure,.diagram-slot,.diagram-inline,.diagram-inline-image",
    ) || element.querySelector("img,svg"),
  );
}

async function extractImageBlock(
  visual: HTMLImageElement | SVGElement,
  element: HTMLElement,
): Promise<
  { block: SelectionImageBlock; resource: SelectionImageResource } | undefined
> {
  if (visual instanceof HTMLImageElement && !selectionImageIsLocal(visual)) {
    return undefined;
  }
  try {
    const blob = await selectionImageToPng(visual);
    const base64 = await blobAsBase64(blob);
    const imageId = crypto.randomUUID();
    const label =
      visual.getAttribute("alt")?.trim() ||
      element.querySelector("figcaption,.title")?.textContent?.trim() ||
      (visual instanceof SVGElement ? "Diagram" : "Image");
    return {
      block: {
        type: "image",
        imageId,
        kind: visual instanceof SVGElement ? "diagram" : "image",
        label,
      },
      resource: {
        imageId,
        displayLabel: label,
        mediaType: "image/png",
        base64,
        byteLength: blob.size,
      },
    };
  } catch {
    return undefined;
  }
}

type ExtractedImageRichBlock =
  | { block: SelectionProseBlock }
  | { block: SelectionImageBlock; resource: SelectionImageResource }
  | undefined;

async function extractImageRichBlock(
  element: HTMLElement,
  selection: Range,
): Promise<ExtractedImageRichBlock[]> {
  const visuals = (
    element.matches("img,svg")
      ? [element as HTMLImageElement | SVGElement]
      : Array.from(
          element.querySelectorAll<HTMLImageElement | SVGElement>("img,svg"),
        )
  ).filter(
    (visual) =>
      intersects(selection, visual) &&
      !visual.parentElement?.closest("svg")?.contains(visual),
  );
  if (visuals.length === 0) return [undefined];
  if (element.matches("img,svg")) {
    return [await extractImageBlock(visuals[0], element)];
  }

  const selected = rangeRestrictedToElement(element, selection);
  const extracted: ExtractedImageRichBlock[] = [];
  let startContainer = selected.startContainer;
  let startOffset = selected.startOffset;
  for (const visual of visuals) {
    const before = selected.cloneRange();
    try {
      before.setStart(startContainer, startOffset);
      before.setEndBefore(visual);
      appendSelectedProse(extracted, element, before);
    } catch {
      return [undefined];
    }
    extracted.push(await extractImageBlock(visual, element));
    const afterVisual = document.createRange();
    afterVisual.setStartAfter(visual);
    startContainer = afterVisual.startContainer;
    startOffset = afterVisual.startOffset;
  }
  const after = selected.cloneRange();
  try {
    after.setStart(startContainer, startOffset);
    appendSelectedProse(extracted, element, after);
  } catch {
    return [undefined];
  }
  return extracted;
}

function appendSelectedProse(
  extracted: ExtractedImageRichBlock[],
  element: HTMLElement,
  range: Range,
) {
  if (range.collapsed) return;
  const fragment = range.cloneContents();
  removeExcluded(fragment);
  const plainText = visibleFragmentText(fragment, range.toString());
  const markdown = serializeChildren(fragment).trim();
  if (!plainText && !markdown) return;
  extracted.push({
    block: {
      type: "prose",
      role: proseRole(element),
      markdown,
      plainText,
    },
  });
}

function rangeRestrictedToElement(element: HTMLElement, selection: Range) {
  const range = document.createRange();
  range.selectNodeContents(element);
  if (element.contains(selection.startContainer)) {
    range.setStart(selection.startContainer, selection.startOffset);
  }
  if (element.contains(selection.endContainer)) {
    range.setEnd(selection.endContainer, selection.endOffset);
  }
  return range;
}

function selectionImageIsLocal(image: HTMLImageElement) {
  const source = image.currentSrc || image.src;
  if (/^https?:/iu.test(source)) return false;
  if (!/^data:image\//iu.test(source)) return true;
  const originalSource = image.getAttribute("data-image-path")?.trim();
  if (originalSource && !/^data:/iu.test(originalSource)) return true;
  return Boolean(
    image.matches(
      ".diagram-inline-image,[data-review-id='diagram-inline-image']",
    ) ||
    image.closest(
      ".diagram-inline-image,[data-review-id='diagram-inline-image']",
    ),
  );
}

function blobAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Image could not be read."));
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      resolve(value.slice(value.indexOf(",") + 1));
    };
    reader.readAsDataURL(blob);
  });
}

function selectionProvenance(
  candidates: HTMLElement[],
  document: DocumentPayload,
  blocks: NonNullable<RenderResult["sourceSelectionBlocks"]>,
  selectedText: string,
): SelectionProvenance[] {
  return candidates.map((element) => {
    const id =
      element.getAttribute("data-source-selection-block-id") ??
      element
        .querySelector<HTMLElement>("[data-source-selection-block-id]")
        ?.getAttribute("data-source-selection-block-id");
    const mapped = id ? blocks.find((block) => block.id === id) : undefined;
    const sourcePath = mapped?.sourceLocation?.sourcePath ?? document.path;
    const startLine = mapped?.startLine ?? 1;
    const endLine = mapped?.endLine ?? mapped?.startLine ?? 1;
    const sourceLines = document.source.replace(/\r\n?/gu, "\n").split("\n");
    const sourceSlice =
      sourcePath === document.path
        ? sourceLines.slice(startLine - 1, endLine).join("\n")
        : "";
    const relativeOffset =
      mapped && candidates.length === 1 && selectedText
        ? sourceSlice.indexOf(selectedText)
        : -1;
    const exact =
      relativeOffset >= 0 &&
      sourceSlice.indexOf(selectedText, relativeOffset + selectedText.length) <
        0;
    const absoluteStart =
      exact && sourcePath === document.path
        ? sourceLines
            .slice(0, startLine - 1)
            .reduce((total, line) => total + line.length + 1, 0) +
          relativeOffset
        : undefined;
    return {
      sourcePath,
      startLine,
      endLine,
      startOffset: absoluteStart,
      endOffset:
        absoluteStart === undefined
          ? undefined
          : absoluteStart + selectedText.length,
      exact,
    };
  });
}

function selectionBlockText(block: SelectionBlock): string {
  if (block.type === "prose") return block.markdown || block.plainText;
  if (block.type === "code") {
    return `\`\`\`${block.language ?? ""}\n${block.text}\n\`\`\``;
  }
  if (block.type === "image") return `[Image: ${block.label}]`;
  return tableMarkdown(block);
}

function tableMarkdown(table: SelectionTableBlock) {
  const rectangular = table.rows.every((row) =>
    row.cells.every((cell) => cell.rowSpan === 1 && cell.columnSpan === 1),
  );
  if (!rectangular) {
    return table.rows
      .map((row, rowIndex) =>
        row.cells
          .map(
            (cell, columnIndex) =>
              `Row ${rowIndex + 1}, column ${columnIndex + 1}${
                cell.rowSpan > 1 ? `, row span ${cell.rowSpan}` : ""
              }${cell.columnSpan > 1 ? `, column span ${cell.columnSpan}` : ""}: ${cell.blocks
                .map(selectionBlockText)
                .join(" ")}`,
          )
          .join("\n"),
      )
      .join("\n");
  }
  const rows = table.rows.map((row) =>
    row.cells.map((cell) =>
      cell.blocks
        .map(selectionBlockText)
        .join(" ")
        .replace(/\|/gu, "\\|")
        .replace(/\n/gu, "<br>"),
    ),
  );
  if (!rows.length) return "";
  const width = Math.max(...rows.map((row) => row.length));
  const normalized = rows.map((row) => [
    ...row,
    ...Array.from({ length: width - row.length }, () => ""),
  ]);
  return [
    `| ${normalized[0].join(" | ")} |`,
    `| ${Array.from({ length: width }, () => "---").join(" | ")} |`,
    ...normalized.slice(1).map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function removeExcluded(root: DocumentFragment) {
  root
    .querySelectorAll(excludedSelector)
    .forEach((element) => element.remove());
  root.querySelectorAll(".katex-html").forEach((element) => element.remove());
}

function visibleSelectionText(range: Range) {
  const fragment = range.cloneContents();
  if (!fragment.querySelector(".katex")) {
    return normalizeVisibleText(range.toString());
  }
  return visibleFragmentText(fragment, range.toString());
}

function visibleFragmentText(root: DocumentFragment, fallback: string) {
  const fragment = root.cloneNode(true) as DocumentFragment;
  removeExcluded(fragment);
  fragment.querySelectorAll(".katex").forEach((element) => {
    const tex = element
      .querySelector('annotation[encoding="application/x-tex"]')
      ?.textContent?.trim();
    element.replaceWith(
      document.createTextNode(tex || element.textContent || ""),
    );
  });
  return normalizeVisibleText(fragment.textContent ?? fallback);
}

function serializeChildren(node: Node): string {
  return Array.from(node.childNodes).map(serializeNode).join("");
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (!(node instanceof Element) || node.matches(excludedSelector)) return "";
  if (node.matches(".katex")) {
    const tex = node
      .querySelector('annotation[encoding="application/x-tex"]')
      ?.textContent?.trim();
    return tex ? `$${tex}$` : serializeChildren(node);
  }
  const content = serializeChildren(node);
  if (node.matches("br")) return "\n";
  if (node.matches("strong,b")) return `**${content}**`;
  if (node.matches("em,i")) return `*${content}*`;
  if (node.matches("code") && !node.closest("pre")) return `\`${content}\``;
  if (node.matches("a")) {
    const href = node.getAttribute("href") ?? "";
    return isSafeReferenceHref(href) ? `[${content}](${href})` : content;
  }
  if (node.matches("li")) return `- ${content.trim()}\n`;
  if (node.matches("blockquote")) {
    return content
      .trim()
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n");
  }
  if (/^H[1-6]$/u.test(node.tagName)) {
    return `${"#".repeat(Number(node.tagName.slice(1)))} ${content.trim()}`;
  }
  if (node.matches("dt")) return `${content.trim()}:: `;
  if (node.matches("dd")) return `${content.trim()}\n`;
  if (node.matches("p,div,section,article,ul,ol,dl")) return `${content}\n`;
  return content;
}

function isSafeReferenceHref(href: string) {
  return Boolean(
    href && !/^(?:javascript|data|file):/iu.test(href) && !href.includes("\0"),
  );
}

function normalizeVisibleText(value: string) {
  return value
    .replace(/\r\n?/gu, "\n")
    .replaceAll("\u200b", "")
    .replaceAll("\u200c", "")
    .replaceAll("\u200d", "")
    .replaceAll("\ufeff", "");
}
