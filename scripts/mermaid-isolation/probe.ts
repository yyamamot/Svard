import mermaid from "mermaid";
import { sanitizeSvg } from "../../src/ui/lib/sanitizeHtml";
import {
  MERMAID_ISOLATION_DEADLINE_MS,
  MERMAID_ISOLATION_MAX_AGGREGATE_SOURCE_BYTES,
  MERMAID_ISOLATION_MAX_AGGREGATE_SVG_BYTES,
  MERMAID_ISOLATION_MAX_COUNT,
  MERMAID_ISOLATION_MAX_SOURCE_BYTES,
  MERMAID_ISOLATION_MAX_SVG_BYTES,
  MERMAID_ISOLATION_PROTOCOL_VERSION,
  createProbeScope,
  isRendererResponse,
  utf8Bytes,
  type RendererRequest,
  type RendererResponse,
} from "../../test/support/mermaidIsolationProtocol";

interface PendingRequest {
  reject: (error: Error) => void;
  resolve: (response: Extract<RendererResponse, { type: "result" }>) => void;
  resolveStarted: () => void;
  timer: number;
}

interface ProbeOutcome {
  name: string;
  status: "passed" | "failed" | "inconclusive";
  reason: string;
  durationMs: number;
  requestedCount: number;
  renderedCount: number;
  terminatedCount: number;
  inputBytes: number;
  outputBytes: number;
  heartbeatGapMs: number;
}

interface ProbeReport {
  status: "passed" | "not-adopted" | "inconclusive";
  platform: "chromium" | "webkit" | "webview2" | "unknown";
  candidate: "opaque-origin-iframe";
  outcomes: ProbeOutcome[];
}

declare global {
  interface Window {
    __SVARD_MERMAID_ISOLATION_REPORT__?: ProbeReport;
  }
}

const fixtures = [
  "flowchart LR\nA[Start] --> B[Finish]",
  "sequenceDiagram\nAlice->>Bob: Hello\nBob-->>Alice: Hi",
  "classDiagram\nclass Animal\nAnimal : +name\nAnimal <|-- Cat",
  "stateDiagram-v2\n[*] --> Ready\nReady --> Done",
  "erDiagram\nCUSTOMER ||--o{ ORDER : places",
  "gantt\ntitle Probe\ndateFormat YYYY-MM-DD\nsection Work\nTask :a, 2026-01-01, 1d",
  'pie title Probe\n"A" : 60\n"B" : 40',
  "mindmap\n  root((Probe))\n    Left\n    Right",
] as const;

function platformName(): ProbeReport["platform"] {
  const value = navigator.userAgent.toLowerCase();
  if (value.includes("windows") && value.includes("edg")) return "webview2";
  if (value.includes("applewebkit") && !value.includes("chrome"))
    return "webkit";
  if (value.includes("chrome")) return "chromium";
  return "unknown";
}

function fixedError(message: string) {
  return new Error(message);
}

class IsolatedRendererClient {
  private iframe: HTMLIFrameElement | null = null;
  private port: MessagePort | null = null;
  private scope = "";
  private sequence = 0;
  private deadline = 0;
  private inputBytes = 0;
  private outputBytes = 0;
  private readonly pending = new Map<string, PendingRequest>();
  private ready: Promise<void> | null = null;
  malformedCount = 0;
  lateResultCount = 0;

  async connect() {
    if (this.ready) return this.ready;
    this.ready = new Promise<void>((resolve, reject) => {
      const iframe = document.createElement("iframe");
      iframe.hidden = true;
      iframe.title = "Mermaid isolation feasibility renderer";
      iframe.setAttribute("aria-hidden", "true");
      iframe.setAttribute("sandbox", "allow-scripts");
      iframe.src = "./renderer.html";
      const scope = createProbeScope();
      const channel = new MessageChannel();
      const timer = window.setTimeout(() => {
        reject(fixedError("renderer-ready-timeout"));
        this.terminate("renderer-ready-timeout");
      }, 5_000);
      channel.port1.onmessage = (event) => {
        if (!isRendererResponse(event.data, scope)) {
          this.malformedCount += 1;
          return;
        }
        if (event.data.type === "ready") {
          window.clearTimeout(timer);
          resolve();
          return;
        }
        const pending = this.pending.get(event.data.requestId);
        if (!pending) {
          this.lateResultCount += 1;
          return;
        }
        if (event.data.type === "started") {
          pending.resolveStarted();
          return;
        }
        this.pending.delete(event.data.requestId);
        window.clearTimeout(pending.timer);
        const outputBytes =
          event.data.svg === undefined
            ? 0
            : utf8Bytes(event.data.svg, MERMAID_ISOLATION_MAX_SVG_BYTES);
        if (
          outputBytes > MERMAID_ISOLATION_MAX_SVG_BYTES ||
          this.outputBytes + outputBytes >
            MERMAID_ISOLATION_MAX_AGGREGATE_SVG_BYTES
        ) {
          pending.reject(fixedError("renderer-output-too-large"));
          return;
        }
        this.outputBytes += outputBytes;
        pending.resolve(event.data);
      };
      channel.port1.start();
      iframe.addEventListener(
        "load",
        () => {
          iframe.contentWindow?.postMessage(
            {
              type: "svard-mermaid-connect",
              protocolVersion: MERMAID_ISOLATION_PROTOCOL_VERSION,
              scope,
            },
            "*",
            [channel.port2],
          );
        },
        { once: true },
      );
      iframe.addEventListener(
        "error",
        () => {
          window.clearTimeout(timer);
          reject(fixedError("renderer-load-failed"));
          this.terminate("renderer-load-failed");
        },
        { once: true },
      );
      document.body.appendChild(iframe);
      this.iframe = iframe;
      this.port = channel.port1;
      this.scope = scope;
    });
    return this.ready;
  }

