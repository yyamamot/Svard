const maximumImageDimension = 4096;

export async function copyImageToClipboard(
  source: HTMLImageElement | SVGElement,
): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Image clipboard is not supported");
  }
  const blob =
    source instanceof HTMLImageElement ? imageToPng(source) : svgToPng(source);
  await copyPngToClipboard(blob);
}

export async function copySvgToClipboard(source: string): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Image clipboard is not supported");
  }
  await copyPngToClipboard(svgTextToPng(source));
}

export function copyPngToClipboard(blob: Promise<Blob>): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Image clipboard is not supported");
  }
  return navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export function imageClipboardSize(width: number, height: number) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error("Image has no usable dimensions");
  }
  const scale = Math.min(1, maximumImageDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

async function imageToPng(image: HTMLImageElement): Promise<Blob> {
  if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    throw new Error("Image is not loaded");
  }
  return drawToPng(image, image.naturalWidth, image.naturalHeight);
}

async function svgToPng(svg: SVGElement): Promise<Blob> {
  const clone = svg.cloneNode(true) as SVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const source = new XMLSerializer().serializeToString(clone);
  return svgTextToPng(source, svg);
}

async function svgTextToPng(source: string, svg?: SVGElement): Promise<Blob> {
  const url = URL.createObjectURL(
    new Blob([source], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const image = await loadImage(url);
    const viewBox = svg?.getAttribute("viewBox")?.trim().split(/\s+/u);
    const width =
      Number.parseFloat(svg?.getAttribute("width") ?? "") ||
      Number(viewBox?.[2]);
    const height =
      Number.parseFloat(svg?.getAttribute("height") ?? "") ||
      Number(viewBox?.[3]);
    return await drawToPng(
      image,
      width || image.naturalWidth,
      height || image.naturalHeight,
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

function drawToPng(
  image: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): Promise<Blob> {
  const { width, height } = imageClipboardSize(sourceWidth, sourceHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");
  context.drawImage(image, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("PNG conversion failed")),
      "image/png",
    );
  });
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("SVG could not be decoded"));
    image.src = source;
  });
}
