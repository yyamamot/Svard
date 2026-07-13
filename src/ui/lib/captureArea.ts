import { toBlob } from "html-to-image";
import {
  copyPngToClipboard,
  imageClipboardSize,
  imageReferenceCompositeLayout,
} from "./imageClipboard";
import {
  sectionLabelForElement,
  sectionLabelForRange,
} from "./locationReference";

export interface CaptureAreaRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type CaptureAreaVariant = "plain" | "reference";
export type CaptureAreaCommandHandler = (
  variant?: CaptureAreaVariant,
) => boolean;

export interface CaptureAreaRequest {
  id: number;
  variant: CaptureAreaVariant;
}

export const minimumCaptureAreaSize = 8;
export const captureAreaFailureNotice =
  "Image could not be copied; clipboard was not changed";
export const captureAreaImageDecodeTimeoutMs = 3000;

const activeCaptureTargets = new WeakSet<HTMLElement>();

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

export function captureAreaCompositeLayout(
  rect: Pick<CaptureAreaRect, "width" | "height">,
  footerHeight: number,
  pixelRatio = window.devicePixelRatio || 1,
) {
  return imageReferenceCompositeLayout(
    rect.width * pixelRatio,
    rect.height * pixelRatio,
    footerHeight * pixelRatio,
  );
}

export function copyCaptureAreaToClipboard(
  article: HTMLElement,
  rect: CaptureAreaRect,
  referenceText?: string,
): Promise<void> {
  if (activeCaptureTargets.has(article)) {
    return Promise.reject(new Error("Image capture is already in progress"));
  }
  activeCaptureTargets.add(article);
  try {
    return copyPngToClipboard(
      captureArticleArea(article, rect, referenceText),
    ).finally(() => activeCaptureTargets.delete(article));
  } catch (error) {
    activeCaptureTargets.delete(article);
    return Promise.reject(error);
  }
}

interface CaptureReferenceUnit {
  element: HTMLElement;
  path: string;
  startLine: number;
  endLine: number;
}

interface CaptureReferenceFragment {
  path: string;
  startLine?: number;
  endLine?: number;
  revision?: string;
  side?: "left" | "right";
  section?: string;
}

const captureReferenceRootSelector =
  ".viewer-pane[data-capture-document-path],.git-rendered-pane[data-capture-document-path]";

