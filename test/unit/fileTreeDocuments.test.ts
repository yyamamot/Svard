import { describe, expect, it } from "vitest";

import {
  buildDocumentOrderNavigation,
  buildFileTreeDocumentRows,
  collectDocumentOrderPaths,
  documentOrderSectionKey,
  filterVisibleDocumentRows,
  isOrderedDocumentsMode,
  relativeDocumentPath,
  sectionHeaderDocument,
} from "../../src/ui/lib/fileTreeDocuments";
import type { DocumentOrderNode, DocumentOrderResult } from "../../src/core/types";

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
    expect(
      filterVisibleDocumentRows(rows, "changed", "documents-zensical", false).map(
        (row) => row.entry.name,
      ),
    ).toEqual(["a.md", "b.md"]);
  });

  it("keeps VitePress and Docusaurus order modes behind the local flag", () => {
    expect(isOrderedDocumentsMode("documents-vitepress", false)).toBe(false);
    expect(isOrderedDocumentsMode("documents-docusaurus", false)).toBe(false);
    expect(isOrderedDocumentsMode("documents-zensical", false)).toBe(true);
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

  it("builds previous and next targets from resolved loaded documents", () => {
    const mkdocsOrder = navigationOrderFixture();
    const navigation = buildDocumentOrderNavigation({
      activePath: "/workspace/docs/install/linux.md",
      loadedDocumentPaths: new Set([
        "/workspace/docs/index.md",
        "/workspace/docs/install/linux.md",
        "/workspace/docs/reference.md",
      ]),
      order: mkdocsOrder,
    });

    expect(navigation?.sourceLabel).toBe("MkDocs");
    expect(navigation?.previous?.path).toBe("/workspace/docs/index.md");
    expect(navigation?.next?.path).toBe("/workspace/docs/reference.md");
    expect(navigation?.activeSectionKeys).toEqual(
      new Set([
        documentOrderSectionKey("mkdocs", ["0"], "Guide", 0),
        documentOrderSectionKey("mkdocs", ["0", "0"], "Install", 1),
      ]),
    );
  });

  it("returns null for non stable order sources and documents outside the selected order", () => {
    const mkdocsOrder = navigationOrderFixture();
    expect(
      buildDocumentOrderNavigation({
        activePath: "/workspace/docs/install/linux.md",
        loadedDocumentPaths: new Set(["/workspace/docs/install/linux.md"]),
        order: { ...mkdocsOrder, source: "vitepress" },
      }),
    ).toBeNull();
    expect(
      buildDocumentOrderNavigation({
        activePath: "/workspace/docs/not-in-nav.md",
        loadedDocumentPaths: new Set(["/workspace/docs/not-in-nav.md"]),
        order: mkdocsOrder,
      }),
    ).toBeNull();
  });

  it("builds previous and next targets from Zensical order", () => {
    const zensicalOrder: DocumentOrderResult = {
      ...navigationOrderFixture(),
      source: "zensical",
    };
    const navigation = buildDocumentOrderNavigation({
      activePath: "/workspace/docs/install/linux.md",
      loadedDocumentPaths: new Set([
        "/workspace/docs/index.md",
        "/workspace/docs/install/linux.md",
        "/workspace/docs/reference.md",
      ]),
      order: zensicalOrder,
    });

    expect(navigation?.sourceLabel).toBe("Zensical");
    expect(navigation?.previous?.path).toBe("/workspace/docs/index.md");
    expect(navigation?.next?.path).toBe("/workspace/docs/reference.md");
  });
});

function navigationOrderFixture(): DocumentOrderResult {
  return {
    source: "mkdocs",
    nodes: [
      {
        kind: "section",
        title: "Guide",
        depth: 0,
        children: [
          {
            kind: "document",
            title: "Guide",
            path: "/workspace/docs/index.md",
            displayPath: "index.md",
            depth: 0,
            status: "resolved",
          },
          {
            kind: "section",
            title: "Install",
            depth: 1,
            children: [
              {
                kind: "document",
                title: "Linux",
                path: "/workspace/docs/install/linux.md",
                displayPath: "install/linux.md",
                depth: 2,
                status: "resolved",
              },
              {
                kind: "document",
                title: "Missing",
                path: "",
                displayPath: "install/missing.md",
                depth: 2,
                status: "missing",
              },
            ],
          },
        ],
      },
      {
        kind: "document",
        title: "Reference",
        path: "/workspace/docs/reference.md",
        displayPath: "reference.md",
        depth: 0,
        status: "resolved",
      },
    ],
  };
}
