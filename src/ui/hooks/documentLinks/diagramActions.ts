import type { DocumentPayload } from "../../../core/types";
import {
  imagePreviewReference,
  imagePreviewTitle,
  imageSizeFromElement,
  svgSourceFromImageSrc,
} from "../../lib/imagePreview";
import { fileName } from "../../lib/path";
import type { DiagramPreviewState } from "../../types";

export function createDiagramActions({
  documentPayload,
  onOpenDiagramPreview,
  showInlineNotice,
}: {
  documentPayload: DocumentPayload | null;
  onOpenDiagramPreview: (preview: DiagramPreviewState) => void;
  showInlineNotice: (
    message: string,
    options?: { tone?: "info" | "success" | "warning" | "error" },
  ) => void;
}) {
  async function saveDiagramSvg(svg: SVGElement) {
    const clone = svg.cloneNode(true) as SVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const source = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stem = documentPayload ? fileName(documentPayload.path) : "diagram";
    anchor.href = url;
    anchor.download = `${stem.replace(/\.[^.]+$/, "")}-diagram.svg`;
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    showInlineNotice("Diagram SVG saved", { tone: "success" });
  }

  function openDiagramPreview(
    svg: SVGElement,
    sourceReference: string | undefined,
  ) {
    const title = documentPayload ? fileName(documentPayload.path) : "Diagram";
    const size = diagramSvgSize(svg);
    onOpenDiagramPreview({
      title: `${title} diagram`,
      svg: serializeDiagramSvg(svg),
      ...size,
      sourceReference,
    });
  }

  function openImagePreview(image: HTMLImageElement) {
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

  return { openDiagramPreview, openImagePreview, saveDiagramSvg };
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

function serializeDiagramSvg(svg: SVGElement) {
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(clone);
}
