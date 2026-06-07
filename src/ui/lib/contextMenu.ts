export function clampContextMenuPosition({
  x,
  y,
  width,
  height,
  viewportWidth,
  viewportHeight,
  gap = 8,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  gap?: number;
}): { left: number; top: number } {
  return {
    left: Math.min(x, Math.max(gap, viewportWidth - width - gap)),
    top: Math.min(y, Math.max(gap, viewportHeight - height - gap)),
  };
}
