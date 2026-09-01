import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { runVlmReview } from "../../scripts/ui-review/vlm-review.mjs";

function geometryElement(reviewId: string, visible: boolean) {
  return {
    reviewId,
    visible,
    rect: {
      x: 0,
      y: 0,
      width: visible ? 100 : 0,
      height: visible ? 40 : 0,
      bottom: visible ? 40 : 0,
      right: visible ? 100 : 0,
    },
  };
}

async function runReview({
  required,
  elements,
}: {
  required: string[];
  elements: ReturnType<typeof geometryElement>[];
}) {
  const artifactRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "svard-ui-review-vlm-"),
  );
  try {
    await fs.writeFile(
      path.join(artifactRoot, "ui-review-report.json"),
      JSON.stringify({
        schemaVersion: 2,
        runId: "unit-review",
        scenarioId: "viewer-copy-actions",
        assertions: { hasDocument: true },
      }),
    );
    await fs.writeFile(
      path.join(artifactRoot, "ui-geometry.json"),
      JSON.stringify({
        schemaVersion: 2,
        runId: "unit-review",
        scenarioId: "viewer-copy-actions",
        markerCompleteness: { required },
        elements,
      }),
    );
    return await runVlmReview(artifactRoot);
  } finally {
    await fs.rm(artifactRoot, { recursive: true, force: true });
  }
}

describe("UI review VLM marker visibility", () => {
  it("ignores hidden DOM retained outside the scenario contract", async () => {
    const result = await runReview({
      required: ["document-viewer"],
      elements: [
        geometryElement("document-viewer", true),
        geometryElement("agent-panel", false),
      ],
    });

    expect(result.outcome).toBe("passed");
    expect(result.findings).toEqual([]);
  });

  it("does not apply control sizing to narrow diff indicators", async () => {
    const result = await runReview({
      required: ["document-viewer"],
      elements: [
        geometryElement("document-viewer", true),
        {
          ...geometryElement("git-diff-change-ruler-marker", true),
          rect: {
            x: 0,
            y: 0,
            width: 6,
            height: 8,
            bottom: 8,
            right: 6,
          },
        },
      ],
    });

    expect(result.outcome).toBe("passed");
    expect(result.findings).toEqual([]);
  });

  it("reports hidden and absent required controls", async () => {
    const result = await runReview({
      required: [
        "document-viewer",
        "required-hidden",
        "required-absent",
        "plantuml-render",
      ],
      elements: [
        geometryElement("document-viewer", true),
        geometryElement("required-hidden", false),
        geometryElement("agent-panel", false),
        geometryElement("diagram-inline-image", true),
      ],
    });

    expect(result.outcome).toBe("needs-fix");
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reviewId: "required-hidden" }),
        expect.objectContaining({ reviewId: "required-absent" }),
        expect.objectContaining({ reviewId: "plantuml-render" }),
      ]),
    );
    expect(result.findings).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reviewId: "agent-panel" }),
      ]),
    );
  });
});
