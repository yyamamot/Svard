import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  defaultSidebarLayout,
  normalizeSidebarLayout,
  sidebarLayoutBounds,
} from "../../core/layout";
import type { SidebarLayoutConfig } from "../../core/layout";
import type { AppConfig } from "../../core/types";
import { clampOpenFilesHeight, layoutFromSidebarResize } from "../lib/config";

interface SidebarResizeState {
  side: "left" | "right";
  pointerId: number;
  startX: number;
  startLayout: SidebarLayoutConfig;
}

interface OpenFilesSplitResizeState {
  pointerId: number;
  startY: number;
  startHeight: number;
}

interface UseSidebarLayoutOptions {
  config: AppConfig | null;
  saveConfig: (nextConfig: AppConfig) => Promise<void>;
}

export function useSidebarLayout({
  config,
  saveConfig,
}: UseSidebarLayoutOptions) {
  const leftSidebarContentRef = useRef<HTMLDivElement | null>(null);
  const openFilesPaneRef = useRef<HTMLElement | null>(null);
  const [sidebarLayout, setSidebarLayout] =
    useState<SidebarLayoutConfig>(defaultSidebarLayout);
  const [sidebarResizeState, setSidebarResizeState] =
    useState<SidebarResizeState | null>(null);
  const sidebarResizeRef = useRef<SidebarResizeState | null>(null);
  const [openFilesSplitResizeState, setOpenFilesSplitResizeState] =
    useState<OpenFilesSplitResizeState | null>(null);
  const openFilesSplitResizeRef = useRef<OpenFilesSplitResizeState | null>(
    null,
  );

  async function persistSidebarLayout(nextLayout: SidebarLayoutConfig) {
    if (!config) {
      return;
    }

    await saveConfig({
      ...config,
      layout: normalizeSidebarLayout(nextLayout),
    });
  }

  function beginSidebarResize(
    side: SidebarResizeState["side"],
    event: ReactPointerEvent<HTMLElement>,
  ) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const nextState = {
      side,
      pointerId: event.pointerId,
      startX: event.clientX,
      startLayout: sidebarLayout,
    };
    sidebarResizeRef.current = nextState;
    setSidebarResizeState(nextState);
  }

  function updateSidebarResize(event: ReactPointerEvent<HTMLElement>) {
    const activeResize = sidebarResizeRef.current;
    if (!activeResize || activeResize.pointerId !== event.pointerId) {
      return;
    }

    setSidebarLayout(layoutFromSidebarResize(activeResize, event.clientX));
  }

  function endSidebarResize(event: ReactPointerEvent<HTMLElement>) {
    const activeResize = sidebarResizeRef.current;
    if (!activeResize || activeResize.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const nextLayout = layoutFromSidebarResize(activeResize, event.clientX);
    sidebarResizeRef.current = null;
    setSidebarResizeState(null);
    setSidebarLayout(nextLayout);
    void persistSidebarLayout(nextLayout);
  }

  function cancelSidebarResize(event: ReactPointerEvent<HTMLElement>) {
    const activeResize = sidebarResizeRef.current;
    if (!activeResize || activeResize.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    sidebarResizeRef.current = null;
    setSidebarResizeState(null);
    setSidebarLayout(activeResize.startLayout);
  }

  function resetSidebarWidth(side: SidebarResizeState["side"]) {
    const nextLayout = normalizeSidebarLayout({
      ...sidebarLayout,
      leftSidebarWidth:
        side === "left"
          ? defaultSidebarLayout.leftSidebarWidth
          : sidebarLayout.leftSidebarWidth,
      rightSidebarWidth:
        side === "right"
          ? defaultSidebarLayout.rightSidebarWidth
          : sidebarLayout.rightSidebarWidth,
    });
    setSidebarLayout(nextLayout);
    void persistSidebarLayout(nextLayout);
  }

  function maxOpenFilesHeightForDisplay(): number | undefined {
    const content = leftSidebarContentRef.current;
    const pane = openFilesPaneRef.current;
    if (!content || !pane) {
      return undefined;
    }

    const contentRect = content.getBoundingClientRect();
    const paneRect = pane.getBoundingClientRect();
    return Math.max(
      sidebarLayoutBounds.openFiles.min,
      contentRect.bottom - paneRect.top - 20 - 180,
    );
  }

  function beginOpenFilesSplitResize(event: ReactPointerEvent<HTMLElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const nextState = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startHeight: sidebarLayout.openFilesHeight,
    };
    openFilesSplitResizeRef.current = nextState;
    setOpenFilesSplitResizeState(nextState);
  }

  function updateOpenFilesSplitResize(event: ReactPointerEvent<HTMLElement>) {
    const activeResize = openFilesSplitResizeRef.current;
    if (!activeResize || activeResize.pointerId !== event.pointerId) {
      return;
    }

    const deltaY = event.clientY - activeResize.startY;
    setSidebarLayout(
      normalizeSidebarLayout({
        ...sidebarLayout,
        openFilesHeight: clampOpenFilesHeight(
          activeResize.startHeight + deltaY,
          maxOpenFilesHeightForDisplay(),
        ),
      }),
    );
  }

  function endOpenFilesSplitResize(event: ReactPointerEvent<HTMLElement>) {
    const activeResize = openFilesSplitResizeRef.current;
    if (!activeResize || activeResize.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const deltaY = event.clientY - activeResize.startY;
    const nextLayout = normalizeSidebarLayout({
      ...sidebarLayout,
      openFilesHeight: clampOpenFilesHeight(
        activeResize.startHeight + deltaY,
        maxOpenFilesHeightForDisplay(),
      ),
    });
    openFilesSplitResizeRef.current = null;
    setOpenFilesSplitResizeState(null);
    setSidebarLayout(nextLayout);
    void persistSidebarLayout(nextLayout);
  }

  function cancelOpenFilesSplitResize(event: ReactPointerEvent<HTMLElement>) {
    const activeResize = openFilesSplitResizeRef.current;
    if (!activeResize || activeResize.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    openFilesSplitResizeRef.current = null;
    setOpenFilesSplitResizeState(null);
    setSidebarLayout(
      normalizeSidebarLayout({
        ...sidebarLayout,
        openFilesHeight: activeResize.startHeight,
      }),
    );
  }

  function resetOpenFilesSplitHeight() {
    const nextLayout = normalizeSidebarLayout({
      ...sidebarLayout,
      openFilesHeight: defaultSidebarLayout.openFilesHeight,
    });
    setSidebarLayout(nextLayout);
    void persistSidebarLayout(nextLayout);
  }

  function toggleOpenFilesCollapsed() {
    const nextLayout = normalizeSidebarLayout({
      ...sidebarLayout,
      openFilesCollapsed: !sidebarLayout.openFilesCollapsed,
    });
    setSidebarLayout(nextLayout);
    void persistSidebarLayout(nextLayout);
  }

  return {
    leftSidebarContentRef,
    openFilesPaneRef,
    sidebarLayout,
    setSidebarLayout,
    sidebarResizeState,
    openFilesSplitResizeState,
    beginSidebarResize,
    updateSidebarResize,
    endSidebarResize,
    cancelSidebarResize,
    resetSidebarWidth,
    maxOpenFilesHeightForDisplay,
    beginOpenFilesSplitResize,
    updateOpenFilesSplitResize,
    endOpenFilesSplitResize,
    cancelOpenFilesSplitResize,
    resetOpenFilesSplitHeight,
    toggleOpenFilesCollapsed,
  };
}
