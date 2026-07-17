import { describe, expect, it } from "vitest";
import { allDiffsUiFixtures } from "../../scripts/all-diffs-ui-benchmark/fixtures.mjs";

describe("All Diffs UI benchmark fixtures", () => {
  it("provides the four fixed synthetic workloads", () => {
    expect(
      allDiffsUiFixtures.map((fixture) => ({
        fixtureId: fixture.fixtureId,
        documentCount: fixture.pairs.length,
        expectedChangeCount: fixture.expectedChangeCount,
      })),
    ).toEqual([
      {
        fixtureId: "markdown-14x12-mixed",
        documentCount: 14,
        expectedChangeCount: 168,
      },
      {
        fixtureId: "asciidoc-14x12-mixed",
        documentCount: 14,
        expectedChangeCount: 168,
      },
      {
        fixtureId: "markdown-dense-list-200",
        documentCount: 1,
        expectedChangeCount: 200,
      },
      {
        fixtureId: "markdown-dense-table-200",
        documentCount: 1,
        expectedChangeCount: 200,
      },
    ]);
  });

  it("uses generic sources with distinct base and working content", () => {
    for (const fixture of allDiffsUiFixtures) {
      for (const pair of fixture.pairs) {
        expect(pair.left.path.startsWith("/benchmark/")).toBe(true);
        expect(pair.left.source).not.toBe(pair.right.source);
      }
    }
  });
});
