import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const defaultOutputDirectory = ".artifacts/perf/imp-445-git-preview-release";
const fixtureId = "working-tree-14x12-mixed";
const variant = "single-vs-batch-two-preview-release";
const allowedRunModes = new Set(["formal", "confirmation"]);
const allowedVerdicts = new Set(["go", "no-go"]);
const allowedStrings = new Set([
  fixtureId,
  variant,
  "formal",
  "confirmation",
  "go",
  "no-go",
]);

export function parseGitPreviewReleaseBenchmarkArgs(argv) {
  const args = { out: defaultOutputDirectory };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--") continue;
    if (value === "--out") {
      args.out = argv[++index] ?? args.out;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return args;
}

function assertExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} schema mismatch`);
  }
}

function assertFinite(value, label, { nonNegative = false } = {}) {
  if (!Number.isFinite(value) || (nonNegative && value < 0)) {
    throw new Error(`${label} numeric mismatch`);
  }
}

function assertDurationSummary(value, label) {
  assertExactKeys(value, ["p50", "p95"], label);
  assertFinite(value.p50, `${label}.p50`, { nonNegative: true });
  assertFinite(value.p95, `${label}.p95`, { nonNegative: true });
  if (value.p95 < value.p50) {
    throw new Error(`${label} duration mismatch`);
  }
}

function nearlyEqual(left, right) {
  return (
    Math.abs(left - right) <=
    Math.max(1, Math.abs(left), Math.abs(right)) * 1e-9
  );
}

function percentile(values, fraction) {
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.ceil(fraction * sorted.length);
  return sorted[Math.min(Math.max(rank - 1, 0), sorted.length - 1)];
}

function collectStrings(value, output) {
  if (typeof value === "string") {
    output.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, output);
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectStrings(item, output);
  }
}

function assertAllowedStrings(value, label) {
  const strings = new Set();
  collectStrings(value, strings);
  if ([...strings].some((item) => !allowedStrings.has(item))) {
    throw new Error(`${label} contains a private string`);
  }
}

export function assertGitPreviewReleaseArtifactSafe(report) {
  assertExactKeys(
    report,
    [
      "batchSize",
      "documentCount",
      "fixtureId",
      "measurementCount",
      "runMode",
      "samples",
      "schemaVersion",
      "summary",
      "variant",
      "verdict",
      "warmupCount",
    ],
    "report",
  );
  if (
    report.schemaVersion !== 2 ||
    report.fixtureId !== fixtureId ||
    report.variant !== variant ||
    !allowedRunModes.has(report.runMode) ||
    !allowedVerdicts.has(report.verdict) ||
    report.documentCount !== 14 ||
    report.batchSize !== 2 ||
    report.warmupCount !== 1 ||
    report.measurementCount !== 15 ||
    !Array.isArray(report.samples) ||
    report.samples.length !== 15
  ) {
    throw new Error("Git preview release report metadata mismatch");
  }
  assertExactKeys(
    report.summary,
    [
      "batchPreviewMs",
      "improvementRatio",
      "pairedDeltaMs",
      "passed",
      "requiredDeltaMs",
      "singlePreviewMs",
    ],
    "summary",
  );
  assertDurationSummary(
    report.summary.singlePreviewMs,
    "summary.singlePreviewMs",
  );
  assertDurationSummary(
    report.summary.batchPreviewMs,
    "summary.batchPreviewMs",
  );
  assertExactKeys(
    report.summary.pairedDeltaMs,
    ["mad", "p50"],
    "summary.pairedDeltaMs",
  );
  assertFinite(report.summary.pairedDeltaMs.p50, "summary.pairedDeltaMs.p50");
  assertFinite(report.summary.pairedDeltaMs.mad, "summary.pairedDeltaMs.mad", {
    nonNegative: true,
  });
  assertFinite(report.summary.requiredDeltaMs, "summary.requiredDeltaMs", {
    nonNegative: true,
  });
  assertFinite(report.summary.improvementRatio, "summary.improvementRatio");

  const expectedRequired = Math.max(
    report.summary.singlePreviewMs.p50 * 0.15,
    2,
    report.summary.pairedDeltaMs.mad * 2,
  );
  const expectedPassed = report.summary.pairedDeltaMs.p50 >= expectedRequired;
  const expectedRatio =
    report.summary.singlePreviewMs.p50 > 0
      ? report.summary.pairedDeltaMs.p50 / report.summary.singlePreviewMs.p50
      : 0;
  if (
    !nearlyEqual(report.summary.requiredDeltaMs, expectedRequired) ||
    !nearlyEqual(report.summary.improvementRatio, expectedRatio) ||
    report.summary.passed !== expectedPassed ||
    report.verdict !== (expectedPassed ? "go" : "no-go")
  ) {
    throw new Error("Git preview release adoption rule mismatch");
  }

  for (const [sampleIndex, sample] of report.samples.entries()) {
    assertExactKeys(
      sample,
      [
        "batchFirst",
        "batchPreviewMs",
        "documentCount",
        "pairedDeltaMs",
        "sampleIndex",
        "singlePreviewMs",
      ],
      "sample",
    );
    assertFinite(sample.singlePreviewMs, "sample.singlePreviewMs", {
      nonNegative: true,
    });
    assertFinite(sample.batchPreviewMs, "sample.batchPreviewMs", {
      nonNegative: true,
    });
    assertFinite(sample.pairedDeltaMs, "sample.pairedDeltaMs");
    if (
      sample.sampleIndex !== sampleIndex ||
      sample.documentCount !== 14 ||
      sample.batchFirst !== (sampleIndex % 2 === 1) ||
      !nearlyEqual(
        sample.pairedDeltaMs,
        sample.singlePreviewMs - sample.batchPreviewMs,
      )
    ) {
      throw new Error("Git preview release sample mismatch");
    }
  }
  const singleValues = report.samples.map((sample) => sample.singlePreviewMs);
  const batchValues = report.samples.map((sample) => sample.batchPreviewMs);
  const pairedValues = report.samples.map((sample) => sample.pairedDeltaMs);
  const pairedP50 = percentile(pairedValues, 0.5);
  const pairedMad = percentile(
    pairedValues.map((value) => Math.abs(value - pairedP50)),
    0.5,
  );
  if (
    !nearlyEqual(
      report.summary.singlePreviewMs.p50,
      percentile(singleValues, 0.5),
    ) ||
    !nearlyEqual(
      report.summary.singlePreviewMs.p95,
      percentile(singleValues, 0.95),
    ) ||
    !nearlyEqual(
      report.summary.batchPreviewMs.p50,
      percentile(batchValues, 0.5),
    ) ||
    !nearlyEqual(
      report.summary.batchPreviewMs.p95,
      percentile(batchValues, 0.95),
    ) ||
    !nearlyEqual(report.summary.pairedDeltaMs.p50, pairedP50) ||
    !nearlyEqual(report.summary.pairedDeltaMs.mad, pairedMad)
  ) {
    throw new Error("Git preview release summary mismatch");
  }
  assertAllowedStrings(report, "Git preview release artifact");
}

function decisionRun(report) {
  return {
    batchP50Ms: report.summary.batchPreviewMs.p50,
    pairedDeltaMadMs: report.summary.pairedDeltaMs.mad,
    pairedDeltaP50Ms: report.summary.pairedDeltaMs.p50,
    passed: report.summary.passed,
    requiredDeltaMs: report.summary.requiredDeltaMs,
    singleP50Ms: report.summary.singlePreviewMs.p50,
  };
}

export function buildGitPreviewReleaseDecision(formal, confirmation) {
  assertGitPreviewReleaseArtifactSafe(formal);
  assertGitPreviewReleaseArtifactSafe(confirmation);
  if (formal.runMode !== "formal" || confirmation.runMode !== "confirmation") {
    throw new Error("Git preview release decision run order mismatch");
  }
  return {
    confirmation: decisionRun(confirmation),
    fixtureId,
    formal: decisionRun(formal),
    schemaVersion: 1,
    variant,
    verdict:
      formal.summary.passed && confirmation.summary.passed ? "go" : "no-go",
  };
}

export function assertGitPreviewReleaseDecisionSafe(decision) {
  assertExactKeys(
    decision,
    [
      "confirmation",
      "fixtureId",
      "formal",
      "schemaVersion",
      "variant",
      "verdict",
    ],
    "decision",
  );
  if (
    decision.schemaVersion !== 1 ||
    decision.fixtureId !== fixtureId ||
    decision.variant !== variant ||
    !allowedVerdicts.has(decision.verdict)
  ) {
    throw new Error("Git preview release decision metadata mismatch");
  }
  const runKeys = [
    "batchP50Ms",
    "pairedDeltaMadMs",
    "pairedDeltaP50Ms",
    "passed",
    "requiredDeltaMs",
    "singleP50Ms",
  ];
  for (const [label, run] of [
    ["formal", decision.formal],
    ["confirmation", decision.confirmation],
  ]) {
    assertExactKeys(run, runKeys, `decision.${label}`);
    assertFinite(run.singleP50Ms, `decision.${label}.singleP50Ms`, {
      nonNegative: true,
    });
    assertFinite(run.batchP50Ms, `decision.${label}.batchP50Ms`, {
      nonNegative: true,
    });
    assertFinite(run.pairedDeltaP50Ms, `decision.${label}.pairedDeltaP50Ms`);
    assertFinite(run.pairedDeltaMadMs, `decision.${label}.pairedDeltaMadMs`, {
      nonNegative: true,
    });
    assertFinite(run.requiredDeltaMs, `decision.${label}.requiredDeltaMs`, {
      nonNegative: true,
    });
    if (run.passed !== run.pairedDeltaP50Ms >= run.requiredDeltaMs) {
      throw new Error(`Git preview release ${label} decision mismatch`);
    }
  }
  const expectedVerdict =
    decision.formal.passed && decision.confirmation.passed ? "go" : "no-go";
  if (decision.verdict !== expectedVerdict) {
    throw new Error("Git preview release common decision mismatch");
  }
  assertAllowedStrings(decision, "Git preview release decision");
}

function runReleaseProbe(runMode, outputFile) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "cargo",
      [
        "test",
        "--manifest-path",
        "src-tauri/Cargo.toml",
        "--release",
        "--lib",
        "git_diff::tests_git_diff_preview_release_probe::git_preview_release_probe_writes_report",
        "--",
        "--ignored",
        "--exact",
        "--nocapture",
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          SVARD_GIT_PREVIEW_RELEASE_PROBE_OUT: outputFile,
          SVARD_GIT_PREVIEW_RELEASE_PROBE_RUN: runMode,
        },
        shell: process.platform === "win32",
        stdio: "inherit",
      },
    );
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Git preview release probe terminated by ${signal}`));
      } else if (code !== 0) {
        reject(new Error(`Git preview release probe exited with ${code}`));
      } else {
        resolve();
      }
    });
  });
}