  async start(
    input:
      | { type: "render"; source: string }
      | { type: "busy"; durationMs: number },
  ) {
    await this.connect();
    if (this.deadline === 0) {
      this.deadline = performance.now() + MERMAID_ISOLATION_DEADLINE_MS;
    }
    const remainingMs = this.deadline - performance.now();
    if (remainingMs <= 0 || this.sequence >= MERMAID_ISOLATION_MAX_COUNT) {
      throw fixedError("renderer-session-budget");
    }
    const sourceBytes =
      input.type === "render"
        ? utf8Bytes(input.source, MERMAID_ISOLATION_MAX_SOURCE_BYTES)
        : 0;
    if (
      sourceBytes > MERMAID_ISOLATION_MAX_SOURCE_BYTES ||
      this.inputBytes + sourceBytes >
        MERMAID_ISOLATION_MAX_AGGREGATE_SOURCE_BYTES
    ) {
      throw fixedError("renderer-source-budget");
    }
    this.inputBytes += sourceBytes;
    const requestId = `${this.scope}-${(this.sequence += 1).toString(36)}`;
    let resolveStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      resolveStarted = resolve;
    });
    const result = new Promise<Extract<RendererResponse, { type: "result" }>>(
      (resolve, reject) => {
        const timer = window.setTimeout(() => {
          this.terminate("renderer-session-deadline");
        }, remainingMs);
        this.pending.set(requestId, {
          reject,
          resolve,
          resolveStarted,
          timer,
        });
        const request: RendererRequest =
          input.type === "render"
            ? {
                type: "render",
                protocolVersion: MERMAID_ISOLATION_PROTOCOL_VERSION,
                requestId,
                scope: this.scope,
                source: input.source,
              }
            : {
                type: "busy",
                protocolVersion: MERMAID_ISOLATION_PROTOCOL_VERSION,
                requestId,
                scope: this.scope,
                durationMs: input.durationMs,
              };
        this.port?.postMessage(request);
      },
    );
    return { result, started };
  }

  terminate(reason = "renderer-terminated") {
    for (const pending of this.pending.values()) {
      window.clearTimeout(pending.timer);
      pending.reject(fixedError(reason));
    }
    this.pending.clear();
    this.port?.close();
    this.port = null;
    this.iframe?.remove();
    this.iframe = null;
    this.ready = null;
    this.scope = "";
    this.sequence = 0;
    this.deadline = 0;
    this.inputBytes = 0;
    this.outputBytes = 0;
  }

  get connectedIframeCount() {
    return Number(this.iframe?.isConnected ?? false);
  }

  get pendingCount() {
    return this.pending.size;
  }
}

function svgShape(svg: string) {
  const sanitized = String(sanitizeSvg(svg));
  const documentNode = new DOMParser().parseFromString(
    sanitized,
    "image/svg+xml",
  );
  const root = documentNode.documentElement;
  if (root.localName !== "svg" || documentNode.querySelector("parsererror")) {
    throw fixedError("invalid-svg");
  }
  const tags = [
    "circle",
    "foreignObject",
    "g",
    "line",
    "path",
    "polygon",
    "rect",
    "text",
  ];
  return {
    text: root.textContent?.replace(/\s+/gu, " ").trim() ?? "",
    viewBox: root.getAttribute("viewBox") ?? "",
    counts: tags.map((tag) => root.querySelectorAll(tag).length).join(","),
    bytes: utf8Bytes(sanitized),
  };
}

async function renderBaseline(sources: readonly string[]) {
  const startedAt = performance.now();
  const shapes = [];
  let bytes = 0;
  for (let index = 0; index < sources.length; index += 1) {
    const result = await mermaid.render(
      `baseline-${Date.now()}-${index}`,
      sources[index],
    );
    const shape = svgShape(result.svg);
    shapes.push(shape);
    bytes += shape.bytes;
  }
  return { durationMs: performance.now() - startedAt, shapes, bytes };
}

