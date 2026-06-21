import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const defaultManifestPath = path.join(
  repoRoot,
  "site",
  "screenshot-manifest.json",
);

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
        const error = new Error(
          `${command} ${args.join(" ")} failed with exit code ${result.code}`,
        );
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

async function findWindowId(windowConfig, attempts = 80) {
  return (await findWindow(windowConfig, attempts)).id;
}

async function waitForWindow(app, windowConfig, timeoutMs = 30000) {
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
  return result.code === 0
    ? null
    : result.stderr.trim() ||
        result.stdout.trim() ||
        "Failed to resize native window.";
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
  const architecturePath = path.join(workspaceRoot, "architecture.md");
  const reviewNotesPath = path.join(workspaceRoot, "review-notes.md");
  const gitCommit = (message) =>
    run(
      "git",
      [
        "-c",
        "user.name=Svard Screenshot",
        "-c",
        "user.email=svard-screenshot@example.invalid",
        "commit",
        "-m",
        message,
      ],
      { cwd: workspaceRoot },
    );

  await fs.rm(workspaceRoot, { recursive: true, force: true });
  await ensureDir(workspaceRoot);
  await fs.writeFile(
    fixturePath,
    `# Source Control Fixture

This file is intended for public screenshots of the Source Control view.

## Git changes

Svard presents Git changes alongside rendered document context.

## Merge target review

Merge-target comparisons are treated as reader-facing review inputs.
`,
  );
  await fs.writeFile(
    architecturePath,
    `# Review Architecture

Svard keeps document review close to the rendered reading surface.

## Review inputs

Readers can inspect local changes, branch differences, and document history without rewriting source files.
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
  await run("git", ["branch", "-M", "main"], { cwd: workspaceRoot });
  await run("git", ["add", "."], { cwd: workspaceRoot });
  await gitCommit("Initial screenshot fixture");
  await fs.appendFile(
    fixturePath,
    `
## Review baseline

The baseline branch keeps the current public documentation stable.
`,
  );
  await fs.appendFile(
    architecturePath,
    `
## Baseline review

The review entry points are read-only surfaces for document changes.
`,
  );
  await run("git", ["add", "."], { cwd: workspaceRoot });
  await gitCommit("Add review baseline");
  await run("git", ["checkout", "-b", "review-docs"], { cwd: workspaceRoot });
  await fs.appendFile(
    fixturePath,
    `
## Branch review

Branch Diff compares the review branch against the selected base branch.
`,
  );
  await fs.appendFile(
    architecturePath,
    `
## History review

Repo Graph shows the flow of commits before opening a document-level diff.
`,
  );
  await fs.writeFile(
    reviewNotesPath,
    `# Review Notes

This document appears only on the review branch.
`,
  );
  await run("git", ["add", "."], { cwd: workspaceRoot });
  await gitCommit("Update review documents");
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

async function prepareRenderedDiffWorkspace({ artifactRoot }) {
  const workspaceRoot = path.join(
    artifactRoot,
    "fixtures",
    "rendered-diff-workspace",
  );
  const fixturePath = path.join(workspaceRoot, "rendered-diff.md");
  const baseContent = `# Rendered Diff Fixture

This Markdown file is intended for screenshots of rendered comparison workflows.

## Release note draft

Svard helps readers inspect documentation changes as rendered output.

- Read local AsciiDoc and Markdown documents
- Compare Git changes against a merge target
- Review diagrams with local rendering first
- Avoid rewriting source for viewer convenience

## Example change area

The rendered diff view should make reader-visible changes easy to inspect.

| Section | Before | After |
| --- | --- | --- |
| Search | Current file only | Current file and all files |
| Diff | Source line diff | Rendered output comparison |
| Diagrams | Remote fallback first | Local rendering first |

## Public-safe note

This fixture intentionally avoids private paths, tokens, repository URLs, and endpoint URLs.
`;
  const changedContent = `# Rendered Diff Fixture

This Markdown file is intended for screenshots of rendered comparison workflows.

## Release note draft

Svard helps reviewers inspect documentation changes directly in the rendered preview.

- Read local AsciiDoc and Markdown documents
- Compare Git changes against a merge target
- Review changed list items and tables in the preview
- Keep Git change markers stable while nearby files update
- Avoid rewriting source for viewer convenience

## Example change area

The rendered diff view should make reader-visible changes easy to inspect and navigate.

| Section | Before | After |
| --- | --- | --- |
| Search | Current document only | Current file and all files |
| Diff | Source line diff | Rendered output comparison |
| Diagrams | Remote fallback first | Local rendering and fallback |

## Public-safe note

This fixture intentionally avoids private paths, tokens, repository URLs, and endpoint URLs.
`;

  await fs.rm(workspaceRoot, { recursive: true, force: true });
  await ensureDir(workspaceRoot);
  await fs.writeFile(fixturePath, baseContent);
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
      "Initial rendered diff screenshot fixture",
    ],
    { cwd: workspaceRoot },
  );
  await fs.writeFile(fixturePath, changedContent);
  return fixturePath;
}

async function prepareTableCopyWorkspace({ artifactRoot }) {
  const workspaceRoot = path.join(artifactRoot, "fixtures", "table-copy");
  const fixturePath = path.join(workspaceRoot, "table-copy.adoc");

  await fs.rm(workspaceRoot, { recursive: true, force: true });
  await ensureDir(workspaceRoot);
  await fs.writeFile(
    fixturePath,
    `= Table Copy Sample

This public sample is used for table copy screenshots.

[cols="1,1,1", options="header"]
|===
|Area
|Owner
|Status

|Reader
|Docs
|Ready

|Search
|Review
|Planned

|Diagrams
|Preview
|Ready
|===
`,
  );

  return fixturePath;
}

async function prepareLinkDocumentActionsWorkspace({ artifactRoot }) {
  const workspaceRoot = path.join(
    artifactRoot,
    "fixtures",
    "link-document-actions",
  );
  const fixturePath = path.join(workspaceRoot, "guide.md");

  await fs.rm(workspaceRoot, { recursive: true, force: true });
  await ensureDir(workspaceRoot);
  await fs.writeFile(
    fixturePath,
    `# Link Actions Guide

This public guide shows how Svard lets readers inspect links before opening them.

## Review links

Use the [Related runbook](./related-runbook.md#review-checklist) before continuing a review.

The link points to another local document in this public sample workspace.
`,
  );
  await fs.writeFile(
    path.join(workspaceRoot, "related-runbook.md"),
    `# Related Runbook

## Review checklist

This public runbook preview explains the destination without exposing private paths.

- Confirm the target document.
- Continue reading in the local workspace.
`,
  );

  return fixturePath;
}

async function prepareWorkspaceSearchWorkspace({ artifactRoot }) {
  const workspaceRoot = path.join(artifactRoot, "fixtures", "workspace-search");
  const fixturePath = path.join(workspaceRoot, "overview.md");

  await fs.rm(workspaceRoot, { recursive: true, force: true });
  await ensureDir(path.join(workspaceRoot, "notes"));
  await fs.writeFile(
    fixturePath,
    `# Workspace Search Overview

This public guide describes how readers find documents across a local folder.

## Search scenario

Workspace search helps locate review notes, release plans, and diagrams without knowing the exact file.

## Reader note

The result list should keep file names and short snippets visible.
`,
  );
  await fs.writeFile(
    path.join(workspaceRoot, "release-plan.md"),
    `# Release Plan

The review workflow includes reading local documents, checking rendered changes, and returning to related notes.

## Workspace search

Search can find review terms across files while keeping the reading workspace open.
`,
  );
  await fs.writeFile(
    path.join(workspaceRoot, "notes", "diagram-review.md"),
    `# Diagram Review Notes

Review diagrams as rendered document content before relying on fallback behavior.

## Search example

The review term appears here so workspace search can show a second file.
`,
  );

  return fixturePath;
}

async function prepareReadingDocumentsWorkspace({ artifactRoot }) {
  const workspaceRoot = path.join(
    artifactRoot,
    "fixtures",
    "reading-documents",
  );
  const fixturePath = path.join(workspaceRoot, "guide.adoc");

  await fs.rm(workspaceRoot, { recursive: true, force: true });
  await ensureDir(path.join(workspaceRoot, "partials"));
  await ensureDir(path.join(workspaceRoot, "assets"));
  await fs.writeFile(
    fixturePath,
    `= Reading Documents Guide
:imagesdir: assets

This public sample shows the reading features used by the static site.

== Overview

Svard displays local technical documents as readable pages.

== Included note

include::partials/review-note.adoc[]

== Local image

image::local-workflow.svg[Local workflow,width=520]

== Navigation section

The contents panel helps readers move across long documents.

== Display section

Theme and zoom settings change how the document is read.
`,
  );
  await fs.writeFile(
    path.join(workspaceRoot, "partials", "review-note.adoc"),
    `The included note is rendered as part of the document while staying inside the sample workspace.
`,
  );
  await fs.writeFile(
    path.join(workspaceRoot, "assets", "local-workflow.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="220" viewBox="0 0 640 220" role="img" aria-label="Local reading workflow">
  <rect width="640" height="220" rx="18" fill="#f8fafc"/>
  <rect x="38" y="72" width="132" height="76" rx="12" fill="#e0f2fe" stroke="#0369a1" stroke-width="2"/>
  <rect x="254" y="72" width="132" height="76" rx="12" fill="#dcfce7" stroke="#15803d" stroke-width="2"/>
  <rect x="470" y="72" width="132" height="76" rx="12" fill="#fef3c7" stroke="#b45309" stroke-width="2"/>
  <path d="M184 110h54" stroke="#475569" stroke-width="3" stroke-linecap="round"/>
  <path d="m232 102 12 8-12 8" fill="none" stroke="#475569" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M400 110h54" stroke="#475569" stroke-width="3" stroke-linecap="round"/>
  <path d="m448 102 12 8-12 8" fill="none" stroke="#475569" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="104" y="104" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="17" font-weight="700" fill="#0f172a">Local files</text>
  <text x="320" y="104" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="17" font-weight="700" fill="#0f172a">Render</text>
  <text x="536" y="104" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="17" font-weight="700" fill="#0f172a">Read</text>
  <text x="104" y="128" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" fill="#334155">AsciiDoc</text>
  <text x="320" y="128" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" fill="#334155">in app</text>
  <text x="536" y="128" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" fill="#334155">preview</text>
</svg>
`,
  );

  return fixturePath;
}

async function prepareFirstDocumentWorkspace({ artifactRoot }) {
  const workspaceRoot = path.join(artifactRoot, "fixtures", "first-document");
  const fixturePath = path.join(workspaceRoot, "guide.adoc");

  await fs.rm(workspaceRoot, { recursive: true, force: true });
  await ensureDir(path.join(workspaceRoot, "notes"));
  await fs.writeFile(
    fixturePath,
    `= Getting Started Guide

This public sample is used for the first document screenshots.

== Start reading

Choose a local folder, then open an AsciiDoc or Markdown document from the tree.

== Next document

The file tree keeps nearby documents visible while the reader stays focused on the current page.
`,
  );
  await fs.writeFile(
    path.join(workspaceRoot, "README.md"),
    `# Sample Workspace

Open this folder to read local AsciiDoc and Markdown documents in Svard.
`,
  );
  await fs.writeFile(
    path.join(workspaceRoot, "notes", "overview.md"),
    `# Overview

This nearby note is part of the same public sample workspace.
`,
  );

  return fixturePath;
}

async function prepareDiagramDocsWorkspace({ artifactRoot }) {
  const workspaceRoot = path.join(artifactRoot, "fixtures", "diagrams");
  const fixturePath = path.join(workspaceRoot, "overview.adoc");

  await fs.rm(workspaceRoot, { recursive: true, force: true });
  await ensureDir(workspaceRoot);
  await fs.writeFile(
    fixturePath,
    `= Diagram Review Guide

This public sample shows rendered diagrams inside a local document.

== System flow

[mermaid]
....
flowchart LR
  local[Local files] --> render[Local render]
  render --> read[Readable preview]
....

== Review sequence

[plantuml]
....
@startuml
actor Reader
participant Svard
Reader -> Svard: Open document
Svard --> Reader: Rendered diagram
@enduml
....

== Dependency map

[graphviz]
....
digraph G {
  rankdir=LR;
  docs -> diagrams;
  diagrams -> preview;
  preview -> review;
}
....
`,
  );

  return fixturePath;
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
    if (
      capture.id === "source-control" ||
      capture.id === "source-control-changes" ||
      capture.id === "source-control-ref-context-menu" ||
      capture.id === "source-control-open-diff" ||
      capture.id === "source-control-branch-diff" ||
      capture.id === "source-control-branch-diff-preview" ||
      capture.id === "source-control-repo-graph" ||
      capture.id === "source-control-file-history" ||
      capture.id === "files"
    ) {
      fixturePath = await prepareGitStatusWorkspace({
        artifactRoot,
        id: capture.id,
      });
    } else if (
      capture.id === "rendered-diff" ||
      capture.id === "table-list-diff-review" ||
      capture.id === "table-list-diff-table" ||
      capture.id === "change-review-mode-markers"
    ) {
      fixturePath = await prepareRenderedDiffWorkspace({ artifactRoot });
    } else if (capture.id === "table-copy-context-menu") {
      fixturePath = await prepareTableCopyWorkspace({ artifactRoot });
    } else if (
      capture.id === "link-hover-preview" ||
      capture.id === "link-context-menu"
    ) {
      fixturePath = await prepareLinkDocumentActionsWorkspace({ artifactRoot });
    } else if (
      capture.id === "workspace-search" ||
      capture.id === "workspace-search-result"
    ) {
      fixturePath = await prepareWorkspaceSearchWorkspace({ artifactRoot });
    } else if (
      capture.id === "table-of-contents" ||
      capture.id === "table-of-contents-jump" ||
      capture.id === "includes-local-assets" ||
      capture.id === "includes-local-assets-boundary" ||
      capture.id === "themes-zoom-preferences" ||
      capture.id === "themes-zoom-reader" ||
      capture.id === "zen-mode-entry" ||
      capture.id === "zen-mode"
    ) {
      fixturePath = await prepareReadingDocumentsWorkspace({ artifactRoot });
    } else if (
      capture.id === "first-document-open-folder" ||
      capture.id === "first-document-reader"
    ) {
      fixturePath = await prepareFirstDocumentWorkspace({ artifactRoot });
    } else if (
      capture.id === "diagram-inspector" ||
      capture.id === "diagram-inline-preview-entry" ||
      capture.id === "diagram-preview" ||
      capture.id === "diagram-save-action" ||
      capture.id === "diagram-loading-cache"
    ) {
      fixturePath = await prepareDiagramDocsWorkspace({ artifactRoot });
    }
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
    `${JSON.stringify(report, null, 2)}\n`,
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
