import type { MermaidDiagram } from "./types";

type MermaidTheme = "light" | "dark";

export const MERMAID_RENDER_LIMITS = Object.freeze({
  maxDiagramCount: 16,
  maxSourceBytes: 16 * 1024,
  maxAggregateSourceBytes: 64 * 1024,
  maxSvgBytes: 2 * 1024 * 1024,
  maxAggregateSvgBytes: 8 * 1024 * 1024,
  deadlineMs: 5_000,
});

export const MERMAID_RENDER_MESSAGES = Object.freeze({
  renderFailed: "Mermaid render failed.",
  sourceTooLarge: "Mermaid diagram is too large.",
  budgetExceeded: "Mermaid render budget exceeded.",
  outputTooLarge: "Mermaid output is too large.",
  resourceBlocked: "Mermaid external resources are not allowed.",
  timedOut: "Mermaid render timed out.",
});

export type MermaidRenderStatus =
  | "complete"
  | "partial"
  | "timed-out"
  | "aborted";

export type MermaidRenderReason =
  | "none"
  | "count"
  | "source"
  | "output"
  | "resource"
  | "deadline"
  | "aborted"
  | "render-error";

export interface MermaidRenderMetrics {
  requestedCount: number;
  attemptedCount: number;
  renderedCount: number;
  blockedCount: number;
  inputBytes: number;
  outputBytes: number;
  durationMs: number;
  status: MermaidRenderStatus;
  reason: MermaidRenderReason;
}

export interface MermaidRenderSession {
  readonly signal?: AbortSignal;
  getMetrics(): MermaidRenderMetrics;
}

interface MermaidRenderSessionState {
  signal?: AbortSignal;
  startedAt?: number;
  deadlineAt?: number;
  diagramCount: number;
  aggregateSourceBytes: number;
  aggregateSvgBytes: number;
  requestedCount: number;
  attemptedCount: number;
  renderedCount: number;
  blockedCount: number;
  reason: MermaidRenderReason;
  haltedReason?: "count" | "source" | "output" | "deadline";
}

export interface MermaidRenderOutput {
  id: string;
  svg?: string;
  error?: string;
}

interface SchedulerJob<T> {
  session: MermaidRenderSessionState;
  task: () => Promise<T>;
  resolve: (result: SchedulerResult<T>) => void;
  reject: (error: Error) => void;
  settled: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  abortListener?: () => void;
}

type SchedulerResult<T> =
  | { status: "completed"; value: T }
  | { status: "blocked" }
  | { status: "deadline" };

const sessionStates = new WeakMap<
  MermaidRenderSession,
  MermaidRenderSessionState
>();
const schedulerQueue: SchedulerJob<unknown>[] = [];

let schedulerActive = false;
let initialized = false;
let mermaidModule: Promise<typeof import("mermaid")> | null = null;

function utf8ByteLength(value: string, stopAfter: number) {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit <= 0x7f) {
      bytes += 1;
    } else if (codeUnit <= 0x7ff) {
      bytes += 2;
    } else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
    if (bytes > stopAfter) {
      return stopAfter + 1;
    }
  }
  return bytes;
}

