import { perfDuration, perfNow, tracePerf } from "./perfTrace";

type IdleCallback = () => void;

interface IdleScheduler {
  requestIdleCallback?: (callback: IdleCallback) => number;
  cancelIdleCallback?: (handle: number) => void;
  setTimeout: (callback: () => void, timeoutMs: number) => number;
  clearTimeout: (handle: number) => void;
}

interface ScheduleMarkdownWorkerWarmupOptions {
  deliveryPrimed?: boolean;
  warm: () => Promise<unknown>;
  scheduler?: IdleScheduler;
  passes?: number;
  timeoutMs?: number;
}

export interface ScheduledMarkdownWorkerWarmup {
  dispose: () => void;
}

function defaultScheduler(): IdleScheduler {
  return window as Window & typeof globalThis & IdleScheduler;
}

export function scheduleMarkdownWorkerWarmup({
  deliveryPrimed = false,
  warm,
  scheduler = defaultScheduler(),
  passes = 1,
  timeoutMs = 750,
}: ScheduleMarkdownWorkerWarmupOptions): ScheduledMarkdownWorkerWarmup {
  let disposed = false;
  let started = false;
  let idleHandle: number | null = null;
  let timeoutHandle: number | null = null;

  const cancelPending = () => {
    if (idleHandle !== null) {
      scheduler.cancelIdleCallback?.(idleHandle);
      idleHandle = null;
    }
    if (timeoutHandle !== null) {
      scheduler.clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
  };

  const run = (trigger: "idle" | "timeout") => {
    if (disposed) {
      tracePerf("render.markdownWorkerWarmup.skipped", {
        reason: "disposed",
        trigger,
      });
      return;
    }
    if (started) {
      tracePerf("render.markdownWorkerWarmup.skipped", {
        reason: "already-started",
        trigger,
      });
      return;
    }
    started = true;
    cancelPending();

    const startedAt = perfNow();
    tracePerf("render.markdownWorkerWarmup.start", { trigger });
    void warm()
      .then(() => {
        tracePerf("render.markdownWorkerWarmup.done", {
          deliveryPrimed,
          durationMs: perfDuration(startedAt),
          passes,
          status: "ok",
          trigger,
        });
      })
      .catch(() => {
        tracePerf("render.markdownWorkerWarmup.failed", {
          deliveryPrimed,
          durationMs: perfDuration(startedAt),
          passes,
          reason: "warmup-failed",
          status: "error",
          trigger,
        });
      });
  };

  if (typeof scheduler.requestIdleCallback === "function") {
    idleHandle = scheduler.requestIdleCallback(() => run("idle"));
  }
  timeoutHandle = scheduler.setTimeout(() => run("timeout"), timeoutMs);

  return {
    dispose() {
      disposed = true;
      cancelPending();
    },
  };
}

export function markdownWorkerWarmupDisabled(): boolean {
  const getItem = globalThis.localStorage?.getItem;
  if (typeof getItem !== "function") {
    return false;
  }
  return (
    getItem.call(globalThis.localStorage, "SVARD_DISABLE_MARKDOWN_WARMUP") ===
    "1"
  );
}
