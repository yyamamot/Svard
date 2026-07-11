import { describe, expect, it } from "vitest";

import { buildDocumentDiffStreamItems } from "../../src/ui/lib/documentDiffStream";

describe("document diff stream", () => {
  it("keeps supported markup documents and filters non-document files", () => {
    const items = buildDocumentDiffStreamItems([
      {
        path: "docs/guide.md",
        documentPath: "/workspace/docs/guide.md",
        status: "modified",
      },
      {
        path: "assets/logo.png",
        status: "modified",
      },
      {
        path: "docs/removed.md",
        documentPath: "/workspace/docs/removed.md",
        status: "deleted",
      },
    ]);

    expect(items).toEqual([
      expect.objectContaining({
        kind: "document",
        documentPath: "/workspace/docs/guide.md",
      }),
      expect.objectContaining({
        kind: "blocker",
        status: "deleted",
      }),
    ]);
  });

  it("deduplicates paths before building stream sections", () => {
    const items = buildDocumentDiffStreamItems([
      {
        path: "docs/guide.md",
        documentPath: "/workspace/docs/guide.md",
        status: "modified",
      },
      {
        path: "docs/guide.md",
        documentPath: "/workspace/docs/guide.md",
        status: "modified",
      },
    ]);

    expect(items).toHaveLength(1);
  });

  it("keeps repository-relative markup paths when documentPath is absent", () => {
    const items = buildDocumentDiffStreamItems(
      [
        {
          path: "docs/path-only.md",
          status: "modified",
        },
        {
          path: "assets/diagram.svg",
          status: "modified",
        },
      ],
      { repositoryRoot: "/workspace" },
    );

    expect(items).toEqual([
      expect.objectContaining({
        kind: "document",
        documentPath: "/workspace/docs/path-only.md",
      }),
    ]);
  });

  it("keeps a renamed branch document's old path for its preview", () => {
    const [item] = buildDocumentDiffStreamItems(
      [
        {
          path: "docs/current.md",
          oldPath: "docs/previous.md",
          documentPath: "/workspace/docs/current.md",
          status: "renamed",
        },
      ],
      { repositoryRoot: "/workspace" },
    );

    expect(item).toMatchObject({
      kind: "document",
      oldPath: "docs/previous.md",
      path: "docs/current.md",
    });
  });
});
