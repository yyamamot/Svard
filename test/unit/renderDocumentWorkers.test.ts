import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  RenderWorkerLike,
  RenderWorkerRequest,
  RenderWorkerResponse,
} from "../../src/core/renderWorkerPool";
import type { RenderResult } from "../../src/core/types";

class StubBrowserWorker implements RenderWorkerLike {
  static instances: StubBrowserWorker[] = [];

  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: ((event: MessageEvent<unknown>) => void) | null = null;
  readonly messages: RenderWorkerRequest<unknown>[] = [];
  terminated = false;

  constructor(
    readonly _url: URL,
    readonly _options: WorkerOptions,
  ) {
    StubBrowserWorker.instances.push(this);
  }

  postMessage(message: unknown): void {
    this.messages.push(message as RenderWorkerRequest<unknown>);
  }

  terminate(): void {
    this.terminated = true;
  }

  respond(result: RenderResult, requestIndex = 0): void {
    const request = this.messages[requestIndex];
    this.onmessage?.({
      data: {
        requestId: request.requestId,
        ok: true,
        result,
      } satisfies RenderWorkerResponse<RenderResult>,
    } as MessageEvent<unknown>);
  }
}

const emptyRenderResult: RenderResult = {
  html: "<p>rendered</p>",
  headings: [],
  sourceBlocks: [],
  diagnostics: [],
  diagramSlots: [],
  mermaidDiagrams: [],
  plantUmlDiagrams: [],
  graphvizDiagrams: [],
  krokiDiagrams: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetModules();
  StubBrowserWorker.instances = [];
});

describe("document render worker wrappers", () => {
  it("sends AsciiDoc path and include files as per-request payload without re-creating idle workers", async () => {
    vi.stubGlobal("Worker", StubBrowserWorker);
    const { disposeAsciiDocRenderWorkers, renderAsciiDoc } =
      await import("../../src/core/renderAsciiDoc");

    const first = renderAsciiDoc("first", {
      path: "/workspace/docs/first.adoc",
      includeFiles: [{ path: "/workspace/docs/partial.adoc", source: "one" }],
    });
    expect(StubBrowserWorker.instances).toHaveLength(1);
    const worker = StubBrowserWorker.instances[0];
    expect(worker.messages[0].payload).toEqual({
      source: "first",
      path: "/workspace/docs/first.adoc",
      includeFiles: [{ path: "/workspace/docs/partial.adoc", source: "one" }],
    });

    worker.respond(emptyRenderResult);
    await expect(first).resolves.toBe(emptyRenderResult);

    const second = renderAsciiDoc("second", {
      path: "/workspace/docs/second.adoc",
      includeFiles: [],
    });
    expect(StubBrowserWorker.instances).toHaveLength(1);
    expect(worker.messages[1].payload).toEqual({
      source: "second",
      path: "/workspace/docs/second.adoc",
      includeFiles: [],
    });

    worker.respond(emptyRenderResult, 1);
    await expect(second).resolves.toBe(emptyRenderResult);

    disposeAsciiDocRenderWorkers();
  });

  it("uses the same request id protocol for Markdown workers", async () => {
    vi.stubGlobal("Worker", StubBrowserWorker);
    const { disposeMarkdownRenderWorkers, renderMarkdown } =
      await import("../../src/core/renderMarkdown");

    const rendered = renderMarkdown("# Title");
    const worker = StubBrowserWorker.instances[0];

    expect(worker.messages[0]).toMatchObject({
      requestId: expect.stringMatching(/^markdown-\d+$/),
      payload: { source: "# Title" },
    });

    worker.respond(emptyRenderResult);
    const result = await rendered;
    expect(result).toBe(emptyRenderResult);
    expect(result).not.toHaveProperty("markdownAuthorHtmlFragments");

    disposeMarkdownRenderWorkers();
  });

  it("preserves optional Markdown author HTML provenance in worker results", async () => {
    vi.stubGlobal("Worker", StubBrowserWorker);
    const { disposeMarkdownRenderWorkers, renderMarkdown } =
      await import("../../src/core/renderMarkdown");
    const source = "<kbd>Ctrl</kbd>";
    const rendered = renderMarkdown(source);
    const worker = StubBrowserWorker.instances[0];
    const resultWithProvenance: RenderResult = {
      ...emptyRenderResult,
      markdownAuthorHtmlFragments: [
        {
          id: "markdown-author-html-1",
          kind: "inline",
          sourceSpan: { startOffset: 0, endOffset: source.length },
        },
      ],
    };

    worker.respond(resultWithProvenance);

    await expect(rendered).resolves.toEqual(resultWithProvenance);
    disposeMarkdownRenderWorkers();
  });

  it("warms the Markdown worker with sequential minimal, representative, and delivery priming passes", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", StubBrowserWorker);
    const { disposeMarkdownRenderWorkers, warmMarkdownRenderWorker } =
      await import("../../src/core/renderMarkdown");

    const warmed = warmMarkdownRenderWorker();
    expect(StubBrowserWorker.instances).toHaveLength(1);
    const worker = StubBrowserWorker.instances[0];
    expect(worker.messages).toHaveLength(1);
    expect(worker.messages[0].payload).toEqual({ source: "# warmup\n" });

    worker.respond(emptyRenderResult);
    await Promise.resolve();

    expect(StubBrowserWorker.instances).toHaveLength(1);
    expect(worker.messages).toHaveLength(2);
    expect(worker.messages[1].payload).toEqual({
      source: expect.stringContaining("```ts"),
    });

    worker.respond(emptyRenderResult, 1);
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    expect(StubBrowserWorker.instances).toHaveLength(1);
    expect(worker.messages).toHaveLength(3);
    expect(worker.messages[2].payload).toEqual({
      source: expect.stringContaining("worker delivery priming"),
    });

    worker.respond(emptyRenderResult, 2);
    await expect(warmed).resolves.toBe(emptyRenderResult);

    disposeMarkdownRenderWorkers();
  });

  it("probes Markdown worker readiness without creating a second worker", async () => {
    vi.stubGlobal("Worker", StubBrowserWorker);
    const { disposeMarkdownRenderWorkers, probeMarkdownRenderWorkerReady } =
      await import("../../src/core/renderMarkdown");

    const probed = probeMarkdownRenderWorkerReady();
    expect(StubBrowserWorker.instances).toHaveLength(1);
    const worker = StubBrowserWorker.instances[0];
    expect(worker.messages).toHaveLength(1);
    expect(worker.messages[0]).toMatchObject({
      requestId: expect.stringMatching(/^markdown-\d+$/),
      payload: { source: expect.stringContaining("worker readiness probe") },
    });

    worker.respond(emptyRenderResult);
    await expect(probed).resolves.toEqual({
      durationMs: expect.any(Number),
    });

    const secondProbe = probeMarkdownRenderWorkerReady();
    expect(StubBrowserWorker.instances).toHaveLength(1);
    expect(worker.messages).toHaveLength(2);
    worker.respond(emptyRenderResult, 1);
    await expect(secondProbe).resolves.toEqual({
      durationMs: expect.any(Number),
    });

    disposeMarkdownRenderWorkers();
  });
});
