import type {
  DocumentPayload,
  DocumentLinkResolution,
  LocalImageResolveContext,
  LocalImageResult,
  RenderResult,
  SecurityConfig,
  SourceLocation,
  SourceSelectionBlock,
  SourceTextBlock,
} from "../../core/types";
import { highlightCodeContent } from "../../core/markdown/highlight";
import {
  classifyMarkdownAuthorImageSource,
  resolveLocalImageSource,
} from "./localImage";
import {
  renderAsciiDocStemMath,
  renderMarkdownMath,
} from "./documentHtml/mathPostProcess";
import { isExternalUrl } from "./path";
import {
  canonicalDocumentLinkHref,
  classifyDocumentLinkHref,
  relativeResolvedDocumentHref,
} from "./documentLinkNavigation";
import {
  perfBasename,
  perfDuration,
  perfNow,
  perfTraceEnabled,
  tracePerf,
} from "./perfTrace";
import {
  MARKDOWN_RENDERER_ID_ATTRIBUTE,
  validateMarkdownRendererProvenance,
} from "./markdownRendererProvenance";
import { normalizeRenderResultHtml } from "./renderResultHtml";
import {
  blockMarkdownAuthorImage,
  blockMarkdownAuthorLink,
  classifyMarkdownAuthorLinkCandidate,
} from "./markdownAuthorResources";
import { sanitizeDocumentBodyInPlace } from "./sanitizeHtml";
import { markSafeHtml, unwrapSafeHtml } from "./safeHtml";
import type { SafeHtml } from "./safeHtml";

interface PrepareDocumentHtmlOptions {
  resolveLocalImage?: (
    path: string,
    documentPath: string,
    context: LocalImageResolveContext | null | undefined,
  ) => Promise<LocalImageResult>;
  resolveDocumentLink?: (
    href: string,
    documentPath: string,
    options?: { kind?: "local" | "wikilink"; target?: string; label?: string },
  ) => Promise<DocumentLinkResolution>;
}

type DocumentHtmlConfig = {
  security: Pick<SecurityConfig, "allowLocalImages" | "confirmExternalLinks"> &
    Partial<Pick<SecurityConfig, "showExternalImages">>;
};

function sourceReference(
  document: DocumentPayload,
  line?: number,
  hash?: string,
  sourceLocation?: SourceLocation,
): string {
  const lineSuffix = line ? `:${line}` : "";
  const hashSuffix = hash ? `#${encodeURIComponent(hash)}` : "";
  return `${sourceLocation?.sourcePath ?? document.path}${lineSuffix}${hashSuffix}`;
}

function normalizeSourcePath(path: string) {
  return path.replace(/\\/gu, "/");
}

function sourceRangeMatches(
  document: DocumentPayload,
  left: SourceSelectionBlock | SourceTextBlock,
  right: SourceSelectionBlock | SourceTextBlock,
) {
  return (
    left.startLine === right.startLine &&
    left.endLine === right.endLine &&
    normalizeSourcePath(left.sourceLocation?.sourcePath ?? document.path) ===
      normalizeSourcePath(right.sourceLocation?.sourcePath ?? document.path)
  );
}

function attachSourceSelectionBlock(
  element: HTMLElement,
  block: SourceSelectionBlock,
) {
  element.setAttribute("data-source-selection-block-id", block.id);
  element.setAttribute("data-source-selection-start", String(block.startLine));
  element.setAttribute("data-source-selection-end", String(block.endLine));
  if (block.sourceLocation?.sourcePath) {
    element.setAttribute(
      "data-source-selection-source-path",
      block.sourceLocation.sourcePath,
    );
  }
}

function sourceForSelectionBlock(
  document: DocumentPayload,
  block: SourceSelectionBlock,
) {
  const sourcePath = block.sourceLocation?.sourcePath;
  if (
    !sourcePath ||
    normalizeSourcePath(sourcePath) === normalizeSourcePath(document.path)
  ) {
    return document.source;
  }
  return document.includeFiles?.find(
    (file) =>
      normalizeSourcePath(file.path) === normalizeSourcePath(sourcePath),
  )?.source;
}

function isSupportedSelectionListBlock(
  document: DocumentPayload,
  block: SourceSelectionBlock,
) {
  const source = sourceForSelectionBlock(document, block);
  if (!source) return false;
  const lines = source.split("\n").slice(block.startLine - 1, block.endLine);
  return !lines.some((line) =>
    /^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]\s/u.test(line),
  );
}

function isSimpleSelectionListElement(element: HTMLElement) {
  return (
    !element.closest("li") &&
    !element.matches(".checklist,.contains-task-list") &&
    !element.querySelector(
      'ul,ol,dl,table,pre,input[type="checkbox"],.task-list-item,.admonitionblock,.admonition,.markdown-alert',
    )
  );
}

function tableSourceLines(source: string, format: DocumentPayload["format"]) {
  const lines: number[] = [];
  if (format === "asciidoc") {
    const pattern = /^\|===/gm;
    let match: RegExpExecArray | null;
    let markerIndex = 0;

    while ((match = pattern.exec(source)) !== null) {
      if (markerIndex % 2 === 0) {
        lines.push(source.slice(0, match.index).split("\n").length);
      }
      markerIndex += 1;
    }

    return lines;
  }

  const pattern =
    /^[ \t]*\|.+\|[ \t]*\n[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*(?:\|[ \t]*:?-{3,}:?[ \t]*)+\|?[ \t]*$/gm;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    lines.push(source.slice(0, match.index).split("\n").length);
  }

  return lines;
}

