import type {
  GraphvizDiagram,
  GraphvizRenderInput,
  GraphvizRenderResult,
} from "./types";
import { createRenderRequestId } from "./renderRequestId";

interface PendingRender {
  enqueuedAt: number;
  input: GraphvizRenderInput;
  resolve: (result: GraphvizRenderResult) => void;
}

interface WorkerMessage {
  type: "GRAPHVIZ_RESULT" | "GRAPHVIZ_ERROR";
  requestId: string;
  status?: "rendered" | "error";
  svg?: string;
  diagnostics?: string[];
  metrics?: {
    renderMs: number;
    workerReadyWaitMs?: number;
    svgBytes?: number;
    workerTotalMs?: number;
  };
}

type GraphvizIframeFactory = () => HTMLIFrameElement;

export interface GraphvizRenderBatchMetrics {
  componentP50Ms?: Record<string, number | null>;
  componentP95Ms?: Record<string, number | null>;
  concurrency: number;
  diagramCount: number;
  errorCount: number;
  p50Ms: number | null;
  p95Ms: number | null;
  renderedCount: number;
  timeoutCount: number;
  totalMs: number;
  workerCount: number;
}

declare global {
  interface Window {
    __svardGraphvizMetrics?: GraphvizRenderBatchMetrics;
  }
}

const workerUrl = "/vendor/plantuml-teavm/graphviz-worker.html";
export const defaultGraphvizConcurrency = 2;
const maxGraphvizConcurrency = 4;

function defaultCreateIframe() {
  return document.createElement("iframe");
}

class IframeGraphvizWorker {
  private active: PendingRender | null = null;
  private activeDispatchedAt: number | null = null;
  private activeRequestId: string | null = null;
  private activeTimer: number | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private ready: Promise<void> | null = null;
  private readyResolvedAt: number | null = null;

  constructor(private readonly createIframe: GraphvizIframeFactory) {}

  get idle(): boolean {
    return this.active === null;
  }

  async initialize(): Promise<void> {
    if (this.ready) {
      return this.ready;
    }

    this.ready = new Promise((resolve, reject) => {
      const iframe = this.createIframe();
      iframe.src = workerUrl;
      iframe.title = "Graphviz renderer";
      iframe.style.cssText =
        "position:absolute;width:0;height:0;border:0;visibility:hidden;pointer-events:none";
      iframe.setAttribute("aria-hidden", "true");
      iframe.addEventListener(
        "load",
        () => {
          this.readyResolvedAt = performance.now();
          resolve();
        },
        { once: true },
      );
      iframe.addEventListener(
        "error",
        () => reject(new Error("Graphviz renderer iframe failed to load")),
        { once: true },
      );
      document.body.appendChild(iframe);
      this.iframe = iframe;
      window.addEventListener("message", this.handleMessage);
    });

    return this.ready;
  }

  async warm(): Promise<void> {
    await this.initialize();
  }

  async renderSvg(
    input: GraphvizRenderInput,
    enqueuedAt = performance.now(),
  ): Promise<GraphvizRenderResult> {
    return new Promise((resolve) => {
      const next = { enqueuedAt, input, resolve };
      this.active = next;
      void this.initialize()
        .then(() => this.startActive(next))
        .catch((error) => {
          this.finish(
            {
              status: "error",
              diagnostics: [
                error instanceof Error
                  ? error.message
                  : "Graphviz renderer iframe failed to initialize",
              ],
              metrics: { renderMs: 0 },
            },
            { resetWorker: true },
          );
        });
    });
  }

  dispose(): void {
    if (this.activeTimer !== null) {
      window.clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }
    this.resetIframe();
    this.active?.resolve({
      status: "error",
      diagnostics: ["Graphviz renderer disposed."],
      metrics: { renderMs: 0 },
    });
    this.active = null;
    this.activeRequestId = null;
    this.activeDispatchedAt = null;
  }

  private startActive(next: PendingRender): void {
    if (this.active !== next) {
      return;
    }

    const requestId = createRenderRequestId("graphviz");
    this.activeRequestId = requestId;
    this.activeDispatchedAt = performance.now();
    this.activeTimer = window.setTimeout(() => {
      this.finish(
        {
          status: "timeout",
          diagnostics: [
            `Graphviz render timed out after ${next.input.timeoutMs}ms.`,
          ],
          metrics: this.withParentMetrics({
            renderMs: next.input.timeoutMs,
          }),
        },
        { resetWorker: true },
      );
    }, next.input.timeoutMs);

    this.iframe?.contentWindow?.postMessage(
      {
        type: "GRAPHVIZ_RENDER",
        requestId,
        source: next.input.source,
      },
      window.location.origin,
    );
  }

