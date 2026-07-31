import fs from "node:fs/promises";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import { afterEach, describe, expect, it } from "vitest";

import {
  assertNativeRegressionEnvironment,
  nativeRunId,
  parseNativeRegressionArgs,
} from "../../scripts/agent-chat-native-regression.mjs";
import {
  assertPrivacySafeNativeReport,
  createNativeRegressionReport,
  finalizeNativeRegressionReport,
  nativeScenarioDefinitions,
  recordNativeScenario,
  validateNativeRegressionReport,
} from "../../scripts/agent-chat-native-regression/contract.mjs";
import {
  cleanupSyntheticNativeRun,
  prepareSyntheticNativeRun,
  selectOwnedProviderProcess,
} from "../../scripts/agent-chat-native-regression/runtime.mjs";

const execFile = promisify(execFileCallback);
const preparedRuns: string[] = [];

function runId(sequence = 0) {
  return `2026-07-30T12-34-56-${String(sequence).padStart(3, "0")}Z`;
}

function report() {
  return createNativeRegressionReport({
    arch: "arm64",
    gitHead: "a".repeat(40),
    nodeVersion: "v24.12.0",
    runId: runId(),
  });
}

afterEach(async () => {
  await Promise.all(
    preparedRuns.splice(0).map(async (preparedRun) => {
      try {
        await cleanupSyntheticNativeRun(preparedRun);
      } catch {
        // A test may have already verified cleanup.
      }
    }),
  );
});

