import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("source control file history perf probe script", () => {
  const source = fs.readFileSync(
    path.join(
      process.cwd(),
      "scripts/source-control-file-history-perf-probe.mjs",
    ),
    "utf8",
  );
  const rustSource = fs.readFileSync(
    path.join(process.cwd(), "src-tauri/src/bin/file_history_perf_probe.rs"),
    "utf8",
  );

  it("supports an opt-in budget gate without failing the default probe", () => {
    expect(source).toContain("--budget");
    expect(source).toContain("budgetPassed");
    expect(source).toContain("budgetResults");
    expect(source).toContain("process.exitCode = 1");
    expect(source).toContain("args.budget && !report.budgetPassed");

    const mainBody = source.slice(
      source.indexOf("async function main"),
      source.indexOf("await main();"),
    );
    expect(mainBody).toContain("args.budget ? deriveBudgetSummary");
    expect(mainBody).not.toContain("process.exitCode = 1;\n  } else");
  });

  it("budgets work-based backend cache regression signals", () => {
    expect(source).toContain("phaseNames.sameHeadCacheHit");
    expect(source).toContain("phaseNames.initialLimit");
    expect(source).toContain("phaseNames.headPlusOneIncremental");
    expect(source).toContain("phaseNames.rewriteFallback");
    expect(source).toContain("phaseNames.untrackedNoCacheSecond");
    expect(source).toContain("metrics.cacheStatus");
    expect(source).toContain("metrics.walkedCommits");
    expect(source).toContain("sameHeadCacheHitDurationMs");
    expect(source).toContain("initialReturnedCommits");
    expect(source).toContain("headPlusOneIncrementalWalkedCommits");
    expect(source).toContain("function equals");
    expect(source).toContain("function atMost");
    expect(source).toContain("function greaterThan");
  });

  it("keeps probe reports free of private source and path payloads", () => {
    const reportBody = rustSource.slice(
      rustSource.indexOf("struct ProbeReport"),
      rustSource.indexOf("fn create_probe_repo"),
    );
    expect(reportBody).not.toContain("repositoryRoot");
    expect(reportBody).not.toContain("absolutePath");
    expect(reportBody).not.toContain("fileContent");
    expect(reportBody).not.toContain("commitBody");
    expect(reportBody).toContain("item_count");
    expect(reportBody).toContain("metrics");
    expect(reportBody).toContain("initial_item_count");
  });
});
