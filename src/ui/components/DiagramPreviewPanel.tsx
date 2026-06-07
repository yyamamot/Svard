import { Maximize2, Minimize2, Minus, Plus, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
} from "react";
import type { DiagramPreviewState } from "../types";
import { sanitizeSvg } from "../lib/sanitizeHtml";
import {
  dangerouslySetSafeHtml,
  emptySafeHtml,
  unwrapSafeHtml,
} from "../lib/safeHtml";
import type { SafeHtml } from "../lib/safeHtml";

interface DiagramPreviewPanelProps {
  preview: DiagramPreviewState;
  onClose: () => void;
}

interface PanState {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

interface ViewportSize {
  width: number;
  height: number;
}

export function DiagramPreviewPanel({
  preview,
  onClose,
}: DiagramPreviewPanelProps) {
  const isRasterPreview = preview.kind === "image-raster";
  const isSelectableSvgPreview = preview.kind === "image-svg";
  const safeSvg = useMemo(
    () => (isRasterPreview ? emptySafeHtml : sanitizePreviewSvg(preview.svg)),
    [isRasterPreview, preview],
  );
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [panState, setPanState] = useState<PanState | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [viewportSize, setViewportSize] = useState<ViewportSize>(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));

  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setPanState(null);
    setExpanded(true);
  }, [isRasterPreview, preview, safeSvg]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose]);

  useEffect(() => {
    function updateViewportSize() {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    }

    window.addEventListener("resize", updateViewportSize);
    return () => window.removeEventListener("resize", updateViewportSize);
  }, []);

  const zoomLabel = useMemo(() => `${Math.round(zoom * 100)}%`, [zoom]);
  const previewSize = useMemo(() => {
    const naturalWidth =
      preview.width && preview.width > 0 ? preview.width : 960;
    const naturalHeight =
      preview.height && preview.height > 0 ? preview.height : 640;
    const maxWidth = expanded
      ? Math.max(320, viewportSize.width - 88)
      : Math.max(320, Math.min(viewportSize.width * 0.84, 980));
    const maxHeight = expanded
      ? Math.max(240, viewportSize.height - 112)
      : Math.max(240, viewportSize.height * 0.68);
    const fitScale = Math.min(
      1,
      maxWidth / naturalWidth,
      maxHeight / naturalHeight,
    );
    return {
      width: Math.max(1, Math.round(naturalWidth * fitScale * zoom)),
      height: Math.max(1, Math.round(naturalHeight * fitScale * zoom)),
    };
  }, [expanded, preview.height, preview.width, viewportSize, zoom]);

  const updateZoom = useCallback((nextZoom: number) => {
    setZoom(Math.min(4, Math.max(0.25, nextZoom)));
  }, []);

  function resetView() {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }

  function beginPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }
    if (
      isSelectableSvgPreview &&
      event.target instanceof SVGElement &&
      event.target.closest("text,tspan")
    ) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanState({
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
    });
  }

  function updatePan(event: ReactPointerEvent<HTMLDivElement>) {
    if (!panState || panState.pointerId !== event.pointerId) {
      return;
    }
    setOffset({
      x: panState.originX + event.clientX - panState.startX,
      y: panState.originY + event.clientY - panState.startY,
    });
  }

  function endPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (panState?.pointerId === event.pointerId) {
      setPanState(null);
    }
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey && !event.metaKey) {
      return;
    }
    event.preventDefault();
    updateZoom(zoom + (event.deltaY < 0 ? 0.1 : -0.1));
  }

  return (
    <div
      className="diagram-preview-backdrop"
      data-review-id="diagram-preview-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section
        className={`diagram-preview-panel ${expanded ? "expanded" : ""}`}
        data-review-id="diagram-preview-panel"
        role="dialog"
        aria-modal="true"
        aria-label={isRasterPreview ? "Image preview" : "Diagram preview"}
      >
        <header className="diagram-preview-toolbar">
          <div className="diagram-preview-title">
            <span>{preview.title}</span>
            {preview.sourceReference && (
              <small>{preview.sourceReference}</small>
            )}
          </div>
          <div className="diagram-preview-controls">
            <button
              type="button"
              className="icon-button"
              data-review-id="diagram-preview-zoom-out"
              aria-label="Zoom out"
              title="Zoom out"
              onClick={() => updateZoom(zoom - 0.2)}
            >
              <Minus size={15} />
            </button>
            <button
              type="button"
              className="diagram-preview-zoom-reset"
              data-review-id="diagram-preview-zoom-reset"
              aria-label="Reset zoom"
              title="Reset zoom"
              onClick={resetView}
            >
              {zoomLabel}
            </button>
            <button
              type="button"
              className="icon-button"
              data-review-id="diagram-preview-zoom-in"
              aria-label="Zoom in"
              title="Zoom in"
              onClick={() => updateZoom(zoom + 0.2)}
            >
              <Plus size={15} />
            </button>
            <button
              type="button"
              className="icon-button"
              data-review-id="diagram-preview-expand"
              aria-label={expanded ? "Exit full screen" : "Enter full screen"}
              title={expanded ? "Exit full screen" : "Enter full screen"}
              onClick={() => setExpanded((current) => !current)}
            >
              {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button
              type="button"
              className="icon-button"
              data-review-id="diagram-preview-close"
              aria-label="Close diagram preview"
              title="Close diagram preview"
              onClick={onClose}
            >
              <X size={15} />
            </button>
          </div>
        </header>
        <div
          className={`diagram-preview-canvas ${panState ? "panning" : ""}`}
          data-review-id="diagram-preview-canvas"
          onPointerDown={beginPan}
          onPointerMove={updatePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onWheel={handleWheel}
        >
          <div
            className={`diagram-preview-content ${
              isSelectableSvgPreview ? "selectable-svg" : ""
            }`}
            style={{
              width: `${previewSize.width}px`,
              height: `${previewSize.height}px`,
              transform: `translate(${offset.x}px, ${offset.y}px)`,
            }}
          >
            {isRasterPreview ? (
              <img
                alt={preview.title}
                src={preview.imageSrc}
                data-review-id="image-preview-content"
              />
            ) : (
              <div
                className="diagram-preview-svg-frame"
                data-review-id={
                  isSelectableSvgPreview
                    ? "image-svg-preview-content"
                    : "diagram-svg-preview-content"
                }
                dangerouslySetInnerHTML={dangerouslySetSafeHtml(safeSvg)}
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function sanitizePreviewSvg(svg: string): SafeHtml {
  const sanitized = sanitizeSvg(svg);
  const doc = new DOMParser().parseFromString(
    unwrapSafeHtml(sanitized),
    "image/svg+xml",
  );
  doc.querySelectorAll("*").forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const value = attribute.value.trim();
      if (
        /^(?:href|xlink:href)$/iu.test(attribute.name) &&
        value &&
        !value.startsWith("#")
      ) {
        element.removeAttribute(attribute.name);
      }
      if (/url\(\s*['"]?(?:https?:|data:)/iu.test(value)) {
        element.removeAttribute(attribute.name);
      }
    }
  });
  return sanitizeSvg(
    new XMLSerializer().serializeToString(doc.documentElement),
  );
}
