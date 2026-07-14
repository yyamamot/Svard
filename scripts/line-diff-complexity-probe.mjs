import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const lineDiffProbeFixtureIds = [
  "single-edit-200",
  "disjoint-200",
  "single-edit-1000",
  "disjoint-1000",
  "single-edit-3000",
  "disjoint-3000",
  "single-edit-5000",
  "disjoint-5000",
];

export const lineDiffProbeComparisonIds = [
  "imp416-common-edge-trim",
  "imp417-linear-memory",
];

export function parseLineDiffProbeArgs(argv) {
  const args = {
    baseline: null,
    comparison: null,
    out: ".artifacts/perf/imp-415-before",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--") continue;
    if (value === "--baseline") {
      args.baseline = argv[++index] ?? null;
    } else if (value === "--comparison") {
      args.comparison = argv[++index] ?? null;
      if (!lineDiffProbeComparisonIds.includes(args.comparison)) {
        throw new Error(`Unsupported comparison: ${args.comparison}`);
      }
    } else if (value === "--out") {
      args.out = argv[++index] ?? args.out;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return args;
}

function runReleaseProbe(outputFile) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "cargo",
      [
        "test",
        "--manifest-path",
        "src-tauri/Cargo.toml",
        "--release",
        "--lib",
        "git_diff::tests_line_diff_probe::line_diff_complexity_probe_writes_report",
        "--",
        "--ignored",
        "--exact",
        "--nocapture",
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, SVARD_LINE_DIFF_PROBE_OUT: outputFile },
        shell: process.platform === "win32",
        stdio: "inherit",
      },
    );
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Line diff probe terminated by ${signal}`));
      } else if (code !== 0) {
        reject(new Error(`Line diff probe exited with ${code}`));
      } else {
        resolve();
      }
    });
  });
}

function assertExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} schema mismatch`);
  }
}

function expectedFixtureMetrics(fixtureId, mode) {
  const lineCount = Number(fixtureId.split("-").at(-1));
  if (mode === "linear-memory") {
    return {
      peakScratchEntries: 0,
      workUnits: fixtureId.startsWith("single-edit-")
        ? 1
        : lineCount * lineCount,
    };
  }
  const usesTrimmedMiddle =
    mode === "common-edge-trim" &&
    fixtureId.startsWith("single-edit-") &&
    lineCount > 200;
  return {
    peakScratchEntries: usesTrimmedMiddle
      ? 4
      : (lineCount + 1) * (lineCount + 1),
    workUnits: usesTrimmedMiddle ? 1 : lineCount * lineCount,
  };
}

function assertFixtureStructure(value, label) {
  const lineCount = Number(value.fixtureId.split("-").at(-1));
  if (
    !Number.isSafeInteger(value.inputBytes) ||
    value.inputBytes <= 0 ||
    value.leftLineCount !== lineCount ||
    value.rightLineCount !== lineCount ||
    !Number.isSafeInteger(value.workUnits) ||
    value.workUnits < 0 ||
    !Number.isSafeInteger(value.peakScratchEntries) ||
    value.peakScratchEntries < 0
  ) {
    throw new Error(`${label} metric mismatch`);
  }
}

function lineDiffProbeReportMode(report) {
  for (const mode of ["full-lcs", "common-edge-trim", "linear-memory"]) {
    if (
      report.summaries.every((summary) => {
        const expected = expectedFixtureMetrics(summary.fixtureId, mode);
        return (
          summary.workUnits === expected.workUnits &&
          summary.peakScratchEntries === expected.peakScratchEntries
        );
      })
    ) {
      return mode;
    }
  }
  return "unknown";
}

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.ceil(ratio * sorted.length);
  return sorted[Math.max(0, rank - 1)];
}

