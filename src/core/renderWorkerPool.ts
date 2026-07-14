import {
  asciiDocWorkerPhaseCountKeys,
  asciiDocWorkerPhaseDurationKeys,
  type AsciiDocWorkerPhaseMetrics,
} from "./renderWorkerMetrics";

export const defaultRenderWorkerTimeoutMs = 30000;

export interface RenderWorkerRequest<Payload> {
  diagnostic?: boolean;
  requestId: string;
  payload: Payload;
}

export interface RenderWorkerDiagnosticMetrics {
  renderCoreMs: number;
  renderStartDeltaMs: number;
  responsePostDeltaMs: number;
  workerReceivedAtMs: number;
  asciidocPhases?: AsciiDocWorkerPhaseMetrics;
}

export interface RenderWorkerSuccess<Result> {
  metrics?: RenderWorkerDiagnosticMetrics;
  requestId: string;
  ok: true;
  result: Result;
}

export interface RenderWorkerFailure {
  metrics?: RenderWorkerDiagnosticMetrics;
  requestId: string;
  ok: false;
  message: string;
}

export type RenderWorkerResponse<Result> =
  | RenderWorkerSuccess<Result>
  | RenderWorkerFailure;

export interface RenderWorkerLike {
  onmessage: ((event: MessageEvent<unknown>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null;
  postMessage(message: unknown): void;
  terminate(): void;
}

export interface RenderWorkerPoolOptions {
  label: string;
  maxWorkers?: number;
  timeoutMs?: number;
  createWorker: () => RenderWorkerLike;
}

export interface RenderRequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

interface QueuedRequest<Payload, Result> {
  requestId: string;
  payload: Payload;
  timeoutMs: number;
  signal?: AbortSignal;
  resolve: (result: Result) => void;
  reject: (error: Error) => void;
  abortListener?: () => void;
  diagnostic: boolean;
  enqueuedAt?: number;
}

interface ActiveRequest<Payload, Result> extends QueuedRequest<
  Payload,
  Result
> {
  postMessageQueuedAt?: number;
  reusedWorker: boolean;
  startedAt: number;
  timer: number;
}

interface WorkerSlot<Payload, Result> {
  worker: RenderWorkerLike | null;
  active: ActiveRequest<Payload, Result> | null;
}

export class RenderWorkerPool<Payload, Result> {
  private readonly label: string;
  private readonly maxWorkers: number;
  private readonly timeoutMs: number;
  private readonly createWorker: () => RenderWorkerLike;
  private readonly queue: QueuedRequest<Payload, Result>[] = [];
  private readonly slots: WorkerSlot<Payload, Result>[];
  private nextRequestNumber = 0;

  constructor(options: RenderWorkerPoolOptions) {
    this.label = options.label;
    this.maxWorkers = options.maxWorkers ?? 2;
    this.timeoutMs = options.timeoutMs ?? defaultRenderWorkerTimeoutMs;
    this.createWorker = options.createWorker;
    this.slots = Array.from({ length: this.maxWorkers }, () => ({
      worker: null,
      active: null,
    }));
  }

  render(
    payload: Payload,
    options: RenderRequestOptions = {},
  ): Promise<Result> {
    if (options.signal?.aborted) {
      return Promise.reject(createAbortError(`${this.label} render aborted`));
    }

    const requestId = `${this.label}-${++this.nextRequestNumber}`;
    const diagnostic = perfDiagnosticEnabled();
    return new Promise((resolve, reject) => {
      const request: QueuedRequest<Payload, Result> = {
        diagnostic,
        ...(diagnostic ? { enqueuedAt: perfNow() } : {}),
        requestId,
        payload,
        timeoutMs: options.timeoutMs ?? this.timeoutMs,
        signal: options.signal,
        resolve,
        reject,
      };

      if (options.signal) {
        request.abortListener = () => this.abortQueuedOrActive(request);
        options.signal.addEventListener("abort", request.abortListener, {
          once: true,
        });
      }

      this.queue.push(request);
      this.pump();
    });
  }

  dispose(): void {
    while (this.queue.length > 0) {
      const request = this.queue.shift()!;
      this.rejectRequest(
        request,
        new Error(`${this.label} render worker pool disposed`),
      );
    }

    for (const slot of this.slots) {
      if (slot.active) {
        window.clearTimeout(slot.active.timer);
        this.rejectRequest(
          slot.active,
          new Error(`${this.label} render worker pool disposed`),
        );
        slot.active = null;
      }
      this.terminateSlot(slot);
    }
  }

  private pump(): void {
    for (const slot of this.slots) {
      if (this.queue.length === 0) {
        return;
      }
      if (slot.active) {
        continue;
      }

      const request = this.queue.shift()!;
      if (request.signal?.aborted) {
        this.rejectRequest(
          request,
          createAbortError(`${this.label} render aborted`),
        );
        continue;
      }

      this.dispatch(slot, request);
    }
  }

  private dispatch(
    slot: WorkerSlot<Payload, Result>,
    request: QueuedRequest<Payload, Result>,
  ): void {
    let worker: RenderWorkerLike;
    const reusedWorker = Boolean(slot.worker);
    const queueDepth = this.queue.length;
    try {
      worker = this.ensureWorker(slot);
    } catch (error) {
      this.rejectRequest(request, normalizeError(error, this.label));
      this.terminateSlot(slot);
      this.pump();
      return;
    }

    const active: ActiveRequest<Payload, Result> = {
      ...request,
      reusedWorker,
      startedAt: perfNow(),
      timer: window.setTimeout(() => {
        this.failActiveRequest(
          slot,
          createTimeoutError(this.label, request.timeoutMs),
        );
      }, request.timeoutMs),
    };

    slot.active = active;
    traceWorkerPoolPerf("render.workerPool.dispatch", {
      label: this.label,
      queueDepth,
      reusedWorker,
    });
    if (typeof request.enqueuedAt === "number") {
      traceWorkerPoolDiagnosticPerf("render.workerPool.queueWait", {
        durationMs: perfDuration(request.enqueuedAt),
        label: this.label,
        queueDepth,
        reusedWorker,
      });
    }
    try {
      worker.postMessage({
        diagnostic: request.diagnostic,
        requestId: request.requestId,
        payload: request.payload,
      } satisfies RenderWorkerRequest<Payload>);
      active.postMessageQueuedAt = perfNow();
      traceWorkerPoolDiagnosticPerf("render.workerPool.postMessageQueued", {
        durationMs: perfDuration(active.startedAt),
        label: this.label,
        queueDepth,
        reusedWorker,
      });
    } catch (error) {
      this.failActiveRequest(slot, normalizeError(error, this.label));
    }
  }

  private ensureWorker(slot: WorkerSlot<Payload, Result>): RenderWorkerLike {
    if (slot.worker) {
      return slot.worker;
    }

    const worker = this.createWorker();
    worker.onmessage = (event) => this.handleMessage(slot, event.data);
    worker.onerror = (event) => {
      this.failActiveRequest(
        slot,
        new Error(event.message || `${this.label} render worker failed`),
      );
    };
    worker.onmessageerror = () => {
      this.failActiveRequest(
        slot,
        new Error(`${this.label} render worker sent an unreadable response`),
      );
    };
    slot.worker = worker;
    return worker;
  }

  private handleMessage(
    slot: WorkerSlot<Payload, Result>,
    data: unknown,
  ): void {
    const active = slot.active;
    if (!active) {
      return;
    }

    const response = parseWorkerResponse<Result>(data);
    if (!response) {
      this.failActiveRequest(
        slot,
        new Error(`${this.label} render worker sent a malformed response`),
      );
      return;
    }
    if (response.requestId !== active.requestId) {
      return;
    }

    traceWorkerPoolDiagnosticPerf("render.workerPool.messageReceived", {
      durationMs: perfDuration(active.startedAt),
      label: this.label,
      queueDepth: this.queue.length,
      reusedWorker: active.reusedWorker,
      sincePostMessageMs:
        typeof active.postMessageQueuedAt === "number"
          ? perfDuration(active.postMessageQueuedAt)
          : undefined,
    });
    traceWorkerMetrics(this.label, response.metrics);
    this.clearActive(slot);
    traceWorkerPoolPerf("render.workerPool.response", {
      durationMs: perfDuration(active.startedAt),
      label: this.label,
      queueDepth: this.queue.length,
      reusedWorker: active.reusedWorker,
    });
    if (response.ok) {
      this.resolveRequest(active, response.result);
    } else {
      this.rejectRequest(active, new Error(response.message));
    }
    this.pump();
  }

  private abortQueuedOrActive(request: QueuedRequest<Payload, Result>): void {
    const queuedIndex = this.queue.indexOf(request);
    if (queuedIndex >= 0) {
      this.queue.splice(queuedIndex, 1);
      this.rejectRequest(
        request,
        createAbortError(`${this.label} render aborted`),
      );
      return;
    }

    const slot = this.slots.find(
      (candidate) => candidate.active?.requestId === request.requestId,
    );
    if (slot) {
      this.failActiveRequest(
        slot,
        createAbortError(`${this.label} render aborted`),
      );
    }
  }

  private failActiveRequest(
    slot: WorkerSlot<Payload, Result>,
    error: Error,
  ): void {
    const active = slot.active;
    if (!active) {
      this.terminateSlot(slot);
      this.pump();
      return;
    }

    this.clearActive(slot);
    this.rejectRequest(active, error);
    this.terminateSlot(slot);
    this.pump();
  }

  private clearActive(slot: WorkerSlot<Payload, Result>): void {
    if (!slot.active) {
      return;
    }
    window.clearTimeout(slot.active.timer);
    slot.active = null;
  }

  private terminateSlot(slot: WorkerSlot<Payload, Result>): void {
    if (!slot.worker) {
      return;
    }
    slot.worker.onmessage = null;
    slot.worker.onerror = null;
    slot.worker.onmessageerror = null;
    slot.worker.terminate();
    slot.worker = null;
  }

  private resolveRequest(
    request: QueuedRequest<Payload, Result>,
    result: Result,
  ): void {
    this.removeAbortListener(request);
    request.resolve(result);
  }

  private rejectRequest(
    request: QueuedRequest<Payload, Result>,
    error: Error,
  ): void {
    this.removeAbortListener(request);
    request.reject(error);
  }

  private removeAbortListener(request: QueuedRequest<Payload, Result>): void {
    if (request.signal && request.abortListener) {
      request.signal.removeEventListener("abort", request.abortListener);
      request.abortListener = undefined;
    }
  }
}

function parseWorkerResponse<Result>(
  data: unknown,
): RenderWorkerResponse<Result> | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const response = data as Partial<RenderWorkerResponse<Result>>;
  if (typeof response.requestId !== "string") {
    return null;
  }
  const metrics = parseWorkerDiagnosticMetrics(response.metrics);
  if (response.ok === true && "result" in response) {
    return {
      requestId: response.requestId,
      ok: true,
      result: response.result as Result,
      ...(metrics ? { metrics } : {}),
    };
  }
  if (response.ok === false && typeof response.message === "string") {
    return {
      requestId: response.requestId,
      ok: false,
      message: response.message,
      ...(metrics ? { metrics } : {}),
    };
  }
  return null;
}

function parseWorkerDiagnosticMetrics(
  metrics: unknown,
): RenderWorkerDiagnosticMetrics | undefined {
  if (!metrics || typeof metrics !== "object") {
    return undefined;
  }
  const candidate = metrics as Partial<RenderWorkerDiagnosticMetrics>;
  if (
    typeof candidate.renderCoreMs !== "number" ||
    typeof candidate.renderStartDeltaMs !== "number" ||
    typeof candidate.responsePostDeltaMs !== "number" ||
    typeof candidate.workerReceivedAtMs !== "number"
  ) {
    return undefined;
  }
  const asciidocPhases = parseAsciiDocWorkerPhaseMetrics(
    candidate.asciidocPhases,
  );
  return {
    renderCoreMs: candidate.renderCoreMs,
    renderStartDeltaMs: candidate.renderStartDeltaMs,
    responsePostDeltaMs: candidate.responsePostDeltaMs,
    workerReceivedAtMs: candidate.workerReceivedAtMs,
    ...(asciidocPhases ? { asciidocPhases } : {}),
  };
}

function parseAsciiDocWorkerPhaseMetrics(
  metrics: unknown,
): AsciiDocWorkerPhaseMetrics | undefined {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) {
    return undefined;
  }
  const candidate = metrics as Record<string, unknown>;
  const parsed: Partial<AsciiDocWorkerPhaseMetrics> = {};
  for (const key of asciiDocWorkerPhaseDurationKeys) {
    const value = candidate[key];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
      return undefined;
    }
    parsed[key] = value;
  }
  for (const key of asciiDocWorkerPhaseCountKeys) {
    const value = candidate[key];
    if (
      typeof value !== "number" ||
      !Number.isSafeInteger(value) ||
      value < 0
    ) {
      return undefined;
    }
    parsed[key] = value;
  }
  return parsed as AsciiDocWorkerPhaseMetrics;
}