function shouldWrapMarkdownTable(table: HTMLTableElement): boolean {
  if (table.classList.contains("rouge-table")) {
    return false;
  }
  if (
    table.closest(
      ".admonitionblock, .markdown-frontmatter, .asciidoc-document-attributes, .frontmatter-nested, .markdown-table-scroll",
    )
  ) {
    return false;
  }
  return true;
}

function wrapMarkdownTable(doc: Document, table: HTMLTableElement): void {
  if (!shouldWrapMarkdownTable(table)) {
    return;
  }
  const wrapper = doc.createElement("div");
  wrapper.className = "markdown-table-scroll";
  wrapper.setAttribute("data-review-id", "markdown-table-scroll");
  table.replaceWith(wrapper);
  wrapper.append(table);
}

const markdownSourceActionAttributes = [
  "data-section-collapse-heading",
  "data-section-collapsed",
  "data-section-collapse-toggle",
  "data-source-line",
  "data-source-column",
  "data-source-reference",
  "data-source-block-id",
  "data-source-text-block-id",
  "data-copy-source",
  "data-copy-source-button",
  "data-copy-source-location-button",
  "data-source-wrap-toggle",
  "data-source-collapse-toggle",
  "data-source-selection-block-id",
  "data-source-selection-start",
  "data-source-selection-end",
  "data-source-selection-source-path",
] as const;

function clearMarkdownSourceActionsInPlace(body: HTMLElement): void {
  body
    .querySelectorAll<HTMLElement>(
      "[data-section-collapse-toggle],.source-block-toolbar",
    )
    .forEach((element) => element.remove());
  body.querySelectorAll<HTMLElement>(".source-block-frame").forEach((frame) => {
    const pre = frame.querySelector(":scope > pre");
    if (pre) frame.replaceWith(pre);
  });
  [body, ...body.querySelectorAll<HTMLElement>("*")].forEach((element) => {
    markdownSourceActionAttributes.forEach((attribute) =>
      element.removeAttribute(attribute),
    );
  });
}

function encodeLocalSvgImage(svg: string): string {
  return encodeURIComponent(svg.replaceAll("&nbsp;", "&#160;"));
}

function markdownHasMathPlaceholders(doc: Document): boolean {
  return Boolean(
    doc.querySelector(
      ".math-inline[data-math-source], .math-block[data-math-source]",
    ),
  );
}

function markdownHtmlHasMathPlaceholders(html: string): boolean {
  return html.includes("data-math-source");
}