async function renderCandidate(
  client: IsolatedRendererClient,
  sources: readonly string[],
) {
  const startedAt = performance.now();
  const shapes = [];
  let bytes = 0;
  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index];
    const request = await client.start({ type: "render", source });
    const response = await request.result;
    if (response.status !== "rendered" || response.svg === undefined) {
      throw fixedError(`candidate-${response.status}-${index + 1}`);
    }
    const shape = svgShape(response.svg);
    shapes.push(shape);
    bytes += shape.bytes;
  }
  return { durationMs: performance.now() - startedAt, shapes, bytes };
}

function sameShapes(
  baseline: Awaited<ReturnType<typeof renderBaseline>>["shapes"],
  candidate: Awaited<ReturnType<typeof renderCandidate>>["shapes"],
) {
  return (
    baseline.length === candidate.length &&
    baseline.every(
      (shape, index) =>
        shape.text === candidate[index]?.text &&
        shape.viewBox === candidate[index]?.viewBox &&
        shape.counts === candidate[index]?.counts,
    )
  );
}

function outcome(
  name: string,
  status: ProbeOutcome["status"],
  reason: string,
  values: Partial<Omit<ProbeOutcome, "name" | "status" | "reason">> = {},
): ProbeOutcome {
  return {
    name,
    status,
    reason,
    durationMs: values.durationMs ?? 0,
    requestedCount: values.requestedCount ?? 0,
    renderedCount: values.renderedCount ?? 0,
    terminatedCount: values.terminatedCount ?? 0,
    inputBytes: values.inputBytes ?? 0,
    outputBytes: values.outputBytes ?? 0,
    heartbeatGapMs: values.heartbeatGapMs ?? 0,
  };
}

async function workerOutcome() {
  const startedAt = performance.now();
  const worker = new Worker(new URL("./worker.ts", import.meta.url), {
    type: "module",
  });
  const status = await new Promise<string>((resolve) => {
    const timer = window.setTimeout(() => resolve("timeout"), 5_000);
    worker.onmessage = (event) => {
      window.clearTimeout(timer);
      resolve(String(event.data?.status ?? "malformed"));
    };
    worker.onerror = () => {
      window.clearTimeout(timer);
      resolve("dom-unavailable");
    };
  });
  worker.terminate();
  return outcome(
    "direct-worker",
    status === "dom-unavailable" ? "passed" : "failed",
    status,
    { durationMs: performance.now() - startedAt, requestedCount: 1 },
  );
}

async function cancellationOutcome(
  name: string,
  start: (client: IsolatedRendererClient) => Promise<{
    result: Promise<Extract<RendererResponse, { type: "result" }>>;
    started: Promise<void>;
  }>,
) {
  const client = new IsolatedRendererClient();
  const startedAt = performance.now();
  const gaps: number[] = [];
  let lastHeartbeat = performance.now();
  const heartbeat = window.setInterval(() => {
    const now = performance.now();
    gaps.push(now - lastHeartbeat);
    lastHeartbeat = now;
  }, 25);
  let committed = 0;
  try {
    const request = await start(client);
    void request.result.then(
      () => {
        committed += 1;
      },
      () => undefined,
    );
    await request.started;
    const terminateStartedAt = performance.now();
    await new Promise((resolve) => window.setTimeout(resolve, 25));
    client.terminate();
    const terminateMs = performance.now() - terminateStartedAt;
    await new Promise((resolve) => window.setTimeout(resolve, 100));
    const recovery = await client.start({
      type: "render",
      source: "flowchart LR\nRecovery-->Ready",
    });
    const recovered = await recovery.result;
    const maxGap = Math.max(0, ...gaps);
    const passed =
      terminateMs <= 500 &&
      committed === 0 &&
      recovered.status === "rendered" &&
      client.lateResultCount === 0 &&
      maxGap <= 500;
    return outcome(
      name,
      passed ? "passed" : "failed",
      passed ? "terminated" : "boundary-failed",
      {
        durationMs: performance.now() - startedAt,
        requestedCount: 2,
        renderedCount: recovered.status === "rendered" ? 1 : 0,
        terminatedCount: committed === 0 ? 1 : 0,
        heartbeatGapMs: maxGap,
      },
    );
  } catch {
    return outcome(name, "failed", "probe-error", {
      durationMs: performance.now() - startedAt,
      requestedCount: 1,
      heartbeatGapMs: Math.max(0, ...gaps),
    });
  } finally {
    window.clearInterval(heartbeat);
    client.terminate();
  }
}

