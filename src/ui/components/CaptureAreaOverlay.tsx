import { useEffect, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  clampCaptureArea,
  type CaptureAreaRect,
  visibleCaptureBounds,
} from "../lib/captureArea";

interface CaptureAreaOverlayProps {
  article: HTMLElement;
  viewer: HTMLElement;
  onCapture: (rect: CaptureAreaRect) => void;
  onClose: () => void;
}

interface CaptureDragState {
  pointerId: number;
  startX: number;
  startY: number;
  rect: CaptureAreaRect | null;
}

export function CaptureAreaOverlay({
  article,
  viewer,
  onCapture,
  onClose,
}: CaptureAreaOverlayProps) {
  const [bounds, setBounds] = useState<CaptureAreaRect | null>(() =>
    visibleCaptureBounds(
      article.getBoundingClientRect(),
      viewer.getBoundingClientRect(),
    ),
  );
  const [drag, setDrag] = useState<CaptureDragState | null>(null);

  useEffect(() => {
    function cancelOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", cancelOnEscape);
    return () => window.removeEventListener("keydown", cancelOnEscape);
  }, [onClose]);

  useEffect(() => {
    function refreshBounds() {
      setBounds(
        visibleCaptureBounds(
          article.getBoundingClientRect(),
          viewer.getBoundingClientRect(),
        ),
      );
    }
    window.addEventListener("resize", refreshBounds);
    return () => window.removeEventListener("resize", refreshBounds);
  }, [article, viewer]);

  if (!bounds) {
    return null;
  }
  const activeBounds = bounds;

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      rect: null,
    });
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setDrag({
      ...drag,
      rect: clampCaptureArea(
        drag.startX,
        drag.startY,
        event.clientX,
        event.clientY,
        activeBounds,
      ),
    });
  }

  function finishCapture(event: ReactPointerEvent<HTMLDivElement>) {
    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.releasePointerCapture(event.pointerId);
    const rect = clampCaptureArea(
      drag.startX,
      drag.startY,
      event.clientX,
      event.clientY,
      activeBounds,
    );
    if (rect) {
      onCapture(rect);
    }
    onClose();
  }

  return (
    <div
      className="capture-area-overlay"
      data-review-id="capture-area-overlay"
      data-selection-exclude="true"
      style={{
        left: activeBounds.left,
        top: activeBounds.top,
        width: activeBounds.width,
        height: activeBounds.height,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishCapture}
      onPointerCancel={onClose}
      onWheel={(event) => event.preventDefault()}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {drag?.rect && (
        <div
          className="capture-area-selection"
          data-review-id="capture-area-selection"
          data-selection-exclude="true"
          style={{
            left: drag.rect.left - activeBounds.left,
            top: drag.rect.top - activeBounds.top,
            width: drag.rect.width,
            height: drag.rect.height,
          }}
        />
      )}
    </div>
  );
}
