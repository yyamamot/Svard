import type { DocumentLinkResolution } from "../../../core/types";
import {
  imagePreviewReference,
  imagePreviewTitle,
  imageSizeFromElement,
  svgSourceFromImageSrc,
} from "../../lib/imagePreview";
import { isExternalUrl, splitPathAndHash } from "../../lib/path";
import type { DiagramPreviewState } from "../../types";

export async function openDiffLinkElement({
  link,
  documentPath,
  confirmExternalLink,
  openDocument,
  openExternalUrl,
  resolveDocumentLink,
  showInlineNotice,
}: {
  link: HTMLAnchorElement;
  documentPath: string | null;
  confirmExternalLink: (url: string) => Promise<boolean>;
  openDocument: (path: string) => Promise<void>;
  openExternalUrl: (url: string) => Promise<void>;
  resolveDocumentLink: (
    href: string,
    documentPath: string,
  ) => Promise<DocumentLinkResolution>;
  showInlineNotice: (
    message: string,
    options?: { tone?: "info" | "success" | "warning" | "error" },
  ) => void;
}) {
  const href = link.getAttribute("href") ?? "";
  if (!href) {
    return;
  }
  if (isExternalUrl(href)) {
    if (await confirmExternalLink(href)) {
      try {
        await openExternalUrl(href);
      } catch (error) {
        showInlineNotice(
          error instanceof Error ? error.message : "External link open failed",
          { tone: "error" },
        );
      }
    }
    return;
  }
  if (!documentPath) {
    showInlineNotice("Document link is not available", { tone: "warning" });
    return;
  }
  const target = splitPathAndHash(href);
  const resolved = await resolveDocumentLink(href, documentPath);
  if (resolved.status !== "resolved" || !resolved.path) {
    showInlineNotice(resolved.message ?? "Document link is not available", {
      tone: "warning",
    });
    return;
  }
  await openDocument(resolved.path);
  const hash = resolved.hash ?? target.hash;
  if (hash) {
    window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({
        block: "start",
        behavior: "smooth",
      });
    }, 50);
  }
}

export function openDiffDiagramPreview({
  svg,
  sourceReference,
  documentPath,
  onOpenDiagramPreview,
  target,
  beforeTitle = "Before",
  afterTitle = "After",
  preparedPreview,
}: {
  svg: SVGElement;
  sourceReference: string | undefined;
  documentPath: string | null;
  onOpenDiagramPreview: (preview: DiagramPreviewState) => void;
  target?: HTMLElement;
  beforeTitle?: string;
  afterTitle?: string;
  preparedPreview?: DiagramPreviewState;
}) {
  if (preparedPreview) {
    onOpenDiagramPreview(preparedPreview);
    return;
  }
  const comparison = diffDiagramComparisonForTarget({
    afterTitle,
    beforeTitle,
    currentSvg: svg,
    target,
  });
  if (comparison) {
    onOpenDiagramPreview({
      kind: "diagram-comparison",
      title: documentPath
        ? `${documentPath.split(/[\\/]/u).at(-1)} diagram comparison`
        : "Diagram comparison",
      ...comparison,
    });
    return;
  }
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  onOpenDiagramPreview({
    title: documentPath
      ? `${documentPath.split(/[\\/]/u).at(-1)} diagram`
      : "Diagram",
    svg: new XMLSerializer().serializeToString(clone),
    ...diagramSvgSize(clone),
    sourceReference,
  });
}

function diffDiagramComparisonForTarget({
  afterTitle,
  beforeTitle,
  currentSvg,
  target,
}: {
  afterTitle: string;
  beforeTitle: string;
  currentSvg: SVGElement;
  target?: HTMLElement;
}):
  | {
      before?: {
        title: string;
        svg: string;
        width?: number;
        height?: number;
        sourceReference?: string;
      };
      after?: {
        title: string;
        svg: string;
        width?: number;
        height?: number;
        sourceReference?: string;
      };
    }
  | null {
  if (!isLocalDiffDiagramSvg(currentSvg)) {
    return null;
  }
  const currentBlock =
    currentSvg.closest<HTMLElement>(".git-rendered-block[data-sync-index]") ??
    target?.closest<HTMLElement>(".git-rendered-block[data-sync-index]");
  const syncIndex = currentBlock?.dataset.syncIndex;
  const renderedDiff = currentBlock?.closest<HTMLElement>(
    ".git-rendered-diff-body",
  );
  if (!syncIndex || !renderedDiff) {
    return null;
  }
  const escapedIndex = cssEscape(syncIndex);
  const beforeBlock = renderedDiff.querySelector<HTMLElement>(
    `.git-rendered-block.left-side[data-sync-index="${escapedIndex}"]`,
  );
  const afterBlock = renderedDiff.querySelector<HTMLElement>(
    `.git-rendered-block.right-side[data-sync-index="${escapedIndex}"]`,
  );
  const before = beforeBlock
    ? localDiagramPreviewSide(beforeBlock, beforeTitle)
    : undefined;
  const after = afterBlock
    ? localDiagramPreviewSide(afterBlock, afterTitle)
    : undefined;
  if (!before && !after) {
    return null;
  }
  return { before, after };
}

