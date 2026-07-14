import { describe, expect, it } from "vitest";

import { renderAsciiDocCore } from "../../src/core/renderAsciiDocCore";
import {
  asciiDocWorkerPhaseCountKeys,
  asciiDocWorkerPhaseDurationKeys,
} from "../../src/core/renderWorkerMetrics";

const payload = {
  source: `= Phase Fixture

include::partial.adoc[]

[mermaid]
----
graph TD
  A --> B
----
`,
  path: "/workspace/docs/index.adoc",
  includeFiles: [
    {
      path: "/workspace/docs/partial.adoc",
      source: `== Included

Generated paragraph.

[source,typescript]
----
const generated = true;
----
`,
    },
  ],
};

describe("AsciiDoc render phase metrics", () => {
  it("keeps render output identical when diagnostics are enabled", () => {
    const unmeasured = renderAsciiDocCore(payload);
    const measured = renderAsciiDocCore(payload, { collectMetrics: true });

    expect(measured.result).toEqual(unmeasured.result);
    expect(unmeasured.phaseMetrics).toBeUndefined();
    expect(measured.phaseMetrics).toBeDefined();
  });

  it("reports only finite non-negative durations and integer counts", () => {
    const { phaseMetrics } = renderAsciiDocCore(payload, {
      collectMetrics: true,
    });
    expect(phaseMetrics).toBeDefined();

    for (const key of asciiDocWorkerPhaseDurationKeys) {
      expect(phaseMetrics?.[key]).toEqual(expect.any(Number));
      expect(Number.isFinite(phaseMetrics?.[key])).toBe(true);
      expect(phaseMetrics?.[key]).toBeGreaterThanOrEqual(0);
    }
    for (const key of asciiDocWorkerPhaseCountKeys) {
      expect(Number.isSafeInteger(phaseMetrics?.[key])).toBe(true);
      expect(phaseMetrics?.[key]).toBeGreaterThanOrEqual(0);
    }
    expect(phaseMetrics).toMatchObject({
      includeCount: 1,
      diagramCount: 1,
      sourceAnalysisPasses: 11,
    });
  });
});
