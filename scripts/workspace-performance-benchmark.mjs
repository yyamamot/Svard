import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reportMarkdown } from "./workspace-performance/reportMarkdown.mjs";

import {
  documentRenderCacheBenchmarkInterface,
  documentRenderCacheBenchmarkPlan,
  normalizeDocumentRenderCacheSample,
  normalizeWorkspaceBootSample,
  percentile,
  workspaceBootBenchmarkInterface,
  workspaceBootBenchmarkPlan,
  workspaceBootScenarioUrl,
} from "./workspace-performance/benchmarkProfiles.mjs";
import {
  buildSummary,
  classifyBottlenecks,
  deriveAsciiDocResults,
  deriveDocumentRenderCacheResult,
  deriveMarkdownResults,
  deriveSourceControlResults,
  deriveUiReviewResults,
  deriveWorkspaceBootResult,
  fillMissingWorkflows,
  summarizeDocumentRenderCacheBenchmark,
  summarizeDurations,
  summarizeEvents,
  summarizeWorkspaceBootBenchmark,
  uiWorkflowScenarios,
  validatePrivacy,
} from "./workspace-performance/benchmarkResults.mjs";

function parseArgs(argv) {
  const args = {
    out: null,
    profile: "quick",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--") {
      continue;
    }
    if (value === "--profile") {
      args.profile = argv[++index] ?? args.profile;
      continue;
    }
    if (value === "--out") {
      args.out = argv[++index] ?? null;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }
  if (!["quick", "full", "diagnostic"].includes(args.profile)) {
    throw new Error(`Unsupported profile: ${args.profile}`);
  }
  return args;
}

function nowId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with ${code}`));
    });
  });
}

function waitForServer(url, timeoutMs = 30_000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    async function poll() {
      try {
        const response = await fetch(url);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // Retry until timeout.
      }
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(poll, 250);
    }
    void poll();
  });
}

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (typeof address !== "object" || address === null) {
        server.close(() =>
          reject(new Error("Failed to allocate a local port")),
        );
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

async function startUiServer() {
  const port = await findAvailablePort();
  const child = spawn(
    "pnpm",
    [
      "exec",
      "vite",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (chunk) => process.stderr.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  const baseURL = `http://127.0.0.1:${port}`;
  await waitForServer(`${baseURL}/`);
  return {
    baseURL,
    stop() {
      return new Promise((resolve) => {
        if (child.exitCode !== null || child.signalCode !== null) {
          resolve();
          return;
        }
        child.once("exit", () => resolve());
        child.kill();
      });
    },
  };
}

