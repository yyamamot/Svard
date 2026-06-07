import { act, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLightweightActionFeedback } from "../../src/ui/hooks/useLightweightActionFeedback";
import type { LightweightActionFeedback } from "../../src/ui/types";

describe("useLightweightActionFeedback", () => {
  let container: HTMLDivElement;
  let root: Root;
  let api:
    | {
        feedback: LightweightActionFeedback | null;
        show(message: string, autoDismissMs?: number): void;
      }
    | undefined;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    vi.useRealTimers();
    act(() => root.unmount());
    container.remove();
    api = undefined;
  });

  function Harness() {
    const { lightweightActionFeedback, showLightweightActionFeedback } =
      useLightweightActionFeedback();
    const [, forceRender] = useState(0);

    useEffect(() => {
      api = {
        feedback: lightweightActionFeedback,
        show: showLightweightActionFeedback,
      };
      forceRender((current) => current);
    }, [lightweightActionFeedback, showLightweightActionFeedback]);

    return null;
  }

  async function renderHook() {
    await act(async () => {
      root.render(<Harness />);
    });
  }

  it("auto dismisses feedback after the requested timeout", async () => {
    await renderHook();

    await act(async () => {
      api?.show("Source block copied", 200);
    });
    expect(api?.feedback?.message).toBe("Source block copied");

    await act(async () => {
      vi.advanceTimersByTime(199);
    });
    expect(api?.feedback?.message).toBe("Source block copied");

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(api?.feedback).toBeNull();
  });

  it("replaces feedback and resets the dismiss timer", async () => {
    await renderHook();

    await act(async () => {
      api?.show("Source block copied", 200);
    });
    await act(async () => {
      vi.advanceTimersByTime(150);
    });
    await act(async () => {
      api?.show("Search pinned", 200);
    });

    expect(api?.feedback?.message).toBe("Search pinned");
    await act(async () => {
      vi.advanceTimersByTime(199);
    });
    expect(api?.feedback?.message).toBe("Search pinned");

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(api?.feedback).toBeNull();
  });
});
