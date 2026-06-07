import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const platform = process.env.DESKTOP_PLATFORM ?? "unknown";
const artifactRoot = path.resolve(
  repoRoot,
  process.env.DESKTOP_BUILD_REPORT_ROOT ??
    path.join(".artifacts", "desktop-build", platform),
);
const smokeRoot = path.resolve(
  repoRoot,
  process.env.DESKTOP_SMOKE_ARTIFACT_ROOT ??
    (platform === "windows-x86_64"
      ? (process.env.WINDOWS_SMOKE_ARTIFACT_ROOT ??
        path.join(".artifacts", "windows-smoke", "local"))
      : (process.env.MACOS_SMOKE_ARTIFACT_ROOT ??
        path.join(".artifacts", "macos-smoke", "local"))),
);
const logsRoot = path.join(smokeRoot, "logs");
const releaseRoot = path.resolve(
  repoRoot,
  process.env.RELEASE_ROOT ?? path.join(".artifacts", "release"),
);
const manifestPath = path.join(releaseRoot, platform, "manifest.json");

const cache = {
  rustCacheExactHit: process.env.RUST_CACHE_HIT === "true",
  rustCacheRaw: process.env.RUST_CACHE_HIT ?? "unknown",
  rustCacheSaveEnabled: process.env.RUST_CACHE_SAVE_ENABLED === "true",
  githubRef: process.env.CI_GITHUB_REF ?? process.env.GITHUB_REF ?? "unknown",
};

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function readJsonIfExists(filePath) {
  const text = await readTextIfExists(filePath);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readNumberIfExists(filePath) {
  const value = await readTextIfExists(filePath);
  if (value === null) return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function extractFinishedDuration(logText, profile) {
  if (!logText) return null;
  const pattern = new RegExp(
    `Finished \`${profile}\` profile .* target\\(s\\) in ([^\\r\\n]+)`,
  );
  const match = logText.match(pattern);
  return match?.[1]?.trim() ?? null;
}

function durationTextToMs(value) {
  if (!value) return null;
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

async function collectDurations() {
  const buildLog = await readTextIfExists(path.join(logsRoot, "build.log"));
  return {
    buildStepMs: await readNumberIfExists(
      path.join(smokeRoot, "build-duration-ms.txt"),
    ),
    releaseCompile: extractFinishedDuration(buildLog, "release"),
  };
}

function collectWarnings(durations, manifestExists) {
  const warnings = [];
  if (!cache.rustCacheExactHit) {
    warnings.push({
      id: "rust-cache-miss",
      message: "Rust cache exact hit was false for the desktop build job.",
      details: { rustCacheRaw: cache.rustCacheRaw },
    });
  }
  const releaseCompileMs = durationTextToMs(durations.releaseCompile);
  if (
    platform === "windows-x86_64" &&
    typeof durations.buildStepMs === "number" &&
    durations.buildStepMs > 20 * 60 * 1000
  ) {
    warnings.push({
      id: "windows-build-step-over-20m",
      message: "Windows Tauri build step exceeded 20 minutes.",
      details: { buildStepMs: durations.buildStepMs },
    });
  }
  if (
    platform === "windows-x86_64" &&
    typeof releaseCompileMs === "number" &&
    releaseCompileMs > 10 * 60 * 1000
  ) {
    warnings.push({
      id: "windows-release-compile-over-10m",
      message: "Windows release compile exceeded 10 minutes.",
      details: {
        releaseCompile: durations.releaseCompile,
        releaseCompileMs,
      },
    });
  }
  if (!manifestExists) {
    warnings.push({
      id: "release-manifest-missing",
      message: "Release asset manifest was not found for this build report.",
      details: { manifestPath },
    });
  }
  return warnings;
}

async function main() {
  await fs.mkdir(artifactRoot, { recursive: true });
  const durations = await collectDurations();
  const manifest = await readJsonIfExists(manifestPath);
  const manifestExists = manifest !== null;
  const report = {
    schemaVersion: 1,
    platform,
    artifactVersion: process.env.DESKTOP_ARTIFACT_VERSION ?? "unknown",
    generatedAt: new Date().toISOString(),
    outcomes: {
      build: process.env.DESKTOP_BUILD_OUTCOME ?? "unknown",
      releaseAsset: process.env.DESKTOP_RELEASE_ASSET_OUTCOME ?? "unknown",
    },
    cache,
    durations,
    releaseManifest: {
      exists: manifestExists,
      path: manifestPath,
      manifest,
    },
    warnings: collectWarnings(durations, manifestExists),
  };
  await fs.writeFile(
    path.join(artifactRoot, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
