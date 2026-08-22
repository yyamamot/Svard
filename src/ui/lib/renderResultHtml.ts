import type { DocumentFormat, RenderResult } from "../../core/types";
import {
  containsMarkdownAuthorHtmlMarkerMarkup,
  normalizeMarkdownAuthorHtmlInPlace,
  type MarkdownAuthorHtmlResourceCandidate,
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
  authorHtmlBlockRootElements: Set<Element>;
  authorHtmlResourceCandidates: Map<
    Element,
    MarkdownAuthorHtmlResourceCandidate
  >;
  authorHtmlSourceActionExcludedElements: Set<Element>;
}

interface NormalizeRenderResultHtmlOptions {
  rendererIdentity?: "strip" | "preserve-for-validation";
}

const APP_OWNED_KROKI_ACTION_ATTRIBUTES = [
  "data-kroki-confirm-key",
  "data-kroki-fallback-key",
  "data-kroki-open-preferences",
] as const;

const ASCIIDOC_NAVIGATION_ATTRIBUTES = [
  "action",
  "formaction",
  "ismap",
  "usemap",
] as const;

function stripAppOwnedKrokiActionsInPlace(body: HTMLElement): void {
  for (const attribute of APP_OWNED_KROKI_ACTION_ATTRIBUTES) {
    if (body.hasAttribute(attribute)) body.removeAttribute(attribute);
    for (const element of body.querySelectorAll(`[${attribute}]`)) {
      element.removeAttribute(attribute);
    }
  }
}

function replaceWithStaticText(element: Element): void {
  const text = element.textContent ?? "";
  if (text) {
    element.replaceWith(element.ownerDocument.createTextNode(text));
  } else {
    element.remove();
  }
}

function neutralizeAsciiDocActiveContentInPlace(body: HTMLElement): void {
  for (const attribute of ASCIIDOC_NAVIGATION_ATTRIBUTES) {
    if (body.hasAttribute(attribute)) body.removeAttribute(attribute);
    for (const element of body.querySelectorAll(`[${attribute}]`)) {
      element.removeAttribute(attribute);
    }
  }

  for (const map of body.querySelectorAll("map")) map.remove();
  for (const area of body.querySelectorAll("area")) area.remove();
  for (const form of body.querySelectorAll("form")) {
    form.replaceWith(...Array.from(form.childNodes));
  }
  for (const control of body.querySelectorAll(
    "button, textarea, select, option",
  )) {
    replaceWithStaticText(control);
  }
  for (const input of body.querySelectorAll("input")) input.remove();
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
  stripAppOwnedKrokiActionsInPlace(document.body);
  if (format === "asciidoc") {
    neutralizeAsciiDocActiveContentInPlace(document.body);
  }
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
        blockRootElements: new Set<Element>(),
        resourceCandidates: new Map<
          Element,
          MarkdownAuthorHtmlResourceCandidate
        >(),
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
    authorHtmlBlockRootElements: counts.blockRootElements,
    authorHtmlResourceCandidates: counts.resourceCandidates,
    authorHtmlSourceActionExcludedElements: counts.sourceActionExcludedElements,
  };
}
