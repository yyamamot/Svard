import { afterEach, describe, expect, it, vi } from "vitest";

import {
  rootDirectory,
  expandedDirectory,
  documentPayload,
  bootConfig,
  buildAdditionalWindowRestoreRequests,
  createBootHost,
  defaultConfig,
  mountedBootCleanups,
  mountWorkspaceBoot,
  maxRestoredAdditionalWindows,
  normalizeConfig,
  flushAsyncWork,
  resetViewerWindowOpenRequestCacheForTest,
  selectWorkspaceBootSession,
  stateFromDispatchCalls,
  takeViewerWindowOpenRequest,
  workspaceSessionFromNewWindowRequest,
} from "./helpers/workspaceBootHarness";
import type {
  AppConfig,
  ViewerWindowOpenRequest,
} from "./helpers/workspaceBootHarness";

describe("workspace boot path semantics", () => {
  afterEach(() => {
    for (const cleanup of [...mountedBootCleanups]) {
      cleanup();
    }
    resetViewerWindowOpenRequestCacheForTest();
  });

  it("restores a new-window session and split snapshot through the mounted hook", async () => {
    const targetPath = "/workspace/docs/new-window.md";
    const payload = documentPayload(targetPath);
    const requestLayout = {
      leftSidebarWidth: 312,
      rightSidebarWidth: 356,
      openFilesHeight: 188,
      openFilesCollapsed: true,
    };
    const request: ViewerWindowOpenRequest = {
      sessionId: "viewer-1",
      path: targetPath,
      activePath: targetPath,
      openTabs: [targetPath],
      pinnedTabs: [targetPath],
      recentTabs: [targetPath],
      scrollPositions: { [targetPath]: 144 },
      activeHeadingByPath: { [targetPath]: "new-window-heading" },
      splitSession: {
        enabled: true,
        focusedPaneId: "right",
        splitRatio: 0.6,
        panePaths: {
          left: targetPath,
          right: targetPath,
        },
      },
      rootDirectory,
      expandedDirectories: [expandedDirectory],
      sidebarTab: "bookmarks",
      sidebarVisible: false,
      rightSidebarVisible: true,
      layout: requestLayout,
      bookmarks: [{ kind: "directory", path: expandedDirectory }],
    };
    const host = createBootHost({
      config: bootConfig({ activePath: "/workspace/docs/stale.md" }),
      documents: { [targetPath]: payload },
      request,
    });
    const { setters } = mountWorkspaceBoot(host);

    await flushAsyncWork();

    expect(setters.setWindowSessionId).toHaveBeenCalledWith("viewer-1");
    expect(setters.setConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        layout: requestLayout,
        sidebarVisible: false,
        workspace: expect.objectContaining({
          activePath: targetPath,
          expandedDirectories: [expandedDirectory],
          lastDirectory: rootDirectory,
          openTabs: [targetPath],
          pinnedTabs: [targetPath],
        }),
      }),
    );
    expect(setters.setDocumentPayload).toHaveBeenCalledWith(payload);
    expect(setters.setSidebarLayout).toHaveBeenCalledWith(requestLayout);
    expect(setters.setSplitEnabled).toHaveBeenCalledWith(true);
    expect(setters.setFocusedPaneId).toHaveBeenCalledWith("right");
    expect(setters.setSplitRatio).toHaveBeenCalledWith(0.6);
    expect(setters.setPendingNavigationLocation).toHaveBeenCalledWith({
      headingId: "new-window-heading",
      label: "new-window-heading",
      path: targetPath,
      scrollTop: 144,
    });
    expect(setters.setWorkspaceBootComplete).toHaveBeenLastCalledWith(true);
    expect(host.openNewWindow).not.toHaveBeenCalled();
  });

  it("defaults omitted optional fields in a minimal new-window request", async () => {
    const targetPath = "/workspace/docs/minimal-window.md";
    const payload = documentPayload(targetPath);
    const request: ViewerWindowOpenRequest = {
      sessionId: "viewer-minimal",
      path: targetPath,
      rootDirectory,
      expandedDirectories: [expandedDirectory],
      sidebarTab: "files",
      bookmarks: [],
    };
    const config = bootConfig({ activePath: "/workspace/docs/stale.md" });
    const host = createBootHost({
      config,
      documents: { [targetPath]: payload },
      request,
    });
    const { setters } = mountWorkspaceBoot(host);

    await flushAsyncWork();

    expect(setters.setWindowSessionId).toHaveBeenCalledWith("viewer-minimal");
    expect(setters.setConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        layout: config.layout,
        rightSidebarVisible: config.rightSidebarVisible,
        sidebarVisible: config.sidebarVisible,
        workspace: expect.objectContaining({
          activePath: targetPath,
          openTabs: [targetPath],
          pinnedTabs: [],
          recentTabs: [targetPath],
          splitSession: null,
        }),
      }),
    );
    expect(setters.setDocumentPayload).toHaveBeenCalledWith(payload);
    expect(setters.setSplitEnabled).toHaveBeenCalledWith(false);
    expect(setters.setFocusedPaneId).toHaveBeenCalledWith("left");
    expect(setters.setSplitRatio).toHaveBeenCalledWith(0.5);
    expect(setters.setPendingNavigationLocation).not.toHaveBeenCalled();
    expect(setters.setWorkspaceBootComplete).toHaveBeenLastCalledWith(true);
  });

  it("keeps an empty new-window request empty instead of restoring its saved session", async () => {
    const stalePath = "/workspace/docs/saved-viewer.md";
    const baseConfig = normalizeConfig(bootConfig({ activePath: stalePath }));
    const config: AppConfig = {
      ...baseConfig,
      workspace: {
        ...baseConfig.workspace,
        windowSessions: {
          ...baseConfig.workspace.windowSessions,
          "viewer-empty": {
            ...baseConfig.workspace.windowSessions.main,
            activePath: stalePath,
            openTabs: [stalePath],
            recentTabs: [stalePath],
          },
        },
      },
    };
    const request: ViewerWindowOpenRequest = {
      sessionId: "viewer-empty",
      path: null,
      rootDirectory,
      expandedDirectories: [expandedDirectory],
      sidebarTab: "bookmarks",
      bookmarks: [],
    };
    const host = createBootHost({ config, request });
    const { setters } = mountWorkspaceBoot(host);

    await flushAsyncWork();

    expect(host.openDocument).not.toHaveBeenCalled();
    expect(setters.setWindowSessionId).toHaveBeenCalledWith("viewer-empty");
    expect(setters.setConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: expect.objectContaining({
          activePath: null,
          openTabs: [],
          recentTabs: [],
        }),
      }),
    );
    expect(setters.setDocumentPayload).toHaveBeenCalledWith(null);
    expect(setters.setTabs).toHaveBeenCalledTimes(1);
    expect(stateFromDispatchCalls(setters.setTabs, [])).toEqual([]);
    expect(setters.setSplitEnabled).toHaveBeenCalledWith(false);
    expect(setters.setWorkspaceBootComplete).toHaveBeenLastCalledWith(true);
  });

  it("reuses the same new-window request across a StrictMode remount", async () => {
    const targetPath = "/workspace/docs/strict-window.md";
    const payload = documentPayload(targetPath);
    const request: ViewerWindowOpenRequest = {
      sessionId: "viewer-strict",
      path: targetPath,
      rootDirectory,
      expandedDirectories: [expandedDirectory],
      sidebarTab: "files",
      bookmarks: [],
    };
    const host = createBootHost({
      config: bootConfig({ activePath: "/workspace/docs/main.md" }),
      documents: { [targetPath]: payload },
      request,
    });
    const { setters } = mountWorkspaceBoot(host, { strictMode: true });

    await flushAsyncWork();

    expect(host.takeCurrentViewerWindowOpenRequest).toHaveBeenCalledTimes(1);
    expect(setters.setConfig).toHaveBeenCalledTimes(1);
    expect(setters.setDocumentPayload).toHaveBeenCalledTimes(1);
    expect(setters.setDocumentPayload).toHaveBeenCalledWith(payload);
    expect(stateFromDispatchCalls(setters.setTabs, [])).toEqual([payload]);
    expect(setters.setIsLoading).toHaveBeenCalledTimes(1);
    expect(setters.setIsLoading).toHaveBeenCalledWith(false);
    expect(setters.setWorkspaceBootComplete).toHaveBeenCalledTimes(1);
    expect(setters.setWorkspaceBootComplete).toHaveBeenCalledWith(true);
    expect(host.openNewWindow).not.toHaveBeenCalled();
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
    const baseSession =
      normalizeConfig(defaultConfig).workspace.windowSessions.main;
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
    const mainSession =
      normalizeConfig(defaultConfig).workspace.windowSessions.main;
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
    const mainSession =
      normalizeConfig(defaultConfig).workspace.windowSessions.main;
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
        restorableWindowSessionIds: ["main", "empty", ...Object.keys(sessions)],
      },
    });

    const requests = buildAdditionalWindowRestoreRequests(config);

    expect(requests).toHaveLength(maxRestoredAdditionalWindows);
    expect(requests.map((request) => request.sessionId)).not.toContain("main");
    expect(requests.map((request) => request.sessionId)).not.toContain("empty");
  });

  it("does not restore stale non-main sessions outside the restore list", () => {
    const mainSession =
      normalizeConfig(defaultConfig).workspace.windowSessions.main;
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
