import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const fixtureRoot = path.join(repoRoot, "test", "fixtures", "plantuml");
const manifestPath = path.join(fixtureRoot, "manifest.json");
const artifactBase = path.join(repoRoot, ".artifacts", "plantuml-concurrency");
const defaultDiagramCount = 100;
const defaultTrials = 3;
const timeoutMs = Number(process.env.PLANTUML_CONCURRENCY_TIMEOUT_MS ?? 10000);
const diagramCount = optionNumber(
  "--count",
  "PLANTUML_CONCURRENCY_COUNT",
  defaultDiagramCount,
);
const trials = optionNumber(
  "--trials",
  "PLANTUML_CONCURRENCY_TRIALS",
  defaultTrials,
);
const concurrencies = [1, 2, 4];
const probeModes = ["skip-diagnostic", "dummy-svg"];

async function main() {
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const artifactRoot = path.join(artifactBase, runId);
  const screenshotRoot = path.join(artifactRoot, "screenshots");
  const metricsPath = path.join(artifactRoot, "metrics.jsonl");
  await fs.mkdir(screenshotRoot, { recursive: true });
  await fs.writeFile(metricsPath, "");

  const sources = await buildStressSources(diagramCount);
  const server = await createBenchmarkServer();
  const baseURL = server.resolvedUrls.local[0].replace(/\/$/, "");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 960 },
  });

  try {
    await page.goto(`${baseURL}/__plantuml-concurrency.html`, {
      waitUntil: "networkidle",
    });
    await page.waitForFunction(() =>
      Boolean(window.__plantumlConcurrencyBench),
    );

    const runs = [];
    for (const concurrency of concurrencies) {
      for (let trial = 1; trial <= trials; trial += 1) {
        const run = await page.evaluate(
          async ({
            stressSources,
            renderConcurrency,
            renderTimeoutMs,
            renderProbeMode,
          }) =>
            window.__plantumlConcurrencyBench.run({
              sources: stressSources,
              concurrency: renderConcurrency,
              timeoutMs: renderTimeoutMs,
              probeMode: renderProbeMode,
            }),
          {
            stressSources: sources,
            renderConcurrency: concurrency,
            renderTimeoutMs: timeoutMs,
            renderProbeMode: "normal",
          },
        );
        const entry = {
          probeMode: "normal",
          concurrency,
          trial,
          ...run,
        };
        runs.push(entry);
        await fs.appendFile(metricsPath, `${JSON.stringify(entry)}\n`);
      }
    }

    const probeRuns = [];
    for (const probeMode of probeModes) {
      for (const concurrency of concurrencies) {
        const run = await page.evaluate(
          async ({
            stressSources,
            renderConcurrency,
            renderTimeoutMs,
            renderProbeMode,
          }) =>
            window.__plantumlConcurrencyBench.run({
              sources: stressSources,
              concurrency: renderConcurrency,
              timeoutMs: renderTimeoutMs,
              probeMode: renderProbeMode,
            }),
          {
            stressSources: sources,
            renderConcurrency: concurrency,
            renderTimeoutMs: timeoutMs,
            renderProbeMode: probeMode,
          },
        );
        const entry = {
          probeMode,
          concurrency,
          trial: 1,
          ...run,
        };
        probeRuns.push(entry);
        await fs.appendFile(metricsPath, `${JSON.stringify(entry)}\n`);
      }
    }

    await page.screenshot({
      path: path.join(screenshotRoot, "plantuml-concurrency-runner.png"),
      fullPage: true,
    });

    const summary = summarizeRuns(runs);
    const probeSummary = summarizeProbeRuns(probeRuns);
    const decision = decide(summary);
    const report = {
      runId,
      generatedAt: new Date().toISOString(),
      artifactRoot,
      diagramCount,
      trials,
      timeoutMs,
      concurrencies,
      summary,
      probeSummary,
      decision,
      metricsPath,
      screenshotRoot,
    };

    await fs.writeFile(
      path.join(artifactRoot, "report.json"),
      `${JSON.stringify(report, null, 2)}\n`,
    );
    await fs.writeFile(
      path.join(artifactRoot, "summary.md"),
      buildSummary(report),
    );

    console.log(
      JSON.stringify(
        {
          outcome: decision.accepted ? "passed" : "measured",
          artifactRoot,
          selectedConcurrency: decision.selectedConcurrency,
          reason: decision.reason,
          summary,
          probeSummary,
        },
        null,
        2,
      ),
    );

    if (Object.values(summary).some((item) => item.failedRuns > 0)) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
    await server.close();
  }
}

