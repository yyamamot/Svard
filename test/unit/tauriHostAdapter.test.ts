import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tauriMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  listen: vi.fn(),
  unlisten: vi.fn(),
  dragDropUnlisten: vi.fn(),
  onDragDropEvent: vi.fn(),
  scaleFactor: vi.fn(),
  openUrl: vi.fn(),
  handlers: new Map<string, (event: { payload: unknown }) => void>(),
  dragDropHandler: null as null | ((event: { payload: unknown }) => void),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: tauriMocks.invoke,
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: tauriMocks.listen,
}));

vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: () => ({
    onDragDropEvent: tauriMocks.onDragDropEvent,
  }),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    scaleFactor: tauriMocks.scaleFactor,
  }),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: tauriMocks.openUrl,
}));

import { TauriHostAdapter } from "../../src/adapters/tauriHostAdapter";

describe("TauriHostAdapter.watchDocument", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    tauriMocks.handlers.clear();
    tauriMocks.invoke.mockReset();
    tauriMocks.listen.mockReset();
    tauriMocks.unlisten.mockReset();
    tauriMocks.dragDropUnlisten.mockReset();
    tauriMocks.onDragDropEvent.mockReset();
    tauriMocks.scaleFactor.mockReset();
    tauriMocks.openUrl.mockReset();
    tauriMocks.openUrl.mockResolvedValue(undefined);
    tauriMocks.dragDropHandler = null;
    tauriMocks.scaleFactor.mockResolvedValue(2);
    tauriMocks.onDragDropEvent.mockImplementation(
      async (handler: (event: { payload: unknown }) => void) => {
        tauriMocks.dragDropHandler = handler;
        return tauriMocks.dragDropUnlisten;
      },
    );
    tauriMocks.invoke.mockImplementation((command: string, args?: unknown) => {
      if (command === "watch_document") {
        return Promise.resolve({
          watchId: "watch-1",
          path: (args as { path: string }).path,
        });
      }
      if (command === "unwatch_document") {
        return Promise.resolve();
      }
      if (command === "watch_directory") {
        return Promise.resolve({
          watchId: "directory-watch-1",
          path: (args as { path: string }).path,
        });
      }
      if (command === "unwatch_directory") {
        return Promise.resolve();
      }
      if (command === "resolve_dropped_document_path") {
        return Promise.resolve((args as { path: string }).path);
      }
      if (command === "authorize_directory") {
        return Promise.resolve();
      }
      if (command === "resolve_workspace_paths") {
        return Promise.resolve({
          initialDirectory: "/tmp/docs",
          expandedDirectories: ["/tmp/docs/guide"],
        });
      }
      if (command === "resolve_document_link") {
        return Promise.resolve({
          status: "resolved",
          path: "/tmp/docs/next.md",
          hash: "usage",
        });
      }
      if (command === "search_workspace") {
        return Promise.resolve({
          status: "ok",
          rootPath: (args as { input: { rootPath: string } }).input.rootPath,
          query: (args as { input: { query: string } }).input.query,
          results: [],
          totalMatches: 0,
          searchedFiles: 2,
          skippedFiles: 1,
          capped: false,
          message: "No matches",
        });
      }
      if (command === "resolve_local_image") {
        return Promise.resolve({
          status: "resolved",
          mediaType: "image/png",
          encoding: "base64",
          content: "AA==",
        });
      }
      if (command === "get_git_branch_diff") {
        return Promise.resolve({
          status: "ok",
          repositoryRoot: "/tmp/repo",
          currentBranch: "feature",
          headCommit: null,
          baseRef: (args as { baseRef: string }).baseRef,
          headRef: "HEAD",
          mergeBase: "1234567",
          baseCandidates: ["origin/main"],
          items: [],
          message: null,
        });
      }
      if (command === "get_git_branch_file_diff") {
        return Promise.resolve({
          status: "modified",
          repositoryRoot: "/tmp/repo",
          relativePath: (args as { relativePath: string }).relativePath,
          leftLabel: (args as { baseRef: string }).baseRef,
          rightLabel: "HEAD",
          hunks: [],
          message: null,
          leftText: null,
          rightText: null,
        });
      }
      return Promise.resolve(undefined);
    });
    tauriMocks.listen.mockImplementation(
      async (
        eventName: string,
        handler: (event: { payload: unknown }) => void,
      ) => {
        tauriMocks.handlers.set(eventName, handler);
        return tauriMocks.unlisten;
      },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("registers a native watcher and debounces matching change events", async () => {
    const adapter = new TauriHostAdapter();
    const onChange = vi.fn();
    const onError = vi.fn();

    const handle = await adapter.watchDocument(
      "/tmp/readme.adoc",
      onChange,
      onError,
    );
    const handler = tauriMocks.handlers.get("document-watch-event");

    expect(tauriMocks.invoke).toHaveBeenCalledWith("watch_document", {
      path: "/tmp/readme.adoc",
    });
    expect(handler).toBeDefined();

    handler?.({
      payload: {
        watchId: "other-watch",
        path: "/tmp/readme.adoc",
        kind: "modified",
      },
    });
    await vi.advanceTimersByTimeAsync(250);
    expect(onChange).not.toHaveBeenCalled();

    handler?.({
      payload: {
        watchId: "watch-1",
        path: "/tmp/readme.adoc",
        kind: "modified",
      },
    });
    await vi.advanceTimersByTimeAsync(199);
    expect(onChange).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(onChange).toHaveBeenCalledTimes(1);

    handle.dispose();

    expect(tauriMocks.unlisten).toHaveBeenCalledTimes(1);
    expect(tauriMocks.invoke).toHaveBeenCalledWith("unwatch_document", {
      watchId: "watch-1",
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it("does not call onChange after dispose", async () => {
    const adapter = new TauriHostAdapter();
    const onChange = vi.fn();
    const handle = await adapter.watchDocument("/tmp/readme.adoc", onChange);
    const handler = tauriMocks.handlers.get("document-watch-event");

    handle.dispose();
    handler?.({
      payload: {
        watchId: "watch-1",
        path: "/tmp/readme.adoc",
        kind: "modified",
      },
    });
    await vi.advanceTimersByTimeAsync(250);

    expect(onChange).not.toHaveBeenCalled();
  });

  it("routes native watcher errors to onError", async () => {
    const adapter = new TauriHostAdapter();
    const onError = vi.fn();
    await adapter.watchDocument("/tmp/readme.adoc", vi.fn(), onError);
    const handler = tauriMocks.handlers.get("document-watch-event");

    handler?.({
      payload: {
        watchId: "watch-1",
        path: "/tmp/readme.adoc",
        kind: "error",
      },
    });

    expect(onError).toHaveBeenCalledWith("Native file watch failed");
  });

  it("registers a native directory watcher and debounces matching change events", async () => {
    const adapter = new TauriHostAdapter();
    const onChange = vi.fn();
    const onError = vi.fn();

    const handle = await adapter.watchDirectory("/tmp/docs", onChange, onError);
    const handler = tauriMocks.handlers.get("directory-watch-event");

    expect(tauriMocks.invoke).toHaveBeenCalledWith("watch_directory", {
      path: "/tmp/docs",
      recursive: false,
    });
    expect(handler).toBeDefined();

    handler?.({
      payload: {
        watchId: "other-watch",
        path: "/tmp/docs",
        kind: "created",
      },
    });
    await vi.advanceTimersByTimeAsync(300);
    expect(onChange).not.toHaveBeenCalled();

    handler?.({
      payload: {
        watchId: "directory-watch-1",
        path: "/tmp/docs",
        changedPath: "/tmp/docs/new.md",
        kind: "created",
      },
    });
    await vi.advanceTimersByTimeAsync(249);
    expect(onChange).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(onChange).toHaveBeenCalledWith({
      path: "/tmp/docs",
      changedPath: "/tmp/docs/new.md",
      kind: "created",
    });

    handle.dispose();

    expect(tauriMocks.unlisten).toHaveBeenCalledTimes(1);
    expect(tauriMocks.invoke).toHaveBeenCalledWith("unwatch_directory", {
      watchId: "directory-watch-1",
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it("preserves the child path when a directory-level event follows a file event", async () => {
    const adapter = new TauriHostAdapter();
    const onChange = vi.fn();

    await adapter.watchDirectory("/tmp/docs", onChange);
    const handler = tauriMocks.handlers.get("directory-watch-event");

    handler?.({
      payload: {
        watchId: "directory-watch-1",
        path: "/tmp/docs",
        changedPath: "/tmp/docs/new.md",
        kind: "created",
      },
    });
    handler?.({
      payload: {
        watchId: "directory-watch-1",
        path: "/tmp/docs",
        changedPath: "/tmp/docs",
        kind: "modified",
      },
    });
    await vi.advanceTimersByTimeAsync(250);

    expect(onChange).toHaveBeenCalledWith({
      path: "/tmp/docs",
      changedPath: "/tmp/docs/new.md",
      kind: "modified",
    });
  });

  it("routes native directory watcher errors to onError", async () => {
    const adapter = new TauriHostAdapter();
    const onError = vi.fn();
    await adapter.watchDirectory("/tmp/docs", vi.fn(), onError);
    const handler = tauriMocks.handlers.get("directory-watch-event");

    handler?.({
      payload: {
        watchId: "directory-watch-1",
        path: "/tmp/docs",
        kind: "error",
      },
    });

    expect(onError).toHaveBeenCalledWith("Native directory watch failed");
  });

  it("routes native file drop events with logical positions and disposes the listener", async () => {
    const adapter = new TauriHostAdapter();
    const onEvent = vi.fn();
    const handle = await adapter.watchNativeFileDrop(onEvent);

    expect(tauriMocks.onDragDropEvent).toHaveBeenCalledTimes(1);
    tauriMocks.dragDropHandler?.({
      payload: {
        type: "enter",
        paths: ["/tmp/left.md"],
        position: {
          toLogical: (scaleFactor: number) => ({
            x: 40 / scaleFactor,
            y: 80 / scaleFactor,
          }),
        },
      },
    });
    await Promise.resolve();

    expect(tauriMocks.scaleFactor).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith({
      type: "enter",
      paths: ["/tmp/left.md"],
      position: { x: 20, y: 40 },
    });

    tauriMocks.dragDropHandler?.({ payload: { type: "leave" } });
    expect(onEvent).toHaveBeenCalledWith({ type: "leave" });

    handle.dispose();
    tauriMocks.dragDropHandler?.({
      payload: {
        type: "drop",
        paths: ["/tmp/right.md"],
        position: {
          toLogical: () => ({ x: 1, y: 2 }),
        },
      },
    });
    await Promise.resolve();

    expect(tauriMocks.dragDropUnlisten).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledTimes(2);
  });

  it("resolves dropped document paths through the native command", async () => {
    const adapter = new TauriHostAdapter();

    await expect(
      adapter.resolveDroppedDocumentPath("/tmp/guide.adoc"),
    ).resolves.toBe("/tmp/guide.adoc");
    expect(tauriMocks.invoke).toHaveBeenCalledWith(
      "resolve_dropped_document_path",
      { path: "/tmp/guide.adoc" },
    );
  });

  it("normalizes structured Tauri command errors to Error messages", async () => {
    const adapter = new TauriHostAdapter();
    tauriMocks.invoke.mockRejectedValueOnce({
      code: "outside-workspace",
      message: "path is outside the current workspace: guide.adoc",
    });

    await expect(adapter.openDocument("/tmp/guide.adoc")).rejects.toThrow(
      "path is outside the current workspace: guide.adoc",
    );
    expect(tauriMocks.invoke).toHaveBeenCalledWith("open_document", {
      path: "/tmp/guide.adoc",
    });
  });

  it("normalizes legacy string Tauri command errors to Error messages", async () => {
    const adapter = new TauriHostAdapter();
    tauriMocks.invoke.mockRejectedValueOnce("failed to read config: denied");

    await expect(adapter.loadConfig()).rejects.toThrow(
      "failed to read config: denied",
    );
    expect(tauriMocks.invoke).toHaveBeenCalledWith("load_config", undefined);
  });

  it("resolves local images through the native command", async () => {
    const adapter = new TauriHostAdapter();

    await expect(
      adapter.resolveLocalImage("assets/sample.png", "/tmp/docs/guide.adoc"),
    ).resolves.toEqual({
      status: "resolved",
      mediaType: "image/png",
      encoding: "base64",
      content: "AA==",
    });
    expect(tauriMocks.invoke).toHaveBeenCalledWith("resolve_local_image", {
      path: "assets/sample.png",
      documentPath: "/tmp/docs/guide.adoc",
    });
  });

  it("delegates PlantUML SVG cache operations to native commands", async () => {
    const adapter = new TauriHostAdapter();
    tauriMocks.invoke.mockResolvedValueOnce({
      status: "hit",
      svg: "<svg></svg>",
    });
    tauriMocks.invoke.mockResolvedValueOnce({ status: "written" });
    tauriMocks.invoke.mockResolvedValueOnce(undefined);

    await expect(
      adapter.readPlantUmlSvgCache({ key: "abc123" }),
    ).resolves.toEqual({
      status: "hit",
      svg: "<svg></svg>",
    });
    await expect(
      adapter.writePlantUmlSvgCache({
        key: "abc123",
        svg: "<svg></svg>",
        metadata: {
          renderer: "plantuml",
          theme: "light",
          version: "plantuml-teavm-test",
        },
      }),
    ).resolves.toEqual({ status: "written" });
    await expect(adapter.clearPlantUmlSvgCache()).resolves.toBeUndefined();

    expect(tauriMocks.invoke).toHaveBeenCalledWith("read_plantuml_svg_cache", {
      input: { key: "abc123" },
    });
    expect(tauriMocks.invoke).toHaveBeenCalledWith("write_plantuml_svg_cache", {
      input: {
        key: "abc123",
        svg: "<svg></svg>",
        metadata: {
          renderer: "plantuml",
          theme: "light",
          version: "plantuml-teavm-test",
        },
      },
    });
    expect(tauriMocks.invoke).toHaveBeenCalledWith("clear_plantuml_svg_cache");
  });

  it("delegates external PlantUML operations to native commands", async () => {
    const adapter = new TauriHostAdapter();
    tauriMocks.invoke.mockResolvedValueOnce({
      status: "rendered",
      svg: "<svg></svg>",
      diagnostics: [],
      metrics: { renderMs: 1, cacheStatus: "miss" },
    });
    tauriMocks.invoke.mockResolvedValueOnce({
      status: "rendered",
      svg: "<svg></svg>",
      diagnostics: [],
      metrics: { renderMs: 1, cacheStatus: "disabled" },
    });

    await expect(
      adapter.renderExternalPlantUml({
        source: "@startuml\nA -> B\n@enduml",
        theme: "light",
        timeoutMs: 5000,
        binaryPath: "/usr/local/bin/plantuml",
        dotPath: null,
      }),
    ).resolves.toMatchObject({ status: "rendered" });
    await expect(
      adapter.testExternalPlantUml({
        timeoutMs: 5000,
        binaryPath: "/usr/local/bin/plantuml",
        dotPath: null,
      }),
    ).resolves.toMatchObject({ status: "rendered" });

    expect(tauriMocks.invoke).toHaveBeenCalledWith("render_external_plantuml", {
      input: {
        source: "@startuml\nA -> B\n@enduml",
        theme: "light",
        timeoutMs: 5000,
        binaryPath: "/usr/local/bin/plantuml",
        dotPath: null,
      },
    });
    expect(tauriMocks.invoke).toHaveBeenCalledWith("test_external_plantuml", {
      input: {
        timeoutMs: 5000,
        binaryPath: "/usr/local/bin/plantuml",
        dotPath: null,
      },
    });
  });

  it("authorizes directories through the native command", async () => {
    const adapter = new TauriHostAdapter();

    await adapter.authorizeDirectory("/tmp/docs");

    expect(tauriMocks.invoke).toHaveBeenCalledWith("authorize_directory", {
      path: "/tmp/docs",
    });
  });

  it("resolves workspace paths through the native command", async () => {
    const adapter = new TauriHostAdapter();

    await expect(
      adapter.resolveWorkspacePaths({
        documentPath: "/tmp/docs/guide.md",
        basePath: "/tmp/docs",
        lastDirectory: "/tmp",
        recentDirectories: ["/tmp/docs"],
        expandedDirectories: ["/tmp/docs/chapters"],
      }),
    ).resolves.toEqual({
      initialDirectory: "/tmp/docs",
      expandedDirectories: ["/tmp/docs/guide"],
    });
    expect(tauriMocks.invoke).toHaveBeenCalledWith("resolve_workspace_paths", {
      input: {
        documentPath: "/tmp/docs/guide.md",
        basePath: "/tmp/docs",
        lastDirectory: "/tmp",
        recentDirectories: ["/tmp/docs"],
        expandedDirectories: ["/tmp/docs/chapters"],
      },
    });
  });

  it("resolves document links through the native command", async () => {
    const adapter = new TauriHostAdapter();

    await expect(
      adapter.resolveDocumentLink({
        documentPath: "/tmp/docs/guide.md",
        href: "next.md#usage",
      }),
    ).resolves.toEqual({
      status: "resolved",
      path: "/tmp/docs/next.md",
      hash: "usage",
    });
    expect(tauriMocks.invoke).toHaveBeenCalledWith("resolve_document_link", {
      input: {
        documentPath: "/tmp/docs/guide.md",
        href: "next.md#usage",
      },
    });
  });

  it("searches workspace through the native command", async () => {
    const adapter = new TauriHostAdapter();

    await expect(
      adapter.searchWorkspace({
        rootPath: "/tmp/docs",
        query: "Graphviz",
        maxFiles: 500,
        maxMatches: 100,
        maxBytesPerFile: 1048576,
      }),
    ).resolves.toMatchObject({
      status: "ok",
      rootPath: "/tmp/docs",
      query: "Graphviz",
    });
    expect(tauriMocks.invoke).toHaveBeenCalledWith("search_workspace", {
      input: {
        rootPath: "/tmp/docs",
        query: "Graphviz",
        maxFiles: 500,
        maxMatches: 100,
        maxBytesPerFile: 1048576,
      },
    });
  });

  it("opens only safe external URLs through the native opener", async () => {
    const adapter = new TauriHostAdapter();

    await expect(
      adapter.openExternalUrl("https://example.test/docs"),
    ).resolves.toBeUndefined();
    await expect(
      adapter.openExternalUrl("javascript:alert(1)"),
    ).rejects.toThrow("Unsafe external URL blocked");
    await expect(
      adapter.openExternalUrl("data:text/plain,hello"),
    ).rejects.toThrow("Unsafe external URL blocked");
    await expect(
      adapter.openExternalUrl("file:///tmp/guide.adoc"),
    ).rejects.toThrow("Unsafe external URL blocked");

    expect(tauriMocks.openUrl).toHaveBeenCalledTimes(1);
    expect(tauriMocks.openUrl).toHaveBeenCalledWith(
      "https://example.test/docs",
    );
  });

  it("loads Branch Diff through the native command", async () => {
    const adapter = new TauriHostAdapter();

    await expect(
      adapter.getGitBranchDiff("/tmp/repo", { baseRef: "origin/main" }),
    ).resolves.toMatchObject({
      status: "ok",
      baseRef: "origin/main",
      baseCandidates: ["origin/main"],
    });
    expect(tauriMocks.invoke).toHaveBeenCalledWith("get_git_branch_diff", {
      path: "/tmp/repo",
      baseRef: "origin/main",
      headRef: null,
      remoteProviders: null,
      network: null,
    });
  });

  it("loads Branch Diff file previews through the native command", async () => {
    const adapter = new TauriHostAdapter();

    await expect(
      adapter.getGitBranchFileDiff("/tmp/repo", {
        baseRef: "origin/main",
        path: "docs/readme.md",
        oldPath: "docs/old.md",
      }),
    ).resolves.toMatchObject({
      status: "modified",
      relativePath: "docs/readme.md",
      leftLabel: "origin/main",
    });
    expect(tauriMocks.invoke).toHaveBeenCalledWith("get_git_branch_file_diff", {
      path: "/tmp/repo",
      baseRef: "origin/main",
      headRef: null,
      relativePath: "docs/readme.md",
      oldPath: "docs/old.md",
    });
  });
});