  private handleMessage = (event: MessageEvent<WorkerMessage>) => {
    if (
      event.origin !== window.location.origin ||
      event.source !== this.iframe?.contentWindow ||
      !event.data ||
      event.data.requestId !== this.activeRequestId
    ) {
      return;
    }

    if (event.data.type === "GRAPHVIZ_RESULT") {
      this.finish({
        status: event.data.status ?? "rendered",
        svg: event.data.svg,
        diagnostics: event.data.diagnostics ?? [],
        metrics: this.withParentMetrics(event.data.metrics),
      });
      return;
    }

    if (event.data.type === "GRAPHVIZ_ERROR") {
      this.finish(
        {
          status: "error",
          diagnostics: event.data.diagnostics ?? ["Graphviz render failed."],
          metrics: this.withParentMetrics(event.data.metrics),
        },
        { resetWorker: true },
      );
      return;
    }

    this.finish(
      {
        status: "error",
        diagnostics: ["Graphviz renderer sent a malformed response."],
        metrics: this.withParentMetrics(undefined),
      },
      { resetWorker: true },
    );
  };

  private finish(
    result: GraphvizRenderResult,
    options: { resetWorker?: boolean } = {},
  ): void {
    if (this.activeTimer !== null) {
      window.clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }

    const active = this.active;
    this.active = null;
    this.activeRequestId = null;
    this.activeDispatchedAt = null;
    if (options.resetWorker) {
      this.resetIframe();
    }
    active?.resolve(result);
  }

  private resetIframe(): void {
    window.removeEventListener("message", this.handleMessage);
    this.iframe?.remove();
    this.iframe = null;
    this.ready = null;
    this.readyResolvedAt = null;
  }

  private withParentMetrics(
    metrics: WorkerMessage["metrics"] | undefined,
  ): GraphvizRenderResult["metrics"] {
    const dispatchedAt = this.activeDispatchedAt ?? performance.now();
    return {
      renderMs: metrics?.renderMs ?? performance.now() - dispatchedAt,
      ...metrics,
      queueWaitMs: this.active
        ? dispatchedAt - this.active.enqueuedAt
        : undefined,
      workerReadyWaitMs: this.active
        ? Math.max(
            0,
            Math.min(dispatchedAt, this.readyResolvedAt ?? dispatchedAt) -
              this.active.enqueuedAt,
          )
        : metrics?.workerReadyWaitMs,
      parentRoundTripMs: performance.now() - dispatchedAt,
      workerTotalMs: metrics?.workerTotalMs ?? metrics?.renderMs,
    };
  }
}

export class IframeGraphvizLocalRenderer {
  private readonly queue: PendingRender[] = [];
  private readonly workers: IframeGraphvizWorker[] = [];

  constructor(
    private readonly concurrency = defaultGraphvizConcurrency,
    private readonly createIframe: GraphvizIframeFactory = defaultCreateIframe,
  ) {}

  get workerCount(): number {
    return this.workers.length;
  }

  async renderSvg(input: GraphvizRenderInput): Promise<GraphvizRenderResult> {
    return new Promise((resolve) => {
      this.queue.push({ enqueuedAt: performance.now(), input, resolve });
      this.pump();
    });
  }

  async warm(): Promise<void> {
    const worker = this.idleWorker();
    if (!worker) {
      return;
    }
    try {
      await worker.warm();
    } catch (error) {
      const index = this.workers.indexOf(worker);
      if (index >= 0 && worker.idle) {
        worker.dispose();
        this.workers.splice(index, 1);
      }
      throw error;
    }
  }

  dispose(): void {
    while (this.queue.length > 0) {
      this.queue.shift()?.resolve({
        status: "error",
        diagnostics: ["Graphviz renderer disposed."],
        metrics: { renderMs: 0 },
      });
    }
    for (const worker of this.workers) {
      worker.dispose();
    }
    this.queue.length = 0;
    this.workers.length = 0;
  }

