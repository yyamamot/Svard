import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const scenarios = [
  "viewer-asciidoc-standard-theme",
  "viewer-asciidoc-antora-theme",
  "viewer-asciidoc-comprehensive-visual",
  "viewer-asciidoc-include",
  "viewer-asciidoc-project-context-assets",
  "viewer-antora-module-local-assets",
  "viewer-math-rendering",
  "viewer-markdown-basic",
  "viewer-markdown-details",
  "viewer-markdown-math-edge-cases",
  "viewer-render-fixtures",
  "viewer-diagram-samples",
];

function timestampId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function ensureDir(directory) {
  await fs.mkdir(directory, { recursive: true });
}

function runVerifyScenario(scenario) {
  return new Promise((resolve) => {
    const args = [
      "run",
      "verify:ui-change",
      "--",
      "--scenario",
      scenario,
      "--id",
      "render-regression",
    ];
    const child = spawn("pnpm", args, {
      shell: process.platform === "win32",
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on("close", (code) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

function parseVerifySummary(output) {
  const matches = [
    ...output.matchAll(
      /\{\s*"outcome"\s*:\s*"(?<outcome>[^"]+)"\s*,\s*"vlmOutcome"\s*:\s*"(?<vlmOutcome>[^"]+)"\s*,\s*"artifactRoot"\s*:\s*"(?<artifactRoot>[^"]+)"\s*\}/g,
    ),
  ];
  const last = matches.at(-1);
  return last?.groups
    ? {
        outcome: last.groups.outcome,
        vlmOutcome: last.groups.vlmOutcome,
        artifactRoot: last.groups.artifactRoot,
      }
    : null;
}

async function readUiReviewReport(artifactRoot) {
  if (!artifactRoot) {
    return null;
  }
  try {
    const reportText = await fs.readFile(
      path.join(artifactRoot, "ui-review-report.json"),
      "utf8",
    );
    return JSON.parse(reportText);
  } catch {
    return null;
  }
}

async function main() {
  const artifactRoot = path.resolve(
    ".artifacts",
    "render-regression",
    `render-regression-${timestampId()}`,
  );
  const logsDir = path.join(artifactRoot, "logs");
  await ensureDir(logsDir);

  const results = [];
  for (const scenario of scenarios) {
    const startedAt = Date.now();
    const run = await runVerifyScenario(scenario);
    const verifySummary = parseVerifySummary(`${run.stdout}\n${run.stderr}`);
    const uiReport = await readUiReviewReport(verifySummary?.artifactRoot);
    const result = {
      scenario,
      exitCode: run.code,
      durationMs: Date.now() - startedAt,
      outcome: verifySummary?.outcome ?? "unknown",
      vlmOutcome: verifySummary?.vlmOutcome ?? "unknown",
      artifactRoot: verifySummary?.artifactRoot ?? null,
      assertionFailureCount: uiReport?.assertionFailures?.length ?? null,
      pageErrorCount: uiReport?.pageErrors?.length ?? null,
    };
    results.push(result);
    await fs.writeFile(
      path.join(logsDir, `${scenario}.log`),
      `${run.stdout}\n${run.stderr}`,
    );
  }

  const failed = results.filter(
    (result) =>
      result.exitCode !== 0 ||
      result.outcome !== "passed" ||
      result.vlmOutcome === "blocked",
  );
  const report = {
    schemaVersion: 1,
    runId: path.basename(artifactRoot),
    generatedAt: new Date().toISOString(),
    outcome: failed.length === 0 ? "passed" : "failed",
    scenarios: results,
  };
  await fs.writeFile(
    path.join(artifactRoot, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(
    JSON.stringify({ outcome: report.outcome, artifactRoot }, null, 2),
  );
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
