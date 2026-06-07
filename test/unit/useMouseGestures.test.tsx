import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultConfig } from "../../src/core/defaultConfig";
import type { AppConfig } from "../../src/core/types";
import { useMouseGestures } from "../../src/ui/hooks/useMouseGestures";

type MouseGestureHandlers = ReturnType<typeof useMouseGestures>;

function configWithMouseGestures(
  mouseGestures: Partial<AppConfig["mouseGestures"]>,
): AppConfig {
  return {
    ...defaultConfig,
    mouseGestures: {
      ...defaultConfig.mouseGestures,
      ...mouseGestures,
      mappings: mouseGestures.mappings ?? defaultConfig.mouseGestures.mappings,
    },
  };
}

function Harness({
  config,
  dispatchCommand,
  onHandlers,
  setLastMouseGesture,
}: {
  config: AppConfig;
  dispatchCommand: Parameters<typeof useMouseGestures>[0]["dispatchCommand"];
  onHandlers: (handlers: MouseGestureHandlers) => void;
  setLastMouseGesture: Parameters<
    typeof useMouseGestures
  >[0]["setLastMouseGesture"];
}) {
  const handlers = useMouseGestures({
    config,
    dispatchCommand,
    preferencesOpen: false,
    quickOpenOpen: false,
    setLastMouseGesture,
  });
  onHandlers(handlers);
  return null;
}

function pointerEvent({
  currentTarget,
  target,
  x,
  y,
}: {
  currentTarget: HTMLElement;
  target: HTMLElement;
  x: number;
  y: number;
}) {
  return {
    button: 2,
    clientX: x,
    clientY: y,
    currentTarget,
    pointerId: 1,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    target,
  };
}

function contextMenuEvent(target: HTMLElement, buttons?: number) {
  return {
    buttons,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    target,
  };
}

