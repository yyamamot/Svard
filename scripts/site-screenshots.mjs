import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultManifestPath = path.join(repoRoot, "site", "screenshot-manifest.json");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function timestampId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function parseArgs(argv) {
  const args = { manifest: defaultManifestPath, only: null, force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--manifest") {
      args.manifest = path.resolve(argv[++index] ?? args.manifest);
    } else if (value === "--only") {
      args.only = argv[++index] ?? null;
    } else if (value === "--force") {
      args.force = true;
    }
  }
  return args;
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

async function ensureDir(directory) {
  await fs.mkdir(directory, { recursive: true });
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: options.env ?? process.env,
      stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      const result = { code: code ?? 1, signal, stdout, stderr };
      if (result.code === 0 || options.allowFailure) {
        resolve(result);
      } else {
        const error = new Error(`${command} ${args.join(" ")} failed with exit code ${result.code}`);
        error.result = result;
        reject(error);
      }
    });
  });
}

function launchTauri({ capture, fixturePath, profileDir, logFile }) {
  const env = {
    ...process.env,
    XDG_CONFIG_HOME: path.join(profileDir, "config"),
    XDG_CACHE_HOME: path.join(profileDir, "cache"),
    XDG_DATA_HOME: path.join(profileDir, "data"),
    SVARD_SITE_SCREENSHOT: "1",
    SVARD_SITE_SCREENSHOT_SCENARIO: capture.scenario,
    SVARD_SITE_SCREENSHOT_FIXTURE: fixturePath,
    VITE_SVARD_SITE_SCREENSHOT_SCENARIO: capture.scenario,
    VITE_SVARD_SITE_SCREENSHOT_FIXTURE: fixturePath,
  };
  const child = spawn("pnpm", ["exec", "tauri", "dev"], {
    cwd: repoRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const chunks = [];
  child.stdout.on("data", (chunk) => chunks.push(chunk.toString()));
  child.stderr.on("data", (chunk) => chunks.push(chunk.toString()));
  child.on("close", async (code, signal) => {
    chunks.push(`\n[site-screenshots] process closed code=${code} signal=${signal}\n`);
    await fs.writeFile(logFile, chunks.join("")).catch(() => undefined);
  });
  return {
    child,
    flush: () => fs.writeFile(logFile, chunks.join("")),
  };
}

async function stopTauri(app) {
  if (!app?.child || app.child.exitCode !== null) {
    await cleanupDevProcesses();
    return;
  }
  app.child.kill("SIGINT");
  await Promise.race([
    new Promise((resolve) => app.child.once("close", resolve)),
    delay(5000).then(() => {
      if (app.child.exitCode === null) {
        app.child.kill("SIGTERM");
      }
    }),
  ]);
  await cleanupDevProcesses();
}

async function cleanupDevProcesses() {
  const result = await run("ps", ["-axo", "pid=,command="], { allowFailure: true });
  const targets = result.stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\d+)\s+(.+)$/);
      return match ? { pid: Number(match[1]), command: match[2] } : null;
    })
    .filter(Boolean)
    .filter(({ pid, command }) => {
      if (pid === process.pid) return false;
      return (
        command.includes("vite --host 127.0.0.1 --strictPort") ||
        command.includes("vite.js --host 127.0.0.1 --strictPort") ||
        command.includes("target/debug/svard") ||
        command.includes("/Applications/Svard.app/Contents/MacOS/svard") ||
        command.includes("pnpm run dev:web")
      );
    });
  for (const target of targets) {
    try {
      process.kill(target.pid, "SIGTERM");
    } catch {
      // Process may have already exited.
    }
  }
  if (targets.length > 0) {
    await delay(1000);
  }
  for (const target of targets) {
    try {
      process.kill(target.pid, 0);
      process.kill(target.pid, "SIGKILL");
    } catch {
      // Process exited after SIGTERM.
    }
  }
}

