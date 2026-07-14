import { execFileSync } from "node:child_process";
import fs from "node:fs";

import { describe, expect, it } from "vitest";

interface UiReviewScenarioContract {
  schemaVersion: 1;
  scenarios: Array<{
    id: string;
    group: string;
    handler: string;
    requiredMarkers: string[];
    optionalCoreMarkers: string[];
    documented: boolean;
  }>;
}

const contract = JSON.parse(
  fs.readFileSync("docs/contracts/ui-review-scenario-contract.json", "utf8"),
) as UiReviewScenarioContract;

describe("UI review scenario contract", () => {
  it("keeps scenario metadata privacy-safe and structurally valid", () => {
    expect(contract.schemaVersion).toBe(1);
    const ids = contract.scenarios.map((scenario) => scenario.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(
      expect.arrayContaining([
        "viewer-source-control-changes",
        "viewer-git-timeline-file-history-cache",
        "viewer-diff-preview-regression-suite",
        "viewer-diff-code-fence-word-highlight",
        "viewer-git-diff-too-complex-source-fallback",
      ]),
    );

    const serialized = JSON.stringify(contract);
    expect(serialized).not.toContain("/Users/");
    expect(serialized).not.toContain("diagramSource");
    expect(serialized).not.toContain("fileContent");
    expect(serialized).not.toContain("token:");
  });

  it("passes the scenario drift checker", () => {
    expect(() =>
      execFileSync("node", ["scripts/check-ui-scenarios.mjs"], {
        stdio: "pipe",
      }),
    ).not.toThrow();
  });
});