const mermaidImagePropertyPattern = /(?:^|[,{\n\r])\s*["']?img["']?\s*:/iu;

function containsMermaidImageResource(source: string) {
  return mermaidImagePropertyPattern.test(source);
}

function createAbortError() {
  return new DOMException("Mermaid rendering was aborted.", "AbortError");
}

function isExpired(session: MermaidRenderSessionState) {
  return session.deadlineAt !== undefined && Date.now() >= session.deadlineAt;
}

function startSession(session: MermaidRenderSessionState) {
  if (session.startedAt !== undefined) {
    return;
  }
  session.startedAt = Date.now();
  session.deadlineAt = session.startedAt + MERMAID_RENDER_LIMITS.deadlineMs;
}

function setReason(
  session: MermaidRenderSessionState,
  reason: MermaidRenderReason,
) {
  if (session.reason === "none" || reason === "aborted") {
    session.reason = reason;
  }
}

function markDeadline(session: MermaidRenderSessionState) {
  session.haltedReason = "deadline";
  session.reason = "deadline";
}

function finishSchedulerJob<T>(job: SchedulerJob<T>) {
  if (job.timer !== null) {
    clearTimeout(job.timer);
    job.timer = null;
  }
  if (job.abortListener && job.session.signal) {
    job.session.signal.removeEventListener("abort", job.abortListener);
  }
}

function settleSchedulerAbort<T>(job: SchedulerJob<T>) {
  if (job.settled) {
    return;
  }
  job.settled = true;
  setReason(job.session, "aborted");
  finishSchedulerJob(job);
  job.reject(createAbortError());
}

function settleSchedulerDeadline<T>(job: SchedulerJob<T>) {
  if (job.settled) {
    return;
  }
  job.settled = true;
  markDeadline(job.session);
  finishSchedulerJob(job);
  job.resolve({ status: "deadline" });
}

function settleSchedulerBlocked<T>(job: SchedulerJob<T>) {
  if (job.settled) {
    return;
  }
  job.settled = true;
  finishSchedulerJob(job);
  job.resolve({ status: "blocked" });
}

function pumpScheduler() {
  if (schedulerActive) {
    return;
  }

  const job = schedulerQueue.shift();
  if (!job) {
    return;
  }
  if (job.settled) {
    pumpScheduler();
    return;
  }
  if (job.session.signal?.aborted) {
    settleSchedulerAbort(job);
    pumpScheduler();
    return;
  }
  if (isExpired(job.session)) {
    settleSchedulerDeadline(job);
    pumpScheduler();
    return;
  }
  if (job.session.haltedReason === "output") {
    settleSchedulerBlocked(job);
    pumpScheduler();
    return;
  }

  schedulerActive = true;
  job.session.attemptedCount += 1;
  void job
    .task()
    .then((value) => {
      if (!job.settled) {
        if (job.session.signal?.aborted) {
          settleSchedulerAbort(job);
        } else if (isExpired(job.session)) {
          settleSchedulerDeadline(job);
        } else {
          job.settled = true;
          finishSchedulerJob(job);
          job.resolve({ status: "completed", value });
        }
      }
    })
    .catch((error: unknown) => {
      if (!job.settled) {
        job.settled = true;
        finishSchedulerJob(job);
        job.reject(error instanceof Error ? error : new Error("Render failed"));
      }
    })
    .finally(() => {
      schedulerActive = false;
      pumpScheduler();
    });
}

function scheduleMermaidRender<T>(
  session: MermaidRenderSessionState,
  task: () => Promise<T>,
): Promise<SchedulerResult<T>> {
  if (session.signal?.aborted) {
    setReason(session, "aborted");
    return Promise.reject(createAbortError());
  }
  if (isExpired(session)) {
    markDeadline(session);
    return Promise.resolve({ status: "deadline" });
  }
  if (session.haltedReason === "output") {
    return Promise.resolve({ status: "blocked" });
  }

  return new Promise<SchedulerResult<T>>((resolve, reject) => {
    const job: SchedulerJob<T> = {
      session,
      task,
      resolve,
      reject,
      settled: false,
      timer: null,
    };
    job.abortListener = () => settleSchedulerAbort(job);
    session.signal?.addEventListener("abort", job.abortListener, {
      once: true,
    });
    job.timer = setTimeout(
      () => settleSchedulerDeadline(job),
      Math.max(0, session.deadlineAt! - Date.now()),
    );
    schedulerQueue.push(job as SchedulerJob<unknown>);
    pumpScheduler();
  });
}

async function loadMermaid() {
  mermaidModule ??= import("mermaid");
  let module: typeof import("mermaid");
  try {
    module = await mermaidModule;
  } catch (error) {
    mermaidModule = null;
    throw error;
  }
  const mermaid = module.default;

  if (!initialized) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      htmlLabels: false,
      flowchart: {
        htmlLabels: false,
      },
      theme: "default",
    });
    initialized = true;
  }

  return mermaid;
}

function getSessionState(session: MermaidRenderSession) {
  const state = sessionStates.get(session);
  if (!state) {
    throw new TypeError("Invalid Mermaid render session.");
  }
  return state;
}

function getStatus(session: MermaidRenderSessionState): MermaidRenderStatus {
  if (session.signal?.aborted || session.reason === "aborted") {
    return "aborted";
  }
  if (session.haltedReason === "deadline") {
    return "timed-out";
  }
  return session.blockedCount > 0 ? "partial" : "complete";
}

export function createMermaidRenderSession(
  options: {
    signal?: AbortSignal;
  } = {},
): MermaidRenderSession {
  const state: MermaidRenderSessionState = {
    signal: options.signal,
    diagramCount: 0,
    aggregateSourceBytes: 0,
    aggregateSvgBytes: 0,
    requestedCount: 0,
    attemptedCount: 0,
    renderedCount: 0,
    blockedCount: 0,
    reason: "none",
  };
  const session: MermaidRenderSession = {
    signal: options.signal,
    getMetrics: () => ({
      requestedCount: state.requestedCount,
      attemptedCount: state.attemptedCount,
      renderedCount: state.renderedCount,
      blockedCount: state.blockedCount,
      inputBytes: state.aggregateSourceBytes,
      outputBytes: state.aggregateSvgBytes,
      durationMs:
        state.startedAt === undefined
          ? 0
          : Math.max(0, Date.now() - state.startedAt),
      status: getStatus(state),
      reason:
        state.signal?.aborted && state.reason === "none"
          ? "aborted"
          : state.reason,
    }),
  };
  sessionStates.set(session, state);
  return session;
}

function blockedOutput(id: string, error: string): MermaidRenderOutput {
  return { id, error };
}

function countBlockedRemaining(
  diagrams: MermaidDiagram[],
  startIndex: number,
  session: MermaidRenderSessionState,
) {
  const blockedCount = Math.max(0, diagrams.length - startIndex);
  session.requestedCount += blockedCount;
  session.blockedCount += blockedCount;
}

