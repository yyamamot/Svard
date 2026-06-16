import { afterEach, describe, expect, it, vi } from "vitest";

import {
  disposeGraphvizRenderer,
  IframeGraphvizLocalRenderer,
  renderGraphvizDiagrams,
} from "../../src/core/renderGraphviz";

interface FakeIframe {
  iframe: HTMLIFrameElement;
  messages: unknown[];
}

interface FakeIframeFactoryOptions {
  failLoad?: boolean;
  patchDocument?: boolean;
}

function createFakeIframeFactory(options: FakeIframeFactoryOptions = {}) {
  const originalCreateElement = document.createElement.bind(document);
  const iframes: FakeIframe[] = [];
  const createIframe = () => {
    const element = originalCreateElement("iframe") as HTMLIFrameElement;
    const messages: unknown[] = [];
    Object.defineProperty(element, "contentWindow", {
      configurable: true,
      value: {
        postMessage(message: unknown) {
          messages.push(message);
        },
      },
    });
    queueMicrotask(() =>
      element.dispatchEvent(new Event(options.failLoad ? "error" : "load")),
    );
    iframes.push({ iframe: element, messages });
    return element;
  };

  if (options.patchDocument) {
    document.createElement = ((tagName: string) => {
      if (tagName.toLowerCase() === "iframe") {
        return createIframe();
      }
      return originalCreateElement(tagName);
    }) as typeof document.createElement;
  }

  return {
    createIframe,
    iframes,
    restore() {
      document.createElement = originalCreateElement;
    },
  };
}

function resultMessage(requestId: string, svg = "<svg></svg>") {
  return new MessageEvent("message", {
    origin: window.location.origin,
    data: {
      type: "GRAPHVIZ_RESULT",
      requestId,
      status: "rendered",
      svg,
      diagnostics: [],
      metrics: { renderMs: 10, svgBytes: svg.length, workerTotalMs: 10 },
    },
  });
}

function errorMessage(requestId: string) {
  return new MessageEvent("message", {
    origin: window.location.origin,
    data: {
      type: "GRAPHVIZ_ERROR",
      requestId,
      diagnostics: ["syntax error"],
      metrics: { renderMs: 5 },
    },
  });
}

function withSource(
  event: MessageEvent,
  source: MessageEventSource | null,
): MessageEvent {
  Object.defineProperty(event, "source", {
    configurable: true,
    value: source,
  });
  return event;
}

function requestAt(fake: FakeIframe, index = 0) {
  return fake.messages[index] as { requestId: string; source: string };
}

function sendResult(fake: FakeIframe, index = 0, svg = "<svg></svg>") {
  const request = requestAt(fake, index);
  window.dispatchEvent(
    withSource(
      resultMessage(request.requestId, svg),
      fake.iframe.contentWindow,
    ),
  );
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  disposeGraphvizRenderer();
  document.body.innerHTML = "";
  vi.useRealTimers();
  delete window.__svardGraphvizMetrics;
});

