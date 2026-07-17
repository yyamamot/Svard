import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import { chromium } from "@playwright/test";

import { allDiffsUiFixtures } from "./all-diffs-ui-benchmark/fixtures.mjs";
import {
  allDiffsUiRuntime,
  allDiffsUiVariants,
  assertAllDiffsUiArtifactSafe,
  combineAllDiffsUiRuns,
  summarizeAllDiffsUiRun,
} from "./all-diffs-ui-benchmark/report.mjs";

const warmupCount = 1;
const formalSampleCount = 15;

export function parseAllDiffsUiBenchmarkArgs(argv) {
  const args = {
    confirmation: null,
    out: ".artifacts/perf/imp-445-all-diffs-ui-formal.json",
    port: 4296,
    smoke: false,
    url: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--") continue;
    if (value === "--confirmation") {
      args.confirmation = argv[++index] ?? null;
    } else if (value === "--out") {
      args.out = argv[++index] ?? args.out;
    } else if (value === "--port") {
      args.port = Number(argv[++index] ?? args.port);
    } else if (value === "--smoke") {
      args.smoke = true;
    } else if (value === "--url") {
      args.url = argv[++index] ?? null;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  if (!Number.isInteger(args.port) || args.port <= 0 || args.port > 65_535) {
    throw new Error(`Invalid port: ${args.port}`);
  }
  return args;
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
        // Retry until the bounded startup deadline.
      }
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      setTimeout(poll, 200);
    }
    void poll();
  });
}

async function startServer(port) {
  await runCommand([
    "exec",
    "vite",
    "build",
    "--config",
    "scripts/all-diffs-ui-benchmark/vite.config.mjs",
  ]);
  const child = spawn(
    "pnpm",
    [
      "exec",
      "vite",
      "preview",
      "--config",
      "scripts/all-diffs-ui-benchmark/vite.config.mjs",
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--strictPort",
    ],
    {
      cwd: process.cwd(),
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.stdout.on("data", (chunk) => process.stderr.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  const url = `http://127.0.0.1:${port}`;
  await waitForServer(`${url}/scripts/all-diffs-ui-benchmark.html`);
  return {
    stop() {
      child.kill();
    },
    url,
  };
}

function runCommand(args) {
  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", args, {
      cwd: process.cwd(),
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (chunk) => process.stderr.write(chunk));
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `All Diffs UI production build failed (${signal ?? `exit ${code}`})`,
        ),
      );
    });
  });
}

export function assertAllDiffsUiBenchmarkRuntime(runtime) {
  if (runtime !== allDiffsUiRuntime) {
    throw new Error(
      `All Diffs UI benchmark requires ${allDiffsUiRuntime}; received ${String(runtime)}`,
    );
  }
  return runtime;
}

function rotatedVariants(sampleIndex) {
  const offset = sampleIndex % allDiffsUiVariants.length;
  return [
    ...allDiffsUiVariants.slice(offset),
    ...allDiffsUiVariants.slice(0, offset),
  ];
}

async function runBrowserMeasurements({ baseUrl, sampleCount }) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") {
      process.stderr.write(`[browser] ${message.text()}\n`);
    }
  });
  await page.goto(`${baseUrl}/scripts/all-diffs-ui-benchmark.html`, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(
    () => window.__SVARD_ALL_DIFFS_UI_BENCHMARK_READY__ === true,
  );
  const runtime = await page.evaluate(
    () => window.__SVARD_ALL_DIFFS_UI_BENCHMARK_RUNTIME__,
  );
  assertAllDiffsUiBenchmarkRuntime(runtime);
  const runSample = (fixtureId, variant) =>
    page.evaluate(
      async ({ selectedFixtureId, selectedVariant }) => {
        const benchmark = window.__SVARD_ALL_DIFFS_UI_BENCHMARK__;
        if (!benchmark) throw new Error("All Diffs UI benchmark is not ready");
        return benchmark.runSample(selectedFixtureId, selectedVariant);
      },
      { selectedFixtureId: fixtureId, selectedVariant: variant },
    );
  const samples = [];
  try {
    for (const fixture of allDiffsUiFixtures) {
      for (let warmupIndex = 0; warmupIndex < warmupCount; warmupIndex += 1) {
        for (const variant of rotatedVariants(warmupIndex)) {
          await runSample(fixture.fixtureId, variant);
        }
      }
      for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
        for (const variant of rotatedVariants(sampleIndex)) {
          const sample = await runSample(fixture.fixtureId, variant);
          samples.push({ ...sample, sampleIndex });
        }
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }
  return samples;
}

async function main() {
  const args = parseAllDiffsUiBenchmarkArgs(process.argv.slice(2));
  const server = args.url ? null : await startServer(args.port);
  const baseUrl = args.url ?? server?.url;
  if (!baseUrl) throw new Error("All Diffs UI benchmark URL is unavailable");
  try {
    const samples = await runBrowserMeasurements({
      baseUrl,
      sampleCount: args.smoke ? 1 : formalSampleCount,
    });
    const mode = args.confirmation ? "confirmation" : "formal";
    let artifact = summarizeAllDiffsUiRun({ mode, samples });
    if (args.confirmation) {
      const formal = JSON.parse(await fs.readFile(args.confirmation, "utf8"));
      assertAllDiffsUiArtifactSafe(formal);
      artifact = combineAllDiffsUiRuns(formal, artifact);
    }
    assertAllDiffsUiArtifactSafe(artifact);
    await fs.mkdir(path.dirname(args.out), { recursive: true });
    await fs.writeFile(args.out, `${JSON.stringify(artifact, null, 2)}\n`);
    process.stdout.write(
      `${artifact.mode}: ${artifact.confirmedCandidate ?? artifact.candidate}\n`,
    );
  } finally {
    server?.stop();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
