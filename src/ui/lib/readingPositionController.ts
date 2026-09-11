import type { PaneId } from "../types";
import {
  captureDocumentReadingPosition,
  type DocumentReadingPosition,
  type ReadingSurface,
} from "./documentReadingPosition";

export interface DocumentNavigationOptions {
  recordNavigation?: boolean;
  navigation?: "reading" | "explicit";
  target?: { headingId?: string; sourceLine?: number };
}

export interface PendingReadingPosition {
  path: string;
  generation: number;
  saved?: DocumentReadingPosition;
  target?: DocumentNavigationOptions["target"];
  startedAt?: number;
  timer?: ReturnType<typeof setTimeout>;
  applied: boolean;
}

export function createReadingPositionController() {
  const positions: Record<PaneId, Map<string, DocumentReadingPosition>> = {
    left: new Map(),
    right: new Map(),
  };
  const surfaces = new Map<PaneId, ReadingSurface>();
  const pending = new Map<PaneId, PendingReadingPosition>();
  const listeners = new Set<() => void>();
  let generation = 0;
  let openGeneration = 0;
  let revision = 0;
  const notify = () => {
    revision += 1;
    listeners.forEach((listener) => listener());
  };

  function cancel(pane?: PaneId) {
    let changed = false;
    for (const id of pane ? [pane] : (["left", "right"] as const)) {
      const request = pending.get(id);
      if (!request) continue;
      clearTimeout(request.timer);
      pending.delete(id);
      changed = true;
    }
    if (changed) notify();
  }

  function capture(pane: PaneId) {
    const surface = surfaces.get(pane);
    // Do not replace an original anchor with provisional/clamped layout geometry.
    if (
      !surface ||
      pending.has(pane) ||
      !surface.article.isConnected ||
      surface.article.dataset.renderedDocumentPath !== surface.payload.path
    )
      return;
    positions[pane].set(
      surface.payload.path,
      captureDocumentReadingPosition(surface),
    );
  }

  function queue(
    pane: PaneId,
    path: string,
    target?: DocumentNavigationOptions["target"],
  ) {
    cancel(pane);
    pending.set(pane, {
      path,
      saved: positions[pane].get(path),
      target,
      generation: ++generation,
      applied: false,
    });
    notify();
  }

  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getRevision: () => revision,
    isRestoring: () => pending.size > 0,
    beginNavigation: () => ++openGeneration,
    isCurrentNavigation: (ticket: number) => ticket === openGeneration,
    pendingFor: (pane: PaneId) => pending.get(pane),
    surfaceFor: (pane: PaneId) => surfaces.get(pane),
    cancel,
    capture,
    captureAll: () => {
      capture("left");
      capture("right");
    },
    attach: (pane: PaneId, surface: ReadingSurface) => {
      surfaces.set(pane, surface);
      return () => {
        if (surfaces.get(pane) === surface) surfaces.delete(pane);
      };
    },
    prepare: (
      pane: PaneId,
      path: string,
      options: DocumentNavigationOptions = {},
    ) => {
      capture(pane);
      if (options.navigation === "explicit" && !options.target) {
        cancel(pane);
        return;
      }
      if (surfaces.get(pane)?.payload.path === path && !options.target) {
        if (pending.get(pane)?.path !== path) cancel(pane);
        return;
      }
      queue(pane, path, options.target);
    },
    preserve: (pane: PaneId) => {
      capture(pane);
      const path = surfaces.get(pane)?.payload.path;
      if (path && !pending.has(pane)) queue(pane, path);
    },
    startDeadline: (pane: PaneId, request: PendingReadingPosition) => {
      if (request.startedAt !== undefined || pending.get(pane) !== request)
        return;
      request.startedAt = performance.now();
      request.timer = setTimeout(() => {
        if (pending.get(pane) === request) cancel(pane);
      }, 2000);
    },
    forget: (paths: string[]) => {
      for (const pane of ["left", "right"] as const) {
        for (const path of paths) positions[pane].delete(path);
        // Closing a tab can precede React's DOM cleanup. Do not recapture it.
        if (paths.includes(surfaces.get(pane)?.payload.path ?? ""))
          surfaces.delete(pane);
        if (paths.includes(pending.get(pane)?.path ?? "")) cancel(pane);
      }
    },
    transfer: (from: PaneId, to: PaneId, path: string) => {
      capture(from);
      const request = pending.get(from);
      const saved =
        request?.path === path ? request.saved : positions[from].get(path);
      if (saved) positions[to].set(path, saved);
      else positions[to].delete(path);
      queue(to, path);
    },
    dispose: () => {
      cancel();
      surfaces.clear();
      positions.left.clear();
      positions.right.clear();
    },
  };
}

export type ReadingPositionController = ReturnType<
  typeof createReadingPositionController
>;
