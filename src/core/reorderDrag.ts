export const reorderDragThresholdPx = 6;

export function hasMovedBeyondThreshold({
  currentX,
  currentY,
  startX,
  startY,
  thresholdPx = reorderDragThresholdPx,
}: {
  currentX: number;
  currentY: number;
  startX: number;
  startY: number;
  thresholdPx?: number;
}): boolean {
  return Math.hypot(currentX - startX, currentY - startY) >= thresholdPx;
}
