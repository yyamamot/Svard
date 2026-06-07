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
}: {
  svg: SVGElement;
  sourceReference: string | undefined;
  documentPath: string | null;
  onOpenDiagramPreview: (preview: DiagramPreviewState) => void;
}) {
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  onOpenDiagramPreview({
    title: documentPath
      ? `${documentPath.split(/[\\/]/u).at(-1)} diagram`
      : "Diagram",
    svg: new XMLSerializer().serializeToString(clone),
    sourceReference,
  });
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
