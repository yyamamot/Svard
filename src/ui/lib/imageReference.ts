export interface ImageReferenceRevision {
  label: string;
  side: "left" | "right";
}

export interface ImageReferenceOptions {
  documentPath?: string | null;
  revision?: ImageReferenceRevision | null;
}

export function imageReferenceForElement(
  image: HTMLImageElement,
  options: ImageReferenceOptions = {},
): string | undefined {
  const lines: string[] = [];
  const imageLocation =
    image.dataset.imageResolvedPath ?? image.dataset.imageUrl;
  if (imageLocation) {
    lines.push(`Image: ${imageLocation}`);
  }

  const sourceElement = image.closest<HTMLElement>(
    "[data-source-selection-start]",
  );
  const sourcePath =
    sourceElement?.dataset.sourceSelectionSourcePath ??
    options.documentPath ??
    image.dataset.imageReference;
  if (sourcePath) {
    const sourceLine = Number(sourceElement?.dataset.sourceSelectionStart);
    lines.push(
      `File: ${sourcePath}${Number.isInteger(sourceLine) && sourceLine > 0 ? `:${sourceLine}` : ""}`,
    );
  }

  if (options.revision) {
    lines.push(
      `Revision: ${options.revision.label} (${options.revision.side})`,
    );
  }
  return lines.length ? lines.join("\n") : undefined;
}
