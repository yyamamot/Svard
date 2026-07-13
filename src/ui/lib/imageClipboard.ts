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

export async function copyImageWithReferenceToClipboard(
  source: HTMLImageElement,
  referenceText: string,
): Promise<void> {
  if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
    throw new Error("Image clipboard is not supported");
  }
  await copyPngToClipboard(imageWithReferenceToPng(source, referenceText));
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

export function imageReferencePixelDensity(
  naturalWidth: number,
  clientWidth: number,
  devicePixelRatio: number,
) {
  return Math.max(
    1,
    Math.min(
      devicePixelRatio || 1,
      clientWidth > 0 ? naturalWidth / clientWidth : 1,
    ),
  );
}

export function imageReferenceCompositeLayout(
  width: number,
  contentHeight: number,
  footerHeight: number,
) {
  const totalHeight = contentHeight + footerHeight;
  const output = imageClipboardSize(width, totalHeight);
  const outputContentHeight = Math.max(
    1,
    Math.min(
      output.height - 1,
      Math.round((output.height * contentHeight) / totalHeight),
    ),
  );
  return {
    width: output.width,
    height: output.height,
    contentHeight: outputContentHeight,
    footerHeight: output.height - outputContentHeight,
  };
}

async function imageToPng(image: HTMLImageElement): Promise<Blob> {
  if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    throw new Error("Image is not loaded");
  }
  return drawToPng(image, image.naturalWidth, image.naturalHeight);
}

async function imageWithReferenceToPng(
  image: HTMLImageElement,
  referenceText: string,
): Promise<Blob> {
  if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    throw new Error("Image is not loaded");
  }
  const density = imageReferencePixelDensity(
    image.naturalWidth,
    image.clientWidth,
    window.devicePixelRatio || 1,
  );
  const fontSize = 12 * density;
  const lineHeight = 17 * density;
  const paddingX = 12 * density;
  const paddingY = 10 * density;
  const measurement = document.createElement("canvas").getContext("2d");
  if (!measurement) throw new Error("Canvas is not available");
  measurement.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  const lines = wrapReferenceText(
    referenceText,
    Math.max(1, image.naturalWidth - paddingX * 2),
    (text) => measurement.measureText(text).width,
  );
  const footerHeight = Math.ceil(paddingY * 2 + lines.length * lineHeight);
  const output = imageReferenceCompositeLayout(
    image.naturalWidth,
    image.naturalHeight,
    footerHeight,
  );
  const scale = output.width / image.naturalWidth;
  const canvas = document.createElement("canvas");
  canvas.width = output.width;
  canvas.height = output.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");
  context.drawImage(image, 0, 0, output.width, output.contentHeight);

  const styleSource =
    image.closest<HTMLElement>(".document-body, article, .viewer-pane") ??
    image;
  const computed = getComputedStyle(styleSource);
  context.fillStyle = opaqueBackground(computed.backgroundColor);
  context.fillRect(0, output.contentHeight, output.width, output.footerHeight);
  context.strokeStyle = "rgba(127, 127, 127, 0.45)";
  context.beginPath();
  context.moveTo(0, output.contentHeight + 0.5);
  context.lineTo(output.width, output.contentHeight + 0.5);
  context.stroke();
  context.fillStyle = computed.color || "rgb(31, 35, 40)";
  context.font = `${fontSize * scale}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
  context.textBaseline = "top";
  lines.forEach((line, index) => {
    context.fillText(
      line,
      paddingX * scale,
      output.contentHeight + paddingY * scale + index * lineHeight * scale,
    );
  });
  return canvasToPng(canvas);
}

export function wrapReferenceText(
  text: string,
  maximumWidth: number,
  measure: (value: string) => number,
): string[] {
  const lines: string[] = [];
  for (const sourceLine of text.split("\n")) {
    if (!sourceLine) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const character of sourceLine) {
      const candidate = current + character;
      if (current && measure(candidate) > maximumWidth) {
        lines.push(current);
        current = character;
      } else {
        current = candidate;
      }
    }
    lines.push(current);
  }
  return lines;
}

function opaqueBackground(value: string) {
  return !value ||
    value === "transparent" ||
    /rgba\([^)]*,\s*0\s*\)/u.test(value)
    ? "rgb(255, 255, 255)"
    : value;
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
  return canvasToPng(canvas);
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
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
