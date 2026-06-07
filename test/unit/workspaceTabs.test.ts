import { describe, expect, it } from "vitest";

import type { DocumentPayload } from "../../src/core/types";
import {
  activeDocumentPathFromWorkspaceTab,
  activeWorkspaceTabId,
  buildWorkspaceTabs,
  preferencesTabId,
} from "../../src/ui/lib/workspaceTabs";

function document(path: string): DocumentPayload {
  return {
    path,
    basePath: "/workspace",
    format: path.endsWith(".md") ? "markdown" : "asciidoc",
    source: "",
    updatedAt: "2026-05-21T00:00:00.000Z",
  };
}

describe("workspace tabs", () => {
  it("adds Preferences as a UI-only workspace tab after document tabs", () => {
    const tabs = buildWorkspaceTabs(
      [
        document("/workspace/docs/guide.adoc"),
        document("/workspace/docs/notes.md"),
      ],
      true,
    );

    expect(tabs.map((tab) => tab.id)).toEqual([
      "/workspace/docs/guide.adoc",
      "/workspace/docs/notes.md",
      preferencesTabId,
    ]);
    expect(tabs[2]).toEqual({
      kind: "preferences",
      id: preferencesTabId,
    });
  });

  it("keeps document-only persistence paths separate from Preferences", () => {
    const documents = [
      document("/workspace/docs/guide.adoc"),
      document("/workspace/docs/notes.md"),
    ];
    const tabs = buildWorkspaceTabs(documents, true);
    const documentPaths = tabs
      .map(activeDocumentPathFromWorkspaceTab)
      .filter((path): path is string => path !== null);

    expect(documentPaths).toEqual(documents.map((tab) => tab.path));
    expect(documentPaths).not.toContain(preferencesTabId);
  });

  it("uses the Preferences id only while the Preferences page is active", () => {
    expect(
      activeWorkspaceTabId({
        activeDocumentPath: "/workspace/docs/guide.adoc",
        preferencesActive: true,
      }),
    ).toBe(preferencesTabId);
    expect(
      activeWorkspaceTabId({
        activeDocumentPath: "/workspace/docs/guide.adoc",
        preferencesActive: false,
      }),
    ).toBe("/workspace/docs/guide.adoc");
    expect(
      activeWorkspaceTabId({
        activeDocumentPath: null,
        preferencesActive: false,
      }),
    ).toBeUndefined();
  });
});