async function readAndValidate(outputFile, expectedRunMode) {
  const report = JSON.parse(await fs.readFile(outputFile, "utf8"));
  assertGitPreviewReleaseArtifactSafe(report);
  if (report.runMode !== expectedRunMode) {
    throw new Error("Git preview release report run mode mismatch");
  }
  return report;
}

async function main() {
  const args = parseGitPreviewReleaseBenchmarkArgs(process.argv.slice(2));
  const outputDirectory = path.resolve(args.out);
  await fs.mkdir(outputDirectory, { recursive: true });
  const reports = new Map();
  for (const runMode of ["formal", "confirmation"]) {
    const outputFile = path.join(outputDirectory, `${runMode}.json`);
    await runReleaseProbe(runMode, outputFile);
    const report = await readAndValidate(outputFile, runMode);
    reports.set(runMode, report);
    process.stdout.write(
      `${runMode}: single ${report.summary.singlePreviewMs.p50.toFixed(3)} ms, batch-2 ${report.summary.batchPreviewMs.p50.toFixed(3)} ms, paired delta ${report.summary.pairedDeltaMs.p50.toFixed(3)} ms (${report.verdict})\n`,
    );
  }
  const decision = buildGitPreviewReleaseDecision(
    reports.get("formal"),
    reports.get("confirmation"),
  );
  assertGitPreviewReleaseDecisionSafe(decision);
  await fs.writeFile(
    path.join(outputDirectory, "decision.json"),
    `${JSON.stringify(decision, null, 2)}\n`,
  );
  process.stdout.write(`common verdict: ${decision.verdict}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
