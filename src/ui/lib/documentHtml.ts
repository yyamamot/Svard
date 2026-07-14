import type {
  DocumentPayload,
  DocumentLinkResolution,
  LocalImageResolveContext,
  LocalImageResult,
  RenderResult,
  SecurityConfig,
  SourceLocation,
} from "../../core/types";
import { isSupportedDocumentPath } from "../../core/documentFormat";
import { highlightCodeContent } from "../../core/markdown/highlight";
import { renderMathBlock, renderMathInline } from "../../core/math";
import { resolveLocalImageSource } from "./localImage";
import { isExternalUrl, splitPathAndHash } from "./path";
import { perfBasename, perfDuration, perfNow, tracePerf } from "./perfTrace";
import { sanitizeDocumentBodyInPlace } from "./sanitizeHtml";
import { markSafeHtml, setElementSafeHtml, unwrapSafeHtml } from "./safeHtml";
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

function encodeLocalSvgImage(svg: string): string {
  return encodeURIComponent(svg.replaceAll("&nbsp;", "&#160;"));
}

function htmlFragment(doc: Document, html: SafeHtml): DocumentFragment {
  const template = doc.createElement("template");
  setElementSafeHtml(template, html);
  return template.content;
}

function isUnsafeLinkHref(href: string): boolean {
  return /^\s*(?:javascript|vbscript|data):/i.test(href);
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
    const mathSource = text.replace(/\\+\$/g, "").trim();
    content.replaceChildren(
      htmlFragment(doc, markSafeHtml(renderMathBlock(mathSource))),
    );
    content.classList.add("math-block");
    content.setAttribute("data-review-id", "math-block");
  });
}

function renderAsciiDocStemMath(doc: Document) {
  replaceAsciiDocStemBlocks(doc);
  replaceAsciiDocInlineStemMath(doc);
}

function renderMarkdownMath(doc: Document) {
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
    });
}

