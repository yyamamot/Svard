export function svgSourceFromImageSrc(src: string): string | null {
  const match = src.match(
    /^data:image\/svg\+xml(?:;charset=[^,;]+)?(;base64)?,(.*)$/iu,
  );
  if (!match?.[2]) {
    return null;
  }
  try {
    return match[1] ? window.atob(match[2]) : decodeURIComponent(match[2]);
  } catch {
    return null;
  }
}

export function imageSizeFromElement(image: HTMLImageElement) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (width > 0 && height > 0) {
    return { width, height };
  }
  return undefined;
}

export function imagePreviewTitle(image: HTMLImageElement, fallback = "Image") {
  const imageReference =
    image.getAttribute("data-image-reference") ??
    image.getAttribute("data-image-path") ??
    undefined;
  return (
    image.getAttribute("alt")?.trim() ||
    imageReference?.split(/[\\/]/u).at(-1) ||
    fallback
  );
}

export function imagePreviewReference(image: HTMLImageElement) {
  return (
    image.getAttribute("data-image-reference") ??
    image.getAttribute("data-image-path") ??
    undefined
  );
}
