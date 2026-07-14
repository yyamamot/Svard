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

export function parseLineDiffProbeArgs(argv) {
  const args = { out: ".artifacts/perf/imp-415-before" };
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

function assertFixtureMetrics(value, label) {
  const lineCount = Number(value.fixtureId.split("-").at(-1));
  if (
    !Number.isSafeInteger(value.inputBytes) ||
    value.inputBytes <= 0 ||
    value.leftLineCount !== lineCount ||
    value.rightLineCount !== lineCount ||
    value.workUnits !== lineCount * lineCount ||
    value.peakScratchEntries !== (lineCount + 1) * (lineCount + 1)
  ) {
    throw new Error(`${label} metric mismatch`);
  }
}

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.ceil(ratio * sorted.length);
  return sorted[Math.max(0, rank - 1)];
}

export function validateLineDiffProbeReport(report) {
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
    assertFixtureMetrics(sample, "sample");
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
    assertFixtureMetrics(summary, "summary");
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
}

async function main() {
  const args = parseLineDiffProbeArgs(process.argv.slice(2));
  const outputFile = path.resolve(args.out, "summary.json");
  await fs.mkdir(path.dirname(outputFile), { recursive: true });
  await runReleaseProbe(outputFile);
  const report = JSON.parse(await fs.readFile(outputFile, "utf8"));
  validateLineDiffProbeReport(report);
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
