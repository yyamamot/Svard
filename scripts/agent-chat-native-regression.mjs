import { execFile as execFileCallback } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  createNativeRegressionReport,
  finalizeNativeRegressionReport,
  nativeFailureClasses,
  nativeScenarioIds,
  recordNativeScenario,
  validateNativeRunId,
} from "./agent-chat-native-regression/contract.mjs";
import {
  cleanupSyntheticNativeRun,
  killOwnedProviderProcess,
  prepareSyntheticNativeRun,
  readNativeRegressionReport,
  readNativeRunState,
  verifyProviderCleanup,
  writeNativeRegressionReport,
} from "./agent-chat-native-regression/runtime.mjs";

const execFile = promisify(execFileCallback);
const scriptPath = fileURLToPath(import.meta.url);

function takeOption(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${name}`);
  }
  args.splice(index, 2);
  return value;
}

function assertNoUnknownArgs(args) {
  if (args.length > 0) {
    throw new Error(`Unknown argument: ${args[0]}`);
  }
}

function requiredOption(value, name) {
  if (!value) throw new Error(`Missing required option: ${name}`);
  return value;
}

function parsePositivePid(value) {
  const pid = Number(value);
  if (!Number.isSafeInteger(pid) || pid <= 1) {
    throw new Error("Invalid --svard-pid");
  }
  return pid;
}

export function parseNativeRegressionArgs(argv) {
  const args = argv[0] === "--" ? argv.slice(1) : [...argv];
  const command = args.shift();
  if (
    !new Set(["prepare", "record", "kill-provider", "finalize"]).has(command)
  ) {
    throw new Error(
      "Usage: agent-chat-native-regression <prepare|record|kill-provider|finalize>",
    );
  }

  const run = takeOption(args, "--run");
  if (command === "prepare") {
    assertNoUnknownArgs(args);
    return { command, run: run ? validateNativeRunId(run) : null };
  }

  const parsed = {
    command,
    run: validateNativeRunId(requiredOption(run, "--run")),
  };
  if (command === "record") {
    const scenario = requiredOption(
      takeOption(args, "--scenario"),
      "--scenario",
    );
    const status = requiredOption(takeOption(args, "--status"), "--status");
    const failureClass = takeOption(args, "--failure-class");
    const failedAssertion = takeOption(args, "--failed-assertion");
    const codexVersion = takeOption(args, "--codex-version");
    const model = takeOption(args, "--model");
    const reasoningEffort = takeOption(args, "--reasoning-effort");
    assertNoUnknownArgs(args);
    if (!nativeScenarioIds.includes(scenario)) {
      throw new Error(`Unknown native scenario: ${scenario}`);
    }
    if (
      failureClass !== undefined &&
      !nativeFailureClasses.includes(failureClass)
    ) {
      throw new Error(`Unknown native failure class: ${failureClass}`);
    }
    return {
      ...parsed,
      codexVersion,
      failedAssertion,
      failureClass,
      model,
      reasoningEffort,
      scenario,
      status,
    };
  }

  const svardPid = parsePositivePid(
    requiredOption(takeOption(args, "--svard-pid"), "--svard-pid"),
  );
  assertNoUnknownArgs(args);
  return { ...parsed, svardPid };
}

export function nativeRunId(date = new Date()) {
  return date.toISOString().replace(/[:.]/gu, "-");
}

export function assertNativeRegressionEnvironment({
  nodeVersion = process.versions.node,
  platform = process.platform,
} = {}) {
  const nodeMajor = Number(nodeVersion.split(".")[0]);
  if (nodeMajor !== 24) {
    throw new Error("IMP-511 native regression requires Node 24");
  }
  if (platform !== "darwin") {
    throw new Error("IMP-511 currently supports macOS only");
  }
}

async function gitHead(repoRoot) {
  const { stdout } = await execFile("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
  });
  return stdout.trim();
}

async function prepare(repoRoot, requestedRun) {
  const runId = requestedRun ?? nativeRunId();
  const currentGitHead = await gitHead(repoRoot);
  await prepareSyntheticNativeRun(repoRoot, runId);
  const report = createNativeRegressionReport({
    arch: os.arch(),
    gitHead: currentGitHead,
    nodeVersion: process.version,
    runId,
  });
  try {
    await writeNativeRegressionReport(repoRoot, report);
  } catch (error) {
    await cleanupSyntheticNativeRun(runId);
    throw error;
  }
  return { command: "prepare", runId, status: "prepared" };
}

async function record(repoRoot, args) {
  const report = await readNativeRegressionReport(repoRoot, args.run);
  const next = recordNativeScenario(report, {
    codexVersion: args.codexVersion,
    failedAssertion: args.failedAssertion,
    failureClass: args.failureClass,
    model: args.model,
    reasoningEffort: args.reasoningEffort,
    scenarioId: args.scenario,
    status: args.status,
  });
  await writeNativeRegressionReport(repoRoot, next);
  return {
    command: "record",
    runId: args.run,
    scenario: args.scenario,
    status: args.status,
  };
}

async function killProvider(args) {
  await readNativeRunState(args.run);
  await killOwnedProviderProcess(args.svardPid);
  return {
    command: "kill-provider",
    runId: args.run,
    status: "terminated",
  };
}

async function finalize(repoRoot, args) {
  const report = await readNativeRegressionReport(repoRoot, args.run);
  const providerCleanup = await verifyProviderCleanup(args.svardPid);
  let fixtureCleanup = true;
  try {
    await cleanupSyntheticNativeRun(args.run);
  } catch {
    fixtureCleanup = false;
  }
  const next = finalizeNativeRegressionReport(
    report,
    providerCleanup && fixtureCleanup,
  );
  await writeNativeRegressionReport(repoRoot, next);
  if (next.outcome !== "passed") {
    process.exitCode = 1;
  }
  return {
    command: "finalize",
    outcome: next.outcome,
    runId: args.run,
  };
}

export async function runNativeRegressionCli(argv, repoRoot = process.cwd()) {
  assertNativeRegressionEnvironment();
  const args = parseNativeRegressionArgs(argv);
  if (args.command === "prepare") return prepare(repoRoot, args.run);
  if (args.command === "record") return record(repoRoot, args);
  if (args.command === "kill-provider") return killProvider(args);
  return finalize(repoRoot, args);
}

function classifyCliError(error) {
  const message = error instanceof Error ? error.message : "";
  if (
    message.includes("exactly one") ||
    message.includes("ownership") ||
    message.includes("Svard process")
  ) {
    return "process-owner-ambiguous";
  }
  if (message.includes("did not terminate")) {
    return "process-termination-failed";
  }
  if (message.includes("privacy")) {
    return "privacy-violation";
  }
  return "environment-error";
}

if (path.resolve(process.argv[1] ?? "") === path.resolve(scriptPath)) {
  runNativeRegressionCli(process.argv.slice(2))
    .then((result) => {
      console.log(JSON.stringify(result));
    })
    .catch((error) => {
      console.error(
        JSON.stringify({
          status: "failed",
          failureClass: classifyCliError(error),
        }),
      );
      process.exit(1);
    });
}
