import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";

const repoRoot = process.cwd();
const artifactRoot = path.resolve(
  process.env.WINDOWS_SMOKE_ARTIFACT_ROOT ??
    path.join(".artifacts", "windows-smoke", timestampId()),
);
const logsRoot = path.join(artifactRoot, "logs");
const exePath = path.resolve(
  repoRoot,
  process.env.WINDOWS_EXE_PATH ??
    path.join(
      "src-tauri",
      "target",
      "x86_64-pc-windows-msvc",
      "release",
      "svard.exe",
    ),
);
const nsisRoot = path.resolve(
  repoRoot,
  process.env.WINDOWS_NSIS_ROOT ??
    path.join(
      "src-tauri",
      "target",
      "x86_64-pc-windows-msvc",
      "release",
      "bundle",
      "nsis",
    ),
);

const stepOutcomes = {
  install: process.env.WINDOWS_INSTALL_OUTCOME ?? "unknown",
  unit: process.env.WINDOWS_UNIT_OUTCOME ?? "unknown",
  tauriTest: process.env.WINDOWS_TAURI_TEST_OUTCOME ?? "unknown",
  playwrightInstall:
    process.env.WINDOWS_PLAYWRIGHT_INSTALL_OUTCOME ?? "unknown",
  plantumlLocal: process.env.WINDOWS_PLANTUML_OUTCOME ?? "unknown",
  build: process.env.WINDOWS_BUILD_OUTCOME ?? "unknown",
};

const cache = {
  rustCacheExactHit: process.env.RUST_CACHE_HIT === "true",
  rustCacheRaw: process.env.RUST_CACHE_HIT ?? "unknown",
  rustCacheSaveEnabled: process.env.RUST_CACHE_SAVE_ENABLED === "true",
  githubRef: process.env.CI_GITHUB_REF ?? process.env.GITHUB_REF ?? "unknown",
};

