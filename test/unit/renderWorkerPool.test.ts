import { afterEach, describe, expect, it, vi } from "vitest";

import {
  RenderWorkerPool,
  type RenderWorkerLike,
  type RenderWorkerRequest,
  type RenderWorkerResponse,
} from "../../src/core/renderWorkerPool";
import {
  asciiDocWorkerPhaseCountKeys,
  asciiDocWorkerPhaseDurationKeys,
} from "../../src/core/renderWorkerMetrics";

class FakeRenderWorker implements RenderWorkerLike {
  static instances: FakeRenderWorker[] = [];

  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  readonly messages: RenderWorkerRequest<string>[] = [];
  terminated = false;

  constructor() {
    FakeRenderWorker.instances.push(this);
  }

  postMessage(message: unknown): void {
    this.messages.push(message as RenderWorkerRequest<string>);
  }

  terminate(): void {
    this.terminated = true;
  }

  respond(result: string, requestIndex = 0): void {
    const request = this.messages[requestIndex];
    this.onmessage?.({
      data: {
        requestId: request.requestId,
        ok: true,
        result,
      } satisfies RenderWorkerResponse<string>,
    } as MessageEvent<unknown>);
  }

  respondWithPayload(payload: unknown): void {
    this.onmessage?.({ data: payload } as MessageEvent<unknown>);
  }

  fail(message = "worker crashed"): void {
    this.onerror?.({ message } as ErrorEvent);
  }
}

function createPool(maxWorkers = 2) {
  return new RenderWorkerPool<string, string>({
    label: "test",
    maxWorkers,
    timeoutMs: 1000,
    createWorker: () => new FakeRenderWorker(),
  });
}

afterEach(() => {
  FakeRenderWorker.instances = [];
  vi.useRealTimers();
});