function validateLineDiffProbeReportStructure(report) {
  assertExactKeys(
    report,
    [
      "measurementCount",
      "samples",
      "schemaVersion",
      "summaries",
      "warmupCount",
    ],
    "report",
  );
  if (
    report.schemaVersion !== 1 ||
    report.warmupCount !== 1 ||
    report.measurementCount !== 20
  ) {
    throw new Error("Line diff report metadata mismatch");
  }
  if (
    !Array.isArray(report.samples) ||
    !Array.isArray(report.summaries) ||
    report.samples.length !== lineDiffProbeFixtureIds.length * 20 ||
    report.summaries.length !== lineDiffProbeFixtureIds.length
  ) {
    throw new Error("Line diff report sample count mismatch");
  }
  const sampleCounts = new Map(
    lineDiffProbeFixtureIds.map((fixtureId) => [fixtureId, 0]),
  );
  const sampleDurations = new Map(
    lineDiffProbeFixtureIds.map((fixtureId) => [fixtureId, []]),
  );
  const fixtureMetrics = new Map();
  for (const sample of report.samples) {
    assertExactKeys(
      sample,
      [
        "durationMs",
        "fixtureId",
        "inputBytes",
        "leftLineCount",
        "peakScratchEntries",
        "rightLineCount",
        "workUnits",
      ],
      "sample",
    );
    if (
      !sampleCounts.has(sample.fixtureId) ||
      !Number.isFinite(sample.durationMs) ||
      sample.durationMs < 0
    ) {
      throw new Error("Line diff report sample value mismatch");
    }
    assertFixtureStructure(sample, "sample");
    const metrics = {
      inputBytes: sample.inputBytes,
      leftLineCount: sample.leftLineCount,
      peakScratchEntries: sample.peakScratchEntries,
      rightLineCount: sample.rightLineCount,
      workUnits: sample.workUnits,
    };
    const previousMetrics = fixtureMetrics.get(sample.fixtureId);
    if (
      previousMetrics &&
      JSON.stringify(previousMetrics) !== JSON.stringify(metrics)
    ) {
      throw new Error("Line diff report fixture metric mismatch");
    }
    fixtureMetrics.set(sample.fixtureId, metrics);
    sampleCounts.set(sample.fixtureId, sampleCounts.get(sample.fixtureId) + 1);
    sampleDurations.get(sample.fixtureId).push(sample.durationMs);
  }
  if ([...sampleCounts.values()].some((count) => count !== 20)) {
    throw new Error("Line diff report fixture sample count mismatch");
  }

  const summaryIds = new Set();
  for (const summary of report.summaries) {
    assertExactKeys(
      summary,
      [
        "durationMs",
        "fixtureId",
        "inputBytes",
        "leftLineCount",
        "peakScratchEntries",
        "rightLineCount",
        "workUnits",
      ],
      "summary",
    );
    assertExactKeys(summary.durationMs, ["p50", "p95"], "summary duration");
    if (
      !lineDiffProbeFixtureIds.includes(summary.fixtureId) ||
      summaryIds.has(summary.fixtureId) ||
      !Number.isFinite(summary.durationMs.p50) ||
      !Number.isFinite(summary.durationMs.p95) ||
      summary.durationMs.p50 < 0 ||
      summary.durationMs.p95 < summary.durationMs.p50
    ) {
      throw new Error("Line diff report summary value mismatch");
    }
    assertFixtureStructure(summary, "summary");
    const expectedMetrics = fixtureMetrics.get(summary.fixtureId);
    if (
      !expectedMetrics ||
      summary.inputBytes !== expectedMetrics.inputBytes ||
      summary.leftLineCount !== expectedMetrics.leftLineCount ||
      summary.peakScratchEntries !== expectedMetrics.peakScratchEntries ||
      summary.rightLineCount !== expectedMetrics.rightLineCount ||
      summary.workUnits !== expectedMetrics.workUnits
    ) {
      throw new Error("Line diff report summary metric mismatch");
    }
    const durations = sampleDurations.get(summary.fixtureId);
    if (
      summary.durationMs.p50 !== percentile(durations, 0.5) ||
      summary.durationMs.p95 !== percentile(durations, 0.95)
    ) {
      throw new Error("Line diff report summary percentile mismatch");
    }
    summaryIds.add(summary.fixtureId);
  }

  const serialized = JSON.stringify(report);
  for (const privateField of [
    "source",
    "path",
    "basename",
    "hunk",
    "lineText",
    "repository",
    "url",
    "timestamp",
    "platform",
  ]) {
    if (serialized.includes(privateField)) {
      throw new Error("Line diff report contains a private field");
    }
  }
  return lineDiffProbeReportMode(report);
}