export function captureAreaReferenceForRect(
  article: HTMLElement,
  rect: CaptureAreaRect,
): string | undefined {
  const roots = captureReferenceRoots(article).filter((root) =>
    rectsIntersect(root.getBoundingClientRect(), rect),
  );
  const fragments = roots.flatMap((root) =>
    captureReferenceFragmentsForRoot(root, rect),
  );
  if (!fragments.length) {
    return undefined;
  }
  return fragments
    .map((fragment) => {
      const lineRange =
        fragment.startLine === undefined || fragment.endLine === undefined
          ? ""
          : `:${fragment.startLine === fragment.endLine ? fragment.startLine : `${fragment.startLine}-${fragment.endLine}`}`;
      return [
        `File: ${fragment.path}${lineRange}`,
        fragment.revision && fragment.side
          ? `Revision: ${fragment.revision} (${fragment.side})`
          : undefined,
        fragment.section ? `Section: ${fragment.section}` : undefined,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function captureReferenceRoots(article: HTMLElement) {
  if (article.matches(captureReferenceRootSelector)) {
    return [article];
  }
  const inside = Array.from(
    article.querySelectorAll<HTMLElement>(captureReferenceRootSelector),
  );
  if (inside.length) {
    return inside;
  }
  const closest = article.closest<HTMLElement>(captureReferenceRootSelector);
  return closest ? [closest] : [];
}

function captureReferenceFragmentsForRoot(
  root: HTMLElement,
  rect: CaptureAreaRect,
): CaptureReferenceFragment[] {
  const rootPath = root.dataset.captureDocumentPath;
  if (!rootPath) {
    return [];
  }
  const revision = root.dataset.captureRevisionLabel;
  const side =
    root.dataset.captureSide === "left" || root.dataset.captureSide === "right"
      ? root.dataset.captureSide
      : undefined;
  const units = captureReferenceUnits(root, rect, rootPath);
  if (!units.length) {
    const anchor = firstIntersectingContentElement(root, rect);
    return [
      {
        path: rootPath,
        revision,
        side,
        section: anchor
          ? (sectionLabelForElement(root, anchor) ?? undefined)
          : undefined,
      },
    ];
  }

  const groups: CaptureReferenceUnit[][] = [];
  for (const unit of units) {
    const current = groups.at(-1);
    if (!current || current[0]?.path !== unit.path) {
      groups.push([unit]);
    } else {
      current.push(unit);
    }
  }
  return groups.map((group) => ({
    path: group[0].path,
    startLine: group[0].startLine,
    endLine: group.at(-1)!.endLine,
    revision,
    side,
    section: commonSectionForUnits(root, group),
  }));
}

function captureReferenceUnits(
  root: HTMLElement,
  rect: CaptureAreaRect,
  rootPath: string,
) {
  const seen = new Set<string>();
  const units: CaptureReferenceUnit[] = [];
  const candidates = root.querySelectorAll<HTMLElement>(
    "[data-source-selection-block-id][data-source-selection-start][data-source-selection-end]",
  );
  for (const element of candidates) {
    if (
      element.closest(".source-block-collapsed") ||
      !rectsIntersect(element.getBoundingClientRect(), rect)
    ) {
      continue;
    }
    const id = element.dataset.sourceSelectionBlockId;
    const startLine = Number(element.dataset.sourceSelectionStart);
    const endLine = Number(element.dataset.sourceSelectionEnd);
    const path = element.dataset.sourceSelectionSourcePath || rootPath;
    const key = `${id}\u0000${path}\u0000${startLine}\u0000${endLine}`;
    if (
      !id ||
      !Number.isInteger(startLine) ||
      !Number.isInteger(endLine) ||
      startLine < 1 ||
      endLine < startLine ||
      seen.has(key)
    ) {
      continue;
    }
    seen.add(key);
    units.push({ element, path, startLine, endLine });
  }
  return units;
}

function commonSectionForUnits(
  root: HTMLElement,
  units: CaptureReferenceUnit[],
) {
  const first = units[0]?.element;
  const last = units.at(-1)?.element;
  if (!first || !last) {
    return undefined;
  }
  try {
    const range = document.createRange();
    range.setStartBefore(first);
    range.setEndAfter(last);
    return sectionLabelForRange({ article: root, range }) ?? undefined;
  } catch {
    return undefined;
  }
}

function firstIntersectingContentElement(
  root: HTMLElement,
  rect: CaptureAreaRect,
) {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      "h1,h2,h3,h4,h5,h6,p,pre,li,table,.diagram-slot,.diagram-inline",
    ),
  ).find((element) => rectsIntersect(element.getBoundingClientRect(), rect));
}

async function captureArticleArea(
  article: HTMLElement,
  rect: CaptureAreaRect,
  referenceText?: string,
): Promise<Blob> {
  const articleRect = article.getBoundingClientRect();
  if (articleRect.width <= 0 || articleRect.height <= 0) {
    throw new Error("Document has no visible area");
  }

  const background = captureAreaBackground(article);
  const contentFrame = createCaptureFrame(rect.width, rect.height, background);
  const clone = createCaptureClone(article, articleRect, rect);
  contentFrame.appendChild(clone);
  document.body.appendChild(contentFrame);
  copyScrollOffsets(article, clone);

  try {
    await waitForCaptureImages(contentFrame);
    if (!referenceText) {
      const size = captureAreaImageSize(rect);
      return await rasterizeCaptureFrame(contentFrame, size.width, size.height);
    }

    const footerFrame = createCaptureFrame(rect.width, 1, background);
    const footer = createCaptureAreaReferenceFooter(
      article,
      referenceText,
      rect.width,
    );
    footer.style.top = "0";
    footerFrame.appendChild(footer);
    document.body.appendChild(footerFrame);
    const footerHeight = Math.ceil(
      footer.getBoundingClientRect().height ||
        footer.scrollHeight ||
        estimateReferenceFooterHeight(referenceText, rect.width),
    );
    footer.style.height = `${footerHeight}px`;
    footerFrame.style.height = `${footerHeight}px`;

    try {
      const layout = captureAreaCompositeLayout(rect, footerHeight);
      const [content, footerImage] = await Promise.all([
        rasterizeCaptureFrame(contentFrame, layout.width, layout.contentHeight),
        rasterizeCaptureFrame(footerFrame, layout.width, layout.footerHeight),
      ]);
      return composeCaptureImages(
        content,
        footerImage,
        layout.width,
        layout.contentHeight,
        layout.footerHeight,
      );
    } finally {
      footerFrame.remove();
    }
  } finally {
    contentFrame.remove();
  }
}

export async function waitForCaptureImages(
  root: HTMLElement,
  timeoutMs = captureAreaImageDecodeTimeoutMs,
) {
  await Promise.all(
    Array.from(root.querySelectorAll("img")).map((image) =>
      waitForCaptureImage(image, timeoutMs),
    ),
  );
}

async function waitForCaptureImage(image: HTMLImageElement, timeoutMs: number) {
  if (!image.complete) {
    await waitForImageLoad(image, timeoutMs);
  }
  if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    throw new Error("Capture image could not be decoded");
  }
  if (typeof image.decode !== "function") {
    return;
  }
  try {
    await withTimeout(image.decode(), timeoutMs);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Capture image decode timed out"
    ) {
      throw error;
    }
    if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      throw new Error("Capture image could not be decoded", { cause: error });
    }
  }
}

