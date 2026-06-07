import { describe, expect, it } from "vitest";
import { MockHostAdapter } from "../../src/adapters/mockHostAdapter";

describe("MockHostAdapter new window requests", () => {
  it("records empty new window requests for harness assertions", async () => {
    const host = new MockHostAdapter();

    await host.openNewWindow({
      path: null,
      rootDirectory: "/workspace",
      expandedDirectories: ["/workspace/docs"],
      sidebarTab: "bookmarks",
      sidebarVisible: false,
      rightSidebarVisible: true,
      layout: {
        leftSidebarWidth: 300,
        rightSidebarWidth: 340,
        openFilesHeight: 180,
        openFilesCollapsed: true,
      },
      bookmarks: [
        {
          kind: "directory",
          path: "/workspace/docs",
        },
      ],
    });

    expect(host.getNewWindowOpenPaths()).toEqual([]);
    expect(host.getNewWindowOpenRequests()).toEqual([
      {
        path: null,
        rootDirectory: "/workspace",
        expandedDirectories: ["/workspace/docs"],
        sidebarTab: "bookmarks",
        sidebarVisible: false,
        rightSidebarVisible: true,
        layout: {
          leftSidebarWidth: 300,
          rightSidebarWidth: 340,
          openFilesHeight: 180,
          openFilesCollapsed: true,
        },
        bookmarks: [
          {
            kind: "directory",
            path: "/workspace/docs",
          },
        ],
      },
    ]);
  });

  it("records Open in New Window target requests for harness assertions", async () => {
    const host = new MockHostAdapter();

    await host.openDocumentInNewWindow({
      path: "/workspace/docs/a.md",
      rootDirectory: "/workspace",
      expandedDirectories: ["/workspace/docs"],
      sidebarTab: "bookmarks",
      pinned: true,
      bookmarks: [
        {
          kind: "file",
          path: "/workspace/docs/a.md",
        },
      ],
    });

    expect(host.getNewWindowOpenPaths()).toEqual(["/workspace/docs/a.md"]);
    expect(host.getNewWindowOpenRequests()).toEqual([
      {
        path: "/workspace/docs/a.md",
        rootDirectory: "/workspace",
        expandedDirectories: ["/workspace/docs"],
        sidebarTab: "bookmarks",
        pinned: true,
        bookmarks: [
          {
            kind: "file",
            path: "/workspace/docs/a.md",
          },
        ],
      },
    ]);
  });

  it("records Duplicate Window session snapshot requests", async () => {
    const host = new MockHostAdapter();

    await host.openNewWindow({
      path: "/workspace/docs/current.md",
      activePath: "/workspace/docs/current.md",
      openTabs: ["/workspace/docs/current.md", "/workspace/docs/other.md"],
      pinnedTabs: ["/workspace/docs/current.md"],
      recentTabs: ["/workspace/docs/current.md", "/workspace/docs/other.md"],
      scrollPositions: {
        "/workspace/docs/current.md": 240,
      },
      activeHeadingByPath: {
        "/workspace/docs/current.md": "overview",
      },
      splitSession: null,
      rootDirectory: "/workspace",
      expandedDirectories: ["/workspace/docs"],
      sidebarTab: "files",
      bookmarks: [],
    });

    expect(host.getNewWindowOpenRequests()).toEqual([
      expect.objectContaining({
        path: "/workspace/docs/current.md",
        activePath: "/workspace/docs/current.md",
        openTabs: ["/workspace/docs/current.md", "/workspace/docs/other.md"],
        pinnedTabs: ["/workspace/docs/current.md"],
        recentTabs: ["/workspace/docs/current.md", "/workspace/docs/other.md"],
        scrollPositions: {
          "/workspace/docs/current.md": 240,
        },
        activeHeadingByPath: {
          "/workspace/docs/current.md": "overview",
        },
      }),
    ]);
  });
});
