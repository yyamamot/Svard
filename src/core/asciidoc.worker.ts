/// <reference lib="webworker" />
import {
  renderAsciiDocCore,
  type AsciiDocRenderPayload,
} from "./renderAsciiDocCore";
import type { RenderResult } from "./types";
import type {
  RenderWorkerRequest,
  RenderWorkerResponse,
} from "./renderWorkerPool";

self.onmessage = (
  event: MessageEvent<RenderWorkerRequest<AsciiDocRenderPayload>>,
) => {
  const { diagnostic, requestId, payload } = event.data;
  const workerReceivedAt = performance.now();
  try {
    const renderStartedAt = performance.now();
    const { result, phaseMetrics } = renderAsciiDocCore(payload, {
      collectMetrics: Boolean(diagnostic),
    });
    const renderDoneAt = performance.now();
    const responsePostAt = performance.now();

    self.postMessage({
      requestId,
      ok: true,
      result,
      ...(diagnostic
        ? {
            metrics: {
              renderCoreMs: duration(renderStartedAt, renderDoneAt),
              renderStartDeltaMs: duration(workerReceivedAt, renderStartedAt),
              responsePostDeltaMs: duration(workerReceivedAt, responsePostAt),
              workerReceivedAtMs: 0,
              asciidocPhases: phaseMetrics,
            },
          }
        : {}),
    } satisfies RenderWorkerResponse<RenderResult>);
  } catch (error) {
    const responsePostAt = performance.now();
    self.postMessage({
      requestId,
      ok: false,
      message:
        error instanceof Error ? error.message : "AsciiDoc render failed",
      ...(diagnostic
        ? {
            metrics: {
              renderCoreMs: 0,
              renderStartDeltaMs: 0,
              responsePostDeltaMs: duration(workerReceivedAt, responsePostAt),
              workerReceivedAtMs: 0,
            },
          }
        : {}),
    } satisfies RenderWorkerResponse<RenderResult>);
  }
};

function duration(start: number, end: number): number {
  return Number((end - start).toFixed(2));
}