describe("useMouseGestures", () => {
  let container: HTMLDivElement;
  let root: Root;
  let surface: HTMLDivElement;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    surface = document.createElement("div");
    container.appendChild(surface);
    document.body.appendChild(container);
    root = createRoot(container);
    surface.setPointerCapture = vi.fn();
    surface.releasePointerCapture = vi.fn();
    surface.hasPointerCapture = vi.fn(() => true);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  async function renderHook(config: AppConfig) {
    let handlers: MouseGestureHandlers | undefined;
    const dispatchCommand = vi.fn().mockResolvedValue({ status: "ok" });
    const setLastMouseGesture = vi.fn();
    await act(async () => {
      root.render(
        <Harness
          config={config}
          dispatchCommand={dispatchCommand}
          onHandlers={(nextHandlers) => {
            handlers = nextHandlers;
          }}
          setLastMouseGesture={setLastMouseGesture}
        />,
      );
    });
    expect(handlers).toBeDefined();
    return {
      dispatchCommand,
      handlers: handlers!,
      setLastMouseGesture,
    };
  }

  it("allows the browser context menu when right-click does not move", async () => {
    const { handlers } = await renderHook(
      configWithMouseGestures({ enabled: true }),
    );

    const down = pointerEvent({
      currentTarget: surface,
      target: surface,
      x: 100,
      y: 100,
    });
    let upResult: Awaited<
      ReturnType<MouseGestureHandlers["handleMouseGesturePointerUp"]>
    >;
    await act(async () => {
      handlers.handleMouseGesturePointerDown(down as never);
      upResult = await handlers.handleMouseGesturePointerUp(
        pointerEvent({
          currentTarget: surface,
          target: surface,
          x: 100,
          y: 100,
        }) as never,
      );
    });

    const menu = contextMenuEvent(surface);
    const menuResult = handlers.handleMouseGestureContextMenu(menu as never);

    expect(upResult!).toEqual({
      status: "plain-right-click",
      contextMenuEvent: null,
    });
    expect(menuResult).toBe("ignored");
    expect(down.preventDefault).not.toHaveBeenCalled();
    expect(menu.preventDefault).not.toHaveBeenCalled();
  });

  it("defers an early context menu while keeping the gesture session alive", async () => {
    const { handlers } = await renderHook(
      configWithMouseGestures({ enabled: true }),
    );

    const pendingMenu = contextMenuEvent(surface);
    await act(async () => {
      handlers.handleMouseGesturePointerDown(
        pointerEvent({
          currentTarget: surface,
          target: surface,
          x: 100,
          y: 100,
        }) as never,
      );
      expect(handlers.handleMouseGestureContextMenu(pendingMenu as never)).toBe(
        "deferred",
      );
    });

    expect(pendingMenu.preventDefault).toHaveBeenCalled();
    await act(async () => {
      expect(handlers.consumePendingMouseGestureContextMenu()).toBe(
        pendingMenu,
      );
    });
  });

  it("reports a completed context menu as a plain right-click", async () => {
    const { handlers } = await renderHook(
      configWithMouseGestures({ enabled: true }),
    );

    await act(async () => {
      handlers.handleMouseGesturePointerDown(
        pointerEvent({
          currentTarget: surface,
          target: surface,
          x: 100,
          y: 100,
        }) as never,
      );
    });

    const menu = contextMenuEvent(surface, 0);
    await act(async () => {
      expect(handlers.handleMouseGestureContextMenu(menu as never)).toBe(
        "plain-right-click",
      );
    });
    expect(menu.preventDefault).not.toHaveBeenCalled();
  });

  it("suppresses context menu after a right-button drag crosses the threshold", async () => {
    const { dispatchCommand, handlers } = await renderHook(
      configWithMouseGestures({ enabled: true }),
    );

    let upResult: Awaited<
      ReturnType<MouseGestureHandlers["handleMouseGesturePointerUp"]>
    >;
    await act(async () => {
      handlers.handleMouseGesturePointerDown(
        pointerEvent({
          currentTarget: surface,
          target: surface,
          x: 100,
          y: 100,
        }) as never,
      );
      handlers.handleMouseGesturePointerMove(
        pointerEvent({
          currentTarget: surface,
          target: surface,
          x: 40,
          y: 100,
        }) as never,
      );
      upResult = await handlers.handleMouseGesturePointerUp(
        pointerEvent({
          currentTarget: surface,
          target: surface,
          x: 40,
          y: 100,
        }) as never,
      );
    });

    const menu = contextMenuEvent(surface);
    const menuResult = handlers.handleMouseGestureContextMenu(menu as never);

    expect(surface.setPointerCapture).toHaveBeenCalledWith(1);
    expect(dispatchCommand).toHaveBeenCalledWith("navigation.back");
    expect(upResult!).toEqual({ status: "gesture-handled" });
    expect(menuResult).toBe("context-menu-suppressed");
    expect(menu.preventDefault).toHaveBeenCalled();
    expect(menu.stopPropagation).toHaveBeenCalled();
  });

  it("suppresses a context menu once the interaction becomes a drag", async () => {
    const { dispatchCommand, handlers } = await renderHook(
      configWithMouseGestures({ enabled: true }),
    );

    const earlyMenu = contextMenuEvent(surface);
    let upResult: Awaited<
      ReturnType<MouseGestureHandlers["handleMouseGesturePointerUp"]>
    >;
    await act(async () => {
      handlers.handleMouseGesturePointerDown(
        pointerEvent({
          currentTarget: surface,
          target: surface,
          x: 100,
          y: 100,
        }) as never,
      );
      handlers.handleMouseGesturePointerMove(
        pointerEvent({
          currentTarget: surface,
          target: surface,
          x: 160,
          y: 100,
        }) as never,
      );
      expect(handlers.handleMouseGestureContextMenu(earlyMenu as never)).toBe(
        "context-menu-suppressed",
      );
      upResult = await handlers.handleMouseGesturePointerUp(
        pointerEvent({
          currentTarget: surface,
          target: surface,
          x: 160,
          y: 100,
        }) as never,
      );
    });

    expect(earlyMenu.preventDefault).toHaveBeenCalled();
    expect(dispatchCommand).toHaveBeenCalledWith("navigation.forward");
    expect(upResult!).toEqual({ status: "gesture-handled" });
  });

  it("keeps an early context menu session alive so a later drag still dispatches", async () => {
    const { dispatchCommand, handlers } = await renderHook(
      configWithMouseGestures({ enabled: true }),
    );

    const earlyMenu = contextMenuEvent(surface);
    await act(async () => {
      handlers.handleMouseGesturePointerDown(
        pointerEvent({
          currentTarget: surface,
          target: surface,
          x: 100,
          y: 100,
        }) as never,
      );
      expect(handlers.handleMouseGestureContextMenu(earlyMenu as never)).toBe(
        "deferred",
      );
      handlers.handleMouseGesturePointerMove(
        pointerEvent({
          currentTarget: surface,
          target: surface,
          x: 160,
          y: 100,
        }) as never,
      );
      await handlers.handleMouseGesturePointerUp(
        pointerEvent({
          currentTarget: surface,
          target: surface,
          x: 160,
          y: 100,
        }) as never,
      );
    });

    expect(dispatchCommand).toHaveBeenCalledWith("navigation.forward");
    expect(handlers.consumePendingMouseGestureContextMenu()).toBeNull();
  });

  it("keeps a deferred plain right-click menu available after pointer cancel", async () => {
    const { handlers } = await renderHook(
      configWithMouseGestures({ enabled: true }),
    );

    const earlyMenu = contextMenuEvent(surface);
    await act(async () => {
      handlers.handleMouseGesturePointerDown(
        pointerEvent({
          currentTarget: surface,
          target: surface,
          x: 100,
          y: 100,
        }) as never,
      );
      expect(handlers.handleMouseGestureContextMenu(earlyMenu as never)).toBe(
        "deferred",
      );
      handlers.handleMouseGesturePointerCancel(
        pointerEvent({
          currentTarget: surface,
          target: surface,
          x: 100,
          y: 100,
        }) as never,
      );
    });

    await act(async () => {
      expect(handlers.consumePendingMouseGestureContextMenu()).toBe(earlyMenu);
    });
  });

  it("suppresses context menu for unassigned right-button drag gestures", async () => {
    const { dispatchCommand, handlers, setLastMouseGesture } = await renderHook(
      configWithMouseGestures({
        enabled: true,
        mappings: [{ pattern: "Left", commandId: "navigation.back" }],
      }),
    );

    await act(async () => {
      handlers.handleMouseGesturePointerDown(
        pointerEvent({
          currentTarget: surface,
          target: surface,
          x: 100,
          y: 100,
        }) as never,
      );
      handlers.handleMouseGesturePointerMove(
        pointerEvent({
          currentTarget: surface,
          target: surface,
          x: 40,
          y: 100,
        }) as never,
      );
      handlers.handleMouseGesturePointerMove(
        pointerEvent({
          currentTarget: surface,
          target: surface,
          x: 40,
          y: 160,
        }) as never,
      );
      await handlers.handleMouseGesturePointerUp(
        pointerEvent({
          currentTarget: surface,
          target: surface,
          x: 40,
          y: 160,
        }) as never,
      );
    });

    const menu = contextMenuEvent(surface);
    handlers.handleMouseGestureContextMenu(menu as never);

    expect(dispatchCommand).not.toHaveBeenCalled();
    expect(setLastMouseGesture).toHaveBeenCalledWith({
      pattern: "Left Down",
      status: "none",
    });
    expect(menu.preventDefault).toHaveBeenCalled();
  });

  it("does not suppress context menu when mouse gestures are disabled", async () => {
    const { handlers } = await renderHook(
      configWithMouseGestures({ enabled: false }),
    );

    await act(async () => {
      handlers.handleMouseGesturePointerDown(
        pointerEvent({
          currentTarget: surface,
          target: surface,
          x: 100,
          y: 100,
        }) as never,
      );
      handlers.handleMouseGesturePointerMove(
        pointerEvent({
          currentTarget: surface,
          target: surface,
          x: 40,
          y: 100,
        }) as never,
      );
      await handlers.handleMouseGesturePointerUp(
        pointerEvent({
          currentTarget: surface,
          target: surface,
          x: 40,
          y: 100,
        }) as never,
      );
    });

    const menu = contextMenuEvent(surface);
    handlers.handleMouseGestureContextMenu(menu as never);

    expect(menu.preventDefault).not.toHaveBeenCalled();
  });

  it("suppresses accidental context menu after a canceled drag", async () => {
    const { handlers } = await renderHook(
      configWithMouseGestures({ enabled: true }),
    );

    await act(async () => {
      handlers.handleMouseGesturePointerDown(
        pointerEvent({
          currentTarget: surface,
          target: surface,
          x: 100,
          y: 100,
        }) as never,
      );
      handlers.handleMouseGesturePointerMove(
        pointerEvent({
          currentTarget: surface,
          target: surface,
          x: 40,
          y: 100,
        }) as never,
      );
      handlers.handleMouseGesturePointerCancel(
        pointerEvent({
          currentTarget: surface,
          target: surface,
          x: 40,
          y: 100,
        }) as never,
      );
    });

    const menu = contextMenuEvent(surface);
    handlers.handleMouseGestureContextMenu(menu as never);

    expect(menu.preventDefault).toHaveBeenCalled();
  });
});