export async function renderMermaidDiagrams(
  diagrams: MermaidDiagram[],
  _theme: MermaidTheme,
  providedSession?: MermaidRenderSession,
): Promise<MermaidRenderOutput[]> {
  if (diagrams.length === 0) {
    return [];
  }

  const session = getSessionState(
    providedSession ?? createMermaidRenderSession(),
  );
  startSession(session);
  const outputs: MermaidRenderOutput[] = [];

  for (let index = 0; index < diagrams.length; index += 1) {
    const diagram = diagrams[index]!;
    if (session.signal?.aborted) {
      setReason(session, "aborted");
      throw createAbortError();
    }
    if (session.haltedReason) {
      countBlockedRemaining(diagrams, index, session);
      break;
    }
    if (isExpired(session)) {
      markDeadline(session);
      countBlockedRemaining(diagrams, index, session);
      break;
    }

    session.requestedCount += 1;
    session.diagramCount += 1;
    if (session.diagramCount > MERMAID_RENDER_LIMITS.maxDiagramCount) {
      session.haltedReason = "count";
      session.reason = "count";
      session.blockedCount += 1;
      outputs.push(
        blockedOutput(diagram.id, MERMAID_RENDER_MESSAGES.budgetExceeded),
      );
      countBlockedRemaining(diagrams, index + 1, session);
      break;
    }

    const sourceBytes = utf8ByteLength(
      diagram.source,
      MERMAID_RENDER_LIMITS.maxSourceBytes,
    );
    if (sourceBytes > MERMAID_RENDER_LIMITS.maxSourceBytes) {
      session.blockedCount += 1;
      setReason(session, "source");
      outputs.push(
        blockedOutput(diagram.id, MERMAID_RENDER_MESSAGES.sourceTooLarge),
      );
      continue;
    }
    if (
      session.aggregateSourceBytes + sourceBytes >
      MERMAID_RENDER_LIMITS.maxAggregateSourceBytes
    ) {
      session.haltedReason = "source";
      session.reason = "source";
      session.blockedCount += 1;
      outputs.push(
        blockedOutput(diagram.id, MERMAID_RENDER_MESSAGES.budgetExceeded),
      );
      countBlockedRemaining(diagrams, index + 1, session);
      break;
    }
    session.aggregateSourceBytes += sourceBytes;

    if (containsMermaidImageResource(diagram.source)) {
      session.blockedCount += 1;
      setReason(session, "resource");
      outputs.push(
        blockedOutput(diagram.id, MERMAID_RENDER_MESSAGES.resourceBlocked),
      );
      continue;
    }

    let scheduled: SchedulerResult<MermaidRenderOutput>;
    try {
      scheduled = await scheduleMermaidRender(session, async () => {
        const mermaid = await loadMermaid();
        const result = await mermaid.render(diagram.id, diagram.source);
        if (session.signal?.aborted || isExpired(session)) {
          return blockedOutput(diagram.id, MERMAID_RENDER_MESSAGES.timedOut);
        }
        const svgBytes = utf8ByteLength(
          result.svg,
          MERMAID_RENDER_LIMITS.maxSvgBytes,
        );
        const singleOutputExceeded =
          svgBytes > MERMAID_RENDER_LIMITS.maxSvgBytes;
        if (
          singleOutputExceeded ||
          session.aggregateSvgBytes + svgBytes >
            MERMAID_RENDER_LIMITS.maxAggregateSvgBytes
        ) {
          session.haltedReason = "output";
          session.reason = "output";
          return blockedOutput(
            diagram.id,
            singleOutputExceeded
              ? MERMAID_RENDER_MESSAGES.outputTooLarge
              : MERMAID_RENDER_MESSAGES.budgetExceeded,
          );
        }
        session.aggregateSvgBytes += svgBytes;
        session.renderedCount += 1;
        return { id: diagram.id, svg: result.svg };
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }
      session.blockedCount += 1;
      setReason(session, "render-error");
      outputs.push(
        blockedOutput(diagram.id, MERMAID_RENDER_MESSAGES.renderFailed),
      );
      continue;
    }

    if (scheduled.status === "deadline") {
      session.blockedCount += 1;
      outputs.push(blockedOutput(diagram.id, MERMAID_RENDER_MESSAGES.timedOut));
      countBlockedRemaining(diagrams, index + 1, session);
      break;
    }
    if (scheduled.status === "blocked") {
      session.blockedCount += 1;
      outputs.push(
        blockedOutput(diagram.id, MERMAID_RENDER_MESSAGES.budgetExceeded),
      );
      countBlockedRemaining(diagrams, index + 1, session);
      break;
    }
    if (scheduled.value.error) {
      session.blockedCount += 1;
      outputs.push(scheduled.value);
      countBlockedRemaining(diagrams, index + 1, session);
      break;
    }
    outputs.push(scheduled.value);
  }

  return outputs;
}
