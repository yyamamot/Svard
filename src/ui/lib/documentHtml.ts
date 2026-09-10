import type { DocumentPayload, RenderResult } from "../../core/types";
import {
  renderAsciiDocStemMath,
  renderMarkdownMath,
} from "./documentHtml/mathPostProcess";
import { perfBasename, perfDuration, perfNow, tracePerf } from "./perfTrace";
import { normalizeRenderResultHtml } from "./renderResultHtml";
import { sanitizeDocumentBodyInPlace } from "./sanitizeHtml";
import { markSafeHtml, unwrapSafeHtml } from "./safeHtml";
import type { SafeHtml } from "./safeHtml";
import { removeUntrustedLocalRasterSlots } from "./resolvedLocalRasterPayloads";
import { collectRendererTargets } from "./documentHtml/rendererTargets";
import {
  attachDiagnosticsAndHeadings,
  attachSourceTextAndSelection,
} from "./documentHtml/sourceMetadata";
import { attachSourceBlocks } from "./documentHtml/sourceBlocks";
import { prepareTables } from "./documentHtml/tables";
import { prepareImages } from "./documentHtml/images";
import { prepareLinks } from "./documentHtml/links";
import type {
  DocumentHtmlConfig,
  DocumentHtmlPhaseContext,
  PrepareDocumentHtmlOptions,
} from "./documentHtml/types";

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
  removeUntrustedLocalRasterSlots(doc.body);
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

  const context: DocumentHtmlPhaseContext = {
    html,
    doc,
    document,
    renderResult,
    basename,
  };
  const rendererTargets = collectRendererTargets(
    context,
    normalizedRenderResult,
  );
  attachDiagnosticsAndHeadings(
    context,
    rendererTargets,
    authorHtmlSourceActionExcludedElements,
  );
  attachSourceBlocks(context, rendererTargets);
  attachSourceTextAndSelection(context, rendererTargets);
  prepareTables(context, rendererTargets, authorHtmlBlockRootElements);
  const { imageResolverTracingEnabled, resolvedLocalRasterPayloads } =
    await prepareImages(context, config, options, authorHtmlResourceCandidates);
  await prepareLinks(context, options, authorHtmlResourceCandidates);

  const sanitizeStartedAt = perfNow();
  const sanitized = sanitizeDocumentBodyInPlace(
    doc.body,
    { format: document.format },
    {
      resolvedLocalRasterSidecar: options.localRasterPayloadOwner
        ? {
            owner: options.localRasterPayloadOwner,
            inputs: resolvedLocalRasterPayloads,
          }
        : undefined,
      onPhase: imageResolverTracingEnabled
        ? (phase, durationMs) => {
            tracePerf(`render.prepareDocumentHtml.sanitize.${phase}`, {
              format: document.format,
              durationMs: Number(durationMs.toFixed(2)),
            });
          }
        : undefined,
    },
  );
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