async function listWindows() {
  const swift = `
import CoreGraphics
let options: CGWindowListOption = [.optionOnScreenOnly, .excludeDesktopElements]
let windows = CGWindowListCopyWindowInfo(options, kCGNullWindowID) as? [[String: Any]] ?? []
for window in windows {
  let id = window[kCGWindowNumber as String] as? UInt32 ?? 0
  let owner = window[kCGWindowOwnerName as String] as? String ?? ""
  let title = window[kCGWindowName as String] as? String ?? ""
  let layer = window[kCGWindowLayer as String] as? Int ?? -1
  let bounds = window[kCGWindowBounds as String] as? [String: Any] ?? [:]
  let width = bounds["Width"] as? Double ?? 0
  let height = bounds["Height"] as? Double ?? 0
  print("\\(id)\\t\\(layer)\\t\\(Int(width))\\t\\(Int(height))\\t\\(owner)\\t\\(title)")
}`;
  const tempDir = await fs.mkdtemp(path.join("/tmp", "svard-site-window-"));
  const swiftPath = path.join(tempDir, "list-windows.swift");
  await fs.writeFile(swiftPath, swift);
  try {
    const result = await run("swift", [swiftPath]);
    return result.stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [id, layer, width, height, owner, title] = line.split("\t");
        return { id: Number(id), layer: Number(layer), width: Number(width), height: Number(height), owner, title };
      });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function findWindow(windowConfig, attempts = 80) {
  const appName = windowConfig.appName ?? "Svard";
  const title = windowConfig.title ?? "Svard";
  const blockedOwners = new Set([
    "Brave Browser",
    "Google Chrome",
    "Chromium",
    "Safari",
    "Firefox",
    "Arc",
  ]);
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const windows = await listWindows();
    const candidate = windows.find(
      (window) => {
        if (window.layer !== 0 || window.width < 800 || window.height < 500) {
          return false;
        }
        if (blockedOwners.has(window.owner)) {
          return false;
        }
        return (
          window.owner.toLowerCase() === appName.toLowerCase() ||
          window.title.includes(title)
        );
      },
    );
    if (candidate) return candidate;
    await delay(250);
  }
  throw new Error(`Could not find native window for ${appName}.`);
}

async function findWindowId(windowConfig, attempts = 80) {
  return (await findWindow(windowConfig, attempts)).id;
}

async function waitForWindow(app, windowConfig, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (app.child.exitCode !== null) {
      throw new Error(`Tauri exited before window was ready: code=${app.child.exitCode}`);
    }
    const window = await findWindow(windowConfig, 1).catch(() => null);
    if (window !== null) return window;
    await delay(250);
  }
  throw new Error("Timed out waiting for Svard native window.");
}

async function setWindowBounds(windowConfig) {
  const appName = windowConfig.appName ?? "Svard";
  const x = windowConfig.x ?? 60;
  const y = windowConfig.y ?? 48;
  const width = windowConfig.width ?? 1440;
  const height = windowConfig.height ?? 960;
  const script = `
tell application "System Events"
  if exists process "${appName}" then
    tell process "${appName}"
      if exists window 1 then
        set position of window 1 to {${x}, ${y}}
        set size of window 1 to {${width}, ${height}}
      end if
    end tell
  end if
end tell`;
  const result = await run("osascript", ["-e", script], { allowFailure: true });
  return result.code === 0 ? null : result.stderr.trim() || result.stdout.trim() || "Failed to resize native window.";
}

async function captureWindow(windowId, outputPath) {
  await ensureDir(path.dirname(outputPath));
  await run("screencapture", ["-x", "-l", String(windowId), outputPath]);
}

async function prepareFixtureCopies({ capture, fixtureRoot, fixturePath }) {
  const copies = [];
  if (capture.fixtureSource) {
    copies.push({ source: capture.fixtureSource, target: capture.fixture });
  }
  for (const copy of capture.extraFixtureSources ?? []) {
    copies.push(copy);
  }

  for (const copy of copies) {
    const sourcePath = path.resolve(fixtureRoot, copy.source);
    const targetPath = path.resolve(fixtureRoot, copy.target);
    await ensureDir(path.dirname(targetPath));
    await fs.copyFile(sourcePath, targetPath);
  }

  await fs.access(fixturePath);
}

async function prepareGitStatusWorkspace({ artifactRoot, id }) {
  const workspaceRoot = path.join(
    artifactRoot,
    "fixtures",
    "source-control-workspace",
  );
  const fixturePath = path.join(workspaceRoot, "source-control.md");
  const filesFixturePath = path.join(workspaceRoot, "files.md");
  const addedPath = path.join(workspaceRoot, "release-notes.md");

  await fs.rm(workspaceRoot, { recursive: true, force: true });
  await ensureDir(workspaceRoot);
  await fs.writeFile(
    fixturePath,
    `# Source Control Fixture

This file is intended for public screenshots of the Source Control view.

## Git changes

Svard presents Git changes alongside rendered document context.

## Merge target review

GitHub and GitLab merge-target comparisons are treated as reader-facing review inputs.
`,
  );
  await fs.writeFile(
    path.join(workspaceRoot, "README.md"),
    `# Screenshot Workspace

This public-safe workspace is generated for static site screenshots.
`,
  );
  await fs.writeFile(
    filesFixturePath,
    `# Files Fixture

This document is opened for public screenshots of the Files tree.

## Local folder

Svard opens local folders and lets readers choose markup documents from the tree.

## Git status

The tree can show changed documents without opening Source Control first.
`,
  );
  await run("git", ["init"], { cwd: workspaceRoot });
  await run("git", ["add", "."], { cwd: workspaceRoot });
  await run(
    "git",
    [
      "-c",
      "user.name=Svard Screenshot",
      "-c",
      "user.email=svard-screenshot@example.invalid",
      "commit",
      "-m",
      "Initial screenshot fixture",
    ],
    { cwd: workspaceRoot },
  );
  await fs.appendFile(
    fixturePath,
    `
## Working tree review

The Source Control view shows changed markup files before opening a rendered diff.
`,
  );
  await fs.writeFile(
    addedPath,
    `# Release Notes

This added document appears in Source Control as a public-safe working tree change.
`,
  );

  return id === "files" ? filesFixturePath : fixturePath;
}

