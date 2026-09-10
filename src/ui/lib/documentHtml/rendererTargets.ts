import {
  MARKDOWN_RENDERER_ID_ATTRIBUTE,
  validateMarkdownRendererProvenance,
} from "../markdownRendererProvenance";
import type { NormalizedRenderResultHtml } from "../renderResultHtml";
import type { DocumentHtmlPhaseContext, RendererTargets } from "./types";

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

export function collectRendererTargets(
  { doc, document, renderResult }: DocumentHtmlPhaseContext,
  normalizedRenderResult: NormalizedRenderResultHtml,
): RendererTargets {
  const authorHtmlSourceActionExcludedElements =
    normalizedRenderResult.authorHtmlSourceActionExcludedElements;
  const rendererProvenanceValidation: RendererTargets["markdownRendererValidation"] =
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

  return {
    markdownRendererValidation,
    markdownHeadingElements,
    markdownSourceElements,
    markdownSourceTextElements,
    markdownSelectionElements,
    markdownTableElements,
  };
}
