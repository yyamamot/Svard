import type { DocumentFormat, RenderResult } from "../../core/types";
import {
  containsMarkdownAuthorHtmlMarkerMarkup,
  normalizeMarkdownAuthorHtmlInPlace,
} from "./markdownAuthorHtml";
import { MARKDOWN_RENDERER_ID_ATTRIBUTE } from "./markdownRendererProvenance";

export interface RenderResultHtmlNormalizationStatus {
  status: "invoked" | "skipped";
  passedCount: number;
  escapedCount: number;
  rejectedCount: number;
}

export interface NormalizedRenderResultHtml {
  document: Document;
  body: HTMLElement;
  authorHtml: RenderResultHtmlNormalizationStatus;
  authorHtmlSourceActionExcludedElements: Set<Element>;
}

interface NormalizeRenderResultHtmlOptions {
  rendererIdentity?: "strip" | "preserve-for-validation";
}

function stripRendererIdentityInPlace(body: HTMLElement): void {
  if (body.hasAttribute(MARKDOWN_RENDERER_ID_ATTRIBUTE)) {
    body.removeAttribute(MARKDOWN_RENDERER_ID_ATTRIBUTE);
  }
  for (const element of body.querySelectorAll(
    `[${MARKDOWN_RENDERER_ID_ATTRIBUTE}]`,
  )) {
    element.removeAttribute(MARKDOWN_RENDERER_ID_ATTRIBUTE);
  }
}

export function normalizeRenderResultHtml(
  format: DocumentFormat,
  source: string,
  renderResult: Pick<RenderResult, "html" | "markdownAuthorHtmlFragments">,
  options: NormalizeRenderResultHtmlOptions = {},
): NormalizedRenderResultHtml {
  const document = new DOMParser().parseFromString(
    renderResult.html,
    "text/html",
  );
  const fragments = renderResult.markdownAuthorHtmlFragments ?? [];
  const shouldNormalizeAuthorHtml =
    format === "markdown" &&
    (fragments.length > 0 ||
      containsMarkdownAuthorHtmlMarkerMarkup(renderResult.html));
  const counts = shouldNormalizeAuthorHtml
    ? normalizeMarkdownAuthorHtmlInPlace(document.body, source, fragments)
    : {
        passedCount: 0,
        escapedCount: 0,
        rejectedCount: 0,
        sourceActionExcludedElements: new Set<Element>(),
      };

  if (options.rendererIdentity !== "preserve-for-validation") {
    stripRendererIdentityInPlace(document.body);
  }

  return {
    document,
    body: document.body,
    authorHtml: {
      status: shouldNormalizeAuthorHtml ? "invoked" : "skipped",
      passedCount: counts.passedCount,
      escapedCount: counts.escapedCount,
      rejectedCount: counts.rejectedCount,
    },
    authorHtmlSourceActionExcludedElements: counts.sourceActionExcludedElements,
  };
}
