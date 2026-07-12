import { toBlob } from "html-to-image";
import { copyPngToClipboard, imageClipboardSize } from "./imageClipboard";

export interface CaptureAreaRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type CaptureAreaCommandHandler = () => boolean;

export const minimumCaptureAreaSize = 8;

export function clampCaptureArea(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  bounds: CaptureAreaRect,
): CaptureAreaRect | null {
  const left = Math.max(bounds.left, Math.min(startX, endX));
  const top = Math.max(bounds.top, Math.min(startY, endY));
  const right = Math.min(bounds.left + bounds.width, Math.max(startX, endX));
  const bottom = Math.min(bounds.top + bounds.height, Math.max(startY, endY));
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  return width >= minimumCaptureAreaSize && height >= minimumCaptureAreaSize
    ? { left, top, width, height }
    : null;
}

export function visibleCaptureBounds(
  article: DOMRect,
  viewer: DOMRect,
): CaptureAreaRect | null {
  const left = Math.max(article.left, viewer.left);
  const top = Math.max(article.top, viewer.top);
  const right = Math.min(article.right, viewer.right);
  const bottom = Math.min(article.bottom, viewer.bottom);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  return width >= minimumCaptureAreaSize && height >= minimumCaptureAreaSize
    ? { left, top, width, height }
    : null;
}

export function captureAreaImageSize(
  rect: Pick<CaptureAreaRect, "width" | "height">,
  pixelRatio = window.devicePixelRatio || 1,
) {
  return imageClipboardSize(rect.width * pixelRatio, rect.height * pixelRatio);
}

export function copyCaptureAreaToClipboard(
  article: HTMLElement,
  rect: CaptureAreaRect,
): Promise<void> {
  return copyPngToClipboard(captureArticleArea(article, rect));
}

async function captureArticleArea(
  article: HTMLElement,
  rect: CaptureAreaRect,
): Promise<Blob> {
  const articleRect = article.getBoundingClientRect();
  if (articleRect.width <= 0 || articleRect.height <= 0) {
    throw new Error("Document has no visible area");
  }

  const frame = document.createElement("div");
  const clone = article.cloneNode(true) as HTMLElement;
  const offsetX = rect.left - articleRect.left;
  const offsetY = rect.top - articleRect.top;
  const background = captureAreaBackground(article);

  Object.assign(frame.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: "-1",
    background,
  });
  Object.assign(clone.style, {
    position: "absolute",
    left: `${-offsetX - article.scrollLeft}px`,
    top: `${-offsetY - article.scrollTop}px`,
    width: `${articleRect.width}px`,
    maxWidth: "none",
    margin: "0",
  });
  preserveCaptureLayout(article, clone);
  removeMediaOutsideCapture(article, clone, rect);
  frame.appendChild(clone);
  document.body.appendChild(frame);
  copyScrollOffsets(article, clone);

  try {
    const { width, height } = captureAreaImageSize(rect);
    const blob = await toBlob(frame, {
      canvasWidth: width,
      canvasHeight: height,
      pixelRatio: 1,
      skipAutoScale: true,
      filter: (node) =>
        !(node instanceof Element) ||
        (!node.hasAttribute("data-selection-exclude") &&
          !node.classList.contains("source-block-toolbar") &&
          !node.classList.contains("capture-area-overlay")),
    });
    if (!blob) {
      throw new Error("PNG conversion failed");
    }
    return blob;
  } finally {
    frame.remove();
  }
}

function preserveCaptureLayout(article: HTMLElement, clone: HTMLElement) {
  const computed = getComputedStyle(article);
  for (const property of computed) {
    if (property.startsWith("--")) {
      clone.style.setProperty(property, computed.getPropertyValue(property));
    }
  }
  if (computed.display === "grid") {
    clone.style.gridTemplateColumns = computed.gridTemplateColumns;
    clone.style.gridTemplateRows = computed.gridTemplateRows;
  }
}

function copyScrollOffsets(article: HTMLElement, clone: HTMLElement) {
  const originals = [article, ...article.querySelectorAll<HTMLElement>("*")];
  const clones = [clone, ...clone.querySelectorAll<HTMLElement>("*")];
  for (let index = 0; index < originals.length; index += 1) {
    const original = originals[index];
    const cloned = clones[index];
    if (!original || !cloned) {
      continue;
    }
    cloned.scrollLeft = original.scrollLeft;
    cloned.scrollTop = original.scrollTop;
  }
}

export function captureAreaBackground(article: HTMLElement) {
  let current: HTMLElement | null = article;
  while (current) {
    const background = getComputedStyle(current).backgroundColor;
    if (!isTransparentBackground(background)) {
      return background;
    }
    current = current.parentElement;
  }
  return "rgb(255, 255, 255)";
}

function isTransparentBackground(value: string) {
  return (
    value === "transparent" ||
    /^rgba\([^)]*,\s*0\)$/u.test(value.replace(/\s+/gu, " "))
  );
}

function removeMediaOutsideCapture(
  article: HTMLElement,
  clone: HTMLElement,
  capture: CaptureAreaRect,
) {
  const originalMedia = Array.from(article.querySelectorAll("img, svg"));
  const clonedMedia = Array.from(clone.querySelectorAll("img, svg"));
  for (let index = 0; index < originalMedia.length; index += 1) {
    const original = originalMedia[index];
    const cloned = clonedMedia[index];
    if (
      !original ||
      !cloned ||
      rectsIntersect(original.getBoundingClientRect(), capture)
    ) {
      continue;
    }
    cloned.remove();
  }
}

function rectsIntersect(rect: DOMRect, capture: CaptureAreaRect) {
  return (
    rect.left < capture.left + capture.width &&
    rect.right > capture.left &&
    rect.top < capture.top + capture.height &&
    rect.bottom > capture.top
  );
}
