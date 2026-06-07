import type {
  PlantUmlDiagram,
  PlantUmlRenderInput,
  PlantUmlRenderResult,
} from "./types";
import { createRenderRequestId } from "./renderRequestId";

interface PendingRender {
  input: PlantUmlRenderInput;
  resolve: (result: PlantUmlRenderResult) => void;
  enqueuedAt: number;
}

interface WorkerMessage {
  type: "PLANTUML_RESULT" | "PLANTUML_ERROR";
  requestId: string;
  status?: "rendered" | "error";
  svg?: string;
  diagnostics?: string[];
  metrics?: {
    renderMs: number;
    queueWaitMs?: number;
    parentRoundTripMs?: number;
    workerTotalMs?: number;
    renderCoreMs?: number;
    diagnosticMs?: number;
    encodeMs?: number;
    postMessageMs?: number;
    svgBytes?: number;
    mode?: "renderToString" | "dom" | "dummy";
  };
}

const workerUrl = "/vendor/plantuml-teavm/worker.html";
export const defaultPlantUmlConcurrency = 1;
const maxPlantUmlConcurrency = 4;

type PlantUmlIframeFactory = () => HTMLIFrameElement;

export interface PlantUmlRenderBatchMetrics {
  diagramCount: number;
  renderedCount: number;
  timeoutCount: number;
  errorCount: number;
  totalMs: number;
  p50Ms: number | null;
  p95Ms: number | null;
  concurrency: number;
  workerCount: number;
  componentP50Ms?: Record<string, number | null>;
  componentP95Ms?: Record<string, number | null>;
}

declare global {
  interface Window {
    __svardPlantUmlMetrics?: PlantUmlRenderBatchMetrics;
  }
}

function defaultCreateIframe() {
  return document.createElement("iframe");
}

export function normalizePlantUmlRenderSource(source: string): string {
  const trimmed = source.trim();
  if (!trimmed) {
    return source;
  }

  if (/^@start/i.test(trimmed) || /^@end/i.test(trimmed)) {
    return source;
  }

  return `@startuml\n${trimmed}\n@enduml`;
}

class IframePlantUmlWorker {
  private iframe: HTMLIFrameElement | null = null;
  private ready: Promise<void> | null = null;
  private active: PendingRender | null = null;
  private activeRequestId: string | null = null;
  private activeTimer: number | null = null;
  private activeDispatchedAt: number | null = null;

