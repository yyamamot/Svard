import { useRef, useState } from "react";
import type { MouseEvent, PointerEvent as ReactPointerEvent } from "react";
import type { CommandDispatchResult } from "../../core/commands";
import type { AppConfig } from "../../core/types";
import {
  defaultMouseGestureConfig,
  resolveMouseGesture,
} from "../../core/mouseGestures";
import type { GesturePoint } from "../../core/mouseGestures";
import { isGestureBlockedTarget } from "../lib/path";
import type { MouseGestureAutomation } from "../types";

export type MouseGestureContextMenuResult =
  | "context-menu-suppressed"
  | "deferred"
  | "ignored"
  | "plain-right-click";

export type MouseGesturePointerUpResult =
  | { status: "gesture-handled" }
  | {
      status: "plain-right-click";
      contextMenuEvent: MouseEvent<HTMLElement> | null;
    }
  | { status: "ignored" };

interface MouseGestureSession {
  pointerId: number;
  pendingContextMenu: MouseEvent<HTMLElement> | null;
  points: GesturePoint[];
  hasDragIntent: boolean;
  hasPointerCapture: boolean;
  suppressContextMenu: boolean;
}

interface UseMouseGesturesOptions {
  closeContextMenu?: () => void;
  config: AppConfig | null;
  preferencesOpen: boolean;
  quickOpenOpen: boolean;
  dispatchCommand: (
    commandId: NonNullable<ReturnType<typeof resolveMouseGesture>["commandId"]>,
  ) => Promise<CommandDispatchResult>;
  setLastMouseGesture: (gesture: MouseGestureAutomation | null) => void;
}

