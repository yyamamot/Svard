import { execFile as execFileCallback } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import {
  assertPrivacySafeNativeReport,
  validateNativeRegressionReport,
  validateNativeRunId,
} from "./contract.mjs";

const execFile = promisify(execFileCallback);
const stateDirectory = path.join(os.tmpdir(), "svard-agent-native-state");
const temporaryPrefix = path.join(os.tmpdir(), "svard-agent-native-");
const markerName = ".svard-agent-native-run.json";
const reportDirectory = path.join(".artifacts", "agent-chat-native");
const pngFixture = Buffer.from(
  "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",
  "base64",
);

function reportPath(repoRoot, runId) {
  return path.join(repoRoot, reportDirectory, runId, "report.json");
}

function statePath(runId) {
  return path.join(stateDirectory, `${validateNativeRunId(runId)}.json`);
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function runGit(args, cwd) {
  await execFile("git", args, { cwd });
}

async function createWorkspace(workspacePath, label, marker) {
  await fs.mkdir(path.join(workspacePath, "docs"), { recursive: true });
  await fs.mkdir(path.join(workspacePath, "assets"), { recursive: true });
  await fs.writeFile(
    path.join(workspacePath, "AGENTS.md"),
    [
      "# Native regression workspace",
      "",
      "This workspace is synthetic and owned by the IMP-511 smoke run.",
      `When asked for the workspace marker, answer only \`${marker}\`.`,
      "Do not inspect or modify paths outside this workspace unless the operator explicitly requests the Full Access sentinel scenario.",
      "",
    ].join("\n"),
  );
  await fs.writeFile(
    path.join(workspacePath, "docs", "review.md"),
    [
      `# Workspace ${label}`,
      "",
      "## Release review",
      "",
      "| Check | Status |",
      "| --- | --- |",
      "| Parser | Passed |",
      "| Native smoke | Pending |",
      "",
      "```ts",
      `export const workspace = "${label}";`,
      "```",
      "",
      "![Synthetic evidence](../assets/evidence.png)",
      "",
    ].join("\n"),
  );
  await fs.writeFile(
    path.join(workspacePath, "assets", "evidence.png"),
    pngFixture,
  );
  await runGit(["init", "--quiet"], workspacePath);
  await runGit(
    ["config", "user.name", "Svard Native Regression"],
    workspacePath,
  );
  await runGit(
    ["config", "user.email", "native-regression@example.invalid"],
    workspacePath,
  );
  await runGit(["add", "."], workspacePath);
  await runGit(
    ["commit", "--quiet", "-m", "synthetic baseline"],
    workspacePath,
  );
  await fs.appendFile(
    path.join(workspacePath, "docs", "review.md"),
    "\n## Candidate\n\nAgent Chat native regression is ready for review.\n",
  );
}

export async function prepareSyntheticNativeRun(repoRoot, runId) {
  validateNativeRunId(runId);
  const existingStatePath = statePath(runId);
  try {
    await fs.access(existingStatePath);
    throw new Error("Native regression run already exists");
  } catch (error) {
    if (error instanceof Error && error.message.includes("already exists")) {
      throw error;
    }
  }

  const tempRoot = await fs.mkdtemp(temporaryPrefix);
  const marker = crypto.randomUUID();
  const workspaceA = path.join(tempRoot, "workspace-a");
  const workspaceB = path.join(tempRoot, "workspace-b");
  const outsideRoot = path.join(tempRoot, "outside");
  const state = {
    schemaVersion: 1,
    runId,
    marker,
    repoRoot,
    tempRoot,
    workspaceA,
    workspaceB,
    outsideSentinel: path.join(outsideRoot, "full-access-sentinel.txt"),
  };

  try {
    await Promise.all([
      createWorkspace(workspaceA, "A", "SVARD_NATIVE_ALPHA"),
      createWorkspace(workspaceB, "B", "SVARD_NATIVE_BRAVO"),
      fs.mkdir(outsideRoot, { recursive: true }),
    ]);
    await writeJson(path.join(tempRoot, markerName), {
      schemaVersion: 1,
      runId,
      marker,
    });
    await writeJson(existingStatePath, state);
    return state;
  } catch (error) {
    await fs.rm(tempRoot, { recursive: true, force: true });
    throw error;
  }
}

export async function readNativeRunState(runId) {
  const state = JSON.parse(await fs.readFile(statePath(runId), "utf8"));
  const expectedKeys = [
    "marker",
    "outsideSentinel",
    "repoRoot",
    "runId",
    "schemaVersion",
    "tempRoot",
    "workspaceA",
    "workspaceB",
  ];
  if (
    !state ||
    typeof state !== "object" ||
    Array.isArray(state) ||
    Object.keys(state).sort().join("\0") !== expectedKeys.sort().join("\0") ||
    state.schemaVersion !== 1 ||
    state.runId !== runId ||
    typeof state.marker !== "string" ||
    !state.tempRoot.startsWith(temporaryPrefix)
  ) {
    throw new Error("Native regression state mismatch");
  }
  return state;
}

export async function readNativeRegressionReport(repoRoot, runId) {
  const report = JSON.parse(
    await fs.readFile(reportPath(repoRoot, runId), "utf8"),
  );
  return validateNativeRegressionReport(report);
}

export async function writeNativeRegressionReport(repoRoot, report) {
  validateNativeRegressionReport(report);
  assertPrivacySafeNativeReport(report);
  await writeJson(reportPath(repoRoot, report.runId), report);
}

export function parseProcessTable(output) {
  return output
    .split(/\r?\n/u)
    .map((line) => line.match(/^\s*(\d+)\s+(\d+)\s+(.+)$/u))
    .filter(Boolean)
    .map((match) => ({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      command: match[3],
    }));
}

function hasAncestor(processes, pid, ancestorPid) {
  const byPid = new Map(processes.map((process) => [process.pid, process]));
  const visited = new Set();
  let current = byPid.get(pid);
  while (current && current.ppid > 0 && !visited.has(current.pid)) {
    if (current.ppid === ancestorPid) return true;
    visited.add(current.pid);
    current = byPid.get(current.ppid);
  }
  return false;
}

function isSvardCommand(command) {
  return /(?:^|[/\s])(?:svard|Svard)(?:\s|$)/u.test(command);
}

function isCodexAppServer(command) {
  return /(?:^|[/\s])codex(?:\s|$).*?\bapp-server\b/u.test(command);
}

export function selectOwnedProviderProcess(processes, svardPid) {
  if (!Number.isSafeInteger(svardPid) || svardPid <= 1) {
    throw new Error("Invalid Svard process ID");
  }
  const svardProcess = processes.find(({ pid }) => pid === svardPid);
  if (!svardProcess || !isSvardCommand(svardProcess.command)) {
    throw new Error("Svard process ownership could not be verified");
  }
  const candidates = processes.filter(
    ({ command, pid }) =>
      isCodexAppServer(command) && hasAncestor(processes, pid, svardPid),
  );
  if (candidates.length !== 1) {
    throw new Error("Expected exactly one Svard-owned Codex app-server");
  }
  return candidates[0];
}

export async function readMacosProcessTable() {
  const { stdout } = await execFile("ps", ["-axo", "pid=,ppid=,command="]);
  return parseProcessTable(stdout);
}

export async function killOwnedProviderProcess(svardPid) {
  const providerProcess = selectOwnedProviderProcess(
    await readMacosProcessTable(),
    svardPid,
  );
  process.kill(providerProcess.pid, "SIGKILL");
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      process.kill(providerProcess.pid, 0);
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch {
      return;
    }
  }
  throw new Error("Svard-owned Codex app-server did not terminate");
}

