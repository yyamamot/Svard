import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { delay, ensureDir, repoRoot, run } from "./common.mjs";

export function launchTauri({ capture, fixturePath, profileDir, logFile }) {
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
    chunks.push(
      `\n[site-screenshots] process closed code=${code} signal=${signal}\n`,
    );
    await fs.writeFile(logFile, chunks.join("")).catch(() => undefined);
  });
  return {
    child,
    flush: () => fs.writeFile(logFile, chunks.join("")),
  };
}

export async function stopTauri(app) {
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

export async function cleanupDevProcesses() {
  const result = await run("ps", ["-axo", "pid=,command="], {
    allowFailure: true,
  });
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
        return {
          id: Number(id),
          layer: Number(layer),
          width: Number(width),
          height: Number(height),
          owner,
          title,
        };
      });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

export async function findWindow(windowConfig, attempts = 80) {
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
    const candidate = windows.find((window) => {
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
    });
    if (candidate) return candidate;
    await delay(250);
  }
  throw new Error(`Could not find native window for ${appName}.`);
}

export async function waitForWindow(app, windowConfig, timeoutMs = 30000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (app.child.exitCode !== null) {
      throw new Error(
        `Tauri exited before window was ready: code=${app.child.exitCode}`,
      );
    }
    const window = await findWindow(windowConfig, 1).catch(() => null);
    if (window !== null) return window;
    await delay(250);
  }
  throw new Error("Timed out waiting for Svard native window.");
}

export async function setWindowBounds(windowConfig) {
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
  return result.code === 0
    ? null
    : result.stderr.trim() ||
        result.stdout.trim() ||
        "Failed to resize native window.";
}

export async function captureWindow(windowId, outputPath) {
  await ensureDir(path.dirname(outputPath));
  await run("screencapture", ["-x", "-l", String(windowId), outputPath]);
}