async function lifecycleOutcome() {
  const startedAt = performance.now();
  let terminated = 0;
  for (let index = 0; index < 20; index += 1) {
    const client = new IsolatedRendererClient();
    try {
      const request = await client.start({ type: "busy", durationMs: 250 });
      void request.result.catch(() => undefined);
      await request.started;
      client.terminate();
      terminated += 1;
      if (client.connectedIframeCount !== 0 || client.pendingCount !== 0) {
        return outcome("lifecycle-20", "failed", "resource-retained", {
          durationMs: performance.now() - startedAt,
          requestedCount: index + 1,
          terminatedCount: terminated,
        });
      }
    } catch {
      client.terminate();
      return outcome("lifecycle-20", "failed", "probe-error", {
        durationMs: performance.now() - startedAt,
        requestedCount: index + 1,
        terminatedCount: terminated,
      });
    }
  }
  return outcome("lifecycle-20", "passed", "recovered", {
    durationMs: performance.now() - startedAt,
    requestedCount: 20,
    terminatedCount: terminated,
  });
}

async function runProbe() {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    htmlLabels: false,
    flowchart: { htmlLabels: false },
    theme: "default",
  });
  const outcomes: ProbeOutcome[] = [];
  outcomes.push(await workerOutcome());

  const inputBytes = fixtures.reduce(
    (sum, source) => sum + utf8Bytes(source),
    0,
  );
  const parityClient = new IsolatedRendererClient();
  try {
    const baseline = await renderBaseline(fixtures);
    const candidate = await renderCandidate(parityClient, fixtures);
    const passed = sameShapes(baseline.shapes, candidate.shapes);
    outcomes.push(
      outcome(
        "parity-8",
        passed ? "passed" : "failed",
        passed ? "matched" : "shape-mismatch",
        {
          durationMs: candidate.durationMs,
          requestedCount: fixtures.length,
          renderedCount: candidate.shapes.length,
          inputBytes,
          outputBytes: candidate.bytes,
        },
      ),
    );
    const warmThreshold = Math.max(
      baseline.durationMs * 1.2,
      baseline.durationMs + 25,
    );
    outcomes.push(
      outcome(
        "warm-performance-8",
        candidate.durationMs <= warmThreshold ? "passed" : "failed",
        candidate.durationMs <= warmThreshold ? "within-budget" : "regressed",
        {
          durationMs: candidate.durationMs,
          requestedCount: fixtures.length,
          renderedCount: candidate.shapes.length,
          inputBytes,
          outputBytes: candidate.bytes,
        },
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const reason = /^candidate-(?:blocked|error)-[1-8]$/u.test(message)
      ? message
      : "probe-error";
    outcomes.push(
      outcome("parity-8", "failed", reason, { requestedCount: 8, inputBytes }),
    );
  } finally {
    parityClient.terminate();
  }

  outcomes.push(
    await cancellationOutcome("busy-hard-cancel", (client) =>
      client.start({ type: "busy", durationMs: 2_000 }),
    ),
  );

  const heavyLines = ["flowchart LR"];
  for (let index = 0; index < 499; index += 1) {
    heavyLines.push(
      `n${index}[Node${index}] --> n${index + 1}[Node${index + 1}]`,
    );
  }
  const heavySource = heavyLines.join("\n");
  outcomes.push(
    await cancellationOutcome("mermaid-hard-cancel", (client) =>
      client.start({ type: "render", source: heavySource }),
    ),
  );

  const resourceClient = new IsolatedRendererClient();
  try {
    const resource = await resourceClient.start({
      type: "render",
      source:
        'flowchart LR\nA@{ img: "http://127.0.0.1:9/probe.png", label: "Blocked" }',
    });
    const response = await resource.result;
    outcomes.push(
      outcome(
        "resource-policy",
        response.status === "blocked" ? "passed" : "failed",
        response.status === "blocked" ? "blocked" : "unexpected-render",
        { requestedCount: 1 },
      ),
    );
  } catch {
    outcomes.push(
      outcome("resource-policy", "failed", "probe-error", {
        requestedCount: 1,
      }),
    );
  } finally {
    resourceClient.terminate();
  }

  outcomes.push(await lifecycleOutcome());

  const failed = outcomes.some((item) => item.status === "failed");
  const report: ProbeReport = {
    status: failed ? "not-adopted" : "passed",
    platform: platformName(),
    candidate: "opaque-origin-iframe",
    outcomes,
  };
  window.__SVARD_MERMAID_ISOLATION_REPORT__ = report;
  const status = document.getElementById("probe-status");
  if (status) status.textContent = report.status;
}

void runProbe().catch(() => {
  window.__SVARD_MERMAID_ISOLATION_REPORT__ = {
    status: "inconclusive",
    platform: platformName(),
    candidate: "opaque-origin-iframe",
    outcomes: [outcome("probe", "failed", "unhandled-error")],
  };
});
