import { afterEach, describe, expect, it } from "vitest";

import {
  clearPlantUmlSvgMemoryCache,
  createPlantUmlSvgCacheKey,
  IframePlantUmlLocalRenderer,
  normalizePlantUmlRenderSource,
  renderPlantUmlDiagrams,
} from "../../src/core/renderPlantUml";

interface FakeIframe {
  iframe: HTMLIFrameElement;
  messages: unknown[];
}

function createFakeIframeFactory(options: { failLoad?: boolean } = {}) {
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
    queueMicrotask(() =>
      iframe.dispatchEvent(new Event(options.failLoad ? "error" : "load")),
    );
    iframes.push({ iframe, messages });
    return iframe;
  };
  return { createIframe, iframes };
}

function resultMessage(requestId: string, svg = "<svg></svg>") {
  const event = new MessageEvent("message", {
    origin: window.location.origin,
    data: {
      type: "PLANTUML_RESULT",
      requestId,
      status: "rendered",
      svg,
      diagnostics: [],
      metrics: { renderMs: 10, svgBytes: svg.length },
    },
  });
  return event;
}

function errorMessage(requestId: string) {
  return new MessageEvent("message", {
    origin: window.location.origin,
    data: {
      type: "PLANTUML_ERROR",
      requestId,
      diagnostics: ["PlantUML failed."],
      metrics: { renderMs: 10 },
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

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  document.body.innerHTML = "";
  clearPlantUmlSvgMemoryCache();
});

describe("IframePlantUmlLocalRenderer", () => {
  it("warms an idle worker without dispatching a render request", async () => {
    const { createIframe, iframes } = createFakeIframeFactory();
    const renderer = new IframePlantUmlLocalRenderer(1, createIframe);

    await renderer.warm();

    expect(iframes).toHaveLength(1);
    expect(iframes[0].messages).toHaveLength(0);

    const rendered = renderer.renderSvg({
      source: "@startuml\nA -> B\n@enduml",
      theme: "light",
      timeoutMs: 1000,
    });
    await flush();

    expect(iframes).toHaveLength(1);
    const request = iframes[0].messages[0] as { requestId: string };
    window.dispatchEvent(
      withSource(
        resultMessage(request.requestId),
        iframes[0].iframe.contentWindow,
      ),
    );
    await expect(rendered).resolves.toMatchObject({
      status: "rendered",
      metrics: { workerReadyWaitMs: 0 },
    });
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
    const renderer = new IframePlantUmlLocalRenderer(1, createIframe);

    await expect(renderer.warm()).rejects.toThrow(
      "PlantUML renderer iframe failed to load",
    );
    expect(iframes[0].iframe.isConnected).toBe(false);

    const rendered = renderer.renderSvg({
      source: "@startuml\nA -> B\n@enduml",
      theme: "light",
      timeoutMs: 1000,
    });
    await flush();

    expect(iframes).toHaveLength(2);
    const request = iframes[1].messages[0] as { requestId: string };
    window.dispatchEvent(
      withSource(
        resultMessage(request.requestId),
        iframes[1].iframe.contentWindow,
      ),
    );
    await expect(rendered).resolves.toMatchObject({ status: "rendered" });
  });

  it("wraps markerless PlantUML only for render payloads", async () => {
    const { createIframe, iframes } = createFakeIframeFactory();
    const renderer = new IframePlantUmlLocalRenderer(1, createIframe);

    const rendered = renderer.renderSvg({
      source: "actor User\nUser -> Renderer: Render",
      theme: "light",
      timeoutMs: 1000,
    });
    await flush();

    const request = iframes[0].messages[0] as {
      requestId: string;
      lines: string[];
    };
    expect(request.lines).toEqual([
      "@startuml",
      "actor User",
      "User -> Renderer: Render",
      "@enduml",
    ]);
    window.dispatchEvent(
      withSource(
        resultMessage(request.requestId),
        iframes[0].iframe.contentWindow,
      ),
    );
    await expect(rendered).resolves.toMatchObject({ status: "rendered" });
  });

  it("keeps PlantUML render payloads light even when the app theme is dark", async () => {
    const { createIframe, iframes } = createFakeIframeFactory();
    const renderer = new IframePlantUmlLocalRenderer(1, createIframe);

    const rendered = renderer.renderSvg({
      source: "@startuml\nactor User\n@enduml",
      theme: "dark",
      timeoutMs: 1000,
    });
    await flush();

    const request = iframes[0].messages[0] as {
      requestId: string;
      theme: string;
    };
    expect(request.theme).toBe("light");
    window.dispatchEvent(
      withSource(
        resultMessage(request.requestId),
        iframes[0].iframe.contentWindow,
      ),
    );
    await expect(rendered).resolves.toMatchObject({ status: "rendered" });
  });

  it("keeps active requests within the configured concurrency", async () => {
    const { createIframe, iframes } = createFakeIframeFactory();
    const renderer = new IframePlantUmlLocalRenderer(2, createIframe);

    const first = renderer.renderSvg({
      source: "@startuml\nA -> B\n@enduml",
      theme: "light",
      timeoutMs: 1000,
    });
    const second = renderer.renderSvg({
      source: "@startuml\nB -> C\n@enduml",
      theme: "light",
      timeoutMs: 1000,
    });
    const third = renderer.renderSvg({
      source: "@startuml\nC -> D\n@enduml",
      theme: "light",
      timeoutMs: 1000,
    });

    await flush();

    expect(iframes).toHaveLength(2);
    expect(iframes[0].messages).toHaveLength(1);
    expect(iframes[1].messages).toHaveLength(1);

    const firstRequest = iframes[0].messages[0] as { requestId: string };
    window.dispatchEvent(
      withSource(
        resultMessage(firstRequest.requestId),
        iframes[0].iframe.contentWindow,
      ),
    );
    await expect(first).resolves.toMatchObject({ status: "rendered" });
    await flush();

    expect(iframes[0].messages).toHaveLength(2);
    const secondRequest = iframes[1].messages[0] as { requestId: string };
    const thirdRequest = iframes[0].messages[1] as { requestId: string };
    window.dispatchEvent(
      withSource(
        resultMessage(thirdRequest.requestId),
        iframes[0].iframe.contentWindow,
      ),
    );
    window.dispatchEvent(
      withSource(
        resultMessage(secondRequest.requestId),
        iframes[1].iframe.contentWindow,
      ),
    );

    await expect(second).resolves.toMatchObject({ status: "rendered" });
    await expect(third).resolves.toMatchObject({ status: "rendered" });
  });

  it("routes success and error responses by request id", async () => {
    const { createIframe, iframes } = createFakeIframeFactory();
    const renderer = new IframePlantUmlLocalRenderer(2, createIframe);

    const success = renderer.renderSvg({
      source: "@startuml\nA -> B\n@enduml",
      theme: "light",
      timeoutMs: 1000,
    });
    const failure = renderer.renderSvg({
      source: "@startuml\ninvalid {\n@enduml",
      theme: "light",
      timeoutMs: 1000,
    });
    await flush();

    const successRequest = iframes[0].messages[0] as { requestId: string };
    const failureRequest = iframes[1].messages[0] as { requestId: string };
    window.dispatchEvent(
      withSource(
        errorMessage(failureRequest.requestId),
        iframes[1].iframe.contentWindow,
      ),
    );
    window.dispatchEvent(
      withSource(
        resultMessage(successRequest.requestId),
        iframes[0].iframe.contentWindow,
      ),
    );

    await expect(success).resolves.toMatchObject({ status: "rendered" });
    await expect(failure).resolves.toMatchObject({ status: "error" });
  });

  it("ignores messages from the wrong origin, source, or request id", async () => {
    const { createIframe, iframes } = createFakeIframeFactory();
    const renderer = new IframePlantUmlLocalRenderer(1, createIframe);

    const rendered = renderer.renderSvg({
      source: "@startuml\nA -> B\n@enduml",
      theme: "light",
      timeoutMs: 1000,
    });
    await flush();

    const request = iframes[0].messages[0] as { requestId: string };
    const wrongOrigin = resultMessage(request.requestId, "<svg>bad</svg>");
    Object.defineProperty(wrongOrigin, "origin", {
      configurable: true,
      value: "https://example.test",
    });
    window.dispatchEvent(
      withSource(wrongOrigin, iframes[0].iframe.contentWindow),
    );
    window.dispatchEvent(withSource(resultMessage(request.requestId), window));
    window.dispatchEvent(
      withSource(
        resultMessage("plantuml-wrong-request"),
        iframes[0].iframe.contentWindow,
      ),
    );
    await flush();

    window.dispatchEvent(
      withSource(
        resultMessage(request.requestId, "<svg>good</svg>"),
        iframes[0].iframe.contentWindow,
      ),
    );
    await expect(rendered).resolves.toMatchObject({
      status: "rendered",
      svg: "<svg>good</svg>",
    });
  });

  it("creates unique request ids for concurrent workers", async () => {
    const { createIframe, iframes } = createFakeIframeFactory();
    const renderer = new IframePlantUmlLocalRenderer(2, createIframe);

    const first = renderer.renderSvg({
      source: "@startuml\nA -> B\n@enduml",
      theme: "light",
      timeoutMs: 1000,
    });
    const second = renderer.renderSvg({
      source: "@startuml\nB -> C\n@enduml",
      theme: "light",
      timeoutMs: 1000,
    });
    await flush();

    const firstRequest = iframes[0].messages[0] as { requestId: string };
    const secondRequest = iframes[1].messages[0] as { requestId: string };
    expect(firstRequest.requestId).not.toBe(secondRequest.requestId);
    window.dispatchEvent(
      withSource(
        resultMessage(firstRequest.requestId),
        iframes[0].iframe.contentWindow,
      ),
    );
    window.dispatchEvent(
      withSource(
        resultMessage(secondRequest.requestId),
        iframes[1].iframe.contentWindow,
      ),
    );
    await expect(first).resolves.toMatchObject({ status: "rendered" });
    await expect(second).resolves.toMatchObject({ status: "rendered" });
  });

  it("advances the queue after timeout", async () => {
    const { createIframe, iframes } = createFakeIframeFactory();
    const renderer = new IframePlantUmlLocalRenderer(1, createIframe);

    const timedOut = renderer.renderSvg({
      source: "@startuml\nslow\n@enduml",
      theme: "light",
      timeoutMs: 1,
    });
    const queued = renderer.renderSvg({
      source: "@startuml\nnext\n@enduml",
      theme: "light",
      timeoutMs: 1000,
    });
    await flush();

    await expect(timedOut).resolves.toMatchObject({ status: "timeout" });
    await flush();

    expect(iframes[0].messages).toHaveLength(2);
    const queuedRequest = iframes[0].messages[1] as { requestId: string };
    window.dispatchEvent(
      withSource(
        resultMessage(queuedRequest.requestId),
        iframes[0].iframe.contentWindow,
      ),
    );
    await expect(queued).resolves.toMatchObject({ status: "rendered" });
  });

  it("disposes active workers and queued requests", async () => {
    const { createIframe } = createFakeIframeFactory();
    const renderer = new IframePlantUmlLocalRenderer(1, createIframe);

    const active = renderer.renderSvg({
      source: "@startuml\nactive\n@enduml",
      theme: "light",
      timeoutMs: 1000,
    });
    const queued = renderer.renderSvg({
      source: "@startuml\nqueued\n@enduml",
      theme: "light",
      timeoutMs: 1000,
    });
    await flush();

    renderer.dispose();

    await expect(active).resolves.toMatchObject({ status: "error" });
    await expect(queued).resolves.toMatchObject({ status: "error" });
    expect(document.querySelectorAll("iframe")).toHaveLength(0);
  });
});

describe("renderPlantUmlDiagrams cache", () => {
  it("uses a persistent cache hit without creating a TeaVM worker iframe", async () => {
    const readInputs: unknown[] = [];
    const writeInputs: unknown[] = [];

    const results = await renderPlantUmlDiagrams(
      [{ id: "plantuml-1", source: "A -> B" }],
      {
        cache: {
          async readPlantUmlSvgCache(input) {
            readInputs.push(input);
            return { status: "hit", svg: "<svg>cached</svg>" };
          },
          async writePlantUmlSvgCache(input) {
            writeInputs.push(input);
            return { status: "written" };
          },
        },
        theme: "light",
        timeoutMs: 1000,
      },
    );

    expect(results).toEqual([
      {
        id: "plantuml-1",
        result: {
          diagnostics: [],
          metrics: {
            cacheLayer: "persistent",
            cacheStatus: "hit",
            renderMs: 0,
            svgBytes: 17,
          },
          status: "rendered",
          svg: "<svg>cached</svg>",
        },
      },
    ]);
    expect(document.querySelector("iframe")).toBeNull();
    expect(writeInputs).toEqual([]);
    expect(readInputs).toHaveLength(1);
    expect(JSON.stringify(readInputs)).not.toContain("A -> B");
    expect(JSON.stringify(readInputs)).not.toContain("plantuml-1");
    expect(JSON.stringify(readInputs)).not.toContain("html");
    expect(JSON.stringify(readInputs)).not.toContain("/Users/");
  });

  it("uses the in-memory cache after a persistent hit", async () => {
    let readCount = 0;
    const cache = {
      async readPlantUmlSvgCache() {
        readCount += 1;
        return { status: "hit" as const, svg: "<svg>cached</svg>" };
      },
      async writePlantUmlSvgCache() {
        return { status: "written" as const };
      },
    };

    await renderPlantUmlDiagrams([{ id: "one", source: "A -> B" }], {
      cache,
      theme: "light",
      timeoutMs: 1000,
    });
    const second = await renderPlantUmlDiagrams(
      [{ id: "two", source: "@startuml\nA -> B\n@enduml" }],
      {
        cache,
        theme: "light",
        timeoutMs: 1000,
      },
    );

    expect(readCount).toBe(1);
    expect(second[0].result.metrics).toMatchObject({
      cacheLayer: "memory",
      cacheStatus: "hit",
    });
  });

  it("evicts the oldest in-memory SVG when the memory cache exceeds its byte cap", async () => {
    const firstKey = await createPlantUmlSvgCacheKey({
      source: "A -> B",
      theme: "light",
      timeoutMs: 1000,
    });
    const secondKey = await createPlantUmlSvgCacheKey({
      source: "B -> C",
      theme: "light",
      timeoutMs: 1000,
    });
    const svgByKey = new Map([
      [firstKey, `<svg>${"a".repeat(17 * 1024 * 1024)}</svg>`],
      [secondKey, `<svg>${"b".repeat(17 * 1024 * 1024)}</svg>`],
    ]);
    let readCount = 0;
    const cache = {
      async readPlantUmlSvgCache(input: { key: string }) {
        readCount += 1;
        return { status: "hit" as const, svg: svgByKey.get(input.key) };
      },
      async writePlantUmlSvgCache() {
        return { status: "written" as const };
      },
    };

    await renderPlantUmlDiagrams([{ id: "one", source: "A -> B" }], {
      cache,
      theme: "light",
      timeoutMs: 1000,
    });
    await renderPlantUmlDiagrams([{ id: "two", source: "B -> C" }], {
      cache,
      theme: "light",
      timeoutMs: 1000,
    });
    await renderPlantUmlDiagrams([{ id: "one-again", source: "A -> B" }], {
      cache,
      theme: "light",
      timeoutMs: 1000,
    });

    expect(readCount).toBe(3);
  });

  it("updates in-memory LRU order on cache hits", async () => {
    const keys = await Promise.all(
      ["A -> B", "B -> C", "C -> D"].map((source) =>
        createPlantUmlSvgCacheKey({
          source,
          theme: "light",
          timeoutMs: 1000,
        }),
      ),
    );
    const svgByKey = new Map(
      keys.map((key, index) => [
        key,
        `<svg>${String(index).repeat(11 * 1024 * 1024)}</svg>`,
      ]),
    );
    let readCount = 0;
    const cache = {
      async readPlantUmlSvgCache(input: { key: string }) {
        readCount += 1;
        return { status: "hit" as const, svg: svgByKey.get(input.key) };
      },
      async writePlantUmlSvgCache() {
        return { status: "written" as const };
      },
    };

    await renderPlantUmlDiagrams([{ id: "one", source: "A -> B" }], {
      cache,
      theme: "light",
      timeoutMs: 1000,
    });
    await renderPlantUmlDiagrams([{ id: "two", source: "B -> C" }], {
      cache,
      theme: "light",
      timeoutMs: 1000,
    });
    await renderPlantUmlDiagrams([{ id: "one-hit", source: "A -> B" }], {
      cache,
      theme: "light",
      timeoutMs: 1000,
    });
    await renderPlantUmlDiagrams([{ id: "three", source: "C -> D" }], {
      cache,
      theme: "light",
      timeoutMs: 1000,
    });
    await renderPlantUmlDiagrams([{ id: "two-again", source: "B -> C" }], {
      cache,
      theme: "light",
      timeoutMs: 1000,
    });

    expect(readCount).toBe(4);
  });

  it("keys markerless and explicit marker source together", async () => {
    await expect(
      createPlantUmlSvgCacheKey({
        source: "A -> B",
        theme: "light",
        timeoutMs: 1000,
      }),
    ).resolves.toBe(
      await createPlantUmlSvgCacheKey({
        source: "@startuml\nA -> B\n@enduml",
        theme: "light",
        timeoutMs: 1000,
      }),
    );
  });

  it("changes cache keys when render options change", async () => {
    const base = await createPlantUmlSvgCacheKey({
      source: "A -> B",
      theme: "light",
      timeoutMs: 1000,
    });
    await expect(
      createPlantUmlSvgCacheKey({
        source: "A -> B",
        theme: "dark",
        timeoutMs: 1000,
      }),
    ).resolves.not.toBe(base);
    await expect(
      createPlantUmlSvgCacheKey({
        source: "A -> B",
        theme: "light",
        timeoutMs: 2000,
      }),
    ).resolves.not.toBe(base);
  });
});

describe("normalizePlantUmlRenderSource", () => {
  it("wraps markerless non-empty source", () => {
    expect(normalizePlantUmlRenderSource("actor User\nUser -> Renderer")).toBe(
      "@startuml\nactor User\nUser -> Renderer\n@enduml",
    );
  });

  it("keeps existing start/end marker source unchanged", () => {
    const source = "@startuml\nA -> B\n@enduml";

    expect(normalizePlantUmlRenderSource(source)).toBe(source);
  });

  it("does not double wrap other PlantUML start marker variants", () => {
    const source = "@startmindmap\n* Root\n@endmindmap";

    expect(normalizePlantUmlRenderSource(source)).toBe(source);
  });

  it("does not repair partially marked or empty source", () => {
    expect(normalizePlantUmlRenderSource("@startuml\nA -> B")).toBe(
      "@startuml\nA -> B",
    );
    expect(normalizePlantUmlRenderSource("@enduml")).toBe("@enduml");
    expect(normalizePlantUmlRenderSource("  \n")).toBe("  \n");
  });
});
