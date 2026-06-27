import { describe, expect, it } from "vitest";

import {
  buildLinkInspectorModel,
  collectResolvedDocumentLinksFromHtml,
  pruneDocumentLinksForOpenDocuments,
  type DocumentLinksByPath,
} from "../../src/ui/lib/documentLinkInspector";
import { markSafeHtml } from "../../src/ui/lib/safeHtml";

describe("document link inspector", () => {
  it("collects resolved local document links and collapses duplicates", () => {
    const links = collectResolvedDocumentLinksFromHtml({
      document: { path: "/workspace/docs/current.md" },
      html: markSafeHtml(`
        <a href="/workspace/docs/next.md">Next</a>
        <a href="/workspace/docs/next.md">Next again</a>
        <a href="/workspace/docs/guide.adoc#intro">Guide</a>
        <a href="#local">Local anchor</a>
        <a href="https://example.com/private">External</a>
        <a href="mailto:test@example.com">Mail</a>
        <a href="/workspace/docs/current.md#same">Same page</a>
        <a href="/workspace/docs/image.png">Image</a>
      `),
    });

    expect(links).toEqual([
      {
        sourcePath: "/workspace/docs/current.md",
        targetPath: "/workspace/docs/next.md",
        hash: null,
        count: 2,
      },
      {
        sourcePath: "/workspace/docs/current.md",
        targetPath: "/workspace/docs/guide.adoc",
        hash: "intro",
        count: 1,
      },
    ]);
  });

  it("builds outgoing links and backlinks from open loaded documents only", () => {
    const documentLinksByPath: DocumentLinksByPath = {
      "/workspace/docs/current.md": {
        path: "/workspace/docs/current.md",
        updatedAt: 1,
        links: [
          {
            sourcePath: "/workspace/docs/current.md",
            targetPath: "/workspace/docs/next.md",
            hash: null,
            count: 1,
          },
          {
            sourcePath: "/workspace/docs/current.md",
            targetPath: "/workspace/docs/closed.md",
            hash: null,
            count: 1,
          },
        ],
      },
      "/workspace/docs/backlink.md": {
        path: "/workspace/docs/backlink.md",
        updatedAt: 2,
        links: [
          {
            sourcePath: "/workspace/docs/backlink.md",
            targetPath: "/workspace/docs/current.md",
            hash: "target",
            count: 2,
          },
        ],
      },
      "/workspace/docs/closed.md": {
        path: "/workspace/docs/closed.md",
        updatedAt: 3,
        links: [
          {
            sourcePath: "/workspace/docs/closed.md",
            targetPath: "/workspace/docs/current.md",
            hash: null,
            count: 1,
          },
        ],
      },
    };

    const model = buildLinkInspectorModel({
      activePath: "/workspace/docs/current.md",
      documentLinksByPath,
      openDocumentPaths: new Set([
        "/workspace/docs/current.md",
        "/workspace/docs/next.md",
        "/workspace/docs/backlink.md",
      ]),
      rootDirectory: "/workspace",
    });

    expect(model.outgoing).toHaveLength(1);
    expect(model.outgoing[0]).toMatchObject({
      path: "/workspace/docs/next.md",
      label: "next.md",
      displayPath: "docs/next.md",
      count: 1,
    });
    expect(model.backlinks).toHaveLength(1);
    expect(model.backlinks[0]).toMatchObject({
      path: "/workspace/docs/backlink.md",
      sourcePath: "/workspace/docs/backlink.md",
      displayPath: "docs/backlink.md#target",
      count: 2,
    });
    expect(JSON.stringify(model)).not.toContain("/Users/");
    expect(JSON.stringify(model)).not.toContain("Next again");
  });

  it("prunes link records when documents are no longer open", () => {
    const current: DocumentLinksByPath = {
      "/workspace/docs/current.md": {
        path: "/workspace/docs/current.md",
        updatedAt: 1,
        links: [],
      },
      "/workspace/docs/closed.md": {
        path: "/workspace/docs/closed.md",
        updatedAt: 2,
        links: [],
      },
    };

    expect(
      pruneDocumentLinksForOpenDocuments(
        current,
        new Set(["/workspace/docs/current.md"]),
      ),
    ).toEqual({
      "/workspace/docs/current.md": current["/workspace/docs/current.md"],
    });
  });
});
