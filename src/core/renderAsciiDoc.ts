import type {
  AsciiDocIncludeFile,
  AsciiDocRenderContext,
  RenderResult,
} from "./types";
import type { AsciiDocRenderPayload } from "./renderAsciiDocCore";
import {
  RenderWorkerPool,
  type RenderRequestOptions,
} from "./renderWorkerPool";

const asciidocRenderWorkerPool = new RenderWorkerPool<
  AsciiDocRenderPayload,
  RenderResult
>({
  label: "asciidoc",
  maxWorkers: 2,
  createWorker: () =>
    new Worker(new URL("./asciidoc.worker.ts", import.meta.url), {
      type: "module",
    }),
});

export function renderAsciiDoc(
  source: string,
  options: {
    path?: string;
    includeFiles?: AsciiDocIncludeFile[];
    asciidocContext?: AsciiDocRenderContext | null;
  } & RenderRequestOptions = {},
): Promise<RenderResult> {
  return asciidocRenderWorkerPool.render(
    {
      source,
      path: options.path,
      includeFiles: options.includeFiles ?? [],
      asciidocContext: options.asciidocContext,
    },
    {
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    },
  );
}

export function disposeAsciiDocRenderWorkers(): void {
  asciidocRenderWorkerPool.dispose();
}