function asciiDocHasStemMathMarkers(source: string, html: string): boolean {
  return (
    html.includes("stemblock") ||
    html.includes("\\$") ||
    /(?:^|\n)\s*\[stem[,\]\r\n]/i.test(source) ||
    /(?:stem|latexmath|asciimath):(?:\[|)/i.test(source) ||
    source.includes("\\$")
  );
}

type PostSanitizeReparseDecision =
  | { reason: "asciidoc-stem-math"; shouldReparse: true }
  | { reason: "markdown-math-placeholder"; shouldReparse: true }
  | { reason: "no-post-sanitize-processing"; shouldReparse: false };

function shouldReparseSanitizedHtmlForPostProcessing(
  format: DocumentPayload["format"],
  source: string,
  sanitizedHtml: string,
): PostSanitizeReparseDecision {
  if (
    format === "asciidoc" &&
    asciiDocHasStemMathMarkers(source, sanitizedHtml)
  ) {
    return { reason: "asciidoc-stem-math", shouldReparse: true };
  }
  if (format === "markdown" && markdownHtmlHasMathPlaceholders(sanitizedHtml)) {
    return { reason: "markdown-math-placeholder", shouldReparse: true };
  }
  return { reason: "no-post-sanitize-processing", shouldReparse: false };
}

function htmlMayContainElement(html: string, tagName: string): boolean {
  return new RegExp(`<\\s*${tagName}(?:\\s|>|/)`, "i").test(html);
}

function stripUnmanagedResourceAttributes(body: HTMLElement): void {
  body
    .querySelectorAll<HTMLElement>(
      "[src], [poster], [background], object[data], [href], [xlink\\:href]",
    )
    .forEach((element) => {
      if (element.localName !== "img") {
        element.removeAttribute("src");
      }
      element.removeAttribute("poster");
      element.removeAttribute("background");
      if (element.localName === "object") {
        element.removeAttribute("data");
      }
      if (element.localName !== "a") {
        element.removeAttribute("href");
        element.removeAttribute("xlink:href");
        element.removeAttributeNS("http://www.w3.org/1999/xlink", "href");
      }
    });
}

export async function prepareDocumentHtml(
  html: string,
  document: DocumentPayload,
  config: DocumentHtmlConfig,
  renderResult?: Pick<
    RenderResult,
    | "headings"
    | "sourceBlocks"
    | "sourceTextBlocks"
    | "sourceSelectionBlocks"
    | "markdownAuthorHtmlFragments"
    | "markdownRendererProvenance"
  > &
    Partial<Pick<RenderResult, "diagnostics" | "diagramSlots">>,
  options: PrepareDocumentHtmlOptions = {},
): Promise<SafeHtml> {
  const basename = perfBasename(document.path);
  const parseStartedAt = perfNow();
  const normalizedRenderResult = normalizeRenderResultHtml(
    document.format,
    document.source,
    {
      html,
      markdownAuthorHtmlFragments: renderResult?.markdownAuthorHtmlFragments,
    },
    { rendererIdentity: "preserve-for-validation" },
  );
  const doc = normalizedRenderResult.document;
  stripUnmanagedResourceAttributes(doc.body);
  const authorHtmlSourceActionExcludedElements =
    normalizedRenderResult.authorHtmlSourceActionExcludedElements;
  const authorHtmlBlockRootElements =
    normalizedRenderResult.authorHtmlBlockRootElements;
  const authorHtmlResourceCandidates =
    normalizedRenderResult.authorHtmlResourceCandidates;
  tracePerf("render.prepareDocumentHtml.domParse", {
    basename,
    format: document.format,
    bytes: html.length,
    durationMs: perfDuration(parseStartedAt),
  });

  const rendererProvenanceValidation =
    document.format === "markdown"
      ? validateMarkdownRendererProvenance(
          doc.body,
          document.source,
          renderResult?.markdownRendererProvenance ?? [],
          {
            headings: renderResult?.headings ?? [],
            sourceBlocks: renderResult?.sourceBlocks ?? [],
            sourceTextBlocks: renderResult?.sourceTextBlocks,
            sourceSelectionBlocks: renderResult?.sourceSelectionBlocks,
            diagramSlots: renderResult?.diagramSlots,
          },
        )
      : { status: "absent" as const, entries: [] };
  const markdownRendererValidation =
    normalizedRenderResult.authorHtml.rejectedCount > 0
      ? ({ status: "rejected", entries: [] } as const)
      : rendererProvenanceValidation;
  if (document.format === "markdown") {
    [
      ...(doc.body.hasAttribute(MARKDOWN_RENDERER_ID_ATTRIBUTE)
        ? [doc.body]
        : []),
      ...doc.body.querySelectorAll<HTMLElement>(
        `[${MARKDOWN_RENDERER_ID_ATTRIBUTE}]`,
      ),
    ].forEach((element) =>
      element.removeAttribute(MARKDOWN_RENDERER_ID_ATTRIBUTE),
    );
    clearMarkdownSourceActionsInPlace(doc.body);
  }

  const markdownHeadingElements = new Map<string, HTMLElement>();
  const markdownSourceElements = new Map<string, HTMLElement>();
  const markdownSourceTextElements = new Map<string, HTMLElement>();
  const markdownSelectionElements = new Map<string, HTMLElement>();
  const markdownTableElements = new Set<HTMLElement>();
  if (markdownRendererValidation.status === "valid") {
    for (const { element, provenance } of markdownRendererValidation.entries) {
      switch (provenance.kind) {
        case "heading":
          markdownHeadingElements.set(provenance.headingId, element);
          if (!authorHtmlSourceActionExcludedElements.has(element)) {
            markdownSelectionElements.set(
              provenance.sourceSelectionBlockId,
              element,
            );
          }
          break;
        case "paragraph":
          if (!authorHtmlSourceActionExcludedElements.has(element)) {
            markdownSourceTextElements.set(
              provenance.sourceTextBlockId,
              element,
            );
          }
          if (
            !authorHtmlSourceActionExcludedElements.has(element) &&
            "sourceSelectionBlockId" in provenance &&
            provenance.sourceSelectionBlockId
          ) {
            markdownSelectionElements.set(
              provenance.sourceSelectionBlockId,
              element,
            );
          }
          break;
        case "list":
        case "table":
          if (provenance.kind === "table") {
            markdownTableElements.add(element);
          }
          if (
            !authorHtmlSourceActionExcludedElements.has(element) &&
            "sourceSelectionBlockId" in provenance &&
            provenance.sourceSelectionBlockId
          ) {
            markdownSelectionElements.set(
              provenance.sourceSelectionBlockId,
              element,
            );
          }
          break;
        case "source":
          markdownSourceElements.set(provenance.sourceBlockId, element);
          if (!authorHtmlSourceActionExcludedElements.has(element)) {
            markdownSelectionElements.set(
              provenance.sourceSelectionBlockId,
              element,
            );
          }
          break;
        case "diagram":
          if (!authorHtmlSourceActionExcludedElements.has(element)) {
            markdownSelectionElements.set(
              provenance.sourceSelectionBlockId,
              element,
            );
          }
          break;
        case "frontmatter":
        case "details":
          break;
      }
    }
  }
  if (markdownRendererValidation.status !== "rejected") {
    const headingMetadataCounts = new Map<string, number>();
    for (const heading of renderResult?.headings ?? []) {
      headingMetadataCounts.set(
        heading.id,
        (headingMetadataCounts.get(heading.id) ?? 0) + 1,
      );
    }
    const publicIdCounts = new Map<string, number>();
    for (const element of doc.body.querySelectorAll<HTMLElement>("[id]")) {
      publicIdCounts.set(element.id, (publicIdCounts.get(element.id) ?? 0) + 1);
    }
    for (const element of authorHtmlSourceActionExcludedElements) {
      if (
        !(element instanceof HTMLElement) ||
        !/^h[1-6]$/u.test(element.localName)
      ) {
        continue;
      }
      const heading = (renderResult?.headings ?? []).find(
        (candidate) => candidate.id === element.id,
      );
      if (
        heading &&
        headingMetadataCounts.get(heading.id) === 1 &&
        publicIdCounts.get(heading.id) === 1 &&
        element.localName === `h${heading.level}`
      ) {
        markdownHeadingElements.set(heading.id, element);
      }
    }
  }

  const diagnosticsStartedAt = perfNow();
  const includeDiagnostics =
    renderResult?.diagnostics?.filter((diagnostic) =>
      diagnostic.id.startsWith("include-"),
    ) ?? [];
  if (includeDiagnostics.length > 0) {
    const wrapper = doc.createElement("div");
    wrapper.className = "document-diagnostics";
    wrapper.setAttribute("data-review-id", "document-diagnostics");
    includeDiagnostics.forEach((diagnostic) => {
      const item = doc.createElement("div");
      item.className = `diagnostic ${diagnostic.severity}`;
      item.textContent = diagnostic.message;
      if (diagnostic.sourceLocation?.line) {
        item.setAttribute(
          "data-source-reference",
          sourceReference(
            document,
            diagnostic.sourceLocation.line,
            undefined,
            diagnostic.sourceLocation,
          ),
        );
      }
      wrapper.append(item);
    });
    doc.body.prepend(wrapper);
  }
  tracePerf("render.prepareDocumentHtml.includeDiagnostics", {
    basename,
    format: document.format,
    count: includeDiagnostics.length,
    durationMs: perfDuration(diagnosticsStartedAt),
  });

  const headingsStartedAt = perfNow();
  renderResult?.headings.forEach((heading) => {
    const element =
      document.format === "markdown"
        ? markdownHeadingElements.get(heading.id)
        : doc.getElementById(heading.id);
    if (!element || element.localName !== `h${heading.level}`) {
      return;
    }
    element.setAttribute("data-section-collapse-heading", "true");
    element.setAttribute("data-section-collapsed", "false");
    element.setAttribute("aria-expanded", "true");
    if (!element.querySelector("[data-section-collapse-toggle]")) {
      const collapseButton = doc.createElement("button");
      collapseButton.type = "button";
      collapseButton.className = "section-collapse-toggle";
      collapseButton.setAttribute("data-review-id", "section-collapse-toggle");
      collapseButton.setAttribute("data-section-collapse-toggle", "true");
      collapseButton.setAttribute("data-selection-exclude", "true");
      collapseButton.setAttribute("aria-label", "Toggle section collapse");
      collapseButton.setAttribute("aria-expanded", "true");
      collapseButton.textContent = "";
      element.prepend(collapseButton);
    }
    const line = heading.sourceLocation?.line;
    if (line && !authorHtmlSourceActionExcludedElements.has(element)) {
      element.setAttribute("data-source-line", String(line));
      element.setAttribute(
        "data-source-reference",
        sourceReference(document, line, heading.id, heading.sourceLocation),
      );
    }
  });
  tracePerf("render.prepareDocumentHtml.headings", {
    basename,
    format: document.format,
    count: renderResult?.headings.length ?? 0,
    durationMs: perfDuration(headingsStartedAt),
  });

  const sourceBlocksStartedAt = perfNow();
  const sourceBlockTargets =
    document.format === "markdown"
      ? (renderResult?.sourceBlocks ?? []).flatMap((sourceBlock, index) => {
          const pre = markdownSourceElements.get(sourceBlock.id);
          return pre ? [{ pre, sourceBlock, index }] : [];
        })
      : Array.from(doc.querySelectorAll<HTMLElement>("pre")).map(
          (pre, index) => ({
            pre,
            sourceBlock: renderResult?.sourceBlocks[index],
            index,
          }),
        );
  const shouldProcessSourceBlocks =
    document.format === "markdown"
      ? sourceBlockTargets.length > 0
      : htmlMayContainElement(html, "pre");
  let sourceBlockCount = 0;
  if (shouldProcessSourceBlocks) {
    sourceBlockTargets.forEach(({ pre, sourceBlock, index }) => {
      sourceBlockCount += 1;
      const sourceLine = sourceBlock?.sourceLocation?.line;
      const sourceLanguage = sourceBlock?.language?.trim() || "Source";
      const sourceCode = pre.querySelector("code");
      if (
        document.format === "asciidoc" &&
        sourceBlock?.language &&
        sourceCode
      ) {
        sourceCode.innerHTML = highlightCodeContent(
          sourceCode.textContent ?? "",
          sourceBlock.language,
        );
        sourceCode.classList.add(
          `language-${sourceBlock.language.trim().toLowerCase()}`,
        );
        pre.classList.add("hljs");
      }
      pre.setAttribute("data-copy-source", `${index + 1}`);
      const wrapper = doc.createElement("div");
      wrapper.className = "source-block-frame";
      if (sourceBlock?.id) {
        wrapper.setAttribute("data-source-block-id", sourceBlock.id);
        pre.setAttribute("data-source-block-id", sourceBlock.id);
      }
      if (sourceLine) {
        wrapper.setAttribute("data-source-line", String(sourceLine));
        pre.setAttribute("data-source-line", String(sourceLine));
        if (sourceBlock?.sourceLocation?.column) {
          wrapper.setAttribute(
            "data-source-column",
            String(sourceBlock.sourceLocation.column),
          );
          pre.setAttribute(
            "data-source-column",
            String(sourceBlock.sourceLocation.column),
          );
        }
        wrapper.setAttribute(
          "data-source-reference",
          sourceReference(
            document,
            sourceLine,
            undefined,
            sourceBlock.sourceLocation,
          ),
        );
      }
      const toolbar = doc.createElement("div");
      toolbar.className = "source-block-toolbar";
      toolbar.setAttribute("data-review-id", "source-block-toolbar");
      toolbar.setAttribute("data-selection-exclude", "true");

      const languageLabel = doc.createElement("span");
      languageLabel.className = "source-block-language";
      languageLabel.setAttribute("data-review-id", "source-block-language");
      languageLabel.textContent = sourceLanguage;

      const toolbarActions = doc.createElement("span");
      toolbarActions.className = "source-block-actions";

      const button = doc.createElement("button");
      button.type = "button";
      button.className = "source-copy-button source-block-action";
      button.setAttribute("data-review-id", "source-copy-button");
      button.setAttribute("data-copy-source-button", `${index + 1}`);
      button.textContent = "Copy";
      const referenceButton = doc.createElement("button");
      referenceButton.type = "button";
      referenceButton.className =
        "source-reference-copy-button source-block-action";
      referenceButton.setAttribute(
        "data-review-id",
        "source-reference-copy-button",
      );
      referenceButton.setAttribute(
        "data-copy-source-location-button",
        `${index + 1}`,
      );
      referenceButton.textContent = "Ref";
      if (!sourceLine) {
        referenceButton.disabled = true;
        referenceButton.title = "Source location unavailable";
      } else {
        referenceButton.title = `Copy ${sourceReference(
          document,
          sourceLine,
          undefined,
          sourceBlock?.sourceLocation,
        )}`;
      }
      const wrapButton = doc.createElement("button");
      wrapButton.type = "button";
      wrapButton.className = "source-wrap-toggle source-block-action";
      wrapButton.setAttribute("data-review-id", "source-wrap-toggle");
      wrapButton.setAttribute("data-source-wrap-toggle", `${index + 1}`);
      wrapButton.setAttribute("aria-pressed", "false");
      wrapButton.title = "Toggle line wrap";
      wrapButton.textContent = "Wrap";

      const collapseButton = doc.createElement("button");
      collapseButton.type = "button";
      collapseButton.className = "source-collapse-toggle source-block-action";
      collapseButton.setAttribute("data-review-id", "source-collapse-toggle");
      collapseButton.setAttribute(
        "data-source-collapse-toggle",
        `${index + 1}`,
      );
      collapseButton.setAttribute("aria-expanded", "true");
      collapseButton.title = "Collapse source block";
      collapseButton.textContent = "Collapse";

      toolbarActions.append(
        button,
        referenceButton,
        wrapButton,
        collapseButton,
      );
      toolbar.append(languageLabel, toolbarActions);
      pre.replaceWith(wrapper);
      wrapper.append(toolbar, pre);
    });
  }
  tracePerf("render.prepareDocumentHtml.sourceBlocks", {
    basename,
    format: document.format,
    count: sourceBlockCount,
    skipped: !shouldProcessSourceBlocks,
    durationMs: perfDuration(sourceBlocksStartedAt),
  });

  const sourceTextBlocksStartedAt = perfNow();
  const sourceTextBlocks = renderResult?.sourceTextBlocks ?? [];
  if (document.format === "asciidoc") {
    const paragraphs = Array.from(
      doc.querySelectorAll<HTMLElement>("div.paragraph > p"),
    );
    if (paragraphs.length === sourceTextBlocks.length) {
      paragraphs.forEach((paragraph, index) => {
        paragraph.setAttribute(
          "data-source-text-block-id",
          sourceTextBlocks[index].id,
        );
      });
    }
  } else if (markdownRendererValidation.status === "valid") {
    sourceTextBlocks.forEach((sourceTextBlock) => {
      markdownSourceTextElements
        .get(sourceTextBlock.id)
        ?.setAttribute("data-source-text-block-id", sourceTextBlock.id);
    });
  }
  tracePerf("render.prepareDocumentHtml.sourceTextBlocks", {
    basename,
    format: document.format,
    count: renderResult?.sourceTextBlocks?.length ?? 0,
    durationMs: perfDuration(sourceTextBlocksStartedAt),
  });

  const selectionBlocksStartedAt = perfNow();
  const selectionBlocks = renderResult?.sourceSelectionBlocks ?? [];
  if (document.format === "asciidoc") {
    const attachSelectionBlocks = (
      selector: string,
      kind: string,
      elementFilter: (element: HTMLElement) => boolean = () => true,
      blockFilter: (block: SourceSelectionBlock) => boolean = () => true,
    ) => {
      const elements = Array.from(
        doc.querySelectorAll<HTMLElement>(selector),
      ).filter(elementFilter);
      const blocks = selectionBlocks.filter(
        (block) => block.kind === kind && blockFilter(block),
      );
      if (elements.length !== blocks.length) return;
      elements.forEach((element, index) => {
        attachSourceSelectionBlock(element, blocks[index]);
      });
    };
    attachSelectionBlocks("h1,h2,h3,h4,h5,h6", "heading");
    doc
      .querySelectorAll<HTMLElement>("p[data-source-text-block-id]")
      .forEach((paragraph) => {
        const sourceTextBlock = sourceTextBlocks.find(
          (block) =>
            block.id === paragraph.getAttribute("data-source-text-block-id"),
        );
        if (!sourceTextBlock) return;
        const matches = selectionBlocks.filter(
          (block) =>
            block.kind === "paragraph" &&
            sourceRangeMatches(document, block, sourceTextBlock),
        );
        if (matches.length === 1) {
          attachSourceSelectionBlock(paragraph, matches[0]);
        }
      });
    attachSelectionBlocks(".source-block-frame", "code");
    doc
      .querySelectorAll<HTMLElement>(".source-block-frame")
      .forEach((frame) => {
        const id = frame.getAttribute("data-source-selection-block-id");
        const pre = frame.querySelector("pre");
        if (!id || !pre) return;
        [
          "data-source-selection-block-id",
          "data-source-selection-start",
          "data-source-selection-end",
          "data-source-selection-source-path",
        ].forEach((name) => {
          const value = frame.getAttribute(name);
          if (value) pre.setAttribute(name, value);
        });
      });
    attachSelectionBlocks(
      "ul,ol",
      "list",
      isSimpleSelectionListElement,
      (block) => isSupportedSelectionListBlock(document, block),
    );
    attachSelectionBlocks("table", "table");
    attachSelectionBlocks(".diagram-slot", "diagram");
  } else if (markdownRendererValidation.status === "valid") {
    selectionBlocks.forEach((block) => {
      const element = markdownSelectionElements.get(block.id);
      if (!element) return;
      if (
        block.kind === "list" &&
        (!isSimpleSelectionListElement(element) ||
          !isSupportedSelectionListBlock(document, block))
      ) {
        return;
      }
      if (block.kind === "code") {
        const frame = element.closest<HTMLElement>(".source-block-frame");
        if (!frame) return;
        attachSourceSelectionBlock(frame, block);
        attachSourceSelectionBlock(element, block);
        return;
      }
      attachSourceSelectionBlock(element, block);
    });
  }
  tracePerf("render.prepareDocumentHtml.sourceSelectionBlocks", {
    basename,
    format: document.format,
    count: selectionBlocks.length,
    durationMs: perfDuration(selectionBlocksStartedAt),
  });

  const tablesStartedAt = perfNow();
  const shouldProcessTables =
    htmlMayContainElement(html, "table") ||
    Array.from(authorHtmlBlockRootElements).some(
      (root) =>
        root.localName === "table" || Boolean(root.querySelector("table")),
    );
  let tableCount = 0;
  let tableLineCount = 0;
  if (shouldProcessTables) {
    const tables = Array.from(doc.querySelectorAll("table")).filter(
      (table) =>
        !table.closest(
          ".admonitionblock, .markdown-frontmatter, .asciidoc-document-attributes, .frontmatter-nested",
        ),
    );
    tableCount = tables.length;
    const tableSourceScanStartedAt = perfNow();
    const tableLines =
      document.format === "asciidoc"
        ? tableSourceLines(document.source, document.format)
        : [];
    tracePerf("render.prepareDocumentHtml.tableSourceScan", {
      basename,
      format: document.format,
      count: tableLines.length,
      skipped: document.format === "markdown",
      durationMs: perfDuration(tableSourceScanStartedAt),
    });
    tableLineCount =
      document.format === "markdown"
        ? markdownTableElements.size
        : tableLines.length;
    tables.forEach((table, index) => {
      const sourceLine =
        document.format === "markdown"
          ? markdownTableElements.has(table)
            ? Number(table.getAttribute("data-source-selection-start")) ||
              undefined
            : undefined
          : tableLines[index];
      table.setAttribute("data-review-id", "rendered-table");
      if (sourceLine) {
        table.setAttribute("data-source-line", String(sourceLine));
        table.setAttribute(
          "data-source-reference",
          sourceReference(document, sourceLine),
        );
      }
      if (document.format === "markdown") {
        wrapMarkdownTable(doc, table);
      }
    });
  }
  if (!shouldProcessTables) {
    tracePerf("render.prepareDocumentHtml.tableSourceScan", {
      basename,
      format: document.format,
      count: 0,
      skipped: true,
      durationMs: 0,
    });
  }
  tracePerf("render.prepareDocumentHtml.tables", {
    basename,
    format: document.format,
    count: tableLineCount || tableCount,
    skipped: !shouldProcessTables,
    durationMs: perfDuration(tablesStartedAt),
  });

  const imagesStartedAt = perfNow();
  const imageResolverTracingEnabled = perfTraceEnabled();
  let imageResolverDurationMs = 0;
  let imageResolverCallCount = 0;
  let imageResolverResolvedCount = 0;
  let imageResolverBlockedCount = 0;
  let imageResolverErrorCount = 0;
  const hasAuthorImages = Array.from(
    authorHtmlResourceCandidates.values(),
  ).some((candidate) => candidate.kind === "image");
  const shouldProcessImages =
    htmlMayContainElement(html, "img") || hasAuthorImages;
  const images = shouldProcessImages
    ? Array.from(doc.querySelectorAll("img"))
    : [];
  if (shouldProcessImages) {
    for (const image of images) {
      const authorCandidate = authorHtmlResourceCandidates.get(image);
      if (authorCandidate && authorCandidate.kind !== "image") {
        blockMarkdownAuthorImage(image);
        continue;
      }
      const source =
        authorCandidate?.kind === "image"
          ? authorCandidate.value
          : image.getAttribute("src");
      if (!source) {
        continue;
      }

      const authorIntent = authorCandidate
        ? classifyMarkdownAuthorImageSource(source)
        : null;
      if (authorIntent?.kind === "blocked") {
        blockMarkdownAuthorImage(image);
        continue;
      }
      const resolvedImage = authorIntent
        ? authorIntent.kind === "external"
          ? config.security.showExternalImages === true
            ? ({ status: "passthrough", src: authorIntent.url } as const)
            : ({ status: "external-blocked" } as const)
          : config.security.allowLocalImages
            ? ({ status: "local", source: authorIntent.source } as const)
            : ({
                status: "blocked",
                placeholderText: "Local image blocked",
              } as const)
        : resolveLocalImageSource(source, {
            allowLocalImages: config.security.allowLocalImages,
            showExternalImages: config.security.showExternalImages ?? false,
          });

      if (resolvedImage.status === "external-blocked") {
        if (authorCandidate) {
          blockMarkdownAuthorImage(image);
          continue;
        }
        const placeholder = doc.createElement("span");
        placeholder.className = "image-placeholder";
        const alt = image.getAttribute("alt")?.trim();
        placeholder.textContent = alt
          ? `External image blocked: ${alt}`
          : "External image blocked";
        image.replaceWith(placeholder);
        continue;
      }

      if (resolvedImage.status === "blocked") {
        if (authorCandidate) {
          blockMarkdownAuthorImage(image);
          continue;
        }
        const placeholder = doc.createElement("span");
        placeholder.className = "image-placeholder";
        placeholder.textContent = resolvedImage.placeholderText;
        image.replaceWith(placeholder);
        continue;
      }

      if (resolvedImage.status === "local") {
        let backendResult: LocalImageResult;
        if (options.resolveLocalImage) {
          const resolverStartedAt = imageResolverTracingEnabled ? perfNow() : 0;
          try {
            backendResult = await options.resolveLocalImage(
              resolvedImage.source,
              document.path,
              document.asciidocContext ?? document.resourceContext,
            );
          } catch (error) {
            if (imageResolverTracingEnabled) {
              imageResolverDurationMs += perfNow() - resolverStartedAt;
              imageResolverCallCount += 1;
              imageResolverErrorCount += 1;
              traceImageResolverMetrics({
                durationMs: imageResolverDurationMs,
                callCount: imageResolverCallCount,
                resolvedCount: imageResolverResolvedCount,
                blockedCount: imageResolverBlockedCount,
                errorCount: imageResolverErrorCount,
              });
            }
            throw error;
          }
          if (imageResolverTracingEnabled) {
            imageResolverDurationMs += perfNow() - resolverStartedAt;
            imageResolverCallCount += 1;
            if (backendResult.status === "resolved") {
              imageResolverResolvedCount += 1;
            } else if (backendResult.status === "blocked") {
              imageResolverBlockedCount += 1;
            } else {
              imageResolverErrorCount += 1;
            }
          }
        } else {
          backendResult = {
            status: "blocked" as const,
            placeholderText: `Local image: ${source}`,
          };
        }
        if (backendResult.status !== "resolved" || !backendResult.content) {
          if (authorCandidate) {
            blockMarkdownAuthorImage(image);
            continue;
          }
          const placeholder = doc.createElement("span");
          placeholder.className = "image-placeholder";
          placeholder.textContent =
            backendResult.placeholderText ?? `Local image blocked: ${source}`;
          image.replaceWith(placeholder);
          continue;
        }
        const mediaType = backendResult.mediaType ?? "application/octet-stream";
        const data =
          mediaType === "image/svg+xml"
            ? encodeLocalSvgImage(backendResult.content)
            : backendResult.content;
        const encoding =
          mediaType === "image/svg+xml" ? ";charset=utf-8," : ";base64,";
        image.setAttribute("src", `data:${mediaType}${encoding}${data}`);
        image.setAttribute("data-image-path", resolvedImage.source);
        if (backendResult.resolvedPath) {
          image.setAttribute(
            "data-image-resolved-path",
            authorCandidate ? resolvedImage.source : backendResult.resolvedPath,
          );
        }
      } else {
        image.setAttribute("src", resolvedImage.src);
        image.setAttribute("data-image-path", resolvedImage.src);
        if (isExternalUrl(resolvedImage.src)) {
          image.setAttribute("data-image-url", resolvedImage.src);
        }
      }
      image.setAttribute("data-image-reference", sourceReference(document));
    }
  }
  if (imageResolverTracingEnabled) {
    traceImageResolverMetrics({
      durationMs: imageResolverDurationMs,
      callCount: imageResolverCallCount,
      resolvedCount: imageResolverResolvedCount,
      blockedCount: imageResolverBlockedCount,
      errorCount: imageResolverErrorCount,
    });
  }
  tracePerf("render.prepareDocumentHtml.images", {
    basename,
    format: document.format,
    count: images.length,
    skipped: !shouldProcessImages,
    durationMs: perfDuration(imagesStartedAt),
  });

  const linksStartedAt = perfNow();
  const hasAuthorLinks = Array.from(authorHtmlResourceCandidates.values()).some(
    (candidate) => candidate.kind === "link",
  );
  const shouldProcessLinks = htmlMayContainElement(html, "a") || hasAuthorLinks;
  const links = shouldProcessLinks
    ? Array.from(doc.querySelectorAll(hasAuthorLinks ? "a" : "a[href]"))
    : [];
  if (shouldProcessLinks) {
    for (const link of links) {
      const authorCandidate = authorHtmlResourceCandidates.get(link);
      if (authorCandidate && authorCandidate.kind !== "link") {
        blockMarkdownAuthorLink(link);
        continue;
      }
      link.removeAttribute("target");
      link.removeAttribute("download");
      link.removeAttribute("ping");
      link.removeAttribute("referrerpolicy");
      const href =
        authorCandidate?.kind === "link"
          ? authorCandidate.value
          : link.getAttribute("href");
      if (!href) {
        if (authorCandidate) blockMarkdownAuthorLink(link);
        continue;
      }
      const wikilinkTarget = link.getAttribute("data-wikilink-target");
      if (wikilinkTarget !== null) {
        if (!options.resolveDocumentLink) {
          link.replaceWith(
            doc.createTextNode(
              link.getAttribute("data-wikilink-raw") ?? link.textContent ?? "",
            ),
          );
          continue;
        }
        const resolved = await options.resolveDocumentLink(
          href,
          document.path,
          {
            kind: "wikilink",
            target: wikilinkTarget,
            label: link.getAttribute("data-wikilink-label") ?? undefined,
          },
        );
        traceWikilinkResolution(resolved);
        if (resolved.status !== "resolved" || !resolved.path) {
          link.replaceWith(
            doc.createTextNode(
              link.getAttribute("data-wikilink-raw") ?? link.textContent ?? "",
            ),
          );
          continue;
        }
        const navigationHref = relativeResolvedDocumentHref(
          document.path,
          resolved.path,
          resolved.hash,
        );
        if (!navigationHref) {
          link.replaceWith(
            doc.createTextNode(
              link.getAttribute("data-wikilink-raw") ?? link.textContent ?? "",
            ),
          );
          continue;
        }
        link.setAttribute("href", navigationHref);
        link.removeAttribute("data-wikilink-target");
        link.removeAttribute("data-wikilink-label");
        link.removeAttribute("data-wikilink-raw");
        continue;
      }
      const intent = authorCandidate
        ? classifyMarkdownAuthorLinkCandidate(href)
        : classifyDocumentLinkHref(href);
      if (intent.kind === "blocked") {
        if (authorCandidate) blockMarkdownAuthorLink(link);
        else link.removeAttribute("href");
        continue;
      }
      if (intent.kind === "fragment" || intent.kind === "external") {
        link.setAttribute("href", canonicalDocumentLinkHref(intent));
        continue;
      }
      if (!options.resolveDocumentLink) {
        if (authorCandidate) blockMarkdownAuthorLink(link);
        else link.removeAttribute("href");
        continue;
      }
      const resolved = await options.resolveDocumentLink(
        intent.href,
        document.path,
      );
      if (resolved.status !== "resolved" || !resolved.path) {
        if (authorCandidate) blockMarkdownAuthorLink(link);
        else link.removeAttribute("href");
        continue;
      }
      link.setAttribute("href", canonicalDocumentLinkHref(intent));
    }
  }
  tracePerf("render.prepareDocumentHtml.links", {
    basename,
    format: document.format,
    count: links.length,
    skipped: !shouldProcessLinks,
    durationMs: perfDuration(linksStartedAt),
  });

  const sanitizeStartedAt = perfNow();
  const sanitized = sanitizeDocumentBodyInPlace(doc.body, {
    format: document.format,
  });
  tracePerf("render.prepareDocumentHtml.sanitize", {
    basename,
    format: document.format,
    bytes: unwrapSafeHtml(sanitized).length,
    durationMs: perfDuration(sanitizeStartedAt),
  });

  const reparseDecision = shouldReparseSanitizedHtmlForPostProcessing(
    document.format,
    document.source,
    unwrapSafeHtml(sanitized),
  );

  if (!reparseDecision.shouldReparse) {
    const sanitizedParseStartedAt = perfNow();
    tracePerf("render.prepareDocumentHtml.sanitizedDomParse", {
      basename,
      format: document.format,
      reason: reparseDecision.reason,
      skipped: true,
      durationMs: perfDuration(sanitizedParseStartedAt),
    });
    const mathStartedAt = perfNow();
    tracePerf("render.prepareDocumentHtml.math", {
      basename,
      format: document.format,
      skipped: true,
      durationMs: perfDuration(mathStartedAt),
    });
    return sanitized;
  }

  const sanitizedParseStartedAt = perfNow();
  const sanitizedDoc = new DOMParser().parseFromString(
    unwrapSafeHtml(sanitized),
    "text/html",
  );
  tracePerf("render.prepareDocumentHtml.sanitizedDomParse", {
    basename,
    format: document.format,
    reason: reparseDecision.reason,
    skipped: false,
    durationMs: perfDuration(sanitizedParseStartedAt),
  });

  const mathStartedAt = perfNow();
  if (reparseDecision.reason === "asciidoc-stem-math") {
    renderAsciiDocStemMath(sanitizedDoc);
  } else if (
    reparseDecision.reason === "markdown-math-placeholder" &&
    markdownHasMathPlaceholders(sanitizedDoc)
  ) {
    renderMarkdownMath(sanitizedDoc);
  }
  tracePerf("render.prepareDocumentHtml.math", {
    basename,
    format: document.format,
    skipped: false,
    durationMs: perfDuration(mathStartedAt),
  });
  return markSafeHtml(sanitizedDoc.body.innerHTML);
}

function traceImageResolverMetrics({
  durationMs,
  callCount,
  resolvedCount,
  blockedCount,
  errorCount,
}: {
  durationMs: number;
  callCount: number;
  resolvedCount: number;
  blockedCount: number;
  errorCount: number;
}) {
  tracePerf("render.prepareDocumentHtml.imageResolver", {
    durationMs: Number(durationMs.toFixed(2)),
    callCount,
    resolvedCount,
    blockedCount,
    errorCount,
    status: callCount > 0 ? "used" : "unused",
  });
}

function traceWikilinkResolution(resolved: DocumentLinkResolution): void {
  const metrics = resolved.metrics;
  tracePerf("documentLink.resolveWikilink", {
    status: resolved.status,
    cacheStatus: metrics?.cacheStatus,
    durationMs: metrics?.durationMs,
    performanceMode: metrics?.performanceMode,
    reason: metrics?.reason,
  });
  if (metrics?.cacheStatus) {
    tracePerf("obsidian.noteIndex.scan", {
      status: resolved.status,
      cacheStatus: metrics.cacheStatus,
      noteCount: metrics.noteCount,
      scannedDirs: metrics.scannedDirs,
      durationMs: metrics.durationMs,
      performanceMode: metrics.performanceMode,
      reason: metrics.reason,
    });
  }
}
