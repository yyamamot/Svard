import { useEffect } from "react";
import {
  probeMarkdownRenderWorkerReady,
  warmMarkdownRenderWorker,
} from "../../core/renderMarkdown";
import {
  markdownWorkerWarmupDisabled,
  scheduleMarkdownWorkerWarmup,
} from "../lib/markdownWorkerWarmup";

export function useMarkdownWorkerWarmupProbe(workspaceBootComplete: boolean) {
  useEffect(() => {
    if (!workspaceBootComplete) {
      return;
    }
    if (markdownWorkerWarmupDisabled()) {
      return;
    }

    const scheduledWarmup = scheduleMarkdownWorkerWarmup({
      deliveryPrimed: true,
      passes: 3,
      warm: warmMarkdownRenderWorker,
    });

    return () => {
      scheduledWarmup.dispose();
    };
  }, [workspaceBootComplete]);

  useEffect(() => {
    const target = window as Window &
      typeof globalThis & {
        __SVARD_PERF_PROBES__?: {
          probeMarkdownRenderWorkerReady: typeof probeMarkdownRenderWorkerReady;
        };
      };
    target.__SVARD_PERF_PROBES__ = {
      probeMarkdownRenderWorkerReady,
    };
    return () => {
      if (
        target.__SVARD_PERF_PROBES__?.probeMarkdownRenderWorkerReady ===
        probeMarkdownRenderWorkerReady
      ) {
        target.__SVARD_PERF_PROBES__ = undefined;
      }
    };
  }, []);
}