  private pump(): void {
    while (this.queue.length > 0) {
      const worker = this.idleWorker();
      if (!worker) {
        return;
      }

      const next = this.queue.shift()!;
      void worker.renderSvg(next.input, next.enqueuedAt).then((result) => {
        next.resolve(result);
        this.pump();
      });
    }
  }

  private idleWorker(): IframeGraphvizWorker | null {
    const idle = this.workers.find((worker) => worker.idle);
    if (idle) {
      return idle;
    }
    if (this.workers.length >= normalizeConcurrency(this.concurrency)) {
      return null;
    }

    const worker = new IframeGraphvizWorker(this.createIframe);
    this.workers.push(worker);
    return worker;
  }
}

let renderer: IframeGraphvizLocalRenderer | null = null;

function normalizeConcurrency(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined) {
    return defaultGraphvizConcurrency;
  }
  return Math.min(maxGraphvizConcurrency, Math.max(1, Math.floor(value)));
}

function getRenderer(concurrency = defaultGraphvizConcurrency) {
  renderer ??= new IframeGraphvizLocalRenderer(
    normalizeConcurrency(concurrency),
  );
  return renderer;
}

export async function renderGraphvizDiagrams(
  diagrams: GraphvizDiagram[],
  options: { timeoutMs: number; concurrency?: number },
) {
  if (diagrams.length === 0) {
    return [];
  }

  const localRenderer = getRenderer(normalizeConcurrency(options.concurrency));
  const started = performance.now();
  const results = await Promise.all(
    diagrams.map(async (diagram) => ({
      id: diagram.id,
      result: await localRenderer.renderSvg({
        source: diagram.source,
        timeoutMs: options.timeoutMs,
      }),
    })),
  );
  publishGraphvizMetrics({
    concurrency: normalizeConcurrency(options.concurrency),
    results: results.map((result) => result.result),
    totalMs: performance.now() - started,
    workerCount: localRenderer.workerCount,
  });
  return results;
}

export async function warmGraphvizRenderer(
  options: { concurrency?: number } = {},
) {
  if (typeof document === "undefined") {
    return;
  }
  const localRenderer = getRenderer(normalizeConcurrency(options.concurrency));
  await localRenderer.warm();
}

export function disposeGraphvizRenderer() {
  renderer?.dispose();
  renderer = null;
}

function publishGraphvizMetrics({
  concurrency,
  results,
  totalMs,
  workerCount,
}: {
  concurrency: number;
  results: GraphvizRenderResult[];
  totalMs: number;
  workerCount: number;
}) {
  if (typeof window === "undefined") {
    return;
  }

  const renderTimes = results
    .map((result) => result.metrics?.renderMs)
    .filter((value): value is number => typeof value === "number")
    .sort((left, right) => left - right);
  const componentKeys = [
    "queueWaitMs",
    "workerReadyWaitMs",
    "parentRoundTripMs",
    "workerTotalMs",
  ] as const;
  window.__svardGraphvizMetrics = {
    componentP50Ms: Object.fromEntries(
      componentKeys.map((key) => [
        key,
        percentile(metricValues(results, key), 0.5),
      ]),
    ),
    componentP95Ms: Object.fromEntries(
      componentKeys.map((key) => [
        key,
        percentile(metricValues(results, key), 0.95),
      ]),
    ),
    concurrency,
    diagramCount: results.length,
    errorCount: results.filter((result) => result.status === "error").length,
    p50Ms: percentile(renderTimes, 0.5),
    p95Ms: percentile(renderTimes, 0.95),
    renderedCount: results.filter((result) => result.status === "rendered")
      .length,
    timeoutCount: results.filter((result) => result.status === "timeout")
      .length,
    totalMs,
    workerCount,
  };
}

function metricValues(
  results: GraphvizRenderResult[],
  key: keyof NonNullable<GraphvizRenderResult["metrics"]>,
) {
  return results
    .map((result) => result.metrics?.[key])
    .filter((value): value is number => typeof value === "number")
    .sort((left, right) => left - right);
}

function percentile(values: number[], percentileValue: number): number | null {
  if (values.length === 0) {
    return null;
  }
  const index = Math.min(
    values.length - 1,
    Math.max(0, Math.ceil(values.length * percentileValue) - 1),
  );
  return values[index];
}