export function useMouseGestures({
  closeContextMenu,
  config,
  preferencesOpen,
  quickOpenOpen,
  dispatchCommand,
  setLastMouseGesture,
}: UseMouseGesturesOptions) {
  const mouseGestureSessionRef = useRef<MouseGestureSession | null>(null);
  const deferredContextMenuRef = useRef<MouseEvent<HTMLElement> | null>(null);
  const suppressMouseGestureContextMenuRef = useRef(false);
  const [mouseGestureTrail, setMouseGestureTrail] = useState<GesturePoint[]>(
    [],
  );

  function handleMouseGesturePointerDown(
    event: ReactPointerEvent<HTMLElement>,
  ) {
    if (event.button === 2) {
      suppressMouseGestureContextMenuRef.current = false;
    }

    const mouseGestures = config?.mouseGestures ?? defaultMouseGestureConfig;
    if (
      !mouseGestures.enabled ||
      mouseGestures.trigger !== "rightButton" ||
      event.button !== 2 ||
      preferencesOpen ||
      quickOpenOpen ||
      isGestureBlockedTarget(event.target)
    ) {
      return;
    }

    const point = { x: event.clientX, y: event.clientY };
    mouseGestureSessionRef.current = {
      pointerId: event.pointerId,
      pendingContextMenu: null,
      points: [point],
      hasDragIntent: false,
      hasPointerCapture: false,
      suppressContextMenu: false,
    };
  }

  function handleMouseGesturePointerMove(
    event: ReactPointerEvent<HTMLElement>,
  ) {
    const mouseGestures = config?.mouseGestures ?? defaultMouseGestureConfig;
    const session = mouseGestureSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }

    const point = { x: event.clientX, y: event.clientY };
    session.points.push(point);
    const resolution = resolveMouseGesture(
      session.points,
      mouseGestures.minDistancePx,
      mouseGestures.mappings,
    );
    const hasMovement = resolution.pattern.length > 0;

    if (hasMovement) {
      if (!session.hasPointerCapture) {
        event.currentTarget.setPointerCapture(event.pointerId);
        session.hasPointerCapture = true;
      }
      session.hasDragIntent = true;
      session.suppressContextMenu = true;
      session.pendingContextMenu = null;
      deferredContextMenuRef.current = null;
      suppressMouseGestureContextMenuRef.current = true;
      closeContextMenu?.();
      event.preventDefault();
      event.stopPropagation();
    }

    if (session.hasDragIntent && mouseGestures.showTrail) {
      setMouseGestureTrail([...session.points]);
    }
  }

  async function handleMouseGesturePointerUp(
    event: ReactPointerEvent<HTMLElement>,
  ): Promise<MouseGesturePointerUpResult> {
    const mouseGestures = config?.mouseGestures ?? defaultMouseGestureConfig;
    const session = mouseGestureSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) {
      return { status: "ignored" };
    }

    if (session.suppressContextMenu) {
      suppressMouseGestureContextMenuRef.current = true;
      closeContextMenu?.();
    }
    mouseGestureSessionRef.current = null;
    setMouseGestureTrail([]);
    if (
      session.hasPointerCapture &&
      event.currentTarget.hasPointerCapture(event.pointerId)
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!session.hasDragIntent) {
      const contextMenuEvent =
        session.pendingContextMenu ?? deferredContextMenuRef.current;
      deferredContextMenuRef.current = null;
      return {
        status: "plain-right-click",
        contextMenuEvent,
      };
    }

    deferredContextMenuRef.current = null;
    event.preventDefault();
    event.stopPropagation();

    const resolution = resolveMouseGesture(
      session.points,
      mouseGestures.minDistancePx,
      mouseGestures.mappings,
    );
    if (!resolution.commandId) {
      setLastMouseGesture({ pattern: resolution.pattern, status: "none" });
      return { status: "gesture-handled" };
    }

    const result = await dispatchCommand(resolution.commandId);
    setLastMouseGesture({
      pattern: resolution.pattern,
      commandId: resolution.commandId,
      status: result.status,
    });
    return { status: "gesture-handled" };
  }

  function handleMouseGesturePointerCancel(
    event: ReactPointerEvent<HTMLElement>,
  ) {
    const session = mouseGestureSessionRef.current;
    if (session?.pointerId === event.pointerId) {
      if (session.suppressContextMenu) {
        suppressMouseGestureContextMenuRef.current = true;
        deferredContextMenuRef.current = null;
        closeContextMenu?.();
      }
      mouseGestureSessionRef.current = null;
      setMouseGestureTrail([]);
      if (
        session.hasPointerCapture &&
        event.currentTarget.hasPointerCapture(event.pointerId)
      ) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    }
  }

  function handleMouseGestureContextMenu(
    event: MouseEvent<HTMLElement>,
  ): MouseGestureContextMenuResult {
    if (suppressMouseGestureContextMenuRef.current) {
      event.preventDefault();
      event.stopPropagation();
      suppressMouseGestureContextMenuRef.current = false;
      deferredContextMenuRef.current = null;
      const session = mouseGestureSessionRef.current;
      if (session) {
        session.pendingContextMenu = null;
      }
      return "context-menu-suppressed";
    }

    const session = mouseGestureSessionRef.current;
    if (session && !session.hasDragIntent) {
      if (event.buttons === 0) {
        session.pendingContextMenu = null;
        deferredContextMenuRef.current = null;
        mouseGestureSessionRef.current = null;
        setMouseGestureTrail([]);
        return "plain-right-click";
      }
      session.pendingContextMenu = event;
      deferredContextMenuRef.current = event;
      event.preventDefault();
      event.stopPropagation();
      return "deferred";
    }
    if (session?.hasDragIntent) {
      event.preventDefault();
      event.stopPropagation();
      session.pendingContextMenu = null;
      deferredContextMenuRef.current = null;
      return "context-menu-suppressed";
    }
    return "ignored";
  }

  function consumePendingMouseGestureContextMenu(): MouseEvent<HTMLElement> | null {
    const session = mouseGestureSessionRef.current;
    const event = deferredContextMenuRef.current ?? session?.pendingContextMenu;
    if (!event || session?.hasDragIntent) {
      return null;
    }
    if (session) {
      session.pendingContextMenu = null;
    }
    deferredContextMenuRef.current = null;
    mouseGestureSessionRef.current = null;
    setMouseGestureTrail([]);
    return event;
  }

  return {
    mouseGestureTrail,
    consumePendingMouseGestureContextMenu,
    handleMouseGestureContextMenu,
    handleMouseGesturePointerCancel,
    handleMouseGesturePointerDown,
    handleMouseGesturePointerMove,
    handleMouseGesturePointerUp,
  };
}
