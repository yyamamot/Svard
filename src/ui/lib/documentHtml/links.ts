import type { DocumentLinkResolution } from "../../../core/types";
import {
  canonicalDocumentLinkHref,
  classifyDocumentLinkHref,
  relativeResolvedDocumentHref,
} from "../documentLinkNavigation";
import {
  blockMarkdownAuthorLink,
  classifyMarkdownAuthorLinkCandidate,
} from "../markdownAuthorResources";
import type { NormalizedRenderResultHtml } from "../renderResultHtml";
import type {
  DocumentHtmlPhaseContext,
  PrepareDocumentHtmlOptions,
} from "./types";
import { htmlMayContainElement } from "./helpers";
import { perfDuration, perfNow, tracePerf } from "../perfTrace";

export async function prepareLinks(
  { html, doc, document, basename }: DocumentHtmlPhaseContext,
  options: PrepareDocumentHtmlOptions,
  authorHtmlResourceCandidates: NormalizedRenderResultHtml["authorHtmlResourceCandidates"],
) {
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
