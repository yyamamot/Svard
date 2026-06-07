import type { MouseEvent } from "react";

export function createArticleDoubleClickHandler({
  openDiagramPreview,
  openImagePreview,
}: {
  openDiagramPreview: (
    svg: SVGElement,
    sourceReference: string | undefined,
  ) => void;
  openImagePreview: (image: HTMLImageElement) => void;
}) {
  return function handleArticleDoubleClick(event: MouseEvent<HTMLElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (
      target.closest("a[href]") ||
      target.closest(".diagram-inline-diagnostic,.image-placeholder")
    ) {
      return;
    }

    const diagram = target.closest<HTMLElement>(".diagram-inline-image");
    const svg =
      target.closest(".diagram-inline-image svg") ??
      diagram?.querySelector("svg");
    if (svg instanceof SVGElement) {
      if (hasActiveSelectionOutside(diagram ?? svg)) {
        return;
      }
      event.preventDefault();
      openDiagramPreview(
        svg,
        diagram?.getAttribute("data-source-reference") ?? undefined,
      );
      return;
    }

    const image = target.closest("img");
    if (image instanceof HTMLImageElement && image.getAttribute("src")) {
      if (hasActiveSelectionOutside(image)) {
        return;
      }
      event.preventDefault();
      openImagePreview(image);
    }
  };
}

function hasActiveSelectionOutside(target: Element) {
  const selection = window.getSelection();
  if (!selection?.toString().trim()) {
    return false;
  }
  const anchor = selection.anchorNode;
  const focus = selection.focusNode;
  if (!anchor || !focus) {
    return true;
  }
  return !target.contains(anchor) && !target.contains(focus);
}
