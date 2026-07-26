import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

interface ResizeState {
  pointerId: number;
  startRatio: number;
  startX: number;
}

interface CodexMainSplitProps {
  open: boolean;
  panel: ReactNode;
  viewer: ReactNode;
}

export function CodexMainSplit({ open, panel, viewer }: CodexMainSplitProps) {
  const [ratio, setRatio] = useState(0.55);
  const resizeRef = useRef<ResizeState | null>(null);
  const [resizing, setResizing] = useState(false);

  function begin(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = {
      pointerId: event.pointerId,
      startRatio: ratio,
      startX: event.clientX,
    };
    setResizing(true);
  }

  function update(event: ReactPointerEvent<HTMLDivElement>) {
    const active = resizeRef.current;
    if (!active || active.pointerId !== event.pointerId) {
      return;
    }
    const container = event.currentTarget.closest(".codex-main-split");
    const width =
      container instanceof HTMLElement
        ? container.getBoundingClientRect().width
        : 1;
    const minimumDocument = 300 / width;
    const maximumDocument = 1 - 320 / width;
    setRatio(
      Math.min(
        Math.max(minimumDocument, maximumDocument),
        Math.max(
          minimumDocument,
          active.startRatio + (event.clientX - active.startX) / width,
        ),
      ),
    );
  }

  function end(event: ReactPointerEvent<HTMLDivElement>) {
    const active = resizeRef.current;
    if (!active || active.pointerId !== event.pointerId) {
      return;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resizeRef.current = null;
    setResizing(false);
  }

  return (
    <div
      className={`codex-main-split ${open ? "open" : "closed"}`}
      style={
        { "--codex-document-width": `${ratio * 100}%` } as React.CSSProperties
      }
      data-review-id={open ? "codex-main-split" : undefined}
    >
      <div className="codex-document-pane">{viewer}</div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize document and AI panels"
        className={`codex-main-resizer ${resizing ? "active" : ""}`}
        onPointerDown={begin}
        onPointerMove={update}
        onPointerUp={end}
        onPointerCancel={end}
      />
      <div className="codex-ai-pane">{panel}</div>
    </div>
  );
}
