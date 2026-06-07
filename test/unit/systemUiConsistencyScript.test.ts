import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_SYSTEM_UI_SCENARIOS,
  findLatestScenarioArtifact,
  normalizeSystemFinding,
  parseSystemReviewArgs,
  runSystemConsistencyReview,
} from "../../scripts/ui-review/system-consistency.mjs";

async function makeTempRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), "svard-system-ui-"));
}

async function writeScenarioArtifact(root: string, scenarioId: string) {
  await fs.mkdir(path.join(root, "screenshots"), { recursive: true });
  await fs.writeFile(
    path.join(root, "screenshots", `${scenarioId}.png`),
    "png",
  );
  await fs.writeFile(
    path.join(root, "ui-review-report.json"),
    `${JSON.stringify(
      {
        schemaVersion: 2,
        runId: path.basename(root),
        scenarioId,
        outcome: "passed",
        screenshotPath: path.join(root, "screenshots", `${scenarioId}.png`),
        assertionFailures: [],
      },
      null,
      2,
    )}\n`,
  );
  await fs.writeFile(
    path.join(root, "ui-geometry.json"),
    `${JSON.stringify(
      {
        schemaVersion: 2,
        runId: path.basename(root),
        scenarioId,
        elements: [
          {
            reviewId: "document-viewer",
            visible: true,
            rect: { width: 800, height: 600 },
          },
        ],
      },
      null,
      2,
    )}\n`,
  );
}

describe("system UI consistency review script", () => {
  it("uses the expected default scenario set", () => {
    expect(parseSystemReviewArgs([])).toEqual({
      id: "system-ui-consistency",
      reuseLatest: false,
      scenarioIds: DEFAULT_SYSTEM_UI_SCENARIOS,
    });
  });

  it("overrides scenarios and removes duplicates", () => {
    expect(
      parseSystemReviewArgs([
        "--scenario",
        "viewer-basic, viewer-bookmarks,viewer-basic",
        "--id",
        "IMP-201",
        "--reuse-latest",
      ]),
    ).toEqual({
      id: "IMP-201",
      reuseLatest: true,
      scenarioIds: ["viewer-basic", "viewer-bookmarks"],
    });
  });

  it("normalizes invalid VLM findings into the advisory schema", () => {
    expect(
      normalizeSystemFinding({
        category: "unknown",
        severity: "loud",
        evidenceScreens: ["viewer-basic", 123],
      }),
    ).toEqual({
      category: "layout_scope",
      severity: "advisory",
      description: "System UI consistency finding needs review.",
      evidenceScreens: ["viewer-basic"],
      recommendation: "",
    });
  });

  it("finds the latest reusable artifact for a scenario", async () => {
    const root = await makeTempRoot();
    const older = path.join(root, "ui-review-2026-05-31T00-00-00-000Z");
    const newer = path.join(root, "ui-review-2026-05-31T00-01-00-000Z");
    await writeScenarioArtifact(older, "viewer-basic");
    await writeScenarioArtifact(newer, "viewer-basic");

    await expect(
      findLatestScenarioArtifact("viewer-basic", root),
    ).resolves.toBe(newer);
    await expect(
      findLatestScenarioArtifact("viewer-bookmarks", root),
    ).resolves.toBeNull();
  });

  it("reuses existing artifacts without capturing", async () => {
    const root = await makeTempRoot();
    const source = path.join(root, "ui-review-2026-05-31T00-00-00-000Z");
    const output = path.join(root, "system-consistency");
    await writeScenarioArtifact(source, "viewer-basic");
    let captureCalled = false;

    const result = await runSystemConsistencyReview({
      id: "IMP-201",
      scenarioIds: ["viewer-basic"],
      reuseLatest: true,
      artifactRoot: output,
      capture: async () => {
        captureCalled = true;
        throw new Error("capture should not run");
      },
      findArtifact: async () => source,
    });

    expect(captureCalled).toBe(false);
    expect(result.outcome).toBe("passed");
    expect(result.screens).toEqual([
      expect.objectContaining({
        scenarioId: "viewer-basic",
        screenshot: "screenshots/viewer-basic.png",
      }),
    ]);
    await expect(
      fs.readFile(path.join(output, "screenshots", "viewer-basic.png"), "utf8"),
    ).resolves.toBe("png");
  });

  it("keeps the serialized system report privacy-safe", async () => {
    const root = await makeTempRoot();
    const output = path.join(root, "system-consistency");

    await runSystemConsistencyReview({
      id: "IMP-201",
      scenarioIds: ["viewer-basic"],
      artifactRoot: output,
      capture: async ({
        scenario,
        artifactRoot,
      }: {
        scenario: string;
        artifactRoot: string;
      }) => {
        await writeScenarioArtifact(artifactRoot, scenario);
      },
    });

    const report = await fs.readFile(
      path.join(output, "system-ui-consistency.json"),
      "utf8",
    );
    expect(report).toContain('"scenarioId": "viewer-basic"');
    expect(report).not.toContain("/Users/");
    expect(report).not.toContain("source markdown body");
    expect(report).not.toContain("rendered HTML");
  });
});
