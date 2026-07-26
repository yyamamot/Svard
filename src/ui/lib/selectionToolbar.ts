export interface SelectionToolbarRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

export interface SelectionToolbarPlacement {
  left: number;
  top: number;
  side: "above" | "below" | "right" | "left";
}

interface SelectionToolbarPlacementInput {
  bounds: SelectionToolbarRect;
  firstLine: SelectionToolbarRect;
  lastLine: SelectionToolbarRect;
  toolbarHeight: number;
  toolbarWidth: number;
  gap?: number;
}

export function placeSelectionToolbar({
  bounds,
  firstLine,
  lastLine,
  toolbarHeight,
  toolbarWidth,
  gap = 8,
}: SelectionToolbarPlacementInput): SelectionToolbarPlacement {
  const minimumLeft = bounds.left + gap;
  const maximumLeft = Math.max(minimumLeft, bounds.right - toolbarWidth - gap);
  const minimumTop = bounds.top + gap;
  const maximumTop = Math.max(minimumTop, bounds.bottom - toolbarHeight - gap);
  const clampLeft = (value: number) =>
    Math.min(maximumLeft, Math.max(minimumLeft, value));
  const clampTop = (value: number) =>
    Math.min(maximumTop, Math.max(minimumTop, value));

  const above = firstLine.top - toolbarHeight - gap;
  if (above >= minimumTop) {
    return {
      left: clampLeft(firstLine.left),
      top: above,
      side: "above",
    };
  }

  const below = lastLine.bottom + gap;
  if (below <= maximumTop) {
    return {
      left: clampLeft(lastLine.left),
      top: below,
      side: "below",
    };
  }

  const right = lastLine.right + gap;
  if (right + toolbarWidth <= bounds.right - gap) {
    return {
      left: right,
      top: clampTop(lastLine.top),
      side: "right",
    };
  }

  const left = firstLine.left - toolbarWidth - gap;
  if (left >= minimumLeft) {
    return {
      left,
      top: clampTop(firstLine.top),
      side: "left",
    };
  }

  return {
    left: clampLeft(lastLine.left),
    top: maximumTop,
    side: "below",
  };
}
