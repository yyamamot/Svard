import { describe, expect, it } from "vitest";

import {
  buildFileTreeDocumentRows,
  collectDocumentOrderPaths,
  documentOrderSectionKey,
  filterVisibleDocumentRows,
  isOrderedDocumentsMode,
  relativeDocumentPath,
  sectionHeaderDocument,
} from "../../src/ui/lib/fileTreeDocuments";
import type { DocumentOrderNode } from "../../src/core/types";

describe("fileTreeDocuments helpers", () => {
  it("builds supported document rows with relative paths and open state", () => {
    const rows = buildFileTreeDocumentRows({
      activePath: "/workspace/docs/guide.adoc",
      childrenByDirectory: {
        "/workspace": [
          { kind: "file", name: "README.md", path: "/workspace/README.md" },
          { kind: "file", name: "notes.txt", path: "/workspace/notes.txt" },
        ],
        "/workspace/docs": [
          {
            kind: "file",
            name: "guide.adoc",
            path: "/workspace/docs/guide.adoc",
          },
        ],
      },
      gitStatusByPath: {
        "/workspace/docs/guide.adoc": "modified",
      },
      openDocumentPaths: new Set(["/workspace/docs/guide.adoc"]),
      rootDirectory: "/workspace",
    });

    expect(rows.map((row) => row.relativePath)).toEqual([
      "docs/guide.adoc",
      "README.md",
    ]);
    expect(rows[0]).toMatchObject({
      isActive: true,
      isChanged: true,
      isOpen: true,
      gitStatusLabel: "Modified in Git. Open rendered diff for guide.adoc",
    });
  });

  it("filters changed documents by status priority for path order", () => {
    const rows = buildFileTreeDocumentRows({
      childrenByDirectory: {
        "/workspace": [
          { kind: "file", name: "added.md", path: "/workspace/added.md" },
          { kind: "file", name: "deleted.md", path: "/workspace/deleted.md" },
          { kind: "file", name: "clean.md", path: "/workspace/clean.md" },
          {
            kind: "file",
            name: "modified.md",
            path: "/workspace/modified.md",
          },
        ],
      },
      gitStatusByPath: {
        "/workspace/added.md": "added",
        "/workspace/deleted.md": "deleted",
        "/workspace/modified.md": "modified",
      },
      openDocumentPaths: new Set(),
      rootDirectory: "/workspace",
    });

    expect(
      filterVisibleDocumentRows(rows, "changed", "documents-path", false).map(
        (row) => row.entry.name,
      ),
    ).toEqual(["deleted.md", "modified.md", "added.md"]);
  });

  it("preserves nav order when changed filter is applied to ordered modes", () => {
    const rows = buildFileTreeDocumentRows({
      childrenByDirectory: {
        "/workspace": [
          { kind: "file", name: "b.md", path: "/workspace/b.md" },
          { kind: "file", name: "a.md", path: "/workspace/a.md" },
        ],
      },
      gitStatusByPath: {
        "/workspace/a.md": "added",
        "/workspace/b.md": "deleted",
      },
      openDocumentPaths: new Set(),
      rootDirectory: "/workspace",
    });

    expect(
      filterVisibleDocumentRows(rows, "changed", "documents-mkdocs", false).map(
        (row) => row.entry.name,
      ),
    ).toEqual(["a.md", "b.md"]);
  });

  it("keeps VitePress and Docusaurus order modes behind the local flag", () => {
    expect(isOrderedDocumentsMode("documents-vitepress", false)).toBe(false);
    expect(isOrderedDocumentsMode("documents-docusaurus", false)).toBe(false);
    expect(isOrderedDocumentsMode("documents-vitepress", true)).toBe(true);
    expect(isOrderedDocumentsMode("documents-docusaurus", true)).toBe(true);
  });

  it("collects order paths and recognizes parent document sections", () => {
    const section: Extract<DocumentOrderNode, { kind: "section" }> = {
      kind: "section",
      title: "Guide",
      depth: 0,
      children: [
        {
          kind: "document",
          title: "Guide",
          path: "/workspace/docs/index.md",
          displayPath: "docs/index.md",
          depth: 0,
          status: "resolved",
        },
        {
          kind: "document",
          title: "Missing",
          path: "/workspace/docs/missing.md",
          displayPath: "docs/missing.md",
          depth: 1,
          status: "missing",
        },
      ],
    };

    expect(sectionHeaderDocument(section)?.path).toBe(
      "/workspace/docs/index.md",
    );
    expect([...collectDocumentOrderPaths([section])]).toEqual([
      "/workspace/docs/index.md",
    ]);
    expect(documentOrderSectionKey("mkdocs", ["0"], "Guide", 0)).toBe(
      "mkdocs:0:0:Guide",
    );
  });

  it("keeps paths outside the root unchanged", () => {
    expect(relativeDocumentPath("/other/README.md", "/workspace")).toBe(
      "/other/README.md",
    );
  });
});
