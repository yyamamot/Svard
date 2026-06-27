import { describe, expect, it } from "vitest";

import { suggestedDocumentsModeForCatalog } from "../../src/ui/hooks/useAppSidebarWiring";
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
      label: "Docs: MkDocs detected",
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
});
