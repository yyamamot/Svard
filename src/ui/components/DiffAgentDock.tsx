import { useRef, type KeyboardEvent, type PointerEvent } from "react";

const minimumDockHeight = 220;
const maximumDockHeightRatio = 0.6;

interface ResizeState {
  pointerId: number;
  startHeight: number;
  startY: number;
}

export interface DiffAgentDockControls {
  available: boolean;
  heightPx: number | null;
  open: boolean;
  onHeightChange: (height: number) => void;
  onMountTargetChange: (target: HTMLDivElement | null) => void;
  onToggle: () => void;
}

export const emptyDiffAgentDockControls: DiffAgentDockControls = {
  available: false,
  heightPx: null,
  open: false,
  onHeightChange: () => undefined,
  onMountTargetChange: () => undefined,
  onToggle: () => undefined,
};

export function DiffAgentDock({
  controls,
}: {
  controls: DiffAgentDockControls;
}) {
  const resizeRef = useRef<ResizeState | null>(null);

  if (!controls.open) {
    return null;
  }

  function beginResize(event: PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const dock = event.currentTarget.closest<HTMLElement>(
      ".git-diff-agent-dock",
    );
    resizeRef.current = {
      pointerId: event.pointerId,
      startHeight: dock?.getBoundingClientRect().height ?? minimumDockHeight,
      startY: event.clientY,
    };
  }

  function updateResize(event: PointerEvent<HTMLDivElement>) {
    const active = resizeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const panel = event.currentTarget.closest<HTMLElement>(".git-diff-panel");
    const maximum = Math.max(
      minimumDockHeight,
      (panel?.getBoundingClientRect().height ?? window.innerHeight) *
        maximumDockHeightRatio,
    );
    controls.onHeightChange(
      Math.min(
        maximum,
        Math.max(
          minimumDockHeight,
          active.startHeight + active.startY - event.clientY,
        ),
      ),
    );
  }

  function resizeWithKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    event.stopPropagation();
    const dock = event.currentTarget.closest<HTMLElement>(
      ".git-diff-agent-dock",
    );
    const panel = event.currentTarget.closest<HTMLElement>(".git-diff-panel");
    const maximum = Math.max(
      minimumDockHeight,
      (panel?.getBoundingClientRect().height ?? window.innerHeight) *
        maximumDockHeightRatio,
    );
    const current = dock?.getBoundingClientRect().height ?? minimumDockHeight;
    const delta = event.key === "ArrowUp" ? 16 : -16;
    controls.onHeightChange(
      Math.min(maximum, Math.max(minimumDockHeight, current + delta)),
    );
  }

  function endResize(event: PointerEvent<HTMLDivElement>) {
    const active = resizeRef.current;
    if (!active || active.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    resizeRef.current = null;
  }

  return (
    <section
      className="git-diff-agent-dock"
      data-review-id="git-diff-agent-dock"
      aria-label="AI Chat for diff preview"
      style={{
        height:
          controls.heightPx === null
            ? "clamp(240px, 34vh, 360px)"
            : `${controls.heightPx}px`,
      }}
    >
      <div
        role="separator"
        tabIndex={0}
        aria-label="Resize AI Chat"
        aria-orientation="horizontal"
        aria-valuemin={minimumDockHeight}
        className="git-diff-agent-dock-resizer"
        data-review-id="git-diff-agent-dock-resizer"
        onKeyDown={resizeWithKeyboard}
        onPointerDown={beginResize}
        onPointerMove={updateResize}
        onPointerUp={endResize}
        onPointerCancel={endResize}
      />
      <div
        ref={controls.onMountTargetChange}
        className="git-diff-agent-dock-content"
        data-review-id="git-diff-agent-dock-content"
      />
    </section>
  );
}
