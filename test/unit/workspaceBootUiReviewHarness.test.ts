import { afterEach, describe, expect, it, vi } from "vitest";

import { listDirectory, loadConfig } from "../../src/adapters/mockHost/files";
import {
  WORKSPACE_BOOT_BENCHMARK_SCENARIO,
  buildWorkspaceBootBenchmarkUrl,
  installWorkspaceBootBenchmarkCollector,
} from "../../scripts/ui-review/core/capture.mjs";

interface WorkspaceBootBenchmark {
  schemaVersion: number;
  scenarioId: string;
  status: "pending" | "ok" | "failed";
  profile: "fast" | "normal" | "stress";
  phases: Record<string, number | null>;
  entryCount: number;
  orderViolationCount: number;
  reason?: string;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
  document.body.replaceChildren();
});

describe("workspace boot UI review harness", () => {
  it.each([
    ["fast", 0],
    ["normal", 50],
    ["stress", 750],
  ] as const)(
    "maps the %s URL profile to a %dms tree delay",
    async (profile, delayMs) => {
      vi.useFakeTimers();
      window.history.replaceState(
        {},
        "",
        `/?scenario=${WORKSPACE_BOOT_BENCHMARK_SCENARIO}&bootTreeProfile=${profile}`,
      );
      let settled = false;
      const pending = listDirectory("/workspace").then((entries) => {
        settled = true;
        return entries;
      });

      if (delayMs > 0) {
        await vi.advanceTimersByTimeAsync(delayMs - 1);
        expect(settled).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
      }

      const entries = await pending;
      expect(settled).toBe(true);
      expect(entries.length).toBeGreaterThan(0);
    },
  );

  it("does not apply a boot tree profile to another scenario", async () => {
    vi.useFakeTimers();
    window.history.replaceState(
      {},
      "",
      "/?scenario=viewer-basic&bootTreeProfile=stress",
    );

    const entries = await listDirectory("/workspace");

    expect(entries.length).toBeGreaterThan(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("uses a dark same-document restored split fixture", async () => {
    window.history.replaceState(
      {},
      "",
      `/?scenario=${WORKSPACE_BOOT_BENCHMARK_SCENARIO}&bootTreeProfile=stress`,
    );

    const config = await loadConfig();

    expect(config.theme).toBe("dark");
    expect(config.workspace.splitSession).toEqual({
      enabled: true,
      focusedPaneId: "right",
      splitRatio: 0.6,
      panePaths: {
        left: config.workspace.activePath,
        right: config.workspace.activePath,
      },
    });
  });

  it("builds a fixed startup scenario URL without discarding other query values", () => {
    const url = new URL(
      buildWorkspaceBootBenchmarkUrl(
        "http://127.0.0.1:4173/?existing=1",
        "normal",
      ),
    );

    expect(url.searchParams.get("scenario")).toBe(
      WORKSPACE_BOOT_BENCHMARK_SCENARIO,
    );
    expect(url.searchParams.get("bootTreeProfile")).toBe("normal");
    expect(url.searchParams.get("existing")).toBe("1");
    expect(() =>
      buildWorkspaceBootBenchmarkUrl("http://127.0.0.1:4173", "unknown"),
    ).toThrow("Unknown workspace boot benchmark profile");
  });

  it("collects only fixed startup fields and completes after all phases", async () => {
    let initScript:
      | ((input: { allowedProfiles: string[]; scenarioId: string }) => void)
      | null = null;
    let initInput: { allowedProfiles: string[]; scenarioId: string } | null =
      null;
    const page = {
      addInitScript: vi.fn(
        async (
          script: typeof initScript,
          input: typeof initInput,
        ): Promise<void> => {
          initScript = script;
          initInput = input;
        },
      ),
    };

    await installWorkspaceBootBenchmarkCollector(page);
    expect(page.addInitScript).toHaveBeenCalledOnce();
    expect(initScript).not.toBeNull();
    expect(
      (initInput as { allowedProfiles: string[]; scenarioId: string } | null)
        ?.scenarioId,
    ).toBe(WORKSPACE_BOOT_BENCHMARK_SCENARIO);

    window.history.replaceState({}, "", "/?bootTreeProfile=stress");
    document.body.innerHTML = `
      <main class="theme-dark" data-review-id="shell" style="--split-left-width: 60%">
        <div data-review-id="viewer-split">
          <section data-pane-id="left" data-review-id="document-viewer-secondary"></section>
          <section class="focused" data-pane-id="right" data-review-id="document-viewer">
            <article data-review-id="document-body"><h1>Fixture</h1></article>
          </section>
        </div>
      </main>
    `;
    let now = 1;
    vi.spyOn(performance, "now").mockImplementation(() => now++);
    const originalInfo = console.info;
    const consoleSink = vi.fn();
    console.info = consoleSink;
    try {
      (
        initScript as unknown as (input: {
          allowedProfiles: string[];
          scenarioId: string;
        }) => void
      )(initInput!);
      const emit = (event: string, fields = {}) =>
        console.info("[perf]", { event, ...fields });
      emit("workspaceBoot.initialDocumentOpened", {
        path: "/workspace/private.md",
        source: "private source",
        token: "private-token",
      });
      emit("workspaceBoot.documentRenderStarted");
      emit("render.articleInnerHtmlCommit");
      emit("workspaceBoot.firstDocumentFrame");
      emit("workspaceBoot.rootDirectoryReady", { entryCount: 7 });
      emit("workspaceBoot.expandedDirectoriesReady");
      emit("workspaceBoot.treeSettled");

      const result = (
        window as unknown as {
          __SVARD_WORKSPACE_BOOT_BENCHMARK__: WorkspaceBootBenchmark;
        }
      ).__SVARD_WORKSPACE_BOOT_BENCHMARK__;
      const observation = (
        window as unknown as {
          __SVARD_WORKSPACE_BOOT_OBSERVATION__: unknown;
        }
      ).__SVARD_WORKSPACE_BOOT_OBSERVATION__;
      expect(result).toMatchObject({
        schemaVersion: 1,
        scenarioId: WORKSPACE_BOOT_BENCHMARK_SCENARIO,
        status: "ok",
        profile: "stress",
        entryCount: 7,
        orderViolationCount: 0,
      });
      expect(
        Object.values(result.phases).every(
          (value) => typeof value === "number",
        ),
      ).toBe(true);
      const serialized = JSON.stringify({ observation, result });
      expect(serialized).not.toContain("Fixture");
      expect(serialized).not.toContain("/workspace");
      expect(serialized).not.toContain("private source");
      expect(serialized).not.toContain("private-token");
      expect(consoleSink).not.toHaveBeenCalled();
      expect(localStorage.getItem("SVARD_PERF_TRACE")).toBe("1");
      expect(observation).toMatchObject({
        splitVisibleAtFirstDocumentFrame: true,
        focusedPaneAtFirstDocumentFrame: "right",
        splitRatioAtFirstDocumentFrame: 0.6,
      });
    } finally {
      console.info = originalInfo;
    }
  });

  it("reports one completed ordering violation for the old boot order", async () => {
    let initScript:
      | ((input: { allowedProfiles: string[]; scenarioId: string }) => void)
      | null = null;
    let initInput: { allowedProfiles: string[]; scenarioId: string } | null =
      null;
    await installWorkspaceBootBenchmarkCollector({
      addInitScript: async (
        script: typeof initScript,
        input: typeof initInput,
      ) => {
        initScript = script;
        initInput = input;
      },
    });
    window.history.replaceState({}, "", "/?bootTreeProfile=stress");
    let now = 1;
    vi.spyOn(performance, "now").mockImplementation(() => now++);
    const originalInfo = console.info;
    try {
      (
        initScript as unknown as (input: {
          allowedProfiles: string[];
          scenarioId: string;
        }) => void
      )(initInput!);
      const emit = (event: string) => console.info("[perf]", { event });
      emit("workspaceBoot.initialDocumentOpened");
      emit("workspaceBoot.rootDirectoryReady");
      emit("workspaceBoot.expandedDirectoriesReady");
      emit("workspaceBoot.treeSettled");
      emit("workspaceBoot.documentRenderStarted");
      emit("workspaceBoot.firstDocumentFrame");

      const result = (
        window as unknown as {
          __SVARD_WORKSPACE_BOOT_BENCHMARK__: WorkspaceBootBenchmark;
        }
      ).__SVARD_WORKSPACE_BOOT_BENCHMARK__;
      expect(result.status).toBe("ok");
      expect(result.orderViolationCount).toBe(1);
    } finally {
      console.info = originalInfo;
    }
  });
});
