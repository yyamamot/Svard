import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  markdownWorkerWarmupDisabled,
  scheduleMarkdownWorkerWarmup,
} from "../../src/ui/lib/markdownWorkerWarmup";

interface FakeScheduler {
  requestIdleCallback: (callback: () => void) => number;
  cancelIdleCallback: (handle: number) => void;
  setTimeout: (callback: () => void, timeoutMs: number) => number;
  clearTimeout: (handle: number) => void;
  fireIdle: () => void;
  fireTimeout: () => void;
  canceledIdle: () => number[];
  canceledTimeouts: () => number[];
}

function createScheduler(): FakeScheduler {
  let nextHandle = 1;
  const idleCallbacks = new Map<number, () => void>();
  const timeoutCallbacks = new Map<number, () => void>();
  const canceledIdleHandles: number[] = [];
  const canceledTimeoutHandles: number[] = [];

  return {
    requestIdleCallback(callback) {
      const handle = nextHandle++;
      idleCallbacks.set(handle, callback);
      return handle;
    },
    cancelIdleCallback(handle) {
      canceledIdleHandles.push(handle);
      idleCallbacks.delete(handle);
    },
    setTimeout(callback) {
      const handle = nextHandle++;
      timeoutCallbacks.set(handle, callback);
      return handle;
    },
    clearTimeout(handle) {
      canceledTimeoutHandles.push(handle);
      timeoutCallbacks.delete(handle);
    },
    fireIdle() {
      idleCallbacks.values().next().value?.();
    },
    fireTimeout() {
      timeoutCallbacks.values().next().value?.();
    },
    canceledIdle() {
      return canceledIdleHandles;
    },
    canceledTimeouts() {
      return canceledTimeoutHandles;
    },
  };
}

async function flushWarmup() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("scheduleMarkdownWorkerWarmup", () => {
  const originalLocalStorage = globalThis.localStorage;
  const originalConsoleInfo = console.info;
  const events: unknown[] = [];

  beforeEach(() => {
    events.length = 0;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => (key === "SVARD_PERF_TRACE" ? "1" : null),
      },
    });
    console.info = vi.fn((label: string, payload: unknown) => {
      if (label === "[perf]") {
        events.push(payload);
      }
    });
  });

  afterEach(() => {
    console.info = originalConsoleInfo;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  it("runs once when idle wins and cancels timeout fallback", async () => {
    const scheduler = createScheduler();
    const warm = vi.fn().mockResolvedValue(undefined);

    scheduleMarkdownWorkerWarmup({
      deliveryPrimed: true,
      passes: 3,
      warm,
      scheduler,
    });
    scheduler.fireIdle();
    scheduler.fireTimeout();
    await flushWarmup();

    expect(warm).toHaveBeenCalledTimes(1);
    expect(scheduler.canceledTimeouts()).toHaveLength(1);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "render.markdownWorkerWarmup.start",
          trigger: "idle",
        }),
        expect.objectContaining({
          event: "render.markdownWorkerWarmup.done",
          deliveryPrimed: true,
          passes: 3,
          status: "ok",
          trigger: "idle",
        }),
      ]),
    );
  });

  it("runs once when timeout wins and cancels idle callback", async () => {
    const scheduler = createScheduler();
    const warm = vi.fn().mockResolvedValue(undefined);

    scheduleMarkdownWorkerWarmup({ warm, scheduler });
    scheduler.fireTimeout();
    scheduler.fireIdle();
    await flushWarmup();

    expect(warm).toHaveBeenCalledTimes(1);
    expect(scheduler.canceledIdle()).toHaveLength(1);
  });

  it("traces warmup failure without throwing", async () => {
    const scheduler = createScheduler();
    const warm = vi.fn().mockRejectedValue(new Error("worker failed"));

    scheduleMarkdownWorkerWarmup({ warm, scheduler });
    scheduler.fireTimeout();
    await flushWarmup();

    expect(warm).toHaveBeenCalledTimes(1);
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "render.markdownWorkerWarmup.failed",
          deliveryPrimed: false,
          reason: "warmup-failed",
          status: "error",
          trigger: "timeout",
        }),
      ]),
    );
    expect(JSON.stringify(events)).not.toContain("worker failed");
  });

  it("does not run after dispose", () => {
    const scheduler = createScheduler();
    const warm = vi.fn().mockResolvedValue(undefined);

    const scheduled = scheduleMarkdownWorkerWarmup({ warm, scheduler });
    scheduled.dispose();
    scheduler.fireIdle();
    scheduler.fireTimeout();

    expect(warm).not.toHaveBeenCalled();
  });

  it("detects the test-only disabled flag", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) =>
          key === "SVARD_DISABLE_MARKDOWN_WARMUP" ? "1" : null,
      },
    });

    expect(markdownWorkerWarmupDisabled()).toBe(true);
  });
});
