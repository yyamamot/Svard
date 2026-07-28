import {
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { MainAgentPanelPlacement } from "../agent/agentPanelTypes";

const minimumBottomHeight = 220;
const maximumBottomHeightRatio = 0.6;

interface ResizeState {
  pointerId: number;
  placement: MainAgentPanelPlacement;
  startHeight: number;
  startRatio: number;
  startX: number;
  startY: number;
}

interface CodexMainSplitProps {
  open: boolean;
  panel: ReactNode;
  placement: MainAgentPanelPlacement;
  viewer: ReactNode;
}

export function CodexMainSplit({
  open,
  panel,
  placement,
  viewer,
}: CodexMainSplitProps) {
  const [ratio, setRatio] = useState(0.55);
  const [bottomHeightPx, setBottomHeightPx] = useState<number | null>(null);
  const resizeRef = useRef<ResizeState | null>(null);
  const [resizing, setResizing] = useState(false);

  function begin(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const container = event.currentTarget.closest(".codex-main-split");
    const aiPane = container?.querySelector(".codex-ai-pane");
    resizeRef.current = {
      pointerId: event.pointerId,
      placement,
      startHeight:
        aiPane instanceof HTMLElement
          ? aiPane.getBoundingClientRect().height
          : minimumBottomHeight,
      startRatio: ratio,
      startX: event.clientX,
      startY: event.clientY,
    };
    setResizing(true);
  }

  function update(event: ReactPointerEvent<HTMLDivElement>) {
    const active = resizeRef.current;
    if (!active || active.pointerId !== event.pointerId) {
      return;
    }
    const container = event.currentTarget.closest(".codex-main-split");
    if (!(container instanceof HTMLElement)) return;
    if (active.placement === "bottom") {
      const maximum = Math.max(
        minimumBottomHeight,
        container.getBoundingClientRect().height * maximumBottomHeightRatio,
      );
      setBottomHeightPx(
        Math.min(
          maximum,
          Math.max(
            minimumBottomHeight,
            active.startHeight + active.startY - event.clientY,
          ),
        ),
      );
      return;
    }
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

  function resizeWithKeyboard(event: ReactKeyboardEvent<HTMLDivElement>) {
    const container = event.currentTarget.closest(".codex-main-split");
    if (!(container instanceof HTMLElement)) return;
    if (
      placement === "bottom" &&
      (event.key === "ArrowUp" || event.key === "ArrowDown")
    ) {
      event.preventDefault();
      const current =
        container
          .querySelector<HTMLElement>(".codex-ai-pane")
          ?.getBoundingClientRect().height ?? minimumBottomHeight;
      const maximum = Math.max(
        minimumBottomHeight,
        container.getBoundingClientRect().height * maximumBottomHeightRatio,
      );
      setBottomHeightPx(
        Math.min(
          maximum,
          Math.max(
            minimumBottomHeight,
            current + (event.key === "ArrowUp" ? 16 : -16),
          ),
        ),
      );
    }
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
      className={`codex-main-split placement-${placement} ${open ? "open" : "closed"}`}
      style={
        {
          "--codex-document-width": `${ratio * 100}%`,
          "--codex-bottom-height":
            bottomHeightPx === null
              ? "clamp(240px, 34vh, 360px)"
              : `${bottomHeightPx}px`,
        } as React.CSSProperties
      }
      data-agent-placement={placement}
      data-review-id={open ? "codex-main-split" : undefined}
    >
      <div className="codex-document-pane">{viewer}</div>
      <div
        role="separator"
        tabIndex={0}
        aria-orientation={placement === "bottom" ? "horizontal" : "vertical"}
        aria-label="Resize document and AI panels"
        className={`codex-main-resizer ${resizing ? "active" : ""}`}
        onPointerDown={begin}
        onKeyDown={resizeWithKeyboard}
        onPointerMove={update}
        onPointerUp={end}
        onPointerCancel={end}
      />
      <div className="codex-ai-pane">{panel}</div>
    </div>
  );
}
