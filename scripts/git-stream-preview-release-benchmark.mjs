import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

const allowedStrings = new Set([
  "formal",
  "confirmation",
  "branch",
  "commit",
  "branch-14x12-mixed",
  "commit-14x12-mixed",
  "single-vs-batch-two-release",
  "go",
  "no-go",
]);

export function parseGitStreamPreviewBenchmarkArgs(argv) {
  const args = {
    confirmation: null,
    out: ".artifacts/perf/imp-448-git-stream-preview-formal.json",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--") continue;
    if (value === "--confirmation") {
      args.confirmation = argv[++index] ?? null;
    } else if (value === "--out") {
      args.out = argv[++index] ?? args.out;
    } else {
      throw new Error(`Unknown argument: ${value}`);
    }
  }
  return args;
}

function collectStrings(value, output) {
  if (typeof value === "string") output.add(value);
  else if (Array.isArray(value))
    value.forEach((item) => collectStrings(item, output));
  else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, output));
  }
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

export function assertGitStreamPreviewArtifactSafe(report) {
  if (
    report.schemaVersion !== 1 ||
    !["formal", "confirmation"].includes(report.runMode) ||
    report.warmupCount !== 1 ||
    report.measurementCount !== 15 ||
    report.documentCount !== 14 ||
    report.batchSize !== 2 ||
    !Array.isArray(report.routes) ||
    report.routes.length !== 2
  ) {
    throw new Error("Git stream preview report metadata mismatch");
  }
  const strings = new Set();
  collectStrings(report, strings);
  if ([...strings].some((value) => !allowedStrings.has(value))) {
    throw new Error("Git stream preview report contains private text");
  }
  for (const route of report.routes) {
    if (
      !["branch", "commit"].includes(route.route) ||
      !["go", "no-go"].includes(route.verdict) ||
      !Array.isArray(route.samples) ||
      route.samples.length !== 15 ||
      route.summary.passed !== (route.verdict === "go")
    ) {
      throw new Error("Git stream preview route schema mismatch");
    }
    for (const sample of route.samples) {
      if (
        !Object.values(sample).every(
          (value) => typeof value === "boolean" || finite(value),
        )
      ) {
        throw new Error("Git stream preview sample contains an invalid value");
      }
    }
  }
  return report;
}

function runProbe(outputPath, runMode) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "cargo",
      [
        "test",
        "--release",
        "--manifest-path",
        "src-tauri/Cargo.toml",
        "--lib",
        "git_diff::tests_git_stream_preview_release_probe::git_stream_preview_release_probe_writes_report",
        "--",
        "--exact",
        "--nocapture",
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          SVARD_GIT_STREAM_PREVIEW_REPORT: outputPath,
          SVARD_GIT_STREAM_PREVIEW_RUN_MODE: runMode,
        },
        shell: process.platform === "win32",
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    child.stdout.on("data", (chunk) => process.stderr.write(chunk));
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else
        reject(new Error(`Git stream preview release probe failed (${code})`));
    });
  });
}

async function main() {
  const args = parseGitStreamPreviewBenchmarkArgs(process.argv.slice(2));
  const runMode = args.confirmation ? "confirmation" : "formal";
  const outputPath = path.resolve(args.out);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await runProbe(outputPath, runMode);
  const report = assertGitStreamPreviewArtifactSafe(
    JSON.parse(await fs.readFile(outputPath, "utf8")),
  );
  if (args.confirmation) {
    const formal = assertGitStreamPreviewArtifactSafe(
      JSON.parse(await fs.readFile(args.confirmation, "utf8")),
    );
    const formalByRoute = new Map(
      formal.routes.map((route) => [route.route, route.verdict]),
    );
    report.confirmedRoutes = report.routes
      .filter(
        (route) =>
          route.verdict === "go" && formalByRoute.get(route.route) === "go",
      )
      .map((route) => route.route);
    assertGitStreamPreviewArtifactSafe(report);
    await fs.writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  process.stdout.write(
    `${runMode}: ${report.routes.map((route) => `${route.route}=${route.verdict}`).join(", ")}\n`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
