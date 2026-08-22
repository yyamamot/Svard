import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const artifactRoot = path.join(
  repositoryRoot,
  ".artifacts",
  "mermaid-isolation",
);
const siteRoot = path.join(artifactRoot, "site");
const buildOnly = process.argv.includes("--build-only");
const outputIndex = process.argv.indexOf("--out");
const outputPath = path.resolve(
  repositoryRoot,
  outputIndex >= 0 && process.argv[outputIndex + 1]
    ? process.argv[outputIndex + 1]
    : ".artifacts/mermaid-isolation/chromium-report.json",
);

const allowedReportKeys = new Set([
  "status",
  "platform",
  "candidate",
  "outcomes",
]);
const allowedOutcomeKeys = new Set([
  "name",
  "status",
  "reason",
  "durationMs",
  "requestedCount",
  "renderedCount",
  "terminatedCount",
  "inputBytes",
  "outputBytes",
  "heartbeatGapMs",
]);

function hasExactKeys(value, allowed) {
  return Object.keys(value).every((key) => allowed.has(key));
}

function isPrivacySafeReport(value) {
  if (
    !value ||
    typeof value !== "object" ||
    !hasExactKeys(value, allowedReportKeys) ||
    !["passed", "not-adopted", "inconclusive"].includes(value.status) ||
    !["chromium", "webkit", "webview2", "unknown"].includes(value.platform) ||
    value.candidate !== "opaque-origin-iframe" ||
    !Array.isArray(value.outcomes)
  ) {
    return false;
  }
  return value.outcomes.every(
    (item) =>
      item &&
      typeof item === "object" &&
      hasExactKeys(item, allowedOutcomeKeys) &&
      typeof item.name === "string" &&
      /^[a-z0-9-]+$/u.test(item.name) &&
      ["passed", "failed", "inconclusive"].includes(item.status) &&
      typeof item.reason === "string" &&
      /^[a-z0-9-]+$/u.test(item.reason) &&
      [
        item.durationMs,
        item.requestedCount,
        item.renderedCount,
        item.terminatedCount,
        item.inputBytes,
        item.outputBytes,
        item.heartbeatGapMs,
      ].every((metric) => Number.isFinite(metric) && metric >= 0),
  );
}

async function run(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repositoryRoot,
      env: process.env,
      stdio: "inherit",
      ...options,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else
        reject(new Error(`${command} failed (${code ?? signal ?? "unknown"})`));
    });
  });
}

async function buildSite() {
  await run("pnpm", [
    "exec",
    "vite",
    "build",
    "--config",
    "scripts/mermaid-isolation/vite.config.ts",
  ]);
  await mkdir(siteRoot, { recursive: true });
  await Promise.all([
    copyFile(
      path.join(repositoryRoot, "node_modules/mermaid/dist/mermaid.min.js"),
      path.join(siteRoot, "mermaid.min.js"),
    ),
    copyFile(
      path.join(repositoryRoot, "scripts/mermaid-isolation/renderer.html"),
      path.join(siteRoot, "renderer.html"),
    ),
    copyFile(
      path.join(repositoryRoot, "scripts/mermaid-isolation/renderer.js"),
      path.join(siteRoot, "renderer.js"),
    ),
  ]);
  await access(path.join(siteRoot, "index.html"), constants.R_OK);
}

async function waitForServer(url, child) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (child.exitCode !== null) throw new Error("preview-server-exited");
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry until the bounded startup deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("preview-server-timeout");
}

await buildSite();
if (buildOnly) process.exit(0);

const port = 4399;
const server = spawn(
  "pnpm",
  [
    "exec",
    "vite",
    "preview",
    "--config",
    "scripts/mermaid-isolation/vite.config.ts",
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "--strictPort",
  ],
  { cwd: repositoryRoot, env: process.env, stdio: "ignore" },
);

let browser;
try {
  const url = `http://127.0.0.1:${port}/`;
  await waitForServer(url, server);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let blockedRequestCount = 0;
  page.on("request", (request) => {
    if (request.url().startsWith("http://127.0.0.1:9/")) {
      blockedRequestCount += 1;
    }
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => window.__SVARD_MERMAID_ISOLATION_REPORT__ !== undefined,
    undefined,
    { timeout: 90_000 },
  );
  const report = await page.evaluate(
    () => window.__SVARD_MERMAID_ISOLATION_REPORT__,
  );
  if (!isPrivacySafeReport(report)) throw new Error("probe-report-invalid");
  report.outcomes.push({
    name: "network-policy",
    status: blockedRequestCount === 0 ? "passed" : "failed",
    reason: blockedRequestCount === 0 ? "no-request" : "request-observed",
    durationMs: 0,
    requestedCount: 1,
    renderedCount: 0,
    terminatedCount: 0,
    inputBytes: 0,
    outputBytes: 0,
    heartbeatGapMs: 0,
  });
  if (blockedRequestCount !== 0) report.status = "not-adopted";
  if (!isPrivacySafeReport(report)) throw new Error("probe-report-invalid");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  const written = JSON.parse(await readFile(outputPath, "utf8"));
  console.log(
    JSON.stringify({
      status: written.status,
      platform: written.platform,
      candidate: written.candidate,
      outcomes: written.outcomes.map(({ name, status, reason }) => ({
        name,
        status,
        reason,
      })),
    }),
  );
  if (written.status === "inconclusive") process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