function createAbortError(message: string): Error {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function createTimeoutError(label: string, timeoutMs: number): Error {
  const error = new Error(`${label} render timed out after ${timeoutMs}ms`);
  error.name = "TimeoutError";
  return error;
}

function normalizeError(error: unknown, label: string): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(`${label} render worker failed`);
}

function perfTraceEnabled(): boolean {
  return localStorageFlagEnabled("SVARD_PERF_TRACE");
}

function perfDiagnosticEnabled(): boolean {
  return localStorageFlagEnabled("SVARD_PERF_DIAGNOSTIC");
}

function localStorageFlagEnabled(key: string): boolean {
  const getItem = globalThis.localStorage?.getItem;
  if (typeof getItem !== "function") {
    return false;
  }
  return getItem.call(globalThis.localStorage, key) === "1";
}

function perfNow(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function perfDuration(startedAt: number): number {
  return Number((perfNow() - startedAt).toFixed(2));
}

function traceWorkerPoolPerf(
  event: string,
  payload: Record<string, unknown>,
): void {
  if (!perfTraceEnabled()) {
    return;
  }
  console.info("[perf]", {
    event,
    ...payload,
  });
}

function traceWorkerPoolDiagnosticPerf(
  event: string,
  payload: Record<string, unknown>,
): void {
  if (!perfDiagnosticEnabled()) {
    return;
  }
  console.info("[perf]", {
    event,
    ...payload,
  });
}

function traceWorkerMetrics(
  label: string,
  metrics: RenderWorkerDiagnosticMetrics | undefined,
): void {
  if (!metrics) {
    return;
  }
  traceWorkerPoolDiagnosticPerf("render.workerPool.workerMetrics", {
    label,
    renderCoreMs: metrics.renderCoreMs,
    renderStartDeltaMs: metrics.renderStartDeltaMs,
    responsePostDeltaMs: metrics.responsePostDeltaMs,
    workerReceivedAtMs: metrics.workerReceivedAtMs,
  });
  if (metrics.asciidocPhases) {
    traceWorkerPoolDiagnosticPerf("render.asciidoc.workerPhases", {
      label,
      ...metrics.asciidocPhases,
    });
  }
}