export function buildDiffDiagramComparisonPreview({
  afterTitle = "After",
  beforeTitle = "Before",
  documentPath,
  svg,
  target,
}: {
  afterTitle?: string;
  beforeTitle?: string;
  documentPath: string | null;
  svg: SVGElement;
  target?: HTMLElement;
}): DiagramPreviewState | undefined {
  const comparison = diffDiagramComparisonForTarget({
    afterTitle,
    beforeTitle,
    currentSvg: svg,
    target,
  });
  if (!comparison) {
    return undefined;
  }
  return {
    kind: "diagram-comparison",
    title: documentPath
      ? `${documentPath.split(/[\\/]/u).at(-1)} diagram comparison`
      : "Diagram comparison",
    ...comparison,
  };
}

function localDiagramPreviewSide(
  block: HTMLElement,
  title: string,
):
  | {
      title: string;
      svg: string;
      width?: number;
      height?: number;
      sourceReference?: string;
    }
  | undefined {
  const svg = Array.from(block.querySelectorAll<SVGElement>("svg")).find(
    isLocalDiffDiagramSvg,
  );
  if (!svg) {
    return undefined;
  }
  const sourceReference =
    svg.closest<HTMLElement>(".diagram-inline-image")?.dataset
      .sourceReference ?? undefined;
  return {
    title,
    svg: serializeDiagramSvg(svg),
    ...diagramSvgSize(svg),
    sourceReference,
  };
}

function isLocalDiffDiagramSvg(svg: SVGElement): boolean {
  return Boolean(
    svg.closest('[data-review-id="diagram-inline-image"]') &&
      !svg.closest('[data-review-id="kroki-render"]'),
  );
}

function serializeDiagramSvg(svg: SVGElement): string {
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(clone);
}

function diagramSvgSize(svg: SVGElement) {
  const width = Number.parseFloat(svg.getAttribute("width") ?? "");
  const height = Number.parseFloat(svg.getAttribute("height") ?? "");
  if (width > 0 && height > 0) {
    return { width, height };
  }
  const viewBox = svg.getAttribute("viewBox")?.trim().split(/\s+/);
  if (viewBox?.length === 4) {
    const viewBoxWidth = Number.parseFloat(viewBox[2]);
    const viewBoxHeight = Number.parseFloat(viewBox[3]);
    if (viewBoxWidth > 0 && viewBoxHeight > 0) {
      return { width: viewBoxWidth, height: viewBoxHeight };
    }
  }
  return undefined;
}

function cssEscape(value: string): string {
  return value.replace(/["\\]/gu, "\\$&");
}

export function openDiffImagePreview({
  image,
  onOpenDiagramPreview,
  showInlineNotice,
}: {
  image: HTMLImageElement;
  onOpenDiagramPreview: (preview: DiagramPreviewState) => void;
  showInlineNotice: (
    message: string,
    options?: { tone?: "info" | "success" | "warning" | "error" },
  ) => void;
}) {
  const imageSource = image.getAttribute("src") ?? "";
  const imageReference = imagePreviewReference(image);
  const title = imagePreviewTitle(image);
  const size = imageSizeFromElement(image);
  const svg = svgSourceFromImageSrc(imageSource);
  if (svg) {
    onOpenDiagramPreview({
      kind: "image-svg",
      title,
      svg,
      ...size,
      sourceReference: imageReference,
    });
    return;
  }
  if (!imageSource) {
    showInlineNotice("Image preview is not available", { tone: "warning" });
    return;
  }
  onOpenDiagramPreview({
    kind: "image-raster",
    title,
    imageSrc: imageSource,
    ...size,
    sourceReference: imageReference,
  });
}

export async function saveDiffDiagramSvg({
  svg,
  documentPath,
  showInlineNotice,
}: {
  svg: SVGElement;
  documentPath: string | null;
  showInlineNotice: (
    message: string,
    options?: { tone?: "info" | "success" | "warning" | "error" },
  ) => void;
}) {
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const source = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stem = (documentPath?.split(/[\\/]/u).at(-1) ?? "diagram").replace(
    /\.[^.]+$/u,
    "",
  );
  anchor.href = url;
  anchor.download = `${stem}-diagram.svg`;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  showInlineNotice("Diagram SVG saved", { tone: "success" });
}