  constructor(private readonly createIframe: PlantUmlIframeFactory) {}

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
      iframe.title = "PlantUML renderer";
      iframe.style.cssText =
        "position:absolute;width:0;height:0;border:0;visibility:hidden;pointer-events:none";
      iframe.setAttribute("aria-hidden", "true");
      iframe.addEventListener("load", () => resolve(), { once: true });
      iframe.addEventListener(
        "error",
        () => reject(new Error("PlantUML renderer iframe failed to load")),
        { once: true },
      );
      document.body.appendChild(iframe);
      this.iframe = iframe;
      window.addEventListener("message", this.handleMessage);
    });

    return this.ready;
  }

  async renderSvg(
    input: PlantUmlRenderInput,
    enqueuedAt = performance.now(),
  ): Promise<PlantUmlRenderResult> {
    return new Promise((resolve) => {
      const next = { input, resolve, enqueuedAt };
      this.active = next;
      void this.initialize()
        .then(() => this.startActive(next))
        .catch((error) => {
          this.active = null;
          resolve({
            status: "error",
            diagnostics: [
              error instanceof Error
                ? error.message
                : "PlantUML renderer iframe failed to initialize",
            ],
            metrics: { renderMs: 0 },
          });
        });
    });
  }

  dispose(): void {
    if (this.activeTimer !== null) {
      window.clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }
    window.removeEventListener("message", this.handleMessage);
    this.iframe?.remove();
    this.active?.resolve({
      status: "error",
      diagnostics: ["PlantUML renderer disposed."],
      metrics: { renderMs: 0 },
    });
    this.iframe = null;
    this.ready = null;
    this.active = null;
    this.activeRequestId = null;
    this.activeDispatchedAt = null;
  }

  private startActive(next: PendingRender) {
    if (this.active !== next) {
      return;
    }

    const requestId = createRenderRequestId("plantuml");
    this.activeRequestId = requestId;
    this.activeDispatchedAt = performance.now();
    this.activeTimer = window.setTimeout(() => {
      this.finish({
        status: "timeout",
        diagnostics: [
          `PlantUML render timed out after ${next.input.timeoutMs}ms.`,
        ],
        metrics: { renderMs: next.input.timeoutMs },
      });
    }, next.input.timeoutMs);

    this.iframe?.contentWindow?.postMessage(
      {
        type: "PLANTUML_RENDER",
        requestId,
        lines: normalizePlantUmlRenderSource(next.input.source).split(
          /\r\n|\r|\n/,
        ),
        theme: "light",
        probeMode: next.input.probeMode ?? "normal",
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

    if (event.data.type === "PLANTUML_RESULT") {
      this.finish({
        status: event.data.status ?? "rendered",
        svg: event.data.svg,
        diagnostics: event.data.diagnostics ?? [],
        metrics: this.withParentMetrics(event.data.metrics),
      });
      return;
    }

    this.finish({
      status: "error",
      diagnostics: event.data.diagnostics ?? ["PlantUML render failed."],
      metrics: this.withParentMetrics(event.data.metrics),
    });
  };

  private finish(result: PlantUmlRenderResult) {
    if (this.activeTimer !== null) {
      window.clearTimeout(this.activeTimer);
      this.activeTimer = null;
    }

    const active = this.active;
    this.active = null;
    this.activeRequestId = null;
    active?.resolve(result);
  }

  private withParentMetrics(
    metrics: WorkerMessage["metrics"],
  ): PlantUmlRenderResult["metrics"] {
    const dispatchedAt = this.activeDispatchedAt ?? performance.now();
    return {
      renderMs: metrics?.renderMs ?? performance.now() - dispatchedAt,
      ...metrics,
      queueWaitMs: this.active
        ? dispatchedAt - this.active.enqueuedAt
        : metrics?.queueWaitMs,
      parentRoundTripMs: performance.now() - dispatchedAt,
    };
  }
}

export class IframePlantUmlLocalRenderer {
  private readonly workers: IframePlantUmlWorker[] = [];
  private readonly queue: PendingRender[] = [];

  constructor(
    private readonly concurrency: number,
    private readonly createIframe: PlantUmlIframeFactory = defaultCreateIframe,
  ) {}

  get workerCount(): number {
    return this.workers.length;
  }

  async renderSvg(input: PlantUmlRenderInput): Promise<PlantUmlRenderResult> {
    return new Promise((resolve) => {
      this.queue.push({ input, resolve, enqueuedAt: performance.now() });
      this.pump();
    });
  }

  dispose(): void {
    while (this.queue.length > 0) {
      this.queue.shift()?.resolve({
        status: "error",
        diagnostics: ["PlantUML renderer disposed."],
        metrics: { renderMs: 0 },
      });
    }
    for (const worker of this.workers) {
      worker.dispose();
    }
    this.workers.length = 0;
    this.queue.length = 0;
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

  private idleWorker(): IframePlantUmlWorker | null {
    const idle = this.workers.find((worker) => worker.idle);
    if (idle) {
      return idle;
    }
    if (this.workers.length >= this.concurrency) {
      return null;
    }

    const worker = new IframePlantUmlWorker(this.createIframe);
    this.workers.push(worker);
    return worker;
  }
}

let renderers = new Map<number, IframePlantUmlLocalRenderer>();

function normalizeConcurrency(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined) {
    return defaultPlantUmlConcurrency;
  }
  return Math.min(maxPlantUmlConcurrency, Math.max(1, Math.floor(value)));
}

function getRenderer(concurrency: number) {
  const normalized = normalizeConcurrency(concurrency);
  let renderer = renderers.get(normalized);
  if (!renderer) {
    renderer = new IframePlantUmlLocalRenderer(normalized);
    renderers.set(normalized, renderer);
  }
  return renderer;
}

export async function renderPlantUmlDiagrams(
  diagrams: PlantUmlDiagram[],
  options: {
    theme: "light" | "dark";
    timeoutMs: number;
    concurrency?: number;
    probeMode?: PlantUmlRenderInput["probeMode"];
  },
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
        theme: options.theme,
        timeoutMs: options.timeoutMs,
        probeMode: options.probeMode,
      }),
    })),
  );
  publishPlantUmlMetrics({
    results: results.map((result) => result.result),
    totalMs: performance.now() - started,
    concurrency: normalizeConcurrency(options.concurrency),
    workerCount: localRenderer.workerCount,
  });
  return results;
}

export function disposePlantUmlRenderer() {
  for (const renderer of renderers.values()) {
    renderer.dispose();
  }
  renderers = new Map();
}

function publishPlantUmlMetrics({
  results,
  totalMs,
  concurrency,
  workerCount,
}: {
  results: PlantUmlRenderResult[];
  totalMs: number;
  concurrency: number;
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
    "parentRoundTripMs",
    "workerTotalMs",
    "renderCoreMs",
    "diagnosticMs",
    "encodeMs",
    "postMessageMs",
  ] as const;
  window.__svardPlantUmlMetrics = {
    diagramCount: results.length,
    renderedCount: results.filter((result) => result.status === "rendered")
      .length,
    timeoutCount: results.filter((result) => result.status === "timeout")
      .length,
    errorCount: results.filter((result) => result.status === "error").length,
    totalMs,
    p50Ms: percentile(renderTimes, 0.5),
    p95Ms: percentile(renderTimes, 0.95),
    concurrency,
    workerCount,
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
  };
}

function metricValues(
  results: PlantUmlRenderResult[],
  key: keyof NonNullable<PlantUmlRenderResult["metrics"]>,
): number[] {
  return results
    .map((result) => result.metrics?.[key])
    .filter((value): value is number => typeof value === "number")
    .sort((left, right) => left - right);
}

function percentile(values: number[], fraction: number): number | null {
  if (values.length === 0) {
    return null;
  }

  const index = Math.min(
    values.length - 1,
    Math.max(0, Math.ceil(values.length * fraction) - 1),
  );
  return values[index];
}