function timestampId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function directoryExists(directoryPath) {
  try {
    const stat = await fs.stat(directoryPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function hasFiles(directoryPath) {
  try {
    const entries = await fs.readdir(directoryPath);
    return entries.length > 0;
  } catch {
    return false;
  }
}

function runVersionCommand(command, args = []) {
  try {
    return execFileSync(command, args, {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    return `unavailable: ${error.message}`;
  }
}

function runShellVersionCommand(command) {
  try {
    return execFileSync(command, {
      cwd: repoRoot,
      encoding: "utf8",
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    return `unavailable: ${error.message}`;
  }
}

function runFirstVersionCommand(candidates) {
  for (const candidate of candidates) {
    const result =
      typeof candidate === "string"
        ? runShellVersionCommand(candidate)
        : runVersionCommand(candidate[0], candidate[1]);
    if (!result.startsWith("unavailable:")) {
      return result;
    }
  }
  const first = candidates[0];
  return typeof first === "string"
    ? runShellVersionCommand(first)
    : runVersionCommand(first[0], first[1]);
}

function pnpmVersionCandidates() {
  const candidates = [
    process.platform === "win32"
      ? 'cmd.exe /d /s /c "pnpm --version"'
      : "pnpm --version",
    ["pnpm", ["--version"]],
    ["pnpm.cmd", ["--version"]],
    ["corepack", ["pnpm", "--version"]],
    ["corepack.cmd", ["pnpm", "--version"]],
  ];
  if (process.env.PNPM_HOME) {
    candidates.unshift(
      [path.join(process.env.PNPM_HOME, "pnpm.cmd"), ["--version"]],
      [path.join(process.env.PNPM_HOME, "pnpm"), ["--version"]],
    );
  }
  return candidates;
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function readNumberIfExists(filePath) {
  const value = await readTextIfExists(filePath);
  if (value === null) {
    return null;
  }
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

async function collectDurations() {
  const tauriTestLog = await readTextIfExists(
    path.join(logsRoot, "tauri-test.log"),
  );
  const buildLog = await readTextIfExists(path.join(logsRoot, "build.log"));
  return {
    tauriTestCompile: extractFinishedDuration(tauriTestLog, "test"),
    releaseCompile: extractFinishedDuration(buildLog, "release"),
    tauriTestStepMs: await readNumberIfExists(
      path.join(artifactRoot, "tauri-test-duration-ms.txt"),
    ),
    buildStepMs: await readNumberIfExists(
      path.join(artifactRoot, "build-duration-ms.txt"),
    ),
  };
}

function extractFinishedDuration(logText, profile) {
  if (!logText) {
    return null;
  }
  const pattern = new RegExp(
    `Finished \`${profile}\` profile .* target\\(s\\) in ([^\\r\\n]+)`,
  );
  const match = logText.match(pattern);
  return match?.[1]?.trim() ?? null;
}

function durationTextToMs(value) {
  if (!value) {
    return null;
  }
  const normalized = value.trim();
  const minutesMatch = normalized.match(/(?:(\d+)m\s*)?([\d.]+)s/);
  if (minutesMatch) {
    const minutes = Number(minutesMatch[1] ?? 0);
    const seconds = Number(minutesMatch[2]);
    return Number.isFinite(minutes) && Number.isFinite(seconds)
      ? Math.round((minutes * 60 + seconds) * 1000)
      : null;
  }
  const secondsMatch = normalized.match(/^([\d.]+)s$/);
  if (secondsMatch) {
    const seconds = Number(secondsMatch[1]);
    return Number.isFinite(seconds) ? Math.round(seconds * 1000) : null;
  }
  return null;
}

function collectWarnings(durations) {
  const warnings = [];
  if (!cache.rustCacheExactHit) {
    warnings.push({
      id: "rust-cache-miss",
      message: "Rust cache exact hit was false for the Windows job.",
      details: { rustCacheRaw: cache.rustCacheRaw },
    });
  }
  if (
    typeof durations.buildStepMs === "number" &&
    durations.buildStepMs > 20 * 60 * 1000
  ) {
    warnings.push({
      id: "windows-build-step-over-20m",
      message: "Windows Tauri build step exceeded 20 minutes.",
      details: { buildStepMs: durations.buildStepMs },
    });
  }
  const releaseCompileMs = durationTextToMs(durations.releaseCompile);
  if (typeof releaseCompileMs === "number" && releaseCompileMs > 10 * 60 * 1000) {
    warnings.push({
      id: "windows-release-compile-over-10m",
      message: "Windows release compile exceeded 10 minutes.",
      details: {
        releaseCompile: durations.releaseCompile,
        releaseCompileMs,
      },
    });
  }
  return warnings;
}

async function collectBundleTree(directoryPath) {
  const lines = [];

  async function visit(currentPath, prefix = "") {
    let entries;
    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        lines.push(`${prefix}${entry.name}/`);
        await visit(entryPath, `${prefix}  `);
        continue;
      }
      const stat = await fs.stat(entryPath);
      lines.push(`${prefix}${entry.name} (${stat.size} bytes)`);
    }
  }

  await visit(directoryPath);
  return lines.join("\n");
}

function check(id, passed, details = {}) {
  return {
    id,
    status: passed ? "passed" : "failed",
    details,
  };
}

function outcomeCheck(id, outcome) {
  return check(id, outcome === "success", { outcome });
}

async function launchExecutableSmoke() {
  if (!(await fileExists(exePath))) {
    return check("launch-smoke", false, {
      reason: "svard.exe is missing",
      exePath,
    });
  }

  const child = spawn(exePath, [], {
    cwd: path.dirname(exePath),
    detached: false,
    stdio: "ignore",
    windowsHide: true,
  });

  let exitCode = null;
  let signal = null;
  let spawnError = null;
  child.once("exit", (code, childSignal) => {
    exitCode = code;
    signal = childSignal;
  });
  child.once("error", (error) => {
    spawnError = error;
  });

  await new Promise((resolve) => setTimeout(resolve, 5000));
  const stillRunning = spawnError === null && exitCode === null && signal === null;
  if (stillRunning) {
    child.kill();
  }

  return check("launch-smoke", stillRunning, {
    exePath,
    pid: child.pid,
    exitCode,
    signal,
    spawnError: spawnError?.message ?? null,
  });
}

async function main() {
  await fs.mkdir(logsRoot, { recursive: true });

  const packageJson = JSON.parse(
    await fs.readFile(path.join(repoRoot, "package.json"), "utf8"),
  );
  const versions = {
    os: `${process.platform} ${process.arch}`,
    node: process.version,
    pnpm: runFirstVersionCommand(pnpmVersionCandidates()),
    rustc: runVersionCommand("rustc", ["--version"]),
    cargo: runVersionCommand("cargo", ["--version"]),
    appVersion: packageJson.version,
    commitSha: process.env.GITHUB_SHA ?? "unknown",
    runId: process.env.GITHUB_RUN_ID ?? "local",
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? "local",
  };

  const nsisExists = await directoryExists(nsisRoot);
  const nsisHasFiles = nsisExists && (await hasFiles(nsisRoot));
  const bundleTree = [
    `svard.exe: ${(await fileExists(exePath)) ? exePath : "missing"}`,
    "",
    `nsis: ${nsisRoot}`,
    "",
    await collectBundleTree(nsisRoot),
  ].join("\n");
  await fs.writeFile(
    path.join(artifactRoot, "versions.txt"),
    Object.entries(versions)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\n") + "\n",
  );
  await fs.writeFile(path.join(artifactRoot, "bundle-tree.txt"), bundleTree);
  const durations = await collectDurations();
  const warnings = collectWarnings(durations);

  const checks = [
    outcomeCheck("install-dependencies", stepOutcomes.install),
    outcomeCheck("local-image-unit-regression", stepOutcomes.unit),
    outcomeCheck("tauri-rust-tests", stepOutcomes.tauriTest),
    outcomeCheck("playwright-browser-install", stepOutcomes.playwrightInstall),
    outcomeCheck("plantuml-fixture-suite", stepOutcomes.plantumlLocal),
    outcomeCheck("tauri-build", stepOutcomes.build),
    check("executable-exists", await fileExists(exePath), { exePath }),
    check("nsis-bundle-exists", nsisHasFiles, { nsisRoot }),
    await launchExecutableSmoke(),
  ];
  const outcome = checks.every((item) => item.status === "passed")
    ? "passed"
    : "failed";
  const report = {
    schemaVersion: 1,
    outcome,
    artifactRoot,
    generatedAt: new Date().toISOString(),
    versions,
    stepOutcomes,
    cache,
    durations,
    warnings,
    checks,
    failureClassification: classifyFailure(checks),
  };

  await fs.writeFile(
    path.join(artifactRoot, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
}

function classifyFailure(checks) {
  const failed = new Set(
    checks.filter((item) => item.status !== "passed").map((item) => item.id),
  );
  if (failed.size === 0) {
    return "none";
  }
  if (
    failed.has("install-dependencies") ||
    failed.has("playwright-browser-install")
  ) {
    return "windows runner failure";
  }
  if (
    failed.has("local-image-unit-regression") ||
    failed.has("tauri-rust-tests") ||
    failed.has("plantuml-fixture-suite")
  ) {
    return "test failure";
  }
  if (
    failed.has("tauri-build") ||
    failed.has("executable-exists") ||
    failed.has("nsis-bundle-exists")
  ) {
    return "bundle failure";
  }
  if (failed.has("launch-smoke")) {
    return "launch smoke failure";
  }
  return "artifact missing";
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
