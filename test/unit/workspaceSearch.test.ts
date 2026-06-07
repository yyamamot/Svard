import { describe, expect, it } from "vitest";

import {
  defaultWorkspaceSearchLimits,
  isWorkspaceSearchExcludedPath,
  searchWorkspaceDocuments,
} from "../../src/core/workspaceSearch";

const input = {
  rootPath: "/workspace",
  query: "graphviz",
  maxFiles: 20,
  maxMatches: 20,
  maxBytesPerFile: 1024,
};

describe("workspace search", () => {
  it("exports the default scan limits used by callers", () => {
    expect(defaultWorkspaceSearchLimits).toEqual({
      maxFiles: 500,
      maxMatches: 100,
      maxBytesPerFile: 1_048_576,
    });
  });

  it("searches supported documents case-insensitively with heading and snippet", () => {
    const result = searchWorkspaceDocuments(
      {
        "/workspace/docs/guide.md": "# Guide\nGraphviz overview\nno match",
        "/workspace/docs/diagram.adoc": "= Diagram\nGraphviz and graphviz",
        "/workspace/docs/raw.txt": "Graphviz ignored",
      },
      input,
    );

    expect(result.status).toBe("ok");
    expect(result.totalMatches).toBe(3);
    expect(result.results).toEqual([
      expect.objectContaining({
        path: "/workspace/docs/diagram.adoc",
        displayPath: "docs/diagram.adoc",
        line: 2,
        heading: "Diagram",
        matchCount: 2,
        sourceReference: "/workspace/docs/diagram.adoc:2",
      }),
      expect.objectContaining({
        path: "/workspace/docs/guide.md",
        displayPath: "docs/guide.md",
        line: 2,
        heading: "Guide",
        matchCount: 1,
        snippet: "Graphviz overview",
      }),
    ]);
  });

  it("skips generated directories and over-large files", () => {
    const result = searchWorkspaceDocuments(
      {
        "/workspace/.git/hidden.md": "# Hidden\nGraphviz",
        "/workspace/node_modules/pkg/readme.md": "# Package\nGraphviz",
        "/workspace/docs/large.md": "Graphviz ".repeat(200),
        "/workspace/docs/guide.md": "# Guide\nGraphviz",
      },
      { ...input, maxBytesPerFile: 64 },
    );

    expect(isWorkspaceSearchExcludedPath("/workspace/.git/hidden.md")).toBe(
      true,
    );
    expect(result.results).toHaveLength(1);
    expect(result.results[0]?.path).toBe("/workspace/docs/guide.md");
    expect(result.skippedFiles).toBeGreaterThanOrEqual(3);
  });

  it("caps results and reports empty queries", () => {
    expect(
      searchWorkspaceDocuments(
        { "/workspace/docs/guide.md": "# Guide\nGraphviz" },
        { ...input, query: " " },
      ),
    ).toMatchObject({ status: "empty", results: [], capped: false });

    const capped = searchWorkspaceDocuments(
      {
        "/workspace/docs/a.md": "Graphviz",
        "/workspace/docs/b.md": "Graphviz",
      },
      { ...input, maxMatches: 1 },
    );

    expect(capped.results).toHaveLength(1);
    expect(capped.capped).toBe(true);
  });
});
