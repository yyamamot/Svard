import { createRoot, type Root } from "react-dom/client";
import type { AllDiffsUiPerformanceEvent } from "../src/ui/lib/allDiffsUiPerformance";
import {
  AllDiffsUiPerformanceProvider,
  type AllDiffsUiPerformanceVariant,
} from "../src/ui/lib/allDiffsUiPerformance";
import { DocumentDiffStreamPanel } from "../src/ui/components/DocumentDiffStreamPanel";
import { defaultConfig } from "../src/core/defaultConfig";
import { diffHunksFromText } from "../src/core/documentDiff";
import type {
  DocumentDiffPreview,
  DocumentDiffStreamPreview,
} from "../src/core/types";
import {
  allDiffsUiFixture,
  type AllDiffsUiFixture,
} from "./all-diffs-ui-benchmark/fixtures.mjs";
import "github-markdown-css/github-markdown.css";
import "highlight.js/styles/github.css";
import "katex/dist/katex.min.css";
import "../src/ui/styles.css";

type BenchmarkSample = {
  fixtureId: string;
  variant: AllDiffsUiPerformanceVariant;
  firstUsefulMs: number;
  workflowSettledMs: number;
  scrollFrameP50Ms: number;
  scrollFrameP95Ms: number;
  longTaskCount: number;
  longTaskTotalMs: number;
  longTaskMaxMs: number;
} & Record<string, number | string>;

declare global {
  interface Window {
    __SVARD_ALL_DIFFS_UI_BENCHMARK__?: {
      runSample: (
        fixtureId: string,
        variant: AllDiffsUiPerformanceVariant,
      ) => Promise<BenchmarkSample>;
    };
    __SVARD_ALL_DIFFS_UI_BENCHMARK_READY__?: boolean;
  }
}

type AllDiffsUiFixturePair = AllDiffsUiFixture["pairs"][number];

function previewForPair(pair: AllDiffsUiFixturePair): DocumentDiffPreview {
  return {
    source: "git",
    repositoryRoot: "/benchmark",
    relativePath: pair.right.relativePath,
    leftPath: pair.left.path,
    rightPath: pair.right.path,
    leftRelativePath: pair.left.relativePath,
    rightRelativePath: pair.right.relativePath,
    leftResourceSource: { kind: "commit", revision: "benchmark-base" },
    rightResourceSource: { kind: "worktree" },
    status: "modified",
    lineDiffAvailability: "available",
    leftLabel: "Base",
    rightLabel: "Working Tree",
    hunks: diffHunksFromText(pair.left.source, pair.right.source),
    leftText: pair.left.source,
    rightText: pair.right.source,
  };
}

function streamPreview(fixture: AllDiffsUiFixture): DocumentDiffStreamPreview {
  return {
    source: "git-changes-stream",
    repositoryRoot: "/benchmark",
    watchStatus: "fresh",
    items: fixture.pairs.map((pair) => ({
      kind: "document",
      path: pair.right.relativePath,
      documentPath: pair.right.path,
      status: "modified",
    })),
  };
}

function resourceContext(documentPath: string) {
  return {
    includeFiles: [],
    resourceContext: {
      documentDir: "/benchmark",
      resourceRoots: ["/benchmark"],
      workspaceRoot: "/benchmark",
    },
    asciidocContext: documentPath.endsWith(".adoc")
      ? {
          attributes: {},
          baseDir: "/benchmark",
          documentDir: "/benchmark",
          resourceRoots: ["/benchmark"],
          workspaceRoot: "/benchmark",
        }
      : null,
  };
}

function twoAnimationFrames() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function waitFor(
  predicate: () => boolean,
  message: string,
  timeoutMs = 120_000,
) {
  const deadline = performance.now() + timeoutMs;
  while (!predicate()) {
    if (performance.now() >= deadline) throw new Error(message);
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  }
}

