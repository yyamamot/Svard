import { describe, expect, it } from "vitest";
import { buildIncludeInspectorItems } from "../../src/ui/lib/includeInspector";
import type { DocumentPayload } from "../../src/core/types";

describe("buildIncludeInspectorItems", () => {
  it("converts include graph nodes into compact view items", () => {
    const document: DocumentPayload = {
      path: "/workspace/docs/current.adoc",
      basePath: "/workspace/docs",
      format: "asciidoc",
      source: "= Current",
      updatedAt: "test",
      asciidocContext: {
        baseDir: "/workspace",
        workspaceRoot: "/workspace",
        documentDir: "/workspace/docs",
        attributes: {},
        resourceRoots: ["/workspace"],
      },
      includeGraph: {
        nodes: [
          {
            id: "root",
            path: "/workspace/docs/current.adoc",
            displayPath: "current.adoc",
            kind: "root",
            status: "active",
          },
          {
            id: "include-1",
            parentId: "root",
            path: "/workspace/docs/partials/active.adoc",
            displayPath: "active.adoc",
            kind: "include",
            status: "active",
            sourceLocation: {
              sourcePath: "/workspace/docs/current.adoc",
              line: 5,
            },
          },
          {
            id: "include-2",
            parentId: "include-1",
            displayPath: "disabled.adoc",
            kind: "include",
            status: "skipped",
            reason: "conditional",
            sourceLocation: {
              sourcePath: "/workspace/docs/partials/active.adoc",
              line: 3,
            },
          },
        ],
        edges: [],
      },
    };

    expect(buildIncludeInspectorItems(document)).toEqual([
      {
        id: "include-1",
        label: "active.adoc",
        displayPath: "docs/partials/active.adoc",
        status: "active",
        path: "/workspace/docs/partials/active.adoc",
        sourcePath: "/workspace/docs/current.adoc",
        sourceLine: 5,
        sourceReference: "/workspace/docs/current.adoc:5",
        depth: 0,
      },
      {
        id: "include-2",
        label: "disabled.adoc",
        displayPath: "disabled.adoc",
        status: "skipped",
        reason: "conditional",
        sourcePath: "/workspace/docs/partials/active.adoc",
        sourceLine: 3,
        sourceReference: "/workspace/docs/partials/active.adoc:3",
        depth: 1,
      },
    ]);
  });

  it("returns no items for Markdown documents", () => {
    expect(
      buildIncludeInspectorItems({
        path: "/workspace/docs/current.md",
        basePath: "/workspace/docs",
        format: "markdown",
        source: "# Current",
        updatedAt: "test",
      }),
    ).toEqual([]);
  });
});
