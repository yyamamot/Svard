import type { LocalImageResult } from "../../../core/types";
import {
  classifyMarkdownAuthorImageSource,
  resolveLocalImageSource,
} from "../localImage";
import { blockMarkdownAuthorImage } from "../markdownAuthorResources";
import { isExternalUrl } from "../path";
import {
  perfDuration,
  perfNow,
  perfTraceEnabled,
  tracePerf,
} from "../perfTrace";
import type { NormalizedRenderResultHtml } from "../renderResultHtml";
import {
  createLocalRasterPayloadSlot,
  isResolvedLocalRasterMediaType,
  localRasterPayloadSlotAttribute,
} from "../resolvedLocalRasterPayloads";
import type { ResolvedLocalRasterPayloadInput } from "../resolvedLocalRasterPayloads";
import type {
  DocumentHtmlConfig,
  DocumentHtmlPhaseContext,
  PrepareDocumentHtmlOptions,
} from "./types";
import { htmlMayContainElement, sourceReference } from "./helpers";

function encodeLocalSvgImage(svg: string): string {
  return encodeURIComponent(svg.replaceAll("&nbsp;", "&#160;"));
}

export async function prepareImages(
  { html, doc, document, basename }: DocumentHtmlPhaseContext,
  config: DocumentHtmlConfig,
  options: PrepareDocumentHtmlOptions,
  authorHtmlResourceCandidates: NormalizedRenderResultHtml["authorHtmlResourceCandidates"],
) {
  const imagesStartedAt = perfNow();
  const imageResolverTracingEnabled = perfTraceEnabled();
  let imageResolverDurationMs = 0;
  let imageResolverCallCount = 0;
  let imageResolverResolvedCount = 0;
  let imageResolverBlockedCount = 0;
  let imageResolverErrorCount = 0;
  const resolvedLocalRasterPayloads: ResolvedLocalRasterPayloadInput[] = [];
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
        const dataUrl = `data:${mediaType}${encoding}${data}`;
        if (
          document.format === "markdown" &&
          options.localRasterPayloadOwner &&
          isResolvedLocalRasterMediaType(mediaType) &&
          backendResult.encoding === "base64"
        ) {
          const slot = createLocalRasterPayloadSlot();
          if (slot) {
            image.removeAttribute("src");
            image.setAttribute(localRasterPayloadSlotAttribute, slot);
            resolvedLocalRasterPayloads.push({ dataUrl, image, slot });
          } else {
            image.setAttribute("src", dataUrl);
          }
        } else {
          image.setAttribute("src", dataUrl);
        }
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

  return { imageResolverTracingEnabled, resolvedLocalRasterPayloads };
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