async function createBenchmarkServer() {
  const port = await findFreePort();
  const server = await createServer({
    root: repoRoot,
    appType: "custom",
    logLevel: "error",
    server: {
      host: "127.0.0.1",
      port,
      strictPort: true,
    },
    plugins: [
      {
        name: "plantuml-concurrency-runner",
        configureServer(viteServer) {
          viteServer.middlewares.use(
            "/__plantuml-concurrency.html",
            (_request, response) => {
              response.setHeader("Content-Type", "text/html; charset=utf-8");
              response.end(buildRunnerHtml());
            },
          );
        },
      },
    ],
  });
  await server.listen();
  return server;
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close(() => {
        if (port === null) {
          reject(new Error("failed to allocate a free port"));
        } else {
          resolve(port);
        }
      });
    });
  });
}

async function buildStressSources(count) {
  const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  const renderedRequired = manifest.fixtures.filter(
    (fixture) =>
      fixture.required === true &&
      (fixture.expectedStatus ?? "rendered") === "rendered" &&
      fixture.file,
  );
  const fixtures = await Promise.all(
    renderedRequired.map(async (fixture) => ({
      id: fixture.id,
      source: await fs.readFile(path.join(fixtureRoot, fixture.file), "utf8"),
    })),
  );
  const sources = [];
  for (let index = 0; index < count; index += 1) {
    const fixture = fixtures[index % fixtures.length];
    sources.push(
      fixture.source.replace(
        "@startuml",
        `@startuml\n' synthetic-${index + 1}-${fixture.id}`,
      ),
    );
  }
  return sources;
}

