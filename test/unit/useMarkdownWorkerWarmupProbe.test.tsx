import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const renderMarkdownMocks = vi.hoisted(() => ({
  probeMarkdownRenderWorkerReady: vi.fn(),
  warmMarkdownRenderWorker: vi.fn(async () => undefined),
}));

vi.mock("../../src/core/renderMarkdown", () => ({
  probeMarkdownRenderWorkerReady:
    renderMarkdownMocks.probeMarkdownRenderWorkerReady,
  warmMarkdownRenderWorker: renderMarkdownMocks.warmMarkdownRenderWorker,
}));

import { useMarkdownWorkerWarmupProbe } from "../../src/ui/hooks/useMarkdownWorkerWarmupProbe";

function WarmupProbeHarness({
  workspaceBootComplete,
}: {
  workspaceBootComplete: boolean;
}) {
  useMarkdownWorkerWarmupProbe(workspaceBootComplete);
  return null;
}

function warmupScheduleCount(setTimeoutSpy: ReturnType<typeof vi.spyOn>) {
  return setTimeoutSpy.mock.calls.filter((call: unknown[]) => call[1] === 750)
    .length;
}

describe("useMarkdownWorkerWarmupProbe", () => {
  let container: HTMLDivElement;
  let root: Root;
  let setTimeoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.removeItem("SVARD_DISABLE_MARKDOWN_WARMUP");
    renderMarkdownMocks.probeMarkdownRenderWorkerReady.mockClear();
    renderMarkdownMocks.warmMarkdownRenderWorker.mockClear();
    vi.useFakeTimers();
    setTimeoutSpy = vi.spyOn(window, "setTimeout");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    setTimeoutSpy.mockRestore();
    vi.useRealTimers();
    localStorage.removeItem("SVARD_DISABLE_MARKDOWN_WARMUP");
  });

  it("defers scheduling until boot completes and warms once after enabling", async () => {
    await act(async () => {
      root.render(<WarmupProbeHarness workspaceBootComplete={false} />);
      await Promise.resolve();
    });

    expect(warmupScheduleCount(setTimeoutSpy)).toBe(0);
    expect(renderMarkdownMocks.warmMarkdownRenderWorker).not.toHaveBeenCalled();

    await act(async () => {
      root.render(<WarmupProbeHarness workspaceBootComplete={true} />);
      await Promise.resolve();
    });

    expect(warmupScheduleCount(setTimeoutSpy)).toBe(1);

    await act(async () => {
      vi.advanceTimersByTime(750);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(renderMarkdownMocks.warmMarkdownRenderWorker).toHaveBeenCalledTimes(
      1,
    );

    await act(async () => {
      root.render(<WarmupProbeHarness workspaceBootComplete={true} />);
      vi.advanceTimersByTime(750);
      await Promise.resolve();
    });

    expect(warmupScheduleCount(setTimeoutSpy)).toBe(1);
    expect(renderMarkdownMocks.warmMarkdownRenderWorker).toHaveBeenCalledTimes(
      1,
    );
  });
});
