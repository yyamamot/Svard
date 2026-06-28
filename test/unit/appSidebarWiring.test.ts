import { describe, expect, it } from "vitest";

import {
  suggestedDocumentsModeForCatalog,
  workspaceSearchOrderedPathsForCatalog,
} from "../../src/ui/hooks/useAppSidebarWiring";
import type { DocumentOrderCatalog } from "../../src/core/types";

describe("useAppSidebarWiring document mode suggestion", () => {
  it("suggests the first detected Docs mode in menu order", () => {
    const documentOrder: DocumentOrderCatalog = {
      orders: [
        { source: "antora", nodes: [] },
        { source: "zensical", nodes: [] },
        { source: "mkdocs", nodes: [] },
      ],
    };

    expect(
      suggestedDocumentsModeForCatalog({
        documentOrder,
        filesViewMode: "tree",
        rootDirectory: "/workspace",
      }),
    ).toEqual({
      mode: "documents-mkdocs",
      label: "Docs: MkDocs",
    });
  });

  it("hides the suggestion when the first detected Docs mode is selected or root is empty", () => {
    const documentOrder: DocumentOrderCatalog = {
      orders: [
        { source: "mkdocs", nodes: [] },
        { source: "zensical", nodes: [] },
      ],
    };

    expect(
      suggestedDocumentsModeForCatalog({
        documentOrder,
        filesViewMode: "documents-mkdocs",
        rootDirectory: "/workspace",
      }),
    ).toBeUndefined();
    expect(
      suggestedDocumentsModeForCatalog({
        documentOrder,
        filesViewMode: "tree",
        rootDirectory: "",
      }),
    ).toBeUndefined();
  });

  it("returns an Antora context selector suggestion for multiple playbooks", () => {
    const documentOrder: DocumentOrderCatalog = {
      orders: [{ source: "antora", nodes: [] }],
      selectedAntoraContext: {
        contextId: "one",
        playbookPath: "antora-playbook.yml",
        contentRoot: "docs-a",
        sourceKind: "standard-playbook",
        label: "antora-playbook.yml (docs-a)",
      },
      antoraContexts: [
        {
          contextId: "one",
          playbookPath: "antora-playbook.yml",
          contentRoot: "docs-a",
          sourceKind: "standard-playbook",
          label: "antora-playbook.yml (docs-a)",
        },
        {
          contextId: "two",
          playbookPath: "antora-playbook.yaml",
          contentRoot: "docs-b",
          sourceKind: "standard-playbook",
          label: "antora-playbook.yaml (docs-b)",
        },
      ],
    };

    expect(
      suggestedDocumentsModeForCatalog({
        documentOrder,
        filesViewMode: "tree",
        rootDirectory: "/workspace",
      }),
    ).toEqual({
      mode: "documents-antora",
      label: "Antora: 2 playbooks",
      selectedAntoraContextId: "one",
      antoraContexts: documentOrder.antoraContexts,
    });
    expect(
      suggestedDocumentsModeForCatalog({
        documentOrder,
        filesViewMode: "documents-antora",
        rootDirectory: "/workspace",
      })?.label,
    ).toBe("Antora: selected");
  });
});

describe("workspaceSearchOrderedPathsForCatalog", () => {
  const documentOrder: DocumentOrderCatalog = {
    orders: [
      {
        source: "mkdocs",
        nodes: [
          {
            kind: "document",
            title: "Part 2",
            path: "/workspace/part-2.md",
            displayPath: "part-2.md",
            depth: 1,
            status: "resolved",
          },
          {
            kind: "section",
            title: "Section",
            depth: 1,
            children: [
              {
                kind: "document",
                title: "Part 1",
                path: "/workspace/part-1.md",
                displayPath: "part-1.md",
                depth: 2,
                status: "resolved",
              },
            ],
          },
        ],
      },
      {
        source: "zensical",
        nodes: [
          {
            kind: "document",
            title: "Zensical",
            path: "/workspace/zensical.md",
            displayPath: "zensical.md",
            depth: 1,
            status: "resolved",
          },
        ],
      },
      {
        source: "antora",
        nodes: [
          {
            kind: "document",
            title: "Antora",
            path: "/workspace/antora.adoc",
            displayPath: "antora.adoc",
            depth: 1,
            status: "resolved",
          },
        ],
      },
    ],
  };

  it("returns paths for the active Docs order mode", () => {
    expect(
      workspaceSearchOrderedPathsForCatalog({
        documentOrder,
        filesViewMode: "documents-mkdocs",
      }),
    ).toEqual(["/workspace/part-2.md", "/workspace/part-1.md"]);
    expect(
      workspaceSearchOrderedPathsForCatalog({
        documentOrder,
        filesViewMode: "documents-zensical",
      }),
    ).toEqual(["/workspace/zensical.md"]);
    expect(
      workspaceSearchOrderedPathsForCatalog({
        documentOrder,
        filesViewMode: "documents-antora",
      }),
    ).toEqual(["/workspace/antora.adoc"]);
  });

  it("does not provide ordered paths in normal file tree mode", () => {
    expect(
      workspaceSearchOrderedPathsForCatalog({
        documentOrder,
        filesViewMode: "tree",
      }),
    ).toBeUndefined();
  });
});
