import { describe, expect, it } from "vitest";
import { defaultConfig } from "../../src/core/defaultConfig";
import {
  mergePersistedSharedConfigIntoWindow,
  mergeWorkspaceConfigForSave,
  mergeWindowConfigForSave,
} from "../../src/ui/lib/windowConfig";
import { workspaceSessionFromWorkspace } from "../../src/ui/lib/config";

describe("window config merge", () => {
  it("keeps other window sessions while saving current shared settings and session", () => {
    const persistedConfig = {
      ...defaultConfig,
      theme: "light" as const,
      zoom: 100,
      workspace: {
        ...defaultConfig.workspace,
        activePath: "/workspace/docs/main.md",
        openTabs: ["/workspace/docs/main.md"],
        lastDirectory: "/workspace/docs",
        expandedDirectories: ["/workspace/docs"],
        windowSessions: {
          other: {
            ...workspaceSessionFromWorkspace(defaultConfig.workspace),
            activePath: "/workspace/docs/other.md",
            openTabs: ["/workspace/docs/other.md"],
          },
        },
      },
    };
    const windowConfig = {
      ...defaultConfig,
      theme: "dark" as const,
      zoom: 120,
      workspace: {
        ...defaultConfig.workspace,
        activePath: "/workspace/docs/viewer.md",
        openTabs: ["/workspace/docs/viewer.md"],
        bookmarks: [
          {
            kind: "file" as const,
            path: "/workspace/docs/viewer.md",
          },
        ],
      },
    };

    expect(
      mergeWindowConfigForSave({
        persistedConfig,
        windowConfig,
        windowSessionId: "viewer-1",
      }),
    ).toMatchObject({
      theme: "dark",
      zoom: 120,
      workspace: {
        bookmarks: [
          {
            kind: "file",
            path: "/workspace/docs/viewer.md",
          },
        ],
        windowSessions: {
          other: {
            activePath: "/workspace/docs/other.md",
            openTabs: ["/workspace/docs/other.md"],
          },
          "viewer-1": {
            activePath: "/workspace/docs/viewer.md",
            openTabs: ["/workspace/docs/viewer.md"],
          },
        },
        restorableWindowSessionIds: ["viewer-1"],
      },
    });
  });

  it("does not add main window to additional window restore candidates", () => {
    const mainWindowConfig = {
      ...defaultConfig,
      workspace: {
        ...defaultConfig.workspace,
        activePath: "/workspace/docs/main.md",
        openTabs: ["/workspace/docs/main.md"],
      },
    };

    expect(
      mergeWorkspaceConfigForSave({
        persistedConfig: {
          ...defaultConfig,
          workspace: {
            ...defaultConfig.workspace,
            restorableWindowSessionIds: ["viewer-existing"],
          },
        },
        windowConfig: mainWindowConfig,
        windowSessionId: "main",
      }).workspace.restorableWindowSessionIds,
    ).toEqual(["viewer-existing"]);
  });

  it("removes empty viewer sessions from additional window restore candidates", () => {
    const emptyViewerConfig = {
      ...defaultConfig,
      workspace: {
        ...defaultConfig.workspace,
        activePath: null,
        openTabs: [],
        lastDirectory: null,
      },
    };

    expect(
      mergeWorkspaceConfigForSave({
        persistedConfig: {
          ...defaultConfig,
          workspace: {
            ...defaultConfig.workspace,
            restorableWindowSessionIds: ["viewer-1", "viewer-existing"],
          },
        },
        windowConfig: emptyViewerConfig,
        windowSessionId: "viewer-1",
      }).workspace.restorableWindowSessionIds,
    ).toEqual(["viewer-existing"]);
  });

  it("does not let viewer window chrome overwrite main window chrome on save", () => {
    const persistedConfig = {
      ...defaultConfig,
      sidebarVisible: true,
      rightSidebarVisible: true,
      layout: {
        ...defaultConfig.layout,
        openFilesCollapsed: false,
      },
    };
    const viewerWindowConfig = {
      ...defaultConfig,
      sidebarVisible: false,
      rightSidebarVisible: false,
      layout: {
        ...defaultConfig.layout,
        openFilesCollapsed: true,
      },
    };

    expect(
      mergeWindowConfigForSave({
        persistedConfig,
        windowConfig: viewerWindowConfig,
        windowSessionId: "viewer-1",
      }),
    ).toMatchObject({
      sidebarVisible: true,
      rightSidebarVisible: true,
      layout: {
        openFilesCollapsed: false,
      },
    });
  });

  it("persists main window chrome on save", () => {
    const mainWindowConfig = {
      ...defaultConfig,
      sidebarVisible: false,
      rightSidebarVisible: false,
      layout: {
        ...defaultConfig.layout,
        openFilesCollapsed: true,
      },
    };

    expect(
      mergeWindowConfigForSave({
        persistedConfig: defaultConfig,
        windowConfig: mainWindowConfig,
        windowSessionId: "main",
      }),
    ).toMatchObject({
      sidebarVisible: false,
      rightSidebarVisible: false,
      layout: {
        openFilesCollapsed: true,
      },
    });
  });

  it("applies persisted shared settings without replacing window session", () => {
    const persistedConfig = {
      ...defaultConfig,
      theme: "dark" as const,
      sidebarVisible: false,
      rightSidebarVisible: false,
      zoom: 120,
      layout: {
        ...defaultConfig.layout,
        openFilesCollapsed: true,
      },
      workspace: {
        ...defaultConfig.workspace,
        activePath: "/workspace/docs/main.md",
        openTabs: ["/workspace/docs/main.md"],
        sidebarTab: "bookmarks" as const,
        expandedDirectories: ["/workspace/main"],
        splitSession: {
          enabled: true,
          focusedPaneId: "left" as const,
          splitRatio: 0.4,
          panePaths: {
            left: "/workspace/docs/main.md",
            right: "/workspace/docs/ref.md",
          },
        },
        bookmarks: [
          {
            kind: "file" as const,
            path: "/workspace/docs/shared.md",
          },
        ],
      },
    };
    const viewerWindowConfig = {
      ...defaultConfig,
      theme: "light" as const,
      sidebarVisible: true,
      rightSidebarVisible: true,
      zoom: 100,
      layout: {
        ...defaultConfig.layout,
        openFilesCollapsed: false,
      },
      workspace: {
        ...defaultConfig.workspace,
        activePath: "/workspace/docs/viewer.md",
        openTabs: ["/workspace/docs/viewer.md"],
        sidebarTab: "files" as const,
        expandedDirectories: ["/workspace/viewer"],
        splitSession: null,
      },
    };

    expect(
      mergePersistedSharedConfigIntoWindow({
        persistedConfig,
        windowConfig: viewerWindowConfig,
      }),
    ).toMatchObject({
      theme: "dark",
      sidebarVisible: true,
      rightSidebarVisible: true,
      zoom: 120,
      layout: {
        openFilesCollapsed: false,
      },
      workspace: {
        activePath: "/workspace/docs/viewer.md",
        openTabs: ["/workspace/docs/viewer.md"],
        sidebarTab: "files",
        expandedDirectories: ["/workspace/viewer"],
        splitSession: null,
        bookmarks: [
          {
            kind: "file",
            path: "/workspace/docs/shared.md",
          },
        ],
      },
    });
  });

  it("keeps main window session when another window writes shared settings", () => {
    const persistedConfig = {
      ...defaultConfig,
      theme: "dark" as const,
      workspace: {
        ...defaultConfig.workspace,
        activePath: "/workspace/docs/other.md",
        openTabs: ["/workspace/docs/other.md"],
        sidebarTab: "bookmarks" as const,
        bookmarks: [
          {
            kind: "file" as const,
            path: "/workspace/docs/shared.md",
          },
        ],
      },
    };
    const mainWindowConfig = {
      ...defaultConfig,
      theme: "light" as const,
      workspace: {
        ...defaultConfig.workspace,
        activePath: "/workspace/docs/main.md",
        openTabs: ["/workspace/docs/main.md"],
        sidebarTab: "files" as const,
      },
    };

    expect(
      mergePersistedSharedConfigIntoWindow({
        persistedConfig,
        windowConfig: mainWindowConfig,
      }),
    ).toMatchObject({
      theme: "dark",
      workspace: {
        activePath: "/workspace/docs/main.md",
        openTabs: ["/workspace/docs/main.md"],
        sidebarTab: "files",
        bookmarks: [
          {
            kind: "file",
            path: "/workspace/docs/shared.md",
          },
        ],
      },
    });
  });

  it("keeps persisted shared settings when saving workspace session state", () => {
    const persistedConfig = {
      ...defaultConfig,
      theme: "dark" as const,
      zoom: 125,
      experimental: {
        searchHitRuler: true,
        restoreAdditionalWindowsOnStartup: true,
        diagramPlaceholderRendering: true,
        postDiffGitMarkers: true,
      },
      workspace: {
        ...defaultConfig.workspace,
        windowSessions: {
          other: {
            ...workspaceSessionFromWorkspace(defaultConfig.workspace),
            activePath: "/workspace/docs/other.md",
            openTabs: ["/workspace/docs/other.md"],
          },
        },
      },
    };
    const staleWindowConfig = {
      ...defaultConfig,
      theme: "light" as const,
      zoom: 100,
      experimental: {
        searchHitRuler: false,
        restoreAdditionalWindowsOnStartup: false,
        diagramPlaceholderRendering: false,
        postDiffGitMarkers: false,
      },
      workspace: {
        ...defaultConfig.workspace,
        activePath: "/workspace/docs/current.md",
        openTabs: ["/workspace/docs/current.md"],
      },
    };

    expect(
      mergeWorkspaceConfigForSave({
        persistedConfig,
        windowConfig: staleWindowConfig,
        windowSessionId: "main",
      }),
    ).toMatchObject({
      theme: "dark",
      zoom: 125,
      experimental: {
        searchHitRuler: true,
        restoreAdditionalWindowsOnStartup: true,
        diagramPlaceholderRendering: true,
        postDiffGitMarkers: true,
      },
      workspace: {
        windowSessions: {
          other: {
            activePath: "/workspace/docs/other.md",
          },
          main: {
            activePath: "/workspace/docs/current.md",
            openTabs: ["/workspace/docs/current.md"],
          },
        },
      },
    });
  });
});