describe("RenderWorkerPool", () => {
  it("reuses an idle persistent worker for later renders", async () => {
    const pool = createPool();

    const first = pool.render("first");
    expect(FakeRenderWorker.instances).toHaveLength(1);
    const worker = FakeRenderWorker.instances[0];
    expect(worker.messages[0].payload).toBe("first");
    worker.respond("first-result");
    await expect(first).resolves.toBe("first-result");

    const second = pool.render("second");
    expect(FakeRenderWorker.instances).toHaveLength(1);
    expect(worker.messages[1].payload).toBe("second");
    worker.respond("second-result", 1);
    await expect(second).resolves.toBe("second-result");
  });

  it("routes concurrent responses by request id across the pool", async () => {
    const pool = createPool(2);

    const first = pool.render("first");
    const second = pool.render("second");

    expect(FakeRenderWorker.instances).toHaveLength(2);
    const [firstWorker, secondWorker] = FakeRenderWorker.instances;
    expect(firstWorker.messages[0].payload).toBe("first");
    expect(secondWorker.messages[0].payload).toBe("second");

    secondWorker.respond("second-result");
    firstWorker.respond("first-result");

    await expect(second).resolves.toBe("second-result");
    await expect(first).resolves.toBe("first-result");
  });

  it("rejects queued aborts without terminating an active worker", async () => {
    const pool = createPool(1);
    const controller = new AbortController();

    const active = pool.render("active");
    const queued = pool.render("queued", { signal: controller.signal });
    const worker = FakeRenderWorker.instances[0];

    controller.abort();

    await expect(queued).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.terminated).toBe(false);
    expect(worker.messages).toHaveLength(1);

    worker.respond("active-result");
    await expect(active).resolves.toBe("active-result");
  });

  it("terminates an active worker on abort and dispatches queued work to a replacement", async () => {
    const pool = createPool(1);
    const controller = new AbortController();

    const active = pool.render("active", { signal: controller.signal });
    const queued = pool.render("queued");
    const firstWorker = FakeRenderWorker.instances[0];

    controller.abort();

    await expect(active).rejects.toMatchObject({ name: "AbortError" });
    expect(firstWorker.terminated).toBe(true);
    expect(FakeRenderWorker.instances).toHaveLength(2);

    const replacement = FakeRenderWorker.instances[1];
    expect(replacement.messages[0].payload).toBe("queued");
    replacement.respond("queued-result");
    await expect(queued).resolves.toBe("queued-result");
  });

  it("terminates timed-out workers and recovers on the next request", async () => {
    vi.useFakeTimers();
    const pool = createPool(1);

    const timedOut = pool.render("slow", { timeoutMs: 10 });
    const firstWorker = FakeRenderWorker.instances[0];

    vi.advanceTimersByTime(10);

    await expect(timedOut).rejects.toMatchObject({ name: "TimeoutError" });
    expect(firstWorker.terminated).toBe(true);

    const next = pool.render("next");
    expect(FakeRenderWorker.instances).toHaveLength(2);
    const replacement = FakeRenderWorker.instances[1];
    replacement.respond("next-result");
    await expect(next).resolves.toBe("next-result");
  });

  it("rejects active work on crash and keeps queued work dispatchable", async () => {
    const pool = createPool(1);

    const active = pool.render("active");
    const queued = pool.render("queued");
    const firstWorker = FakeRenderWorker.instances[0];

    firstWorker.fail("boom");

    await expect(active).rejects.toThrow("boom");
    expect(firstWorker.terminated).toBe(true);
    expect(FakeRenderWorker.instances).toHaveLength(2);

    const replacement = FakeRenderWorker.instances[1];
    expect(replacement.messages[0].payload).toBe("queued");
    replacement.respond("queued-result");
    await expect(queued).resolves.toBe("queued-result");
  });

  it("rejects malformed responses and recovers with a fresh worker", async () => {
    const pool = createPool(1);

    const malformed = pool.render("malformed");
    const worker = FakeRenderWorker.instances[0];

    worker.respondWithPayload({ ok: true, result: "missing request id" });

    await expect(malformed).rejects.toThrow("malformed response");
    expect(worker.terminated).toBe(true);

    const next = pool.render("next");
    const replacement = FakeRenderWorker.instances[1];
    replacement.respond("next-result");
    await expect(next).resolves.toBe("next-result");
  });

  it("emits privacy-safe worker pool perf events without payload data", async () => {
    const originalLocalStorage = globalThis.localStorage;
    const originalConsoleInfo = console.info;
    const events: unknown[] = [];
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => (key === "SVARD_PERF_TRACE" ? "1" : null),
      },
    });
    console.info = vi.fn((label: string, payload: unknown) => {
      if (label === "[perf]") {
        events.push(payload);
      }
    });

    try {
      const pool = createPool();
      const first = pool.render("private source body");
      const worker = FakeRenderWorker.instances[0];
      worker.respond("first-result");
      await expect(first).resolves.toBe("first-result");

      const second = pool.render("another private source");
      worker.respond("second-result", 1);
      await expect(second).resolves.toBe("second-result");

      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: "render.workerPool.dispatch",
            label: "test",
            queueDepth: 0,
            reusedWorker: false,
          }),
          expect.objectContaining({
            event: "render.workerPool.response",
            label: "test",
            reusedWorker: true,
          }),
        ]),
      );
      expect(JSON.stringify(events)).not.toContain("private source");
      expect(JSON.stringify(events)).not.toContain("first-result");
      expect(JSON.stringify(events)).not.toContain(
        "render.workerPool.messageReceived",
      );
      expect(JSON.stringify(events)).not.toContain(
        "render.workerPool.workerMetrics",
      );
      expect(worker.messages[0].diagnostic).toBe(false);
    } finally {
      console.info = originalConsoleInfo;
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  });

  it("emits diagnostic worker delivery events only when enabled", async () => {
    const originalLocalStorage = globalThis.localStorage;
    const originalConsoleInfo = console.info;
    const events: unknown[] = [];
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) =>
          key === "SVARD_PERF_TRACE" || key === "SVARD_PERF_DIAGNOSTIC"
            ? "1"
            : null,
      },
    });
    console.info = vi.fn((label: string, payload: unknown) => {
      if (label === "[perf]") {
        events.push(payload);
      }
    });

    try {
      const pool = createPool();
      const rendered = pool.render("private diagnostic source");
      const worker = FakeRenderWorker.instances[0];
      const request = worker.messages[0];
      worker.respondWithPayload({
        requestId: request.requestId,
        ok: true,
        result: "private diagnostic result",
        metrics: {
          renderCoreMs: 1.2,
          renderStartDeltaMs: 0.1,
          responsePostDeltaMs: 1.4,
          workerReceivedAtMs: 0,
        },
      } satisfies RenderWorkerResponse<string>);
      await expect(rendered).resolves.toBe("private diagnostic result");

      expect(worker.messages[0].diagnostic).toBe(true);
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: "render.workerPool.postMessageQueued",
            label: "test",
            reusedWorker: false,
          }),
          expect.objectContaining({
            event: "render.workerPool.messageReceived",
            label: "test",
            reusedWorker: false,
          }),
          expect.objectContaining({
            event: "render.workerPool.workerMetrics",
            label: "test",
            renderCoreMs: 1.2,
            responsePostDeltaMs: 1.4,
          }),
        ]),
      );
      expect(JSON.stringify(events)).not.toContain("private diagnostic source");
      expect(JSON.stringify(events)).not.toContain("private diagnostic result");
      expect(JSON.stringify(events)).not.toContain("result");
    } finally {
      console.info = originalConsoleInfo;
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  });

  it("allowlists AsciiDoc phase metrics and reports queue wait", async () => {
    const originalLocalStorage = globalThis.localStorage;
    const originalConsoleInfo = console.info;
    const events: unknown[] = [];
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: { getItem: () => "1" },
    });
    console.info = vi.fn((label: string, payload: unknown) => {
      if (label === "[perf]") events.push(payload);
    });

    try {
      const pool = createPool(1);
      const rendered = pool.render("private AsciiDoc source");
      const worker = FakeRenderWorker.instances[0];
      const phaseMetrics = Object.fromEntries([
        ...asciiDocWorkerPhaseDurationKeys.map((key) => [key, 1.25]),
        ...asciiDocWorkerPhaseCountKeys.map((key) => [key, 2]),
        ["privatePath", "/private/workspace/doc.adoc"],
      ]);
      worker.respondWithPayload({
        requestId: worker.messages[0].requestId,
        ok: true,
        result: "private result",
        metrics: {
          renderCoreMs: 2,
          renderStartDeltaMs: 0,
          responsePostDeltaMs: 2,
          workerReceivedAtMs: 0,
          asciidocPhases: phaseMetrics,
        },
      });
      await expect(rendered).resolves.toBe("private result");

      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: "render.workerPool.queueWait",
            label: "test",
          }),
          expect.objectContaining({
            event: "render.asciidoc.workerPhases",
            totalMs: 1.25,
            sourceAnalysisPasses: 2,
          }),
        ]),
      );
      expect(JSON.stringify(events)).not.toContain("privatePath");
      expect(JSON.stringify(events)).not.toContain("/private/workspace");
      expect(JSON.stringify(events)).not.toContain("private AsciiDoc source");
    } finally {
      console.info = originalConsoleInfo;
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  });

  it("drops malformed AsciiDoc phase metrics without rejecting the render", async () => {
    const originalLocalStorage = globalThis.localStorage;
    const originalConsoleInfo = console.info;
    const events: unknown[] = [];
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: { getItem: () => "1" },
    });
    console.info = vi.fn((label: string, payload: unknown) => {
      if (label === "[perf]") events.push(payload);
    });

    try {
      const pool = createPool();
      const rendered = pool.render("private source");
      const worker = FakeRenderWorker.instances[0];
      worker.respondWithPayload({
        requestId: worker.messages[0].requestId,
        ok: true,
        result: "rendered",
        metrics: {
          renderCoreMs: 2,
          renderStartDeltaMs: 0,
          responsePostDeltaMs: 2,
          workerReceivedAtMs: 0,
          asciidocPhases: { totalMs: Number.NaN },
        },
      });
      await expect(rendered).resolves.toBe("rendered");
      expect(
        events.some(
          (event) =>
            (event as { event?: string }).event ===
            "render.asciidoc.workerPhases",
        ),
      ).toBe(false);
      expect(
        events.some(
          (event) =>
            (event as { event?: string }).event ===
            "render.workerPool.workerMetrics",
        ),
      ).toBe(true);
    } finally {
      console.info = originalConsoleInfo;
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  });
});