async function captureOne({ manifest, capture, artifactRoot }) {
  const fixtureRoot = path.resolve(repoRoot, manifest.fixtureRoot);
  let fixturePath = path.resolve(fixtureRoot, capture.fixture);
  const outputPath = path.resolve(repoRoot, manifest.outputDir, capture.output);
  const profileDir = path.join(artifactRoot, "profiles", capture.id);
  const logFile = path.join(artifactRoot, "logs", `${capture.id}.log`);
  const startedAt = Date.now();
  let app = null;
  try {
    await cleanupDevProcesses();
    await ensureDir(profileDir);
    await ensureDir(path.dirname(logFile));
    if (capture.id === "source-control" || capture.id === "files") {
      fixturePath = await prepareGitStatusWorkspace({
        artifactRoot,
        id: capture.id,
      });
    }
    await prepareFixtureCopies({ capture, fixtureRoot, fixturePath });
    app = launchTauri({ capture, fixturePath, profileDir, logFile });
    const windowConfig = capture.window ?? manifest.window ?? {};
    let windowInfo = await waitForWindow(app, windowConfig, capture.timeoutMs ?? 30000);
    const resizeWarning = await setWindowBounds(windowConfig);
    if (!resizeWarning) {
      await delay(500);
      windowInfo = await findWindow(windowConfig, 1).catch(() => windowInfo);
    }
    await delay(capture.settleMs ?? 2500);
    await captureWindow(windowInfo.id, outputPath);
    await app.flush();
    return {
      id: capture.id,
      scenario: capture.scenario,
      outcome: "passed",
      outputPath,
      fixturePath,
      windowId: windowInfo.id,
      windowOwner: windowInfo.owner,
      windowTitle: windowInfo.title,
      windowSize: {
        width: windowInfo.width,
        height: windowInfo.height,
      },
      warnings: resizeWarning ? [resizeWarning] : [],
      durationMs: Date.now() - startedAt,
      captureMethod: "macos-screencapture-window-id",
      description: capture.description ?? null,
    };
  } catch (error) {
    await app?.flush?.();
    return {
      id: capture.id,
      scenario: capture.scenario,
      outcome: "failed",
      outputPath,
      fixturePath,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      captureMethod: "macos-screencapture-window-id",
      description: capture.description ?? null,
    };
  } finally {
    if (!capture.keepApp) {
      await stopTauri(app);
    }
  }
}

async function skippedExistingResult({ manifest, capture }) {
  const fixtureRoot = path.resolve(repoRoot, manifest.fixtureRoot);
  const fixturePath = path.resolve(fixtureRoot, capture.fixture);
  const outputPath = path.resolve(repoRoot, manifest.outputDir, capture.output);
  const stat = await fs.stat(outputPath);
  return {
    id: capture.id,
    scenario: capture.scenario,
    outcome: "skipped",
    reason: "output-exists",
    outputPath,
    fixturePath,
    outputSizeBytes: stat.size,
    captureMethod: "macos-screencapture-window-id",
    description: capture.description ?? null,
  };
}

async function main() {
  if (process.platform !== "darwin") {
    throw new Error("site screenshot capture is currently supported only on macOS.");
  }
  const args = parseArgs(process.argv.slice(2));
  const manifest = await readJson(args.manifest);
  const captures = args.only
    ? manifest.captures.filter((capture) => capture.id === args.only)
    : manifest.captures;
  if (captures.length === 0) {
    throw new Error(`No screenshot capture matched: ${args.only}`);
  }
  const artifactRoot = path.resolve(repoRoot, ".artifacts", "site-screenshots", `site-screenshots-${timestampId()}`);
  await ensureDir(path.join(artifactRoot, "logs"));
  await ensureDir(path.resolve(repoRoot, manifest.outputDir));

  const results = [];
  for (const capture of captures) {
    const outputPath = path.resolve(repoRoot, manifest.outputDir, capture.output);
    if (!args.force) {
      try {
        await fs.access(outputPath);
        results.push(await skippedExistingResult({ manifest, capture }));
        continue;
      } catch {
        // Missing outputs are captured below.
      }
    }
    results.push(await captureOne({ manifest, capture, artifactRoot }));
  }

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    manifestPath: args.manifest,
    artifactRoot,
    outcome: results.every((result) => result.outcome === "passed" || result.outcome === "skipped")
      ? "passed"
      : "failed",
    window: manifest.window,
    results,
  };
  await fs.writeFile(path.join(artifactRoot, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ outcome: report.outcome, artifactRoot }, null, 2));
  if (report.outcome !== "passed") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
