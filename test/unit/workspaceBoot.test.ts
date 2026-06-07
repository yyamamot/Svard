import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultConfig } from "../../src/core/defaultConfig";
import { normalizeConfig } from "../../src/ui/lib/config";
import {
  buildAdditionalWindowRestoreRequests,
  maxRestoredAdditionalWindows,
  resetViewerWindowOpenRequestCacheForTest,
  selectWorkspaceBootSession,
  takeViewerWindowOpenRequest,
  workspaceSessionFromNewWindowRequest,
} from "../../src/ui/hooks/useWorkspaceBoot";

describe("workspace boot path semantics", () => {
  afterEach(() => {
    resetViewerWindowOpenRequestCacheForTest();
  });

  it("delegates root restore and expanded directory resolution to HostAdapter", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/ui/hooks/useWorkspaceBoot.ts"),
      "utf8",
    );

    expect(source).toContain("host.resolveWorkspacePaths");
    expect(source).toContain("documentPath: initialPath");
    expect(source).toContain(
      ".authorizeDirectory(preResolvedWorkspace.initialDirectory)",
    );
    expect(source).toContain("documentPath: nextDocument?.path ?? null");
    expect(source).toContain(
      "expandedDirectories: bootWorkspace.expandedDirectories",
    );
    expect(source).toContain("const nextDirectoryErrors");
    expect(source).toContain("setDirectoryErrors(nextDirectoryErrors)");
    expect(source).not.toContain(
      "await host.listDirectory(initialDirectory).catch(() => [])",
    );
    expect(source).not.toContain("isPathInsideRoot");
    expect(source).not.toContain("directoryAncestors");
    expect(source).not.toContain("pathDepth");
  });

  it("caches the viewer window launch request across StrictMode remounts", async () => {
    const request = {
      sessionId: "viewer-1",
      path: "/workspace/docs/target.md",
      rootDirectory: "/workspace",
      expandedDirectories: ["/workspace/docs"],
      sidebarTab: "files" as const,
      sidebarVisible: false,
      rightSidebarVisible: true,
      layout: {
        leftSidebarWidth: 300,
        rightSidebarWidth: 340,
        openFilesHeight: 180,
        openFilesCollapsed: true,
      },
      bookmarks: [],
    };
    const takeCurrentViewerWindowOpenRequest = vi
      .fn()
      .mockResolvedValueOnce(request)
      .mockResolvedValueOnce(null);

    await expect(
      takeViewerWindowOpenRequest({ takeCurrentViewerWindowOpenRequest }),
    ).resolves.toEqual(request);
    await expect(
      takeViewerWindowOpenRequest({ takeCurrentViewerWindowOpenRequest }),
    ).resolves.toEqual(request);
    expect(takeCurrentViewerWindowOpenRequest).toHaveBeenCalledTimes(1);
  });

  it("shares the in-flight viewer window launch request across concurrent boots", async () => {
    const request = {
      sessionId: "viewer-1",
      path: "/workspace/docs/target.md",
      rootDirectory: "/workspace",
      expandedDirectories: ["/workspace/docs"],
      sidebarTab: "files" as const,
      sidebarVisible: false,
      rightSidebarVisible: true,
      layout: {
        leftSidebarWidth: 300,
        rightSidebarWidth: 340,
        openFilesHeight: 180,
        openFilesCollapsed: true,
      },
      bookmarks: [],
    };
    const takeCurrentViewerWindowOpenRequest = vi
      .fn()
      .mockResolvedValue(request);

    await expect(
      Promise.all([
        takeViewerWindowOpenRequest({ takeCurrentViewerWindowOpenRequest }),
        takeViewerWindowOpenRequest({ takeCurrentViewerWindowOpenRequest }),
      ]),
    ).resolves.toEqual([request, request]);
    expect(takeCurrentViewerWindowOpenRequest).toHaveBeenCalledTimes(1);
  });

  it("defaults missing recentTabs to an empty normalized window session field", () => {
    const baseSession = normalizeConfig(defaultConfig).workspace.windowSessions.main;
    const normalized = normalizeConfig({
      ...defaultConfig,
      workspace: {
        ...defaultConfig.workspace,
        recentTabs: undefined as unknown as string[],
        windowSessions: {
          main: {
            ...baseSession,
            recentTabs: undefined as unknown as string[],
          },
        },
        restorableWindowSessionIds: ["viewer-restore-1"],
      },
    });

    expect(normalized.workspace.recentTabs).toEqual([]);
    expect(normalized.workspace.windowSessions.main.recentTabs).toEqual([]);
  });

  it("uses an empty launch request instead of restoring a saved viewer session", () => {
    const workspace = normalizeConfig(defaultConfig).workspace;
    const savedSession = {
      ...workspace.windowSessions.main,
      activePath: "/workspace/docs/current.md",
      openTabs: ["/workspace/docs/current.md"],
      recentTabs: ["/workspace/docs/current.md"],
    };
    const baseWorkspace = {
      ...workspace,
      windowSessions: {
        ...workspace.windowSessions,
        "viewer-1": savedSession,
      },
    };
    const launchSession = workspaceSessionFromNewWindowRequest(
      {
        sessionId: "viewer-1",
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
      baseWorkspace,
    );

    expect(
      selectWorkspaceBootSession({
        baseWorkspace,
        launchSession,
        windowSessionId: "viewer-1",
      }),
    ).toMatchObject({
      activePath: null,
      openTabs: [],
      lastDirectory: "/workspace",
      expandedDirectories: ["/workspace/docs"],
      sidebarTab: "bookmarks",
    });
  });

  it("uses the launch target path instead of restoring the current saved document", () => {
    const workspace = normalizeConfig(defaultConfig).workspace;
    const baseWorkspace = {
      ...workspace,
      windowSessions: {
        ...workspace.windowSessions,
        "viewer-1": {
          ...workspace.windowSessions.main,
          activePath: "/workspace/docs/current.md",
          openTabs: ["/workspace/docs/current.md"],
          recentTabs: ["/workspace/docs/current.md"],
        },
      },
    };
    const launchSession = workspaceSessionFromNewWindowRequest(
      {
        sessionId: "viewer-1",
        path: "/workspace/docs/right-click-target.md",
        rootDirectory: "/workspace",
        expandedDirectories: ["/workspace/docs"],
        sidebarTab: "files",
        sidebarVisible: false,
        rightSidebarVisible: true,
        layout: {
          leftSidebarWidth: 300,
          rightSidebarWidth: 340,
          openFilesHeight: 180,
          openFilesCollapsed: true,
        },
        bookmarks: [],
      },
      baseWorkspace,
    );

    expect(
      selectWorkspaceBootSession({
        baseWorkspace,
        launchSession,
        windowSessionId: "viewer-1",
      }),
    ).toMatchObject({
      activePath: "/workspace/docs/right-click-target.md",
      openTabs: ["/workspace/docs/right-click-target.md"],
      recentTabs: ["/workspace/docs/right-click-target.md"],
    });
  });

  it("keeps moved pinned tabs pinned in the new window launch session", () => {
    const workspace = normalizeConfig(defaultConfig).workspace;
    const launchSession = workspaceSessionFromNewWindowRequest(
      {
        sessionId: "viewer-1",
        path: "/workspace/docs/pinned-target.md",
        rootDirectory: "/workspace",
        expandedDirectories: ["/workspace/docs"],
        sidebarTab: "files",
        pinned: true,
        bookmarks: [],
      },
      workspace,
    );

    expect(launchSession).toMatchObject({
      activePath: "/workspace/docs/pinned-target.md",
      openTabs: ["/workspace/docs/pinned-target.md"],
      pinnedTabs: ["/workspace/docs/pinned-target.md"],
      recentTabs: ["/workspace/docs/pinned-target.md"],
    });
  });

  it("uses Duplicate Window session snapshot when provided", () => {
    const workspace = normalizeConfig(defaultConfig).workspace;
    const launchSession = workspaceSessionFromNewWindowRequest(
      {
        sessionId: "viewer-1",
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
      },
      workspace,
    );

    expect(launchSession).toMatchObject({
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
    });
  });

  it("does not build additional window restore requests when disabled", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      experimental: {
        ...defaultConfig.experimental,
        restoreAdditionalWindowsOnStartup: false,
      },
    });

    expect(buildAdditionalWindowRestoreRequests(config)).toEqual([]);
  });

  it("builds additional window restore requests from non-main sessions", () => {
    const mainSession = normalizeConfig(defaultConfig).workspace.windowSessions.main;
    const config = normalizeConfig({
      ...defaultConfig,
      sidebarVisible: false,
      rightSidebarVisible: true,
      layout: {
        ...defaultConfig.layout,
        leftSidebarWidth: 320,
      },
      experimental: {
        ...defaultConfig.experimental,
        restoreAdditionalWindowsOnStartup: true,
      },
      workspace: {
        ...defaultConfig.workspace,
        bookmarks: [
          {
            kind: "file",
            path: "/workspace/docs/current.md",
          },
        ],
        windowSessions: {
          main: {
            ...mainSession,
            activePath: "/workspace/docs/main.md",
            openTabs: ["/workspace/docs/main.md"],
          },
          "viewer-restore-1": {
            ...mainSession,
            activePath: "/workspace/docs/current.md",
            openTabs: [
              "/workspace/docs/current.md",
              "/workspace/docs/other.md",
            ],
            pinnedTabs: ["/workspace/docs/current.md"],
            recentTabs: [
              "/workspace/docs/current.md",
              "/workspace/docs/other.md",
            ],
            scrollPositions: {
              "/workspace/docs/current.md": 240,
            },
            activeHeadingByPath: {
              "/workspace/docs/current.md": "overview",
            },
            splitSession: {
              enabled: true,
              focusedPaneId: "right",
              splitRatio: 0.55,
              panePaths: {
                left: "/workspace/docs/current.md",
                right: "/workspace/docs/other.md",
              },
            },
            lastDirectory: "/workspace",
            expandedDirectories: ["/workspace/docs"],
            sidebarTab: "bookmarks",
          },
        },
        restorableWindowSessionIds: ["viewer-restore-1"],
      },
    });

    expect(buildAdditionalWindowRestoreRequests(config)).toEqual([
      expect.objectContaining({
        sessionId: "viewer-restore-1",
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
        splitSession: expect.objectContaining({
          enabled: true,
          focusedPaneId: "right",
        }),
        rootDirectory: "/workspace",
        expandedDirectories: ["/workspace/docs"],
        sidebarTab: "bookmarks",
        sidebarVisible: false,
        rightSidebarVisible: true,
        layout: expect.objectContaining({
          leftSidebarWidth: 320,
        }),
        bookmarks: [
          {
            kind: "file",
            path: "/workspace/docs/current.md",
          },
        ],
      }),
    ]);
  });

  it("skips empty additional sessions and caps restore requests", () => {
    const mainSession = normalizeConfig(defaultConfig).workspace.windowSessions.main;
    const sessions = Object.fromEntries(
      Array.from({ length: maxRestoredAdditionalWindows + 2 }, (_, index) => [
        `viewer-${index}`,
        {
          ...mainSession,
          activePath: `/workspace/docs/${index}.md`,
          openTabs: [`/workspace/docs/${index}.md`],
        },
      ]),
    );
    const config = normalizeConfig({
      ...defaultConfig,
      experimental: {
        ...defaultConfig.experimental,
        restoreAdditionalWindowsOnStartup: true,
      },
      workspace: {
        ...defaultConfig.workspace,
        windowSessions: {
          main: {
            ...mainSession,
            activePath: "/workspace/docs/main.md",
            openTabs: ["/workspace/docs/main.md"],
          },
          empty: mainSession,
          ...sessions,
        },
        restorableWindowSessionIds: [
          "main",
          "empty",
          ...Object.keys(sessions),
        ],
      },
    });

    const requests = buildAdditionalWindowRestoreRequests(config);

    expect(requests).toHaveLength(maxRestoredAdditionalWindows);
    expect(requests.map((request) => request.sessionId)).not.toContain("main");
    expect(requests.map((request) => request.sessionId)).not.toContain("empty");
  });

  it("does not restore stale non-main sessions outside the restore list", () => {
    const mainSession = normalizeConfig(defaultConfig).workspace.windowSessions.main;
    const config = normalizeConfig({
      ...defaultConfig,
      experimental: {
        ...defaultConfig.experimental,
        restoreAdditionalWindowsOnStartup: true,
      },
      workspace: {
        ...defaultConfig.workspace,
        windowSessions: {
          main: mainSession,
          "viewer-stale": {
            ...mainSession,
            activePath: "/workspace/docs/stale.md",
            openTabs: ["/workspace/docs/stale.md"],
          },
        },
        restorableWindowSessionIds: [],
      },
    });

    expect(buildAdditionalWindowRestoreRequests(config)).toEqual([]);
  });
});