function percentile(values: number[], fraction: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * fraction) - 1),
  );
  return sorted[index];
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function numeric(event: AllDiffsUiPerformanceEvent, key: string) {
  const value = (event as unknown as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function aggregateEvents(events: AllDiffsUiPerformanceEvent[]) {
  const named = (type: AllDiffsUiPerformanceEvent["type"]) =>
    events.filter((event) => event.type === type);
  const total = (type: AllDiffsUiPerformanceEvent["type"], key: string) =>
    sum(named(type).map((event) => numeric(event, key)));
  return {
    marginMeasureCount: named("margin-measure").length,
    marginMeasureDurationMs: total("margin-measure", "durationMs"),
    marginTargetCount: total("margin-measure", "targetCount"),
    marginRectCount: total("margin-measure", "rectCount"),
    marginResizeCallbackCount: total("margin-resize-callback", "callbackCount"),
    marginResizeEntryCount: total("margin-resize-callback", "entryCount"),
    marginMutationCallbackCount: total(
      "margin-mutation-callback",
      "callbackCount",
    ),
    marginMutationCount: total("margin-mutation-callback", "mutationCount"),
    streamRulerMeasureCount: named("stream-ruler-measure").length,
    streamRulerMeasureDurationMs: total("stream-ruler-measure", "durationMs"),
    streamRulerTargetCount: total("stream-ruler-measure", "targetCount"),
    streamRulerRectCount: total("stream-ruler-measure", "rectCount"),
    streamRulerMarkerCount: total("stream-ruler-measure", "markerCount"),
    streamRulerResizeCallbackCount: total(
      "stream-ruler-resize-callback",
      "callbackCount",
    ),
    streamRulerResizeEntryCount: total(
      "stream-ruler-resize-callback",
      "entryCount",
    ),
    presentationRebuildCount: named("presentation-rebuild").length,
    presentationDurationMs: total("presentation-rebuild", "durationMs"),
    presentationItemCount: total("presentation-rebuild", "itemCount"),
    presentationReadyItemCount: total("presentation-rebuild", "readyItemCount"),
    presentationTargetCount: total("presentation-rebuild", "targetCount"),
    activeFileScrollSyncCount: named("active-file-scroll-sync").length,
    activeFileScrollSyncDurationMs: total(
      "active-file-scroll-sync",
      "durationMs",
    ),
    activeFileScrollSyncSectionCount: total(
      "active-file-scroll-sync",
      "sectionCount",
    ),
    activeFileScrollSyncRectCount: total(
      "active-file-scroll-sync",
      "rectCount",
    ),
  };
}

async function waitForMeasurementSettle(events: AllDiffsUiPerformanceEvent[]) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const before = events.length;
    await twoAnimationFrames();
    if (events.length === before) return;
  }
  throw new Error("All Diffs UI measurement did not settle");
}

async function loadEverySection(stage: HTMLElement, expectedCount: number) {
  const body = stage.querySelector<HTMLElement>(".diff-stream-body");
  if (!body) throw new Error("All Diffs stream body was not mounted");
  const deadline = performance.now() + 120_000;
  while (true) {
    if (performance.now() >= deadline) {
      throw new Error("Timed out waiting for every All Diffs section");
    }
    const sections = Array.from(
      stage.querySelectorAll<HTMLElement>(
        '[data-review-id="diff-stream-file-section"]',
      ),
    );
    if (sections.length !== expectedCount) {
      await twoAnimationFrames();
      continue;
    }
    const unresolved = sections.find(
      (section) => section.dataset.loadStatus !== "ready",
    );
    if (!unresolved) return;
    if (unresolved.dataset.loadStatus === "blocked") {
      throw new Error("Synthetic All Diffs fixture was blocked");
    }
    if (unresolved.dataset.loadStatus === "idle") {
      body.scrollTop = Math.max(0, unresolved.offsetTop - 100);
      body.dispatchEvent(new Event("scroll"));
    }
    await twoAnimationFrames();
  }
}

function assertExpectedUi(
  stage: HTMLElement,
  fixture: AllDiffsUiFixture,
  variant: AllDiffsUiPerformanceVariant,
) {
  const readyCount = stage.querySelectorAll(
    '[data-review-id="diff-stream-file-section"][data-load-status="ready"]',
  ).length;
  if (readyCount !== fixture.pairs.length) {
    throw new Error("All Diffs ready section count did not match the fixture");
  }
  const marginHosts = stage.querySelectorAll(
    '[data-review-id="git-rendered-margin-markers"]',
  ).length;
  const marginMarkers = stage.querySelectorAll(
    '[data-review-id="git-rendered-margin-marker"]',
  ).length;
  if (variant === "production") {
    if (marginHosts !== fixture.pairs.length * 2 || marginMarkers === 0) {
      throw new Error("Production margin markers were not fully mounted");
    }
  } else if (marginHosts !== 0 || marginMarkers !== 0) {
    throw new Error("Counterfactual margin markers remained mounted");
  }
  const ruler = stage.querySelector(
    '[data-review-id="diff-stream-change-ruler"]',
  );
  const rulerMarkerCount = stage.querySelectorAll(
    '[data-review-id="diff-stream-change-ruler-marker"]',
  ).length;
  if (variant === "without-rendered-rulers") {
    if (ruler || rulerMarkerCount !== 0) {
      throw new Error("Rendered ruler remained mounted in counterfactual");
    }
  } else if (!ruler || rulerMarkerCount !== fixture.expectedChangeCount) {
    throw new Error("Rendered ruler marker count did not match the fixture");
  }
}