async function runWorkspaceBootBenchmark({
  baseURL,
  buildScenarioUrl = workspaceBootScenarioUrl,
  collectorTimeoutMs = 10_000,
  installCollector,
  launchBrowser,
}) {
  const profiles = Object.fromEntries(
    workspaceBootBenchmarkInterface.profiles.map((profile) => [profile, []]),
  );
  let browser = null;
  let context = null;
  try {
    browser = await launchBrowser();
    context = await browser.newContext({
      viewport: { width: 1440, height: 960 },
    });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const page = await context.newPage();
    await installCollector(page);

    for (const run of workspaceBootBenchmarkPlan()) {
      await page.goto(buildScenarioUrl(baseURL, run.profile), {
        waitUntil: "domcontentloaded",
      });
      await page.waitForFunction(
        (collectorGlobal) => {
          const collector = globalThis[collectorGlobal];
          return collector?.status === "ok" || collector?.status === "failed";
        },
        workspaceBootBenchmarkInterface.collectorGlobal,
        { timeout: collectorTimeoutMs },
      );
      const rawSample = await page.evaluate(
        (collectorGlobal) => globalThis[collectorGlobal] ?? null,
        workspaceBootBenchmarkInterface.collectorGlobal,
      );
      let sample;
      try {
        sample = normalizeWorkspaceBootSample(rawSample, run.profile);
      } catch {
        return {
          profiles,
          reason: "workspace-boot-collector-contract-mismatch",
          status: "failed",
        };
      }
      if (sample.status !== "ok") {
        return {
          profiles,
          reason: sample.reason,
          status: "failed",
        };
      }
      if (run.kind === "measurement") {
        profiles[run.profile].push(sample);
      }
    }
    return {
      measurementCountPerProfile:
        workspaceBootBenchmarkInterface.measurementCountPerProfile,
      profiles,
      status: "ok",
      warmupCountPerProfile:
        workspaceBootBenchmarkInterface.warmupCountPerProfile,
    };
  } catch (error) {
    const unavailable =
      error?.name === "TimeoutError" ||
      /timeout|timed out/iu.test(String(error?.message ?? ""));
    return {
      profiles,
      reason: unavailable
        ? "workspace-boot-collector-unavailable"
        : "workspace-boot-scenario-error",
      status: unavailable ? "skipped" : "failed",
    };
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}

async function runDocumentRenderCacheBenchmark({
  baseURL,
  installCollector,
  launchBrowser,
  runScenario,
}) {
  const samples = [];
  let browser = null;
  let context = null;
  try {
    browser = await launchBrowser();
    context = await browser.newContext({
      viewport: { width: 1440, height: 960 },
    });
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const page = await context.newPage();
    await installCollector(page);
    for (const run of documentRenderCacheBenchmarkPlan()) {
      const rawSample = await runScenario(page, baseURL);
      let sample;
      try {
        sample = normalizeDocumentRenderCacheSample(rawSample);
      } catch {
        return {
          reason: "document-render-cache-collector-contract-mismatch",
          samples,
          status: "failed",
        };
      }
      if (sample.status !== "ok") {
        return { reason: sample.reason, samples, status: "failed" };
      }
      if (run.kind === "measurement") {
        samples.push(sample);
      }
    }
    return {
      measurementCount: documentRenderCacheBenchmarkInterface.measurementCount,
      samples,
      status: "ok",
      warmupCount: documentRenderCacheBenchmarkInterface.warmupCount,
    };
  } catch (error) {
    const unavailable =
      error?.name === "TimeoutError" ||
      /timeout|timed out/iu.test(String(error?.message ?? ""));
    return {
      reason: unavailable
        ? "document-render-cache-collector-unavailable"
        : "document-render-cache-scenario-error",
      samples,
      status: unavailable ? "skipped" : "failed",
    };
  } finally {
    await context?.close().catch(() => {});
    await browser?.close().catch(() => {});
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function runProbeReports({ outputDir, profile }) {
  const probeDir = path.join(outputDir, "probes");
  await fs.mkdir(probeDir, { recursive: true });
  const markdownOut = path.join(probeDir, "markdown.json");
  const asciidocOut = path.join(probeDir, "asciidoc.json");
  const sourceOut = path.join(probeDir, "source-control-file-history.json");

  await runCommand("node", [
    "scripts/markdown-perf-probe.mjs",
    ...(profile === "diagnostic" ? ["--diagnostic"] : []),
    "--out",
    markdownOut,
  ]);
  await runCommand("node", [
    "scripts/asciidoc-perf-probe.mjs",
    "--out",
    asciidocOut,
  ]);
  await runCommand("node", [
    "scripts/source-control-file-history-perf-probe.mjs",
    "--out",
    sourceOut,
  ]);

  const reports = {
    asciidocReport: await readJson(asciidocOut),
    markdownReport: await readJson(markdownOut),
    sourceReport: await readJson(sourceOut),
  };

  if (profile === "quick") {
    return {
      ...reports,
      documentRenderCacheReport: null,
      uiReports: [],
      workspaceBootReport: null,
    };
  }

  const uiResults = await runUiReviewReports({ outputDir, profile });
  return {
    ...reports,
    ...uiResults,
  };
}

async function runUiReviewReports({ outputDir, profile }) {
  const [captureModule, playwright] = await Promise.all([
    import("./ui-review/core/capture.mjs"),
    import("@playwright/test"),
  ]);
  const {
    DOCUMENT_RENDER_CACHE_BENCHMARK_PHASES,
    DOCUMENT_RENDER_CACHE_BENCHMARK_SCENARIO,
    WORKSPACE_BOOT_BENCHMARK_PROFILES,
    WORKSPACE_BOOT_BENCHMARK_SCENARIO,
    buildWorkspaceBootBenchmarkUrl,
    captureScenario,
    installDocumentRenderCacheBenchmarkCollector,
    installWorkspaceBootBenchmarkCollector,
    runDocumentRenderCacheBenchmarkScenario,
  } = captureModule;
  const server = await startUiServer();
  const uiRoot = path.join(outputDir, "ui-scenarios");
  const reports = [];
  let workspaceBootReport;
  let documentRenderCacheReport;

  try {
    const interfaceMatches =
      WORKSPACE_BOOT_BENCHMARK_SCENARIO ===
        workspaceBootBenchmarkInterface.scenarioId &&
      workspaceBootBenchmarkInterface.profiles.every((profileId) =>
        WORKSPACE_BOOT_BENCHMARK_PROFILES.includes(profileId),
      );
    workspaceBootReport = interfaceMatches
      ? await runWorkspaceBootBenchmark({
          baseURL: server.baseURL,
          buildScenarioUrl: buildWorkspaceBootBenchmarkUrl,
          installCollector: installWorkspaceBootBenchmarkCollector,
          launchBrowser: () => playwright.chromium.launch(),
        })
      : {
          profiles: {},
          reason: "workspace-boot-collector-contract-mismatch",
          status: "failed",
        };
    const cacheInterfaceMatches =
      DOCUMENT_RENDER_CACHE_BENCHMARK_SCENARIO ===
        documentRenderCacheBenchmarkInterface.scenarioId &&
      documentRenderCacheBenchmarkInterface.phases.every((phase) =>
        DOCUMENT_RENDER_CACHE_BENCHMARK_PHASES.includes(phase),
      );
    documentRenderCacheReport = cacheInterfaceMatches
      ? await runDocumentRenderCacheBenchmark({
          baseURL: server.baseURL,
          installCollector: installDocumentRenderCacheBenchmarkCollector,
          launchBrowser: () => playwright.chromium.launch(),
          runScenario: runDocumentRenderCacheBenchmarkScenario,
        })
      : {
          reason: "document-render-cache-collector-contract-mismatch",
          samples: [],
          status: "failed",
        };
    for (const definition of uiWorkflowScenarios) {
      const scenario = definition.scenario;
      const artifactRoot = path.join(uiRoot, definition.workflowId);
      await fs.mkdir(path.join(artifactRoot, "screenshots"), {
        recursive: true,
      });
      const startedAt = Date.now();
      try {
        const report = await captureScenario({
          artifactRoot,
          baseURL: server.baseURL,
          gotoWaitUntil: "domcontentloaded",
          id: `benchmark-${profile}`,
          scenario,
        });
        reports.push({
          durationMs: Date.now() - startedAt,
          report,
          scenario,
          status: report.outcome === "passed" ? "ok" : "failed",
          workflowId: definition.workflowId,
        });
      } catch {
        reports.push({
          durationMs: Date.now() - startedAt,
          reason: "scenario-error",
          report: null,
          scenario,
          status: "failed",
          workflowId: definition.workflowId,
        });
      }
    }
  } finally {
    await server.stop();
  }

  return {
    documentRenderCacheReport,
    uiReports: reports,
    workspaceBootReport,
  };
}

async function writeOutputs(outputDir, summary) {
  await fs.mkdir(outputDir, { recursive: true });
  const privacyViolations = validatePrivacy(summary);
  const finalSummary = {
    ...summary,
    generatedAt: new Date().toISOString(),
    privacyCheck: {
      passed: privacyViolations.length === 0,
      violations: privacyViolations,
    },
  };
  await fs.writeFile(
    path.join(outputDir, "summary.json"),
    `${JSON.stringify(finalSummary, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(outputDir, "report.md"),
    reportMarkdown(finalSummary),
  );
  return finalSummary;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const outputDir = path.resolve(
    process.cwd(),
    args.out ?? `.artifacts/perf/workspace-${nowId()}`,
  );
  const reports = await runProbeReports({ outputDir, profile: args.profile });
  const summary = buildSummary({ ...reports, profile: args.profile });
  const finalSummary = await writeOutputs(outputDir, summary);
  process.stdout.write(`${JSON.stringify(finalSummary, null, 2)}\n`);
  if (!finalSummary.privacyCheck.passed) {
    process.exitCode = 1;
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  await main();
}

export {
  buildSummary,
  classifyBottlenecks,
  deriveAsciiDocResults,
  deriveDocumentRenderCacheResult,
  deriveMarkdownResults,
  deriveSourceControlResults,
  deriveUiReviewResults,
  deriveWorkspaceBootResult,
  fillMissingWorkflows,
  normalizeWorkspaceBootSample,
  normalizeDocumentRenderCacheSample,
  parseArgs,
  percentile,
  reportMarkdown,
  runWorkspaceBootBenchmark,
  runDocumentRenderCacheBenchmark,
  summarizeDocumentRenderCacheBenchmark,
  summarizeWorkspaceBootBenchmark,
  summarizeDurations,
  summarizeEvents,
  validatePrivacy,
  documentRenderCacheBenchmarkInterface,
  documentRenderCacheBenchmarkPlan,
  workspaceBootBenchmarkInterface,
  workspaceBootBenchmarkPlan,
  workspaceBootScenarioUrl,
};
