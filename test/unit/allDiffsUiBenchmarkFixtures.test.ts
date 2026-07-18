import { describe, expect, it } from "vitest";
import { allDiffsUiFixtures } from "../../scripts/all-diffs-ui-benchmark/fixtures.mjs";

describe("All Diffs UI benchmark fixtures", () => {
  it("provides the fixed synthetic workloads and route-specific streams", () => {
    expect(
      allDiffsUiFixtures.map((fixture) => ({
        fixtureId: fixture.fixtureId,
        documentCount: fixture.pairs.length,
        expectedChangeCount: fixture.expectedChangeCount,
        streamSource: fixture.streamSource,
      })),
    ).toEqual([
      {
        fixtureId: "markdown-14x12-mixed",
        documentCount: 14,
        expectedChangeCount: 168,
        streamSource: "git-changes-stream",
      },
      {
        fixtureId: "asciidoc-14x12-mixed",
        documentCount: 14,
        expectedChangeCount: 168,
        streamSource: "git-changes-stream",
      },
      {
        fixtureId: "branch-markdown-14x12-mixed",
        documentCount: 14,
        expectedChangeCount: 168,
        streamSource: "git-branch-stream",
      },
      {
        fixtureId: "commit-markdown-14x12-mixed",
        documentCount: 14,
        expectedChangeCount: 168,
        streamSource: "git-commit-stream",
      },
      {
        fixtureId: "markdown-dense-list-200",
        documentCount: 1,
        expectedChangeCount: 200,
        streamSource: "git-changes-stream",
      },
      {
        fixtureId: "markdown-dense-table-200",
        documentCount: 1,
        expectedChangeCount: 200,
        streamSource: "git-changes-stream",
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
