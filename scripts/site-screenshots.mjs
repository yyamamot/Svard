import fs from "node:fs/promises";
import path from "node:path";
import { preview } from "vite";
import { captureScenario, createArtifactRoot } from "./ui-review-utils.mjs";
import {
  delay,
  ensureDir,
  parseArgs,
  readJson,
  repoRoot,
  run,
  timestampId,
} from "./site-screenshots/common.mjs";
import {
  captureWindow,
  cleanupDevProcesses,
  findWindow,
  launchTauri,
  setWindowBounds,
  stopTauri,
  waitForWindow,
} from "./site-screenshots/nativeCapture.mjs";
import {
  prepareFixtureCopies,
  prepareScreenshotFixture,
} from "./site-screenshots/fixtures.mjs";

async function captureUiReview({ manifest, capture, artifactRoot }) {
  const outputPath = path.resolve(repoRoot, manifest.outputDir, capture.output);
  const uiArtifactRoot = await createArtifactRoot(
    `site-screenshot-${capture.id}`,
  );
  const port = 4291;
  let server = null;
  const startedAt = Date.now();
  try {
    await run("pnpm", ["run", "build"]);
    server = await preview({
      preview: {
        host: "127.0.0.1",
        port,
        strictPort: true,
      },
    });
    const report = await captureScenario({
      scenario: capture.scenario,
      id: capture.featureId ?? capture.id,
      artifactRoot: uiArtifactRoot,
      baseURL: `http://127.0.0.1:${port}`,
    });
    if (report.outcome !== "passed") {
      throw new Error(
        `UI review capture failed: ${report.assertionFailures.join(", ")}`,
      );
    }
    await ensureDir(path.dirname(outputPath));
    await fs.copyFile(report.screenshotPath, outputPath);
    return {
      id: capture.id,
      scenario: capture.scenario,
      outcome: "passed",
      outputPath,
      artifactRoot,
      uiArtifactRoot,
      durationMs: Date.now() - startedAt,
      captureMethod: "ui-review-browser",
      description: capture.description ?? null,
    };
  } catch (error) {
    return {
      id: capture.id,
      scenario: capture.scenario,
      outcome: "failed",
      outputPath,
      artifactRoot,
      uiArtifactRoot,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
      captureMethod: "ui-review-browser",
      description: capture.description ?? null,
    };
  } finally {
    if (server) {
      await server.httpServer.close();
    }
  }
}

async function captureOne({ manifest, capture, artifactRoot }) {
  if (capture.captureMode === "ui-review") {
    return captureUiReview({ manifest, capture, artifactRoot });
  }
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
    fixturePath = await prepareScreenshotFixture({
      artifactRoot,
      capture,
      fixturePath,
    });
    await prepareFixtureCopies({ capture, fixtureRoot, fixturePath });
    app = launchTauri({ capture, fixturePath, profileDir, logFile });
    const windowConfig = capture.window ?? manifest.window ?? {};
    let windowInfo = await waitForWindow(
      app,
      windowConfig,
      capture.timeoutMs ?? 30000,
    );
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
  const fixturePath = capture.fixture
    ? path.resolve(fixtureRoot, capture.fixture)
    : null;
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
    throw new Error(
      "site screenshot capture is currently supported only on macOS.",
    );
  }
  const args = parseArgs(process.argv.slice(2));
  const manifest = await readJson(args.manifest);
  const captures = args.only
    ? manifest.captures.filter((capture) => capture.id === args.only)
    : manifest.captures;
  if (captures.length === 0) {
    throw new Error(`No screenshot capture matched: ${args.only}`);
  }
  const artifactRoot = path.resolve(
    repoRoot,
    ".artifacts",
    "site-screenshots",
    `site-screenshots-${timestampId()}`,
  );
  await ensureDir(path.join(artifactRoot, "logs"));
  await ensureDir(path.resolve(repoRoot, manifest.outputDir));

  const results = [];
  for (const capture of captures) {
    const outputPath = path.resolve(
      repoRoot,
      manifest.outputDir,
      capture.output,
    );
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
    outcome: results.every(
      (result) => result.outcome === "passed" || result.outcome === "skipped",
    )
      ? "passed"
      : "failed",
    window: manifest.window,
    results,
  };
  await fs.writeFile(
    path.join(artifactRoot, "report.json"),
    `${JSON.stringify(report, null, 2)}
`,
  );
  console.log(
    JSON.stringify({ outcome: report.outcome, artifactRoot }, null, 2),
  );
  if (report.outcome !== "passed") process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
