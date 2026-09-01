import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContextMenu } from "../../src/ui/components/ContextMenu";
import type { ContextMenuState } from "../../src/ui/types";

const menu: ContextMenuState = {
  x: 24,
  y: 32,
  items: [
    {
      id: "open",
      label: "Open",
      onSelect: vi.fn(),
    },
  ],
};

describe("ContextMenu focus and scroll lifecycle", () => {
  let container: HTMLDivElement;
  let root: Root;
  let originalRequestAnimationFrame: typeof window.requestAnimationFrame;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    originalRequestAnimationFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback) => {
      callback(performance.now());
      return 1;
    };
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.requestAnimationFrame = originalRequestAnimationFrame;
    vi.restoreAllMocks();
  });

  it("focuses the initial item without scrolling the window closed", async () => {
    const onClose = vi.fn();
    const focus = vi
      .spyOn(HTMLButtonElement.prototype, "focus")
      .mockImplementation(function (options?: FocusOptions) {
        if (!options?.preventScroll) {
          window.dispatchEvent(new Event("scroll"));
        }
      });

    await act(async () => {
      root.render(<ContextMenu menu={menu} onClose={onClose} />);
    });

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("ignores opening-adjacent scroll before the first frame", async () => {
    const onClose = vi.fn();
    let activate: FrameRequestCallback | undefined;
    window.requestAnimationFrame = (callback) => {
      activate = callback;
      return 2;
    };

    await act(async () => {
      root.render(<ContextMenu menu={menu} onClose={onClose} />);
    });
    window.dispatchEvent(new Event("scroll"));
    expect(onClose).not.toHaveBeenCalled();

    activate?.(performance.now());
    window.dispatchEvent(new Event("scroll"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("still closes for a user scroll", async () => {
    const onClose = vi.fn();

    await act(async () => {
      root.render(<ContextMenu menu={menu} onClose={onClose} />);
    });
    window.dispatchEvent(new Event("scroll"));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays open while its own overflow area scrolls", async () => {
    const onClose = vi.fn();

    await act(async () => {
      root.render(<ContextMenu menu={menu} onClose={onClose} />);
    });
    container
      .querySelector<HTMLElement>('[role="menu"]')!
      .dispatchEvent(new Event("scroll"));

    expect(onClose).not.toHaveBeenCalled();
  });
});
