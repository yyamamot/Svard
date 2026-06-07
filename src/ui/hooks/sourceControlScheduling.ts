import type { MutableRefObject } from "react";
import { tracePerf } from "../lib/perfTrace";

export const sourceControlRefreshDebounceMs = 250;
export const sourceControlIdleWarmDelayMs = 900;
export const sourceControlIdleWarmTimeoutMs = 2_500;
export const sourceControlChangesCacheStaleMs = 5 * 60 * 1_000;

type IdleDeadlineLike = {
  didTimeout: boolean;
  timeRemaining(): number;
};

type WindowWithIdleCallback = Window & {
  requestIdleCallback?: (
    callback: (deadline: IdleDeadlineLike) => void,
    options?: { timeout?: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export interface SourceControlTimerRefs {
  refreshTimerRef: MutableRefObject<number | null>;
  idleWarmDelayRef: MutableRefObject<number | null>;
  idleWarmHandleRef: MutableRefObject<number | null>;
  silentRefreshTimerRef: MutableRefObject<number | null>;
}

export function scheduleDebouncedSourceControlRefresh(
  refreshTimerRef: MutableRefObject<number | null>,
  refresh: () => void,
) {
  if (refreshTimerRef.current !== null) {
    window.clearTimeout(refreshTimerRef.current);
  }
  refreshTimerRef.current = window.setTimeout(() => {
    refreshTimerRef.current = null;
    tracePerf("sourceControl.watch.debouncedRefresh", {
      debounceMs: sourceControlRefreshDebounceMs,
    });
    refresh();
  }, sourceControlRefreshDebounceMs);
}

export function scheduleAfterDocumentPaint(callback: () => void): () => void {
  let cancelled = false;
  const handles: number[] = [];
  const scheduleTimeout = () => {
    handles.push(
      window.setTimeout(() => {
        if (!cancelled) {
          callback();
        }
      }, 0),
    );
  };

  if (typeof window.requestAnimationFrame === "function") {
    const first = window.requestAnimationFrame(() => {
      if (cancelled) {
        return;
      }
      const second = window.requestAnimationFrame(() => {
        if (!cancelled) {
          callback();
        }
      });
      handles.push(second);
    });
    handles.push(first);
  } else {
    scheduleTimeout();
  }

  return () => {
    cancelled = true;
    for (const handle of handles) {
      if (typeof window.cancelAnimationFrame === "function") {
        window.cancelAnimationFrame(handle);
      }
      window.clearTimeout(handle);
    }
  };
}

export function cancelScheduledSourceControlIdleWork(
  refs: SourceControlTimerRefs,
) {
  if (refs.silentRefreshTimerRef.current !== null) {
    window.clearTimeout(refs.silentRefreshTimerRef.current);
    refs.silentRefreshTimerRef.current = null;
  }
  if (refs.idleWarmDelayRef.current !== null) {
    window.clearTimeout(refs.idleWarmDelayRef.current);
    refs.idleWarmDelayRef.current = null;
  }
  if (refs.idleWarmHandleRef.current !== null) {
    const win = window as WindowWithIdleCallback;
    if (win.cancelIdleCallback) {
      win.cancelIdleCallback(refs.idleWarmHandleRef.current);
    } else {
      window.clearTimeout(refs.idleWarmHandleRef.current);
    }
    refs.idleWarmHandleRef.current = null;
  }
}

export function cancelAllSourceControlTimers(refs: SourceControlTimerRefs) {
  if (refs.refreshTimerRef.current !== null) {
    window.clearTimeout(refs.refreshTimerRef.current);
    refs.refreshTimerRef.current = null;
  }
  cancelScheduledSourceControlIdleWork(refs);
}

export function scheduleIdleSourceControlRefresh(
  refs: SourceControlTimerRefs,
  callback: () => void,
  options: { delayMs?: number } = {},
) {
  cancelScheduledSourceControlIdleWork(refs);

  const delayMs = options.delayMs ?? sourceControlRefreshDebounceMs;
  const win = window as WindowWithIdleCallback;
  refs.silentRefreshTimerRef.current = window.setTimeout(() => {
    refs.silentRefreshTimerRef.current = null;
    const runWhenIdle = () => {
      refs.idleWarmHandleRef.current = null;
      callback();
    };
    if (win.requestIdleCallback) {
      refs.idleWarmHandleRef.current = win.requestIdleCallback(runWhenIdle, {
        timeout: sourceControlIdleWarmTimeoutMs,
      });
    } else {
      refs.idleWarmHandleRef.current = window.setTimeout(runWhenIdle, 0);
    }
  }, delayMs);
}
