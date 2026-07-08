import { useRef, useState, type MouseEvent } from "react";
import type { AppConfig } from "../../../core/types";
import {
  defaultMouseGestureConfig,
  resolveMouseGesture,
  type GesturePoint,
} from "../../../core/mouseGestures";
import type { MouseGestureAutomation } from "../../types";
import { isGestureBlockedTarget } from "../../lib/path";
import { shouldIgnoreDiffMouseGestureTarget } from "../gitDiffPreview/diffPreviewInteractionEvents";
import {
  dispatchDiffPreviewMouseGestureCommand,
  type DiffPreviewMouseGestureScrollAction,
} from "../gitDiffPreview/mouseGestures";
import type { DiffStreamMouseGestureSession } from "./types";

export function useDocumentDiffStreamGestures({
  changeCount,
  closePreview,
  config,
  moveChange,
  scrollPane,
  setLastMouseGesture,
}: {
  changeCount: number;
  closePreview: () => void;
  config: AppConfig | null;
  moveChange: (offset: number) => boolean;
  scrollPane: (action: DiffPreviewMouseGestureScrollAction) => boolean;
  setLastMouseGesture?: (gesture: MouseGestureAutomation | null) => void;
}) {
  const [mouseGestureTrail, setMouseGestureTrail] = useState<GesturePoint[]>([]);
  const mouseGestureSessionRef =
    useRef<DiffStreamMouseGestureSession | null>(null);
  const suppressNextContextMenuRef = useRef(false);

  function mouseGestureConfig() {
    return config?.mouseGestures ?? defaultMouseGestureConfig;
  }

  function dispatchStreamMouseGesture(points: GesturePoint[]) {
    const resolution = resolveMouseGesture(
      points,
      mouseGestureConfig().minDistancePx,
      mouseGestureConfig().mappings,
    );
    if (!resolution.commandId) {
      setLastMouseGesture?.({ pattern: resolution.pattern, status: "none" });
      return;
    }
    const result = dispatchDiffPreviewMouseGestureCommand({
      commandId: resolution.commandId,
      changeCount,
      moveChange,
      scrollPane,
      closePreview,
    });
    setLastMouseGesture?.({
      pattern: resolution.pattern,
      commandId: resolution.commandId,
      status: result.status,
    });
  }

  function handleStreamMouseDown(event: MouseEvent<HTMLElement>) {
    suppressNextContextMenuRef.current = false;
    if (shouldIgnoreDiffStreamGestureTarget(event.target)) {
      return;
    }
    const mouseGestures = mouseGestureConfig();
    if (
      !mouseGestures.enabled ||
      mouseGestures.trigger !== "rightButton" ||
      event.button !== 2 ||
      isGestureBlockedTarget(event.target)
    ) {
      return;
    }
    mouseGestureSessionRef.current = {
      hasDragIntent: false,
      points: [{ x: event.clientX, y: event.clientY }],
    };
  }

  function handleStreamMouseMove(event: MouseEvent<HTMLElement>) {
    const session = mouseGestureSessionRef.current;
    if (!session) {
      return;
    }
    session.points.push({ x: event.clientX, y: event.clientY });
    const resolution = resolveMouseGesture(
      session.points,
      mouseGestureConfig().minDistancePx,
      mouseGestureConfig().mappings,
    );
    if (resolution.pattern.length === 0) {
      return;
    }
    session.hasDragIntent = true;
    if (mouseGestureConfig().showTrail) {
      setMouseGestureTrail([...session.points]);
    }
    event.preventDefault();
    event.stopPropagation();
    suppressNextContextMenuRef.current = true;
  }

  function handleStreamMouseUp(event: MouseEvent<HTMLElement>) {
    const session = mouseGestureSessionRef.current;
    if (!session) {
      return;
    }
    mouseGestureSessionRef.current = null;
    setMouseGestureTrail([]);
    if (session.hasDragIntent) {
      event.preventDefault();
      event.stopPropagation();
      suppressNextContextMenuRef.current = true;
      dispatchStreamMouseGesture(session.points);
    } else {
      suppressNextContextMenuRef.current = false;
    }
  }

  function handleStreamContextMenu(event: MouseEvent<HTMLElement>) {
    if (shouldIgnoreDiffStreamGestureTarget(event.target)) {
      return;
    }
    if (!suppressNextContextMenuRef.current) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    suppressNextContextMenuRef.current = false;
  }

  function handleStreamMouseLeave() {
    mouseGestureSessionRef.current = null;
    setMouseGestureTrail([]);
    suppressNextContextMenuRef.current = false;
  }

  return {
    handleStreamContextMenu,
    handleStreamMouseDown,
    handleStreamMouseLeave,
    handleStreamMouseMove,
    handleStreamMouseUp,
    mouseGestureTrail,
  };
}

function shouldIgnoreDiffStreamGestureTarget(target: EventTarget | null) {
  return (
    shouldIgnoreDiffMouseGestureTarget(target) ||
    (target instanceof HTMLElement &&
      Boolean(
        target.closest(
          ".diff-stream-file-header, .diff-stream-review-actions, .git-diff-change-ruler, [data-review-id='context-menu']",
        ),
      ))
  );
}
