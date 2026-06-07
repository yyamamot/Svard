/// <reference lib="webworker" />
import { renderMarkdownCore } from "./renderMarkdownCore";
import type {
  RenderWorkerRequest,
  RenderWorkerResponse,
} from "./renderWorkerPool";

interface MarkdownRenderPayload {
  source: string;
}

self.onmessage = (
  event: MessageEvent<RenderWorkerRequest<MarkdownRenderPayload>>,
) => {
  const { diagnostic, requestId, payload } = event.data;
  const workerReceivedAt = performance.now();
  try {
    const renderStartedAt = performance.now();
    const result = renderMarkdownCore(payload.source);
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
            },
          }
        : {}),
    } satisfies RenderWorkerResponse<ReturnType<typeof renderMarkdownCore>>);
  } catch (error) {
    const responsePostAt = performance.now();
    self.postMessage({
      requestId,
      ok: false,
      message:
        error instanceof Error ? error.message : "Markdown render failed",
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
    } satisfies RenderWorkerResponse<ReturnType<typeof renderMarkdownCore>>);
  }
};

function duration(start: number, end: number): number {
  return Number((end - start).toFixed(2));
}
