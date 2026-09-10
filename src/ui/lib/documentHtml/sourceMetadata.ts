import type {
  DocumentPayload,
  SourceSelectionBlock,
  SourceTextBlock,
} from "../../../core/types";
import type { DocumentHtmlPhaseContext, RendererTargets } from "./types";
import { perfDuration, perfNow, tracePerf } from "../perfTrace";
import { sourceReference } from "./helpers";

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

export function attachDiagnosticsAndHeadings(
  { doc, document, renderResult, basename }: DocumentHtmlPhaseContext,
  { markdownHeadingElements }: RendererTargets,
  authorHtmlSourceActionExcludedElements: Set<Element>,
) {
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
}

export function attachSourceTextAndSelection(
  { doc, document, renderResult, basename }: DocumentHtmlPhaseContext,
  {
    markdownRendererValidation,
    markdownSourceTextElements,
    markdownSelectionElements,
  }: RendererTargets,
) {
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
}
