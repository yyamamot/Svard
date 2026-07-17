import path from "node:path";
import { describe, expect, it } from "vitest";
import benchmarkViteConfig from "../../scripts/all-diffs-ui-benchmark/vite.config.mjs";

async function resolveBenchmarkConfig(command: "build" | "serve") {
  if (typeof benchmarkViteConfig !== "function") {
    return benchmarkViteConfig;
  }
  return benchmarkViteConfig({
    command,
    mode: command === "build" ? "production" : "development",
    isPreview: command === "serve",
    isSsrBuild: false,
  });
}

describe("All Diffs UI production benchmark build", () => {
  it("builds only the benchmark HTML into the artifact directory", async () => {
    const config = await resolveBenchmarkConfig("build");
    const outDir = config.build?.outDir ?? "";
    const input = config.build?.rolldownOptions?.input;

    expect(outDir).toContain(
      path.join(".artifacts", "perf", "imp-445-all-diffs-ui-bundle"),
    );
    expect(path.basename(outDir)).not.toBe("dist");
    expect(input).toBe(path.resolve("scripts/all-diffs-ui-benchmark.html"));
    expect(config.define).toMatchObject({
      __SVARD_ALL_DIFFS_UI_PRODUCTION_BUNDLE__: "true",
    });
  });

  it("does not identify a development transform as production", async () => {
    const config = await resolveBenchmarkConfig("serve");

    expect(config.define).toMatchObject({
      __SVARD_ALL_DIFFS_UI_PRODUCTION_BUNDLE__: "false",
    });
  });
});