export async function verifyProviderCleanup(svardPid) {
  try {
    selectOwnedProviderProcess(await readMacosProcessTable(), svardPid);
    return false;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Expected exactly one Svard-owned Codex app-server"
    ) {
      const processes = await readMacosProcessTable();
      const svardProcess = processes.find(({ pid }) => pid === svardPid);
      if (!svardProcess || !isSvardCommand(svardProcess.command)) {
        return false;
      }
      return !processes.some(
        ({ command, pid }) =>
          isCodexAppServer(command) && hasAncestor(processes, pid, svardPid),
      );
    }
    return false;
  }
}

export async function cleanupSyntheticNativeRun(runId) {
  const state = await readNativeRunState(runId);
  const marker = JSON.parse(
    await fs.readFile(path.join(state.tempRoot, markerName), "utf8"),
  );
  if (
    marker.schemaVersion !== 1 ||
    marker.runId !== runId ||
    marker.marker !== state.marker ||
    !state.tempRoot.startsWith(temporaryPrefix)
  ) {
    throw new Error("Refusing to remove unowned native regression directory");
  }
  await fs.rm(state.tempRoot, { recursive: true });
  await fs.rm(statePath(runId));
}

export function nativeReportPath(repoRoot, runId) {
  return reportPath(repoRoot, validateNativeRunId(runId));
}