export function validateLineDiffProbeReport(report) {
  const mode = validateLineDiffProbeReportStructure(report);
  if (mode === "unknown") {
    throw new Error("Line diff report mode mismatch");
  }
  return mode;
}

function round(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function p95RegressionPercent(baseline, candidate) {
  return baseline === 0
    ? candidate === 0
      ? 0
      : Number.POSITIVE_INFINITY
    : round(((candidate - baseline) / baseline) * 100);
}

export function validateLineDiffProbeComparison(comparison) {
  assertExactKeys(
    comparison,
    [
      "baselineMode",
      "candidateMode",
      "comparisonId",
      "fixtures",
      "schemaVersion",
      "status",
      "violations",
    ],
    "comparison",
  );
  if (
    comparison.schemaVersion !== 2 ||
    !lineDiffProbeComparisonIds.includes(comparison.comparisonId) ||
    !new Set(["full-lcs", "common-edge-trim", "linear-memory", "unknown"]).has(
      comparison.baselineMode,
    ) ||
    !new Set(["full-lcs", "common-edge-trim", "linear-memory", "unknown"]).has(
      comparison.candidateMode,
    ) ||
    !new Set(["go", "no-go"]).has(comparison.status) ||
    !Array.isArray(comparison.fixtures) ||
    comparison.fixtures.length !== lineDiffProbeFixtureIds.length ||
    !Array.isArray(comparison.violations)
  ) {
    throw new Error("Line diff comparison metadata mismatch");
  }
  const allowedViolations =
    comparison.comparisonId === "imp417-linear-memory"
      ? new Set([
          "baseline-mode-mismatch",
          "candidate-mode-mismatch",
          "linear-scratch-bound-exceeded",
          "full-matrix-allocation-retained",
          "small-case-p95-regression",
        ])
      : new Set([
          "baseline-mode-mismatch",
          "candidate-mode-mismatch",
          "single-edit-work-not-reduced",
          "single-edit-scratch-not-reduced",
          "small-case-p95-regression",
        ]);
  if (
    comparison.violations.some((reason) => !allowedViolations.has(reason)) ||
    comparison.status !== (comparison.violations.length === 0 ? "go" : "no-go")
  ) {
    throw new Error("Line diff comparison violation mismatch");
  }
  const fixtureIds = new Set();
  for (const fixture of comparison.fixtures) {
    assertExactKeys(
      fixture,
      [
        "baselineP95Ms",
        "baselinePeakScratchEntries",
        "baselineWorkUnits",
        "candidateP95Ms",
        "candidatePeakScratchEntries",
        "candidateWorkUnits",
        "fixtureId",
        "p95RegressionPercent",
      ],
      "comparison fixture",
    );
    if (
      !lineDiffProbeFixtureIds.includes(fixture.fixtureId) ||
      fixtureIds.has(fixture.fixtureId) ||
      !Object.values(fixture)
        .filter((value) => typeof value === "number")
        .every(Number.isFinite)
    ) {
      throw new Error("Line diff comparison fixture mismatch");
    }
    fixtureIds.add(fixture.fixtureId);
  }
  const serialized = JSON.stringify(comparison);
  for (const privateField of [
    "source",
    "path",
    "basename",
    "hunk",
    "lineText",
    "repository",
    "url",
    "timestamp",
    "platform",
  ]) {
    if (serialized.includes(privateField)) {
      throw new Error("Line diff comparison contains a private field");
    }
  }
}

function inferLineDiffProbeComparisonId(
  requestedComparison,
  baselineMode,
  candidateMode,
) {
  if (requestedComparison) {
    if (!lineDiffProbeComparisonIds.includes(requestedComparison)) {
      throw new Error(`Unsupported comparison: ${requestedComparison}`);
    }
    return requestedComparison;
  }
  if (baselineMode === "full-lcs" || candidateMode === "common-edge-trim") {
    return "imp416-common-edge-trim";
  }
  if (
    baselineMode === "common-edge-trim" ||
    candidateMode === "linear-memory"
  ) {
    return "imp417-linear-memory";
  }
  throw new Error("Unable to infer line diff comparison");
}

export function buildLineDiffProbeComparison(
  baseline,
  candidate,
  requestedComparison = null,
) {
  const baselineMode = validateLineDiffProbeReportStructure(baseline);
  const candidateMode = validateLineDiffProbeReportStructure(candidate);
  const comparisonId = inferLineDiffProbeComparisonId(
    requestedComparison,
    baselineMode,
    candidateMode,
  );
  const baselineById = new Map(
    baseline.summaries.map((summary) => [summary.fixtureId, summary]),
  );
  const candidateById = new Map(
    candidate.summaries.map((summary) => [summary.fixtureId, summary]),
  );
  const fixtures = lineDiffProbeFixtureIds.map((fixtureId) => {
    const before = baselineById.get(fixtureId);
    const after = candidateById.get(fixtureId);
    return {
      baselineP95Ms: before.durationMs.p95,
      baselinePeakScratchEntries: before.peakScratchEntries,
      baselineWorkUnits: before.workUnits,
      candidateP95Ms: after.durationMs.p95,
      candidatePeakScratchEntries: after.peakScratchEntries,
      candidateWorkUnits: after.workUnits,
      fixtureId,
      p95RegressionPercent: p95RegressionPercent(
        before.durationMs.p95,
        after.durationMs.p95,
      ),
    };
  });
  const violations = [];
  if (comparisonId === "imp417-linear-memory") {
    if (baselineMode !== "common-edge-trim") {
      violations.push("baseline-mode-mismatch");
    }
    if (candidateMode !== "linear-memory") {
      violations.push("candidate-mode-mismatch");
    }
    if (
      fixtures.some((fixture) => {
        const lineCount = Number(fixture.fixtureId.split("-").at(-1));
        return fixture.candidatePeakScratchEntries > 2 * (lineCount + 1);
      })
    ) {
      violations.push("linear-scratch-bound-exceeded");
    }
    if (
      fixtures.some((fixture) => {
        const lineCount = Number(fixture.fixtureId.split("-").at(-1));
        return (
          fixture.candidatePeakScratchEntries >=
          (lineCount + 1) * (lineCount + 1)
        );
      })
    ) {
      violations.push("full-matrix-allocation-retained");
    }
  } else {
    if (baselineMode !== "full-lcs") violations.push("baseline-mode-mismatch");
    if (candidateMode !== "common-edge-trim") {
      violations.push("candidate-mode-mismatch");
    }
    const singleEdit5000 = fixtures.find(
      (fixture) => fixture.fixtureId === "single-edit-5000",
    );
    if (singleEdit5000.candidateWorkUnits >= singleEdit5000.baselineWorkUnits) {
      violations.push("single-edit-work-not-reduced");
    }
    if (
      singleEdit5000.candidatePeakScratchEntries >=
      singleEdit5000.baselinePeakScratchEntries
    ) {
      violations.push("single-edit-scratch-not-reduced");
    }
  }
  if (
    fixtures.some(
      (fixture) =>
        fixture.fixtureId.endsWith("-200") &&
        fixture.candidateP95Ms > fixture.baselineP95Ms * 1.1,
    )
  ) {
    violations.push("small-case-p95-regression");
  }
  const comparison = {
    baselineMode,
    candidateMode,
    comparisonId,
    fixtures,
    schemaVersion: 2,
    status: violations.length === 0 ? "go" : "no-go",
    violations,
  };
  validateLineDiffProbeComparison(comparison);
  return comparison;
}

async function main() {
  const args = parseLineDiffProbeArgs(process.argv.slice(2));
  if (args.comparison && !args.baseline) {
    throw new Error("--comparison requires --baseline");
  }
  const outputFile = path.resolve(args.out, "summary.json");
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await runReleaseProbe(outputFile);
  const report = JSON.parse(await fs.readFile(outputFile, "utf8"));
  if (args.baseline) {
    const baseline = JSON.parse(await fs.readFile(args.baseline, "utf8"));
    const comparison = buildLineDiffProbeComparison(
      baseline,
      report,
      args.comparison,
    );
    await fs.writeFile(
      path.resolve(args.out, "comparison.json"),
      `${JSON.stringify(comparison, null, 2)}\n`,
    );
    process.stdout.write(
      `Line diff comparison completed with status ${comparison.status}.\n`,
    );
  } else {
    validateLineDiffProbeReport(report);
  }
  process.stdout.write(
    `Line diff complexity probe passed: ${report.samples.length} samples across ${report.summaries.length} fixtures.\n`,
  );
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  await main();
}