function buildRunnerHtml() {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>PlantUML concurrency benchmark</title>
  </head>
  <body>
    <div id="status">ready</div>
    <script type="module">
      import { disposePlantUmlRenderer, renderPlantUmlDiagrams } from "/src/core/renderPlantUml.ts";

      window.__plantumlConcurrencyBench = {
        async run({ sources, concurrency, timeoutMs, probeMode = "normal" }) {
          disposePlantUmlRenderer();
          document.getElementById("status").textContent =
            "running concurrency " + concurrency;
          const diagrams = sources.map((source, index) => ({
            id: "stress-" + String(index + 1).padStart(3, "0"),
            source,
          }));
          const started = performance.now();
          const results = await renderPlantUmlDiagrams(diagrams, {
            theme: "light",
            timeoutMs,
            concurrency,
            probeMode,
          });
          const totalMs = performance.now() - started;
          const statuses = results.map((entry) => entry.result.status);
          const metrics = window.__svardPlantUmlMetrics ?? null;
          document.getElementById("status").textContent =
            "done concurrency " + concurrency;
          return {
            totalMs,
            metrics,
            renderedCount: statuses.filter((status) => status === "rendered").length,
            timeoutCount: statuses.filter((status) => status === "timeout").length,
            errorCount: statuses.filter((status) => status === "error").length,
          };
        },
      };
    </script>
  </body>
</html>`;
}

function summarizeRuns(runs) {
  const summary = {};
  for (const concurrency of concurrencies) {
    const group = runs.filter((run) => run.concurrency === concurrency);
    const totals = group
      .map((run) => run.totalMs)
      .sort((left, right) => left - right);
    const p95s = group
      .map((run) => run.metrics?.p95Ms)
      .filter((value) => typeof value === "number")
      .sort((left, right) => left - right);
    summary[concurrency] = {
      runs: group.length,
      failedRuns: group.filter(
        (run) => run.timeoutCount > 0 || run.errorCount > 0,
      ).length,
      minTotalMs: totals[0] ?? null,
      medianTotalMs: percentile(totals, 0.5),
      p95TotalMs: percentile(totals, 0.95),
      medianRenderP95Ms: percentile(p95s, 0.5),
      componentP50Ms: summarizeComponents(group, "componentP50Ms"),
      componentP95Ms: summarizeComponents(group, "componentP95Ms"),
      workerCount: Math.max(
        ...group.map((run) => run.metrics?.workerCount ?? 0),
        0,
      ),
      renderedCount: Math.min(...group.map((run) => run.renderedCount)),
      timeoutCount: Math.max(...group.map((run) => run.timeoutCount)),
      errorCount: Math.max(...group.map((run) => run.errorCount)),
    };
  }
  return summary;
}

function summarizeProbeRuns(runs) {
  const summary = {};
  for (const probeMode of probeModes) {
    summary[probeMode] = summarizeRuns(
      runs.filter((run) => run.probeMode === probeMode),
    );
  }
  return summary;
}

function summarizeComponents(group, field) {
  const keys = [
    "queueWaitMs",
    "parentRoundTripMs",
    "workerTotalMs",
    "renderCoreMs",
    "diagnosticMs",
    "encodeMs",
    "postMessageMs",
  ];
  return Object.fromEntries(
    keys.map((key) => {
      const values = group
        .map((run) => run.metrics?.[field]?.[key])
        .filter((value) => typeof value === "number")
        .sort((left, right) => left - right);
      return [key, percentile(values, 0.5)];
    }),
  );
}

function decide(summary) {
  const serial = summary[1];
  const candidates = [summary[2], summary[4]].filter(
    (candidate) => candidate.failedRuns === 0,
  );
  if (!serial || serial.failedRuns > 0 || candidates.length === 0) {
    return {
      accepted: false,
      selectedConcurrency: 1,
      reason: "serial or parallel benchmark had failures",
    };
  }

  const serialTotal = serial.medianTotalMs;
  const serialP95 = serial.medianRenderP95Ms;
  const scored = candidates.map((candidate) => ({
    concurrency: candidate === summary[2] ? 2 : 4,
    totalImprovement: improvement(serialTotal, candidate.medianTotalMs),
    p95Improvement: improvement(serialP95, candidate.medianRenderP95Ms),
  }));
  const best = scored
    .filter(
      (candidate) =>
        candidate.totalImprovement >= 0.25 || candidate.p95Improvement >= 0.25,
    )
    .sort(
      (left, right) =>
        Math.max(right.totalImprovement, right.p95Improvement) -
        Math.max(left.totalImprovement, left.p95Improvement),
    )[0];

  if (!best) {
    return {
      accepted: false,
      selectedConcurrency: 1,
      reason: "parallel render did not improve total or p95 by 25%",
      scored,
    };
  }

  const two = scored.find((candidate) => candidate.concurrency === 2);
  const four = scored.find((candidate) => candidate.concurrency === 4);
  const selectedConcurrency =
    best.concurrency === 4 &&
    two &&
    four &&
    Math.max(four.totalImprovement, four.p95Improvement) -
      Math.max(two.totalImprovement, two.p95Improvement) <
      0.1
      ? 2
      : best.concurrency;

  return {
    accepted: true,
    selectedConcurrency,
    reason: "parallel render improved total or p95 by at least 25%",
    scored,
  };
}

function buildSummary(report) {
  const rows = Object.entries(report.summary)
    .map(
      ([concurrency, item]) =>
        `| ${concurrency} | ${Math.round(item.medianTotalMs)} | ${Math.round(
          item.medianRenderP95Ms ?? 0,
        )} | ${item.failedRuns} | ${item.workerCount} |`,
    )
    .join("\n");
  return `# PlantUML Concurrency Benchmark

- runId: ${report.runId}
- diagramCount: ${report.diagramCount}
- trials: ${report.trials}
- selectedConcurrency: ${report.decision.selectedConcurrency}
- accepted: ${report.decision.accepted}
- reason: ${report.decision.reason}

| concurrency | median total ms | median render p95 ms | failed runs | worker count |
| --- | ---: | ---: | ---: | ---: |
${rows}

## Component P95 Median

\`\`\`json
${JSON.stringify(
  Object.fromEntries(
    Object.entries(report.summary).map(([concurrency, item]) => [
      concurrency,
      item.componentP95Ms,
    ]),
  ),
  null,
  2,
)}
\`\`\`

## Probe Summary

\`\`\`json
${JSON.stringify(report.probeSummary, null, 2)}
\`\`\`
`;
}

function percentile(values, fraction) {
  if (values.length === 0) {
    return null;
  }
  const index = Math.min(
    values.length - 1,
    Math.max(0, Math.ceil(values.length * fraction) - 1),
  );
  return values[index];
}

function improvement(baseline, candidate) {
  if (!baseline || !candidate) {
    return 0;
  }
  return (baseline - candidate) / baseline;
}

function optionNumber(optionName, envName, fallback) {
  const optionIndex = process.argv.indexOf(optionName);
  const raw =
    optionIndex >= 0 ? process.argv[optionIndex + 1] : process.env[envName];
  const value = Number(raw ?? fallback);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
