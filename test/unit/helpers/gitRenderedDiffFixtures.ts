import {
  buildRenderedDiffPresentation,
  compareRenderedBlocks,
  extractRenderedBlocksFromHtml,
  type RenderedBlockDiff,
} from "../../../src/ui/lib/gitRenderedDiff";

type ExtractionOptions = Parameters<typeof extractRenderedBlocksFromHtml>[1];

export function blocksFromHtml(html: string, options?: ExtractionOptions) {
  return extractRenderedBlocksFromHtml(html, options);
}

export function diffHtml(
  leftHtml: string,
  rightHtml: string,
  options?: ExtractionOptions,
) {
  return compareRenderedBlocks(
    blocksFromHtml(leftHtml, options),
    blocksFromHtml(rightHtml, options),
  );
}

export function presentationFromBlocks(blocks: RenderedBlockDiff[]) {
  return buildRenderedDiffPresentation(blocks);
}

export function parseHtmlBody(html: string): HTMLElement {
  return new DOMParser().parseFromString(html, "text/html").body;
}