describe("Agent Chat native regression runner", () => {
  it("parses only the fixed commands and report metadata", () => {
    expect(parseNativeRegressionArgs(["prepare", "--run", runId()])).toEqual({
      command: "prepare",
      run: runId(),
    });
    expect(
      parseNativeRegressionArgs([
        "record",
        "--run",
        runId(),
        "--scenario",
        "provider-crash-streaming",
        "--status",
        "failed",
        "--failure-class",
        "assertion-failed",
        "--failed-assertion",
        "turn-failed",
        "--codex-version",
        "1.2.3",
        "--model",
        "gpt-5.6-sol",
        "--reasoning-effort",
        "medium",
      ]),
    ).toMatchObject({
      command: "record",
      scenario: "provider-crash-streaming",
      status: "failed",
      failureClass: "assertion-failed",
      failedAssertion: "turn-failed",
      codexVersion: "1.2.3",
      model: "gpt-5.6-sol",
      reasoningEffort: "medium",
    });
    expect(
      parseNativeRegressionArgs([
        "kill-provider",
        "--run",
        runId(),
        "--svard-pid",
        "120",
      ]),
    ).toEqual({
      command: "kill-provider",
      run: runId(),
      svardPid: 120,
    });
    expect(() => parseNativeRegressionArgs(["prepare", "--unknown"])).toThrow(
      "Unknown argument",
    );
    expect(() =>
      parseNativeRegressionArgs([
        "record",
        "--run",
        runId(),
        "--scenario",
        "unknown",
        "--status",
        "passed",
      ]),
    ).toThrow("Unknown native scenario");
  });

  it("requires Node 24 and macOS and creates stable run IDs", () => {
    expect(() =>
      assertNativeRegressionEnvironment({
        nodeVersion: "24.12.0",
        platform: "darwin",
      }),
    ).not.toThrow();
    expect(() =>
      assertNativeRegressionEnvironment({
        nodeVersion: "25.8.2",
        platform: "darwin",
      }),
    ).toThrow("Node 24");
    expect(() =>
      assertNativeRegressionEnvironment({
        nodeVersion: "24.12.0",
        platform: "linux",
      }),
    ).toThrow("macOS");
    expect(nativeRunId(new Date("2026-07-30T12:34:56.789Z"))).toBe(runId(789));
  });

  it("records only fixed scenario outcomes and assertions", () => {
    const passed = recordNativeScenario(report(), {
      scenarioId: "core-three-turn",
      status: "passed",
      codexVersion: "1.2.3",
      model: "gpt-5.6-sol",
      reasoningEffort: "medium",
    });
    expect(passed.runtime).toEqual({
      nodeVersion: "v24.12.0",
      codexVersion: "1.2.3",
      model: "gpt-5.6-sol",
      reasoningEffort: "medium",
    });
    expect(passed.scenarios[0]).toMatchObject({
      id: "core-three-turn",
      status: "passed",
      failureClass: null,
    });
    expect(
      passed.scenarios[0].assertions.every(({ status }) => status === "passed"),
    ).toBe(true);

    const failed = recordNativeScenario(passed, {
      scenarioId: "provider-crash-streaming",
      status: "failed",
      failureClass: "assertion-failed",
      failedAssertion: "turn-failed",
    });
    expect(failed.outcome).toBe("failed");
    expect(
      failed.scenarios
        .find(({ id }) => id === "provider-crash-streaming")
        ?.assertions.find(({ id }) => id === "turn-failed"),
    ).toEqual({ id: "turn-failed", status: "failed" });
    expect(() =>
      recordNativeScenario(report(), {
        scenarioId: "core-three-turn",
        status: "failed",
        failureClass: "assertion-failed",
        failedAssertion: "unknown",
      }),
    ).toThrow("fixed failed assertion");
    expect(() =>
      recordNativeScenario(report(), {
        scenarioId: "core-three-turn",
        status: "passed",
        model: "/private/model",
      }),
    ).toThrow("model metadata");
  });

  it("accepts only the privacy-safe fixed report schema", () => {
    const valid = report();
    expect(validateNativeRegressionReport(valid)).toBe(valid);
    expect(assertPrivacySafeNativeReport(valid)).toBe(valid);
    expect(() =>
      validateNativeRegressionReport({ ...valid, answer: "private" }),
    ).toThrow("schema mismatch");
    expect(() =>
      validateNativeRegressionReport({
        ...valid,
        runtime: { ...valid.runtime, model: "unsafe/model" },
      }),
    ).toThrow("model metadata");
    expect(() =>
      validateNativeRegressionReport({
        ...valid,
        scenarios: valid.scenarios.map((scenario) =>
          scenario.id === "core-three-turn"
            ? {
                ...scenario,
                status: "failed",
                failureClass: "assertion-failed",
              }
            : scenario,
        ),
      }),
    ).toThrow("assertion state mismatch");

    const allPassed = nativeScenarioDefinitions.reduce(
      (current, { id }) =>
        recordNativeScenario(current, { scenarioId: id, status: "passed" }),
      valid,
    );
    expect(finalizeNativeRegressionReport(allPassed, true)).toMatchObject({
      outcome: "passed",
      privacyCheck: "passed",
      processCleanup: "passed",
    });
    expect(() =>
      recordNativeScenario(finalizeNativeRegressionReport(allPassed, true), {
        scenarioId: "core-three-turn",
        status: "passed",
      }),
    ).toThrow("immutable");
    expect(finalizeNativeRegressionReport(valid, true).outcome).toBe("blocked");
  });

  it("selects only one Codex app-server descended from the selected Svard", () => {
    const processes = [
      { pid: 100, ppid: 1, command: "/target/debug/svard" },
      { pid: 110, ppid: 100, command: "/bin/sh provider-wrapper" },
      { pid: 120, ppid: 110, command: "/usr/local/bin/codex app-server" },
      { pid: 200, ppid: 1, command: "/target/debug/svard" },
      { pid: 220, ppid: 200, command: "/usr/local/bin/codex app-server" },
    ];
    expect(selectOwnedProviderProcess(processes, 100)).toMatchObject({
      pid: 120,
      ppid: 110,
    });
    expect(() =>
      selectOwnedProviderProcess(
        [
          ...processes,
          {
            pid: 121,
            ppid: 100,
            command: "/usr/local/bin/codex app-server",
          },
        ],
        100,
      ),
    ).toThrow("exactly one");
    expect(() => selectOwnedProviderProcess(processes, 999)).toThrow(
      "ownership",
    );
  });

  it("prepares isolated Git workspaces and removes only the owned run", async () => {
    const preparedRun = runId(1);
    preparedRuns.push(preparedRun);
    const state = await prepareSyntheticNativeRun(process.cwd(), preparedRun);
    const [agentA, agentB, png, diff] = await Promise.all([
      fs.readFile(`${state.workspaceA}/AGENTS.md`, "utf8"),
      fs.readFile(`${state.workspaceB}/AGENTS.md`, "utf8"),
      fs.readFile(`${state.workspaceA}/assets/evidence.png`),
      execFile("git", ["diff", "--", "docs/review.md"], {
        cwd: state.workspaceA,
      }),
    ]);
    expect(agentA).toContain("SVARD_NATIVE_ALPHA");
    expect(agentB).toContain("SVARD_NATIVE_BRAVO");
    expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
    expect(diff.stdout).toContain("Agent Chat native regression");

    await cleanupSyntheticNativeRun(preparedRun);
    preparedRuns.splice(preparedRuns.indexOf(preparedRun), 1);
    await expect(fs.access(state.tempRoot)).rejects.toThrow();
  });
});