describe("IframeGraphvizLocalRenderer", () => {
  it("warms an idle worker without dispatching a render request", async () => {
    const fake = createFakeIframeFactory();
    const renderer = new IframeGraphvizLocalRenderer(1, fake.createIframe);

    await renderer.warm();

    expect(fake.iframes).toHaveLength(1);
    expect(fake.iframes[0].messages).toHaveLength(0);

    const rendered = renderer.renderSvg({
      source: "digraph { A -> B }",
      timeoutMs: 1000,
    });
    await flush();

    expect(fake.iframes).toHaveLength(1);
    sendResult(fake.iframes[0]);
    await expect(rendered).resolves.toMatchObject({
      status: "rendered",
      metrics: { workerReadyWaitMs: 0 },
    });
    renderer.dispose();
    fake.restore();
  });

  it("does not let a warm failure poison the next render", async () => {
    let failNextLoad = true;
    const iframes: FakeIframe[] = [];
    const createIframe = () => {
      const iframe = document.createElement("iframe");
      const messages: unknown[] = [];
      Object.defineProperty(iframe, "contentWindow", {
        configurable: true,
        value: {
          postMessage(message: unknown) {
            messages.push(message);
          },
        },
      });
      queueMicrotask(() => {
        iframe.dispatchEvent(new Event(failNextLoad ? "error" : "load"));
        failNextLoad = false;
      });
      iframes.push({ iframe, messages });
      return iframe;
    };
    const renderer = new IframeGraphvizLocalRenderer(1, createIframe);

    await expect(renderer.warm()).rejects.toThrow(
      "Graphviz renderer iframe failed to load",
    );
    expect(iframes[0].iframe.isConnected).toBe(false);

    const rendered = renderer.renderSvg({
      source: "digraph { A -> B }",
      timeoutMs: 1000,
    });
    await flush();

    expect(iframes).toHaveLength(2);
    sendResult(iframes[1]);
    await expect(rendered).resolves.toMatchObject({ status: "rendered" });
    renderer.dispose();
  });

  it("dispatches two renders concurrently and keeps queued result order stable", async () => {
    const fake = createFakeIframeFactory();
    const renderer = new IframeGraphvizLocalRenderer(2, fake.createIframe);
    const first = renderer.renderSvg({
      source: "digraph { A -> B }",
      timeoutMs: 1000,
    });
    const second = renderer.renderSvg({
      source: "digraph { B -> C }",
      timeoutMs: 1000,
    });
    const third = renderer.renderSvg({
      source: "digraph { C -> D }",
      timeoutMs: 1000,
    });
    await flush();

    expect(fake.iframes).toHaveLength(2);
    expect(fake.iframes[0].messages).toHaveLength(1);
    expect(fake.iframes[1].messages).toHaveLength(1);
    expect(requestAt(fake.iframes[0]).source).toContain("A -> B");
    expect(requestAt(fake.iframes[1]).source).toContain("B -> C");

    sendResult(fake.iframes[1], 0, "<svg>second</svg>");
    await expect(second).resolves.toMatchObject({ svg: "<svg>second</svg>" });
    await flush();

    expect(fake.iframes[1].messages).toHaveLength(2);
    expect(requestAt(fake.iframes[1], 1).source).toContain("C -> D");
    sendResult(fake.iframes[0], 0, "<svg>first</svg>");
    sendResult(fake.iframes[1], 1, "<svg>third</svg>");
    await expect(first).resolves.toMatchObject({ svg: "<svg>first</svg>" });
    await expect(third).resolves.toMatchObject({ svg: "<svg>third</svg>" });
    renderer.dispose();
    fake.restore();
  });

  it("ignores messages from the wrong origin, source, or request id", async () => {
    const fake = createFakeIframeFactory();
    const renderer = new IframeGraphvizLocalRenderer(2, fake.createIframe);
    const rendered = renderer.renderSvg({
      source: "digraph { A -> B }",
      timeoutMs: 1000,
    });
    await flush();

    const request = requestAt(fake.iframes[0]);
    const wrongOrigin = resultMessage(request.requestId, "<svg>bad</svg>");
    Object.defineProperty(wrongOrigin, "origin", {
      configurable: true,
      value: "https://example.test",
    });
    window.dispatchEvent(
      withSource(wrongOrigin, fake.iframes[0].iframe.contentWindow),
    );
    window.dispatchEvent(withSource(resultMessage(request.requestId), window));
    window.dispatchEvent(
      withSource(
        resultMessage("graphviz-wrong-request"),
        fake.iframes[0].iframe.contentWindow,
      ),
    );
    await flush();

    window.dispatchEvent(
      withSource(
        resultMessage(request.requestId, "<svg>good</svg>"),
        fake.iframes[0].iframe.contentWindow,
      ),
    );
    await expect(rendered).resolves.toMatchObject({
      status: "rendered",
      svg: "<svg>good</svg>",
    });
    renderer.dispose();
    fake.restore();
  });

  it("creates unique request ids for queued renders", async () => {
    const fake = createFakeIframeFactory();
    const renderer = new IframeGraphvizLocalRenderer(1, fake.createIframe);
    const first = renderer.renderSvg({
      source: "digraph { A -> B }",
      timeoutMs: 1000,
    });
    const second = renderer.renderSvg({
      source: "digraph { B -> C }",
      timeoutMs: 1000,
    });
    await flush();

    const firstRequest = requestAt(fake.iframes[0]);
    sendResult(fake.iframes[0]);
    await expect(first).resolves.toMatchObject({ status: "rendered" });
    await flush();

    const secondRequest = requestAt(fake.iframes[0], 1);
    expect(firstRequest.requestId).not.toBe(secondRequest.requestId);
    sendResult(fake.iframes[0], 1);
    await expect(second).resolves.toMatchObject({ status: "rendered" });
    renderer.dispose();
    fake.restore();
  });

  it("replaces a timed-out iframe and continues queued work", async () => {
    vi.useFakeTimers();
    const fake = createFakeIframeFactory();
    const renderer = new IframeGraphvizLocalRenderer(1, fake.createIframe);
    const timedOut = renderer.renderSvg({
      source: "digraph { slow }",
      timeoutMs: 10,
    });
    const queued = renderer.renderSvg({
      source: "digraph { next }",
      timeoutMs: 1000,
    });
    await flush();

    expect(fake.iframes).toHaveLength(1);
    vi.advanceTimersByTime(10);
    await expect(timedOut).resolves.toMatchObject({
      status: "timeout",
    });
    await flush();

    expect(fake.iframes).toHaveLength(2);
    expect(fake.iframes[0].iframe.isConnected).toBe(false);
    expect(requestAt(fake.iframes[1]).source).toContain("next");
    sendResult(fake.iframes[1]);
    await expect(queued).resolves.toMatchObject({ status: "rendered" });
    renderer.dispose();
    fake.restore();
  });

  it("resolves active and queued renders when disposed", async () => {
    const fake = createFakeIframeFactory();
    const renderer = new IframeGraphvizLocalRenderer(1, fake.createIframe);
    const active = renderer.renderSvg({
      source: "digraph { active }",
      timeoutMs: 1000,
    });
    const queued = renderer.renderSvg({
      source: "digraph { queued }",
      timeoutMs: 1000,
    });
    await flush();

    renderer.dispose();
    await expect(active).resolves.toMatchObject({
      status: "error",
      diagnostics: ["Graphviz renderer disposed."],
    });
    await expect(queued).resolves.toMatchObject({
      status: "error",
      diagnostics: ["Graphviz renderer disposed."],
    });
    expect(fake.iframes[0].iframe.isConnected).toBe(false);
    fake.restore();
  });

  it("recovers queued work after iframe initialization failure", async () => {
    const failing = createFakeIframeFactory({ failLoad: true });
    const renderer = new IframeGraphvizLocalRenderer(1, failing.createIframe);
    const rendered = renderer.renderSvg({
      source: "digraph { broken }",
      timeoutMs: 1000,
    });
    await flush();

    await expect(rendered).resolves.toMatchObject({
      status: "error",
      diagnostics: ["Graphviz renderer iframe failed to load"],
    });
    expect(failing.iframes[0].iframe.isConnected).toBe(false);
    renderer.dispose();
    failing.restore();
  });

  it("resets the iframe after worker errors", async () => {
    const fake = createFakeIframeFactory();
    const renderer = new IframeGraphvizLocalRenderer(1, fake.createIframe);
    const errored = renderer.renderSvg({
      source: "digraph { broken }",
      timeoutMs: 1000,
    });
    const queued = renderer.renderSvg({
      source: "digraph { next }",
      timeoutMs: 1000,
    });
    await flush();

    const request = requestAt(fake.iframes[0]);
    window.dispatchEvent(
      withSource(
        errorMessage(request.requestId),
        fake.iframes[0].iframe.contentWindow,
      ),
    );
    await expect(errored).resolves.toMatchObject({ status: "error" });
    await flush();

    expect(fake.iframes).toHaveLength(2);
    expect(fake.iframes[0].iframe.isConnected).toBe(false);
    sendResult(fake.iframes[1]);
    await expect(queued).resolves.toMatchObject({ status: "rendered" });
    renderer.dispose();
    fake.restore();
  });

  it("publishes privacy-safe batch metrics", async () => {
    const fake = createFakeIframeFactory({ patchDocument: true });
    const rendered = renderGraphvizDiagrams(
      [
        {
          id: "graphviz-1",
          diagramType: "graphviz",
          source: "digraph { private_source -> A }",
        },
        {
          id: "graphviz-2",
          diagramType: "graphviz",
          source: "digraph { B -> C }",
        },
      ],
      { timeoutMs: 1000 },
    );
    await flush();

    sendResult(fake.iframes[0], 0, "<svg>private_svg_payload</svg>");
    sendResult(fake.iframes[1], 0, "<svg>public</svg>");
    await expect(rendered).resolves.toHaveLength(2);

    expect(window.__svardGraphvizMetrics).toMatchObject({
      concurrency: 2,
      diagramCount: 2,
      renderedCount: 2,
      workerCount: 2,
    });
    const serialized = JSON.stringify(window.__svardGraphvizMetrics);
    expect(serialized).not.toContain("private_source");
    expect(serialized).not.toContain("private_svg_payload");
    disposeGraphvizRenderer();
    fake.restore();
  });
});