function waitForImageLoad(image: HTMLImageElement, timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeout);
      image.removeEventListener("load", handleLoad);
      image.removeEventListener("error", handleError);
    };
    const handleLoad = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      cleanup();
      reject(new Error("Capture image could not be loaded"));
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("Capture image decode timed out"));
    }, timeoutMs);
    image.addEventListener("load", handleLoad, { once: true });
    image.addEventListener("error", handleError, { once: true });
    if (image.complete) {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        handleLoad();
      } else {
        handleError();
      }
    }
  });
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("Capture image decode timed out")),
      timeoutMs,
    );
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
}

function createCaptureFrame(width: number, height: number, background: string) {
  const frame = document.createElement("div");
  Object.assign(frame.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: `${width}px`,
    height: `${height}px`,
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: "-1",
    background,
  });
  return frame;
}

function createCaptureClone(
  article: HTMLElement,
  articleRect: DOMRect,
  rect: CaptureAreaRect,
) {
  const clone = article.cloneNode(true) as HTMLElement;
  const offsetX = rect.left - articleRect.left;
  const offsetY = rect.top - articleRect.top;
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
  return clone;
}

async function rasterizeCaptureFrame(
  frame: HTMLElement,
  width: number,
  height: number,
) {
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
  if (!blob) throw new Error("PNG conversion failed");
  return blob;
}

async function composeCaptureImages(
  content: Blob,
  footer: Blob,
  width: number,
  contentHeight: number,
  footerHeight: number,
) {
  const [contentImage, footerImage] = await Promise.all([
    loadCaptureImage(content),
    loadCaptureImage(footer),
  ]);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = contentHeight + footerHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available");
    context.drawImage(contentImage.image, 0, 0, width, contentHeight);
    context.drawImage(footerImage.image, 0, contentHeight, width, footerHeight);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("PNG conversion failed")),
        "image/png",
      ),
    );
  } finally {
    URL.revokeObjectURL(contentImage.url);
    URL.revokeObjectURL(footerImage.url);
  }
}

function loadCaptureImage(blob: Blob) {
  const url = URL.createObjectURL(blob);
  return new Promise<{ image: HTMLImageElement; url: string }>(
    (resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ image, url });
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("PNG could not be decoded"));
      };
      image.src = url;
    },
  );
}

export function createCaptureAreaReferenceFooter(
  article: HTMLElement,
  referenceText: string,
  width: number,
) {
  const footer = document.createElement("div");
  footer.dataset.captureReferenceFooter = "true";
  footer.textContent = referenceText;
  const computed = getComputedStyle(article);
  Object.assign(footer.style, {
    position: "absolute",
    left: "0",
    width: `${width}px`,
    boxSizing: "border-box",
    padding: "10px 12px",
    borderTop: "1px solid rgba(127, 127, 127, 0.45)",
    background: captureAreaBackground(article),
    color: computed.color || "rgb(31, 35, 40)",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "12px",
    lineHeight: "17px",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  });
  return footer;
}

function estimateReferenceFooterHeight(referenceText: string, width: number) {
  const charactersPerLine = Math.max(12, Math.floor((width - 24) / 7.2));
  const lines = referenceText
    .split("\n")
    .reduce(
      (count, line) =>
        count + Math.max(1, Math.ceil(line.length / charactersPerLine)),
      0,
    );
  return 21 + lines * 17;
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
