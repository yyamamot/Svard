import { describe, expect, it } from "vitest";

import {
  addRecentDirectory,
  addRecentDocument,
  closeOtherOpenTabPaths,
  maxWorkspacePathStateEntries,
  nextRecentTabPath,
  pruneRecentTabs,
  pruneWorkspacePathState,
  removeWorkspacePathStateEntries,
  sortedOpenTabPaths,
  updateRecentTabs,
  togglePinnedTab,
  upsertOpenTab,
} from "../../src/core/workspaceState";
import type { DocumentPayload, WorkspaceState } from "../../src/core/types";

const document: DocumentPayload = {
  path: "/workspace/docs/a.adoc",
  basePath: "/workspace/docs",
  format: "asciidoc",
  source: "= A",
  updatedAt: "2026-05-14T00:00:00.000Z",
};

const secondDocument: DocumentPayload = {
  ...document,
  path: "/workspace/docs/b.adoc",
  source: "= B",
};

describe("workspace state helpers", () => {
  it("deduplicates recent documents and directories", () => {
    const recentDocuments = addRecentDocument(
      addRecentDocument([], document, "2026-05-14T00:00:00.000Z"),
      { ...document, source: "= A2" },
      "2026-05-14T01:00:00.000Z",
    );
    const recentDirectories = addRecentDirectory(
      addRecentDirectory([], "/workspace/docs", "2026-05-14T00:00:00.000Z"),
      "/workspace/docs",
      "2026-05-14T01:00:00.000Z",
    );

    expect(recentDocuments).toHaveLength(1);
    expect(recentDocuments[0].lastOpenedAt).toBe("2026-05-14T01:00:00.000Z");
    expect(recentDirectories).toHaveLength(1);
    expect(recentDirectories[0].name).toBe("docs");
  });

  it("stores Windows path basenames for recent directories", () => {
    const recentDirectories = addRecentDirectory(
      [],
      "C:\\Users\\me\\project",
      "2026-05-14T00:00:00.000Z",
    );

    expect(recentDirectories[0].name).toBe("project");
  });

  it("keeps pinned open tabs first", () => {
    const workspace = {
      openTabs: ["/a.adoc", "/b.adoc", "/c.adoc"],
      pinnedTabs: ["/c.adoc", "/missing.adoc"],
    } as WorkspaceState;

    expect(sortedOpenTabPaths(workspace)).toEqual([
      "/c.adoc",
      "/a.adoc",
      "/b.adoc",
    ]);
  });

  it("toggles pinned tabs by path", () => {
    expect(togglePinnedTab(["/a.adoc"], "/b.adoc")).toEqual([
      "/a.adoc",
      "/b.adoc",
    ]);
    expect(togglePinnedTab(["/a.adoc", "/b.adoc"], "/a.adoc")).toEqual([
      "/b.adoc",
    ]);
  });

  it("keeps target and pinned tabs when closing other tabs", () => {
    expect(
      closeOtherOpenTabPaths(
        ["/a.adoc", "/b.adoc", "/c.adoc", "/d.adoc"],
        ["/b.adoc", "/missing.adoc"],
        "/d.adoc",
      ),
    ).toEqual(["/b.adoc", "/d.adoc"]);
  });

  it("keeps all pinned tabs when the close-others target is pinned", () => {
    expect(
      closeOtherOpenTabPaths(
        ["/a.adoc", "/b.adoc", "/c.adoc"],
        ["/a.adoc", "/c.adoc"],
        "/a.adoc",
      ),
    ).toEqual(["/a.adoc", "/c.adoc"]);
  });

  it("maintains window-local recent tab MRU order", () => {
    expect(
      updateRecentTabs(["/a.adoc"], "/b.adoc", ["/a.adoc", "/b.adoc"]),
    ).toEqual(["/b.adoc", "/a.adoc"]);
    expect(
      updateRecentTabs(["/b.adoc", "/a.adoc"], "/a.adoc", [
        "/a.adoc",
        "/b.adoc",
      ]),
    ).toEqual(["/a.adoc", "/b.adoc"]);
  });

  it("prunes missing and duplicate recent tabs", () => {
    expect(
      pruneRecentTabs(["/a.adoc", "/missing.adoc", "/a.adoc", "/b.adoc"], [
        "/a.adoc",
        "/b.adoc",
      ]),
    ).toEqual(["/a.adoc", "/b.adoc"]);
  });

  it("selects the first recent tab that is open and not active", () => {
    expect(
      nextRecentTabPath(
        ["/active.adoc", "/previous.adoc", "/older.adoc"],
        "/active.adoc",
        ["/active.adoc", "/previous.adoc"],
      ),
    ).toBe("/previous.adoc");
    expect(nextRecentTabPath(["/active.adoc"], "/active.adoc", ["/active.adoc"])).toBeNull();
  });

  it("adds a new open tab at the end", () => {
    expect(upsertOpenTab([document], secondDocument)).toEqual([
      document,
      secondDocument,
    ]);
  });

  it("replaces an existing open tab payload without moving it", () => {
    const refreshed = { ...document, source: "= A refreshed" };

    expect(upsertOpenTab([secondDocument, document], refreshed)).toEqual([
      secondDocument,
      refreshed,
    ]);
  });

  it("collapses duplicated open tabs for the same path", () => {
    const refreshed = { ...document, source: "= A refreshed" };

    expect(
      upsertOpenTab([document, secondDocument, { ...document }], refreshed),
    ).toEqual([refreshed, secondDocument]);
  });

  it("collapses open tabs that differ only by current directory segments", () => {
    const dottedDocument = {
      ...document,
      path: "/workspace/docs/./a.adoc",
      basePath: "/workspace/docs/.",
    };
    const refreshed = { ...document, source: "= A refreshed" };

    expect(upsertOpenTab([dottedDocument, secondDocument], refreshed)).toEqual([
      refreshed,
      secondDocument,
    ]);
  });

  it("removes closed document paths from persisted path state", () => {
    expect(
      removeWorkspacePathStateEntries(
        {
          "/workspace/docs/a.adoc": 10,
          "/workspace/docs/b.adoc": 20,
        },
        ["/workspace/docs/a.adoc"],
      ),
    ).toEqual({ "/workspace/docs/b.adoc": 20 });

    expect(
      removeWorkspacePathStateEntries(
        {
          "/workspace/docs/a.adoc": "intro",
          "/workspace/docs/b.adoc": "details",
        },
        ["/workspace/docs/b.adoc"],
      ),
    ).toEqual({ "/workspace/docs/a.adoc": "intro" });
  });

  it("prunes persisted path state while preserving priority paths", () => {
    const entries = Object.fromEntries(
      Array.from({ length: maxWorkspacePathStateEntries + 5 }, (_, index) => [
        `/workspace/docs/${index}.adoc`,
        index,
      ]),
    );
    const priorityPath = "/workspace/docs/0.adoc";
    const pruned = pruneWorkspacePathState(entries, [priorityPath]);

    expect(Object.keys(pruned)).toHaveLength(maxWorkspacePathStateEntries);
    expect(pruned[priorityPath]).toBe(0);
    expect(pruned["/workspace/docs/1.adoc"]).toBeUndefined();
    expect(pruned["/workspace/docs/204.adoc"]).toBe(204);
  });
});
