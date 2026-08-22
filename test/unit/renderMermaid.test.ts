import { afterEach, describe, expect, it, vi } from "vitest";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

describe("renderMermaidDiagrams", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.doUnmock("mermaid");
    vi.resetModules();
  });

  it("does not import mermaid when there are no diagrams", async () => {
    vi.doMock("mermaid", () => {
      throw new Error("Mermaid should not be imported for an empty batch");
    });

    const { renderMermaidDiagrams } =
      await import("../../src/core/renderMermaid");

    await expect(renderMermaidDiagrams([], "light")).resolves.toEqual([]);
  });

  it("uses the default Mermaid renderer theme even when the app theme is dark", async () => {
    const initialize = vi.fn();
    const render = vi.fn(async (id: string) => ({
      svg: `<svg id="${id}"></svg>`,
    }));
    vi.doMock("mermaid", () => ({
      default: {
        initialize,
        render,
      },
    }));

    const { renderMermaidDiagrams } =
      await import("../../src/core/renderMermaid");

    await expect(
      renderMermaidDiagrams(
        [{ id: "diagram-dark", source: "flowchart TD" }],
        "dark",
      ),
    ).resolves.toEqual([
      { id: "diagram-dark", svg: '<svg id="diagram-dark"></svg>' },
    ]);

    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({ theme: "default" }),
    );
  });

  it("renders through one global FIFO slot across sessions", async () => {
    const pending = new Map<
      string,
      ReturnType<typeof deferred<{ svg: string }>>
    >();
    const started: string[] = [];
    let active = 0;
    let maxActive = 0;
    const render = vi.fn((id: string) => {
      started.push(id);
      active += 1;
      maxActive = Math.max(maxActive, active);
      const next = deferred<{ svg: string }>();
      pending.set(id, next);
      return next.promise.finally(() => {
        active -= 1;
      });
    });
    vi.doMock("mermaid", () => ({
      default: { initialize: vi.fn(), render },
    }));

    const { createMermaidRenderSession, renderMermaidDiagrams } =
      await import("../../src/core/renderMermaid");
    const first = renderMermaidDiagrams(
      [
        { id: "a-1", source: "flowchart TD" },
        { id: "a-2", source: "flowchart TD" },
      ],
      "light",
      createMermaidRenderSession(),
    );
    const second = renderMermaidDiagrams(
      [{ id: "b-1", source: "flowchart TD" }],
      "light",
      createMermaidRenderSession(),
    );

    await vi.waitFor(() => expect(started).toEqual(["a-1"]));
    pending.get("a-1")!.resolve({ svg: "<svg>a-1</svg>" });
    await vi.waitFor(() => expect(started).toEqual(["a-1", "b-1"]));
    pending.get("b-1")!.resolve({ svg: "<svg>b-1</svg>" });
    await vi.waitFor(() => expect(started).toEqual(["a-1", "b-1", "a-2"]));
    pending.get("a-2")!.resolve({ svg: "<svg>a-2</svg>" });

    await expect(Promise.all([first, second])).resolves.toBeDefined();
    expect(maxActive).toBe(1);
  });

  it("enforces the inclusive diagram count budget before render", async () => {
    const render = vi.fn(async (id: string) => ({ svg: `<svg>${id}</svg>` }));
    vi.doMock("mermaid", () => ({
      default: { initialize: vi.fn(), render },
    }));
    const {
      createMermaidRenderSession,
      MERMAID_RENDER_MESSAGES,
      renderMermaidDiagrams,
    } = await import("../../src/core/renderMermaid");
    const session = createMermaidRenderSession();
    const diagrams = Array.from({ length: 17 }, (_, index) => ({
      id: `diagram-${index}`,
      source: "flowchart TD",
    }));

    const result = await renderMermaidDiagrams(diagrams, "light", session);

    expect(render).toHaveBeenCalledTimes(16);
    expect(result[15]).toHaveProperty("svg");
    expect(result[16]).toEqual({
      id: "diagram-16",
      error: MERMAID_RENDER_MESSAGES.budgetExceeded,
    });
    expect(session.getMetrics()).toMatchObject({
      requestedCount: 17,
      attemptedCount: 16,
      renderedCount: 16,
      blockedCount: 1,
      status: "partial",
      reason: "count",
    });
  });

  it("counts a large blocked remainder without materializing one output per diagram", async () => {
    const render = vi.fn(async (id: string) => ({ svg: `<svg>${id}</svg>` }));
    vi.doMock("mermaid", () => ({
      default: { initialize: vi.fn(), render },
    }));
    const { createMermaidRenderSession, renderMermaidDiagrams } =
      await import("../../src/core/renderMermaid");
    const session = createMermaidRenderSession();
    const diagrams = Array.from({ length: 20_000 }, (_, index) => ({
      id: `diagram-${index}`,
      source: "flowchart TD",
    }));

    const result = await renderMermaidDiagrams(diagrams, "light", session);

    expect(render).toHaveBeenCalledTimes(16);
    expect(result).toHaveLength(17);
    expect(result.at(-1)).toEqual({
      id: "diagram-16",
      error: "Mermaid render budget exceeded.",
    });
    expect(session.getMetrics()).toMatchObject({
      requestedCount: 20_000,
      attemptedCount: 16,
      renderedCount: 16,
      blockedCount: 19_984,
      status: "partial",
      reason: "count",
    });
  });

  it("allows the exact source limits and blocks only an oversized source", async () => {
    const render = vi.fn(async (id: string) => ({ svg: `<svg>${id}</svg>` }));
    vi.doMock("mermaid", () => ({
      default: { initialize: vi.fn(), render },
    }));
    const {
      createMermaidRenderSession,
      MERMAID_RENDER_LIMITS,
      MERMAID_RENDER_MESSAGES,
      renderMermaidDiagrams,
    } = await import("../../src/core/renderMermaid");
    const session = createMermaidRenderSession();
    const exact = "x".repeat(MERMAID_RENDER_LIMITS.maxSourceBytes);

    const result = await renderMermaidDiagrams(
      [
        { id: "exact", source: exact },
        { id: "oversized", source: `${exact}x` },
        { id: "after", source: "flowchart TD" },
      ],
      "light",
      session,
    );

    expect(render).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      { id: "exact", svg: "<svg>exact</svg>" },
      {
        id: "oversized",
        error: MERMAID_RENDER_MESSAGES.sourceTooLarge,
      },
      { id: "after", svg: "<svg>after</svg>" },
    ]);
    expect(session.getMetrics().inputBytes).toBe(
      MERMAID_RENDER_LIMITS.maxSourceBytes + 12,
    );
  });

  it("stops before a source that would exceed the aggregate budget", async () => {
    const render = vi.fn(async (id: string) => ({ svg: `<svg>${id}</svg>` }));
    vi.doMock("mermaid", () => ({
      default: { initialize: vi.fn(), render },
    }));
    const {
      createMermaidRenderSession,
      MERMAID_RENDER_LIMITS,
      MERMAID_RENDER_MESSAGES,
      renderMermaidDiagrams,
    } = await import("../../src/core/renderMermaid");
    const session = createMermaidRenderSession();
    const quarter = "x".repeat(MERMAID_RENDER_LIMITS.maxSourceBytes);

    const result = await renderMermaidDiagrams(
      [
        ...Array.from({ length: 3 }, (_, index) => ({
          id: `exact-${index}`,
          source: quarter,
        })),
        { id: "below", source: "x".repeat(quarter.length - 1) },
        { id: "at", source: "x" },
        { id: "over", source: "x" },
        { id: "remaining", source: "x" },
      ],
      "light",
      session,
    );

    expect(render).toHaveBeenCalledTimes(5);
    expect(result.slice(5)).toEqual([
      { id: "over", error: MERMAID_RENDER_MESSAGES.budgetExceeded },
    ]);
    expect(session.getMetrics()).toMatchObject({
      attemptedCount: 5,
      inputBytes: MERMAID_RENDER_LIMITS.maxAggregateSourceBytes,
      blockedCount: 2,
      reason: "source",
    });
  });

  it("counts UTF-8 bytes for emoji and malformed surrogates", async () => {
    const render = vi.fn(async () => ({ svg: "<svg></svg>" }));
    vi.doMock("mermaid", () => ({
      default: { initialize: vi.fn(), render },
    }));
    const { createMermaidRenderSession, renderMermaidDiagrams } =
      await import("../../src/core/renderMermaid");
    const session = createMermaidRenderSession();

    await renderMermaidDiagrams(
      [{ id: "utf8", source: "a\r\n😀\ud800" }],
      "light",
      session,
    );

    expect(session.getMetrics().inputBytes).toBe(10);
  });

  it("blocks Mermaid image resources before calling the renderer", async () => {
    const render = vi.fn(async (id: string) => ({ svg: `<svg>${id}</svg>` }));
    vi.doMock("mermaid", () => ({
      default: { initialize: vi.fn(), render },
    }));
    const {
      createMermaidRenderSession,
      MERMAID_RENDER_MESSAGES,
      renderMermaidDiagrams,
    } = await import("../../src/core/renderMermaid");
    const session = createMermaidRenderSession();

    const result = await renderMermaidDiagrams(
      [
        {
          id: "remote-image",
          source:
            'flowchart LR\nA@{ img: "https://attacker.invalid/pixel.png", label: "Image" }',
        },
        {
          id: "relative-image",
          source: 'flowchart LR\nA@{ "img": "/pixel.png" }',
        },
        { id: "ordinary", source: 'flowchart LR\nA["img label"]' },
      ],
      "light",
      session,
    );

    expect(render).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledWith(
      "ordinary",
      'flowchart LR\nA["img label"]',
    );
    expect(result).toEqual([
      {
        id: "remote-image",
        error: MERMAID_RENDER_MESSAGES.resourceBlocked,
      },
      {
        id: "relative-image",
        error: MERMAID_RENDER_MESSAGES.resourceBlocked,
      },
      { id: "ordinary", svg: "<svg>ordinary</svg>" },
    ]);
    expect(session.getMetrics()).toMatchObject({
      attemptedCount: 1,
      renderedCount: 1,
      blockedCount: 2,
      status: "partial",
      reason: "resource",
    });
  });

  it("discards oversized output and does not start later diagrams", async () => {
    vi.doMock("mermaid", () => ({
      default: {
        initialize: vi.fn(),
        render: vi.fn(async () => ({ svg: "x".repeat(2 * 1024 * 1024 + 1) })),
      },
    }));
    const {
      createMermaidRenderSession,
      MERMAID_RENDER_MESSAGES,
      renderMermaidDiagrams,
    } = await import("../../src/core/renderMermaid");
    const session = createMermaidRenderSession();

    const result = await renderMermaidDiagrams(
      [
        { id: "large", source: "flowchart TD" },
        { id: "later", source: "flowchart TD" },
      ],
      "light",
      session,
    );

    expect(result).toEqual([
      { id: "large", error: MERMAID_RENDER_MESSAGES.outputTooLarge },
    ]);
    expect(session.getMetrics()).toMatchObject({
      attemptedCount: 1,
      renderedCount: 0,
      outputBytes: 0,
      blockedCount: 2,
      reason: "output",
    });
  });

  it("allows aggregate SVG output at B-1 and B, then stops at B+1", async () => {
    const sizes = [
      2 * 1024 * 1024 - 1,
      2 * 1024 * 1024,
      2 * 1024 * 1024,
      2 * 1024 * 1024,
      1,
      1,
    ];
    const render = vi.fn(async () => ({ svg: "x".repeat(sizes.shift()!) }));
    vi.doMock("mermaid", () => ({
      default: { initialize: vi.fn(), render },
    }));
    const {
      createMermaidRenderSession,
      MERMAID_RENDER_LIMITS,
      MERMAID_RENDER_MESSAGES,
      renderMermaidDiagrams,
    } = await import("../../src/core/renderMermaid");
    const session = createMermaidRenderSession();
    const diagrams = Array.from({ length: 6 }, (_, index) => ({
      id: `svg-${index}`,
      source: "flowchart TD",
    }));

    const result = await renderMermaidDiagrams(diagrams, "light", session);

    expect(render).toHaveBeenCalledTimes(6);
    expect(result.slice(0, 5).every((item) => item.svg !== undefined)).toBe(
      true,
    );
    expect(result[5]).toEqual({
      id: "svg-5",
      error: MERMAID_RENDER_MESSAGES.budgetExceeded,
    });
    expect(session.getMetrics()).toMatchObject({
      attemptedCount: 6,
      renderedCount: 5,
      outputBytes: MERMAID_RENDER_LIMITS.maxAggregateSvgBytes,
      blockedCount: 1,
      reason: "output",
    });
  });

  it("continues after a syntax failure without exposing the raw error", async () => {
    const render = vi
      .fn()
      .mockRejectedValueOnce(new Error("raw source and parser internals"))
      .mockResolvedValueOnce({ svg: "<svg>ok</svg>" });
    vi.doMock("mermaid", () => ({
      default: { initialize: vi.fn(), render },
    }));
    const {
      createMermaidRenderSession,
      MERMAID_RENDER_MESSAGES,
      renderMermaidDiagrams,
    } = await import("../../src/core/renderMermaid");
    const session = createMermaidRenderSession();

    await expect(
      renderMermaidDiagrams(
        [
          { id: "bad", source: "bad secret source" },
          { id: "good", source: "flowchart TD" },
        ],
        "light",
        session,
      ),
    ).resolves.toEqual([
      { id: "bad", error: MERMAID_RENDER_MESSAGES.renderFailed },
      { id: "good", svg: "<svg>ok</svg>" },
    ]);
  });

  it("rejects an aborted active batch, discards its SVG, and recovers", async () => {
    const active = deferred<{ svg: string }>();
    const render = vi
      .fn()
      .mockImplementationOnce(() => active.promise)
      .mockResolvedValueOnce({ svg: "<svg>next</svg>" });
    vi.doMock("mermaid", () => ({
      default: { initialize: vi.fn(), render },
    }));
    const { createMermaidRenderSession, renderMermaidDiagrams } =
      await import("../../src/core/renderMermaid");
    const controller = new AbortController();
    const session = createMermaidRenderSession({ signal: controller.signal });
    const aborted = renderMermaidDiagrams(
      [{ id: "stale", source: "flowchart TD" }],
      "light",
      session,
    );
    await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(1));

    controller.abort();
    await expect(aborted).rejects.toMatchObject({ name: "AbortError" });
    expect(session.getMetrics()).toMatchObject({
      renderedCount: 0,
      outputBytes: 0,
      status: "aborted",
      reason: "aborted",
    });

    const recovery = renderMermaidDiagrams(
      [{ id: "next", source: "flowchart TD" }],
      "light",
    );
    await Promise.resolve();
    expect(render).toHaveBeenCalledTimes(1);
    active.resolve({ svg: "<svg>stale</svg>" });
    await expect(recovery).resolves.toEqual([
      { id: "next", svg: "<svg>next</svg>" },
    ]);
  });

  it("removes an aborted queued job without starting Mermaid", async () => {
    const active = deferred<{ svg: string }>();
    const render = vi
      .fn()
      .mockImplementationOnce(() => active.promise)
      .mockResolvedValueOnce({ svg: "<svg>unexpected</svg>" });
    vi.doMock("mermaid", () => ({
      default: { initialize: vi.fn(), render },
    }));
    const { createMermaidRenderSession, renderMermaidDiagrams } =
      await import("../../src/core/renderMermaid");
    const first = renderMermaidDiagrams(
      [{ id: "active", source: "flowchart TD" }],
      "light",
    );
    await vi.waitFor(() => expect(render).toHaveBeenCalledTimes(1));
    const controller = new AbortController();
    const queued = renderMermaidDiagrams(
      [{ id: "queued", source: "flowchart TD" }],
      "light",
      createMermaidRenderSession({ signal: controller.signal }),
    );

    controller.abort();
    await expect(queued).rejects.toMatchObject({ name: "AbortError" });
    active.resolve({ svg: "<svg>active</svg>" });
    await expect(first).resolves.toEqual([
      { id: "active", svg: "<svg>active</svg>" },
    ]);
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("times out an active diagram, preserves no late SVG, and skips the rest", async () => {
    vi.useFakeTimers();
    const active = deferred<{ svg: string }>();
    const render = vi.fn(() => active.promise);
    vi.doMock("mermaid", () => ({
      default: { initialize: vi.fn(), render },
    }));
    const {
      createMermaidRenderSession,
      MERMAID_RENDER_LIMITS,
      MERMAID_RENDER_MESSAGES,
      renderMermaidDiagrams,
    } = await import("../../src/core/renderMermaid");
    const session = createMermaidRenderSession();
    const resultPromise = renderMermaidDiagrams(
      [
        { id: "slow", source: "flowchart TD" },
        { id: "later", source: "flowchart TD" },
      ],
      "light",
      session,
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(render).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(MERMAID_RENDER_LIMITS.deadlineMs);
    await expect(resultPromise).resolves.toEqual([
      { id: "slow", error: MERMAID_RENDER_MESSAGES.timedOut },
    ]);
    expect(session.getMetrics()).toMatchObject({
      attemptedCount: 1,
      renderedCount: 0,
      outputBytes: 0,
      blockedCount: 2,
      status: "timed-out",
      reason: "deadline",
    });
    expect(render).toHaveBeenCalledTimes(1);
    active.resolve({ svg: "<svg>late</svg>" });
    await vi.advanceTimersByTimeAsync(0);
    expect(session.getMetrics().renderedCount).toBe(0);
  });

  it("keeps a completed session status stable after its deadline passes", async () => {
    vi.useFakeTimers();
    vi.doMock("mermaid", () => ({
      default: {
        initialize: vi.fn(),
        render: vi.fn(async () => ({ svg: "<svg>done</svg>" })),
      },
    }));
    const {
      createMermaidRenderSession,
      MERMAID_RENDER_LIMITS,
      renderMermaidDiagrams,
    } = await import("../../src/core/renderMermaid");
    const session = createMermaidRenderSession();
    await renderMermaidDiagrams(
      [{ id: "done", source: "flowchart TD" }],
      "light",
      session,
    );

    await vi.advanceTimersByTimeAsync(MERMAID_RENDER_LIMITS.deadlineMs + 1);
    expect(session.getMetrics().status).toBe("complete");
  });
});
