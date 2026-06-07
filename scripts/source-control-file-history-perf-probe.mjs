import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const defaultBudgets = {
  initialReturnedCommits: 20,
  headPlusOneIncrementalWalkedCommits: 2,
  sameHeadCacheHitDurationMs: 20,
};

const phaseNames = {
  headPlusOneIncremental: "headPlusOneIncremental",
  initialLimit: "initialLimit",
  rewriteFallback: "rewriteFallback",
  sameHeadCacheHit: "sameHeadCacheHit",
  untrackedNoCacheFirst: "untrackedNoCacheFirst",
  untrackedNoCacheSecond: "untrackedNoCacheSecond",
};

function parseArgs(argv) {
  const args = {
    budget: false,
    out: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--out") {
      args.out = argv[++index] ?? null;
    } else if (value === "--budget") {
      args.budget = true;
    } else if (value === "--") {
      continue;
    }
  }
  return args;
}

function runRustProbe() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "cargo",
      [
        "run",
        "--quiet",
        "--manifest-path",
        "src-tauri/Cargo.toml",
        "--bin",
        "file_history_perf_probe",
      ],
      {
        cwd: process.cwd(),
        shell: process.platform === "win32",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
        return;
      }
      reject(new Error(stderr || `file history perf probe failed: ${code}`));
    });
  });
}

function phaseMap(report) {
  return Object.fromEntries(report.phases.map((phase) => [phase.phase, phase]));
}

function phaseValue(phases, phaseName, field) {
  const phase = phases[phaseName] ?? null;
  if (field === "itemCount") {
    return phase?.itemCount ?? null;
  }
  const metric = field.replace(/^metrics\./, "");
  return phase?.metrics?.[metric] ?? null;
}

function budgetResult({ actual, expected, label, metric, passed }) {
  return {
    label,
    metric,
    actual,
    expected,
    passed,
  };
}

function equals(phases, { expected, field, label, phaseName }) {
  const actual = phaseValue(phases, phaseName, field);
  return budgetResult({
    label,
    metric: `${phaseName}.${field.replace(/^metrics\./, "")}`,
    actual,
    expected,
    passed: actual === expected,
  });
}

function atMost(phases, { field, label, limit, phaseName }) {
  const actual = phaseValue(phases, phaseName, field);
  return budgetResult({
    label,
    metric: `${phaseName}.${field.replace(/^metrics\./, "")}`,
    actual,
    expected: `<=${limit}`,
    passed: typeof actual === "number" && actual <= limit,
  });
}

function greaterThan(phases, { field, label, limit, phaseName }) {
  const actual = phaseValue(phases, phaseName, field);
  return budgetResult({
    label,
    metric: `${phaseName}.${field.replace(/^metrics\./, "")}`,
    actual,
    expected: `>${limit}`,
    passed: typeof actual === "number" && actual > limit,
  });
}

function deriveBudgetSummary(report, budgets = defaultBudgets) {
  const phases = phaseMap(report);
  const budgetResults = [
    atMost(phases, {
      label: "initial File History request stays small",
      phaseName: phaseNames.initialLimit,
      field: "itemCount",
      limit: budgets.initialReturnedCommits,
    }),
    atMost(phases, {
      label: "initial backend returned commits stay small",
      phaseName: phaseNames.initialLimit,
      field: "metrics.returnedCommits",
      limit: budgets.initialReturnedCommits,
    }),
    equals(phases, {
      label: "same head uses backend cache",
      phaseName: phaseNames.sameHeadCacheHit,
      field: "metrics.cacheStatus",
      expected: "hit",
    }),
    equals(phases, {
      label: "same head avoids history walk",
      phaseName: phaseNames.sameHeadCacheHit,
      field: "metrics.walkedCommits",
      expected: 0,
    }),
    atMost(phases, {
      label: "same head cache hit remains cheap",
      phaseName: phaseNames.sameHeadCacheHit,
      field: "metrics.durationMs",
      limit: budgets.sameHeadCacheHitDurationMs,
    }),
    equals(phases, {
      label: "head plus one uses incremental refresh",
      phaseName: phaseNames.headPlusOneIncremental,
      field: "metrics.cacheStatus",
      expected: "incremental",
    }),
    atMost(phases, {
      label: "head plus one walks only the new range",
      phaseName: phaseNames.headPlusOneIncremental,
      field: "metrics.walkedCommits",
      limit: budgets.headPlusOneIncrementalWalkedCommits,
    }),
    equals(phases, {
      label: "rewrite falls back to full scan",
      phaseName: phaseNames.rewriteFallback,
      field: "metrics.cacheStatus",
      expected: "fallback",
    }),
    greaterThan(phases, {
      label: "rewrite fallback returns history",
      phaseName: phaseNames.rewriteFallback,
      field: "itemCount",
      limit: 0,
    }),
    equals(phases, {
      label: "untracked first request is not cached",
      phaseName: phaseNames.untrackedNoCacheFirst,
      field: "metrics.cacheStatus",
      expected: "miss",
    }),
    equals(phases, {
      label: "untracked second request is not cached",
      phaseName: phaseNames.untrackedNoCacheSecond,
      field: "metrics.cacheStatus",
      expected: "miss",
    }),
  ];
  return {
    budgetPassed: budgetResults.every((result) => result.passed),
    budgetResults,
    budgets,
  };
}

async function writeReport(out, report) {
  if (!out) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  const outputPath = path.resolve(process.cwd(), out);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(outputPath);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const probeOutput = await runRustProbe();
  const probeReport = JSON.parse(probeOutput);
  const budgetSummary = args.budget ? deriveBudgetSummary(probeReport) : {};
  const report = {
    ...probeReport,
    ...budgetSummary,
  };
  await writeReport(args.out, report);
  if (args.budget && !report.budgetPassed) {
    process.exitCode = 1;
  }
}

await main();