async function measureScrollFrames(body: HTMLElement) {
  const durations: number[] = [];
  const maxScrollTop = Math.max(0, body.scrollHeight - body.clientHeight);
  body.scrollTop = 0;
  await twoAnimationFrames();
  let previous = performance.now();
  for (let frame = 1; frame <= 60; frame += 1) {
    body.scrollTop = (maxScrollTop * frame) / 60;
    const timestamp = await new Promise<number>((resolve) =>
      requestAnimationFrame(resolve),
    );
    durations.push(timestamp - previous);
    previous = timestamp;
  }
  return {
    scrollFrameP50Ms: percentile(durations, 0.5),
    scrollFrameP95Ms: percentile(durations, 0.95),
  };
}

async function runSample(
  fixtureId: string,
  variant: AllDiffsUiPerformanceVariant,
): Promise<BenchmarkSample> {
  const fixture = allDiffsUiFixture(fixtureId);
  const host = document.getElementById("all-diffs-ui-benchmark-root");
  if (!host) throw new Error("All Diffs UI benchmark root is missing");
  const stage = document.createElement("div");
  stage.style.width = "1440px";
  stage.style.height = "900px";
  host.replaceChildren(stage);

  const previews = new Map(
    fixture.pairs.map((pair) => [pair.right.path, previewForPair(pair)]),
  );
  const events: AllDiffsUiPerformanceEvent[] = [];
  const longTasks: number[] = [];
  let longTaskObserver: PerformanceObserver | null = null;
  if (PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
    longTaskObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) longTasks.push(entry.duration);
    });
    longTaskObserver.observe({ entryTypes: ["longtask"] });
  }

  const startedAt = performance.now();
  const root: Root = createRoot(stage);
  root.render(
    <AllDiffsUiPerformanceProvider
      variant={variant}
      onEvent={(event) => events.push(event)}
    >
      <DocumentDiffStreamPanel
        config={defaultConfig}
        preview={streamPreview(fixture)}
        getGitDiffPreview={async (path) => {
          const preview = previews.get(path);
          if (!preview) throw new Error("Synthetic preview is unavailable");
          return preview;
        }}
        copyText={async () => undefined}
        openContextMenu={() => true}
        openDocument={async () => undefined}
        openPathInEditor={async () => undefined}
        resolveDocumentLink={async () => ({
          status: "blocked",
          message: "Unavailable in benchmark",
        })}
        confirmExternalLink={async () => false}
        openExternalUrl={async () => undefined}
        onOpenDiagramPreview={() => undefined}
        showInlineNotice={() => undefined}
        loadDocumentContext={async (path) => resourceContext(path)}
        onClose={() => undefined}
      />
    </AllDiffsUiPerformanceProvider>,
  );

  try {
    await waitFor(
      () =>
        Boolean(
          stage.querySelector(
            '[data-review-id="diff-stream-file-section"][data-load-status="ready"]',
          ),
        ),
      "Timed out waiting for first useful All Diffs section",
    );
    await twoAnimationFrames();
    const firstUsefulMs = performance.now() - startedAt;

    await loadEverySection(stage, fixture.pairs.length);
    await waitForMeasurementSettle(events);
    assertExpectedUi(stage, fixture, variant);
    const workflowSettledMs = performance.now() - startedAt;
    const body = stage.querySelector<HTMLElement>(".diff-stream-body");
    if (!body) throw new Error("All Diffs stream body disappeared");
    const scrollMetrics = await measureScrollFrames(body);
    await waitForMeasurementSettle(events);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const probes = aggregateEvents(events);
    return {
      fixtureId,
      variant,
      firstUsefulMs,
      workflowSettledMs,
      ...scrollMetrics,
      longTaskCount: longTasks.length,
      longTaskTotalMs: sum(longTasks),
      longTaskMaxMs: longTasks.length > 0 ? Math.max(...longTasks) : 0,
      ...probes,
    };
  } finally {
    longTaskObserver?.disconnect();
    root.unmount();
    stage.remove();
    await twoAnimationFrames();
  }
}

window.__SVARD_ALL_DIFFS_UI_BENCHMARK__ = { runSample };
window.__SVARD_ALL_DIFFS_UI_BENCHMARK_READY__ = true;
