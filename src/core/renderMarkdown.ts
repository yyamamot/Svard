import type { RenderResult } from "./types";
import {
  RenderWorkerPool,
  type RenderRequestOptions,
} from "./renderWorkerPool";

interface MarkdownRenderPayload {
  source: string;
}

const minimalWarmupMarkdown = "# warmup\n";
const representativeWarmupMarkdown = `# Warmup

Small Markdown document for renderer path priming.

- one
- two

\`\`\`ts
const warmed = true;
\`\`\`
`;
const readinessProbeMarkdown = "# ready\n\nworker readiness probe\n";
const deliveryPrimingMarkdown = "# ping\n\nworker delivery priming\n";

function perfNow(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function perfDuration(startedAt: number): number {
  return Number((perfNow() - startedAt).toFixed(2));
}

const markdownRenderWorkerPool = new RenderWorkerPool<
  MarkdownRenderPayload,
  RenderResult
>({
  label: "markdown",
  maxWorkers: 2,
  createWorker: () =>
    new Worker(new URL("./markdown.worker.ts", import.meta.url), {
      type: "module",
    }),
});

export function renderMarkdown(
  source: string,
  options: RenderRequestOptions = {},
): Promise<RenderResult> {
  return markdownRenderWorkerPool.render(
    { source },
    {
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    },
  );
}

export function warmMarkdownRenderWorker(): Promise<RenderResult> {
  return renderMarkdown(minimalWarmupMarkdown)
    .then(() => renderMarkdown(representativeWarmupMarkdown))
    .then(() => waitForDeliveryPrimingSlot())
    .then(() => renderMarkdown(deliveryPrimingMarkdown));
}

export async function probeMarkdownRenderWorkerReady(): Promise<{
  durationMs: number;
}> {
  const startedAt = perfNow();
  await renderMarkdown(readinessProbeMarkdown);
  return { durationMs: perfDuration(startedAt) };
}

export function disposeMarkdownRenderWorkers(): void {
  markdownRenderWorkerPool.dispose();
}

function waitForDeliveryPrimingSlot(): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, 0);
  });
}