export async function prepareDocumentHtml(
  html: string,
  document: DocumentPayload,
  config: DocumentHtmlConfig,
  renderResult?: Pick<
    RenderResult,
    "headings" | "sourceBlocks" | "sourceTextBlocks" | "sourceSelectionBlocks"
  > &
    Partial<Pick<RenderResult, "diagnostics">>,
  options: PrepareDocumentHtmlOptions = {},
): Promise<SafeHtml> {
  const basename = perfBasename(document.path);
  const parser = new DOMParser();
  const parseStartedAt = perfNow();
  const doc = parser.parseFromString(html, "text/html");
  tracePerf("render.prepareDocumentHtml.domParse", {
    basename,
    format: document.format,
    bytes: html.length,
    durationMs: perfDuration(parseStartedAt),
  });

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
    const element = doc.getElementById(heading.id);
    if (!element) {
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
    if (line) {
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
  const shouldProcessSourceBlocks = htmlMayContainElement(html, "pre");
  let sourceBlockCount = 0;
  if (shouldProcessSourceBlocks) {
    doc.querySelectorAll("pre").forEach((pre, index) => {
      sourceBlockCount += 1;
      const sourceBlock = renderResult?.sourceBlocks[index];
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
  if (document.format === "asciidoc") {
    const paragraphs = Array.from(
      doc.querySelectorAll<HTMLElement>("div.paragraph > p"),
    );
    const sourceTextBlocks = renderResult?.sourceTextBlocks ?? [];
    if (paragraphs.length === sourceTextBlocks.length) {
      paragraphs.forEach((paragraph, index) => {
        paragraph.setAttribute(
          "data-source-text-block-id",
          sourceTextBlocks[index].id,
        );
      });
    }
  }
  tracePerf("render.prepareDocumentHtml.sourceTextBlocks", {
    basename,
    format: document.format,
    count: renderResult?.sourceTextBlocks?.length ?? 0,
    durationMs: perfDuration(sourceTextBlocksStartedAt),
  });

  const selectionBlocksStartedAt = perfNow();
  const selectionBlocks = renderResult?.sourceSelectionBlocks ?? [];
  const attachSelectionBlocks = (selector: string, kind: string) => {
    const elements = Array.from(doc.querySelectorAll<HTMLElement>(selector));
    const blocks = selectionBlocks.filter((block) => block.kind === kind);
    if (elements.length !== blocks.length) return;
    elements.forEach((element, index) => {
      const block = blocks[index];
      element.setAttribute("data-source-selection-block-id", block.id);
      element.setAttribute(
        "data-source-selection-start",
        String(block.startLine),
      );
      element.setAttribute("data-source-selection-end", String(block.endLine));
      if (block.sourceLocation?.sourcePath) {
        element.setAttribute(
          "data-source-selection-source-path",
          block.sourceLocation.sourcePath,
        );
      }
    });
  };
  attachSelectionBlocks("h1,h2,h3,h4,h5,h6", "heading");
  attachSelectionBlocks("p[data-source-text-block-id]", "paragraph");
  attachSelectionBlocks(".source-block-frame", "code");
  doc.querySelectorAll<HTMLElement>(".source-block-frame").forEach((frame) => {
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
  attachSelectionBlocks("ul,ol", "list");
  attachSelectionBlocks("table", "table");
  attachSelectionBlocks(".diagram-slot", "diagram");
  tracePerf("render.prepareDocumentHtml.sourceSelectionBlocks", {
    basename,
    format: document.format,
    count: selectionBlocks.length,
    durationMs: perfDuration(selectionBlocksStartedAt),
  });

  const tablesStartedAt = perfNow();
  const shouldProcessTables = htmlMayContainElement(html, "table");
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
      document.format === "markdown" && tables.length === 0
        ? []
        : tableSourceLines(document.source, document.format);
    tracePerf("render.prepareDocumentHtml.tableSourceScan", {
      basename,
      format: document.format,
      count: tableLines.length,
      durationMs: perfDuration(tableSourceScanStartedAt),
    });
    tableLineCount = tableLines.length;
    tables.forEach((table, index) => {
      const sourceLine = tableLines[index];
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
  const shouldProcessImages = htmlMayContainElement(html, "img");
  const images = shouldProcessImages
    ? Array.from(doc.querySelectorAll("img"))
    : [];
  if (shouldProcessImages) {
    for (const image of images) {
      const source = image.getAttribute("src");
      if (!source) {
        continue;
      }

      const resolvedImage = resolveLocalImageSource(source, {
        allowLocalImages: config.security.allowLocalImages,
        showExternalImages: config.security.showExternalImages ?? false,
      });

      if (resolvedImage.status === "external-blocked") {
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
        const placeholder = doc.createElement("span");
        placeholder.className = "image-placeholder";
        placeholder.textContent = resolvedImage.placeholderText;
        image.replaceWith(placeholder);
        continue;
      }

      if (resolvedImage.status === "local") {
        const backendResult = options.resolveLocalImage
          ? await options.resolveLocalImage(
              resolvedImage.source,
              document.path,
              document.asciidocContext ?? document.resourceContext,
            )
          : {
              status: "blocked" as const,
              placeholderText: `Local image: ${source}`,
            };
        if (backendResult.status !== "resolved" || !backendResult.content) {
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
            backendResult.resolvedPath,
          );
        }
      } else {
        image.setAttribute("src", resolvedImage.src);
        image.setAttribute("data-image-path", source);
        if (isExternalUrl(source)) {
          image.setAttribute("data-image-url", source);
        }
      }
      image.setAttribute("data-image-reference", sourceReference(document));
    }
  }
  tracePerf("render.prepareDocumentHtml.images", {
    basename,
    format: document.format,
    count: images.length,
    skipped: !shouldProcessImages,
    durationMs: perfDuration(imagesStartedAt),
  });

  const linksStartedAt = perfNow();
  const shouldProcessLinks =
    Boolean(options.resolveDocumentLink) && htmlMayContainElement(html, "a");
  const links = shouldProcessLinks
    ? Array.from(doc.querySelectorAll("a[href]"))
    : [];
  if (shouldProcessLinks) {
    for (const link of links) {
      const href = link.getAttribute("href");
      if (!href) {
        continue;
      }
      if (isUnsafeLinkHref(href)) {
        link.removeAttribute("href");
        continue;
      }
      if (href.startsWith("#") || isExternalUrl(href)) {
        continue;
      }
      if (!options.resolveDocumentLink) {
        continue;
      }
      const wikilinkTarget = link.getAttribute("data-wikilink-target");
      if (wikilinkTarget !== null) {
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
        link.setAttribute(
          "href",
          resolved.hash ? `${resolved.path}#${resolved.hash}` : resolved.path,
        );
        link.removeAttribute("data-wikilink-target");
        link.removeAttribute("data-wikilink-label");
        link.removeAttribute("data-wikilink-raw");
        continue;
      }
      const { path } = splitPathAndHash(href);
      if (!isSupportedDocumentPath(path)) {
        continue;
      }
      const resolved = await options.resolveDocumentLink(href, document.path);
      if (resolved.status !== "resolved" || !resolved.path) {
        link.removeAttribute("href");
        if (resolved.message) {
          link.setAttribute("title", resolved.message);
        }
        continue;
      }
      link.setAttribute(
        "href",
        resolved.hash ? `${resolved.path}#${resolved.hash}` : resolved.path,
      );
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
  const sanitizedDoc = parser.parseFromString(
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
