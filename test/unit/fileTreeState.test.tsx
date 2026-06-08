import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useFileTreeState } from "../../src/ui/hooks/useFileTreeState";
import type {
  AppConfig,
  DirectoryEntry,
  DirectoryWatchEvent,
  WatchHandle,
} from "../../src/core/types";

describe("useFileTreeState directory watching", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("watches root and expanded directories and reloads only the changed directory", async () => {
    const callbacks = new Map<string, (event: DirectoryWatchEvent) => void>();
    const rootEntries: DirectoryEntry[] = [
      { kind: "directory", name: "nested", path: "/workspace/docs/nested" },
    ];
    const refreshedEntries: DirectoryEntry[] = [
      { kind: "file", name: "new.md", path: "/workspace/docs/new.md" },
    ];
    const host = {
      listDirectory: vi.fn(async (path: string) =>
        path === "/workspace/docs" ? refreshedEntries : [],
      ),
      watchDirectory: vi.fn(
        async (
          path: string,
          onChange: (event: DirectoryWatchEvent) => void,
        ): Promise<WatchHandle> => {
          callbacks.set(path, onChange);
          return {
            dispose() {
              callbacks.delete(path);
            },
          };
        },
      ),
    };
    let api: ReturnType<typeof useFileTreeState> | undefined;
    const current = () => {
      if (!api) {
        throw new Error("hook state was not initialized");
      }
      return api;
    };

    function Harness() {
      const state = useFileTreeState({
        host,
        persistWorkspace: vi.fn(
          async (_partial: Partial<AppConfig["workspace"]>) => undefined,
        ),
        showInlineNotice: vi.fn(),
      });
      useEffect(() => {
        api = state;
      });
      return null;
    }

    await act(async () => {
      root.render(<Harness />);
    });
    await act(async () => {
      current().setRootDirectory("/workspace/docs");
      current().setExpandedDirectories(new Set(["/workspace/docs/nested"]));
      current().setChildrenByDirectory({
        "/workspace/docs": rootEntries,
        "/workspace/docs/nested": [],
      });
    });

    expect(host.watchDirectory).toHaveBeenCalledWith(
      "/workspace/docs",
      expect.any(Function),
      expect.any(Function),
      { recursive: true },
    );
    expect(host.watchDirectory).toHaveBeenCalledWith(
      "/workspace/docs/nested",
      expect.any(Function),
      expect.any(Function),
      { recursive: false },
    );

    await act(async () => {
      callbacks.get("/workspace/docs")?.({
        path: "/workspace/docs",
        kind: "created",
      });
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(host.listDirectory).toHaveBeenCalledWith("/workspace/docs");
    expect(current().childrenByDirectory["/workspace/docs"]).toEqual(
      refreshedEntries,
    );
    expect(current().childrenByDirectory["/workspace/docs/nested"]).toEqual([]);
  });

  it("reloads the watched directory and clears link cache for changed Markdown files", async () => {
    const callbacks = new Map<string, (event: DirectoryWatchEvent) => void>();
    const refreshedEntries: DirectoryEntry[] = [
      { kind: "file", name: "new.md", path: "/workspace/docs/new.md" },
    ];
    const host = {
      clearDocumentLinkCache: vi.fn(async () => undefined),
      listDirectory: vi.fn(async () => refreshedEntries),
      watchDirectory: vi.fn(
        async (
          path: string,
          onChange: (event: DirectoryWatchEvent) => void,
        ): Promise<WatchHandle> => {
          callbacks.set(path, onChange);
          return {
            dispose() {
              callbacks.delete(path);
            },
          };
        },
      ),
    };
    const onWorkspaceFileChange = vi.fn();
    let api: ReturnType<typeof useFileTreeState> | undefined;
    const current = () => {
      if (!api) {
        throw new Error("hook state was not initialized");
      }
      return api;
    };

    function Harness() {
      const state = useFileTreeState({
        host,
        persistWorkspace: vi.fn(
          async (_partial: Partial<AppConfig["workspace"]>) => undefined,
        ),
        showInlineNotice: vi.fn(),
        onWorkspaceFileChange,
      });
      useEffect(() => {
        api = state;
      });
      return null;
    }

    await act(async () => {
      root.render(<Harness />);
    });
    await act(async () => {
      current().setRootDirectory("/workspace/docs");
      current().setChildrenByDirectory({ "/workspace/docs": [] });
    });
    await act(async () => {
      callbacks.get("/workspace/docs")?.({
        path: "/workspace/docs",
        changedPath: "/workspace/docs/new.md",
        kind: "created",
      });
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(host.listDirectory).toHaveBeenCalledWith("/workspace/docs");
    expect(host.clearDocumentLinkCache).toHaveBeenCalledWith(
      "/workspace/docs/new.md",
    );
    expect(onWorkspaceFileChange).toHaveBeenCalledWith({
      reason: "directory-watch",
      changedPath: "/workspace/docs/new.md",
    });
    expect(current().childrenByDirectory["/workspace/docs"]).toEqual(
      refreshedEntries,
    );
  });

  it("reloads cached directory entries when a collapsed directory is expanded again", async () => {
    const callbacks = new Map<string, (event: DirectoryWatchEvent) => void>();
    const staleEntries: DirectoryEntry[] = [
      { kind: "file", name: "old.md", path: "/workspace/docs/old.md" },
    ];
    const refreshedEntries: DirectoryEntry[] = [
      ...staleEntries,
      { kind: "file", name: "new.md", path: "/workspace/docs/new.md" },
    ];
    const persistWorkspace = vi.fn(
      async (_partial: Partial<AppConfig["workspace"]>) => undefined,
    );
    const host = {
      listDirectory: vi.fn(async () => refreshedEntries),
      watchDirectory: vi.fn(
        async (
          path: string,
          onChange: (event: DirectoryWatchEvent) => void,
        ): Promise<WatchHandle> => {
          callbacks.set(path, onChange);
          return {
            dispose() {
              callbacks.delete(path);
            },
          };
        },
      ),
    };
    let api: ReturnType<typeof useFileTreeState> | undefined;
    const current = () => {
      if (!api) {
        throw new Error("hook state was not initialized");
      }
      return api;
    };

    function Harness() {
      const state = useFileTreeState({
        host,
        persistWorkspace,
        showInlineNotice: vi.fn(),
      });
      useEffect(() => {
        api = state;
      });
      return null;
    }

    await act(async () => {
      root.render(<Harness />);
    });
    await act(async () => {
      current().setRootDirectory("/workspace");
      current().setChildrenByDirectory({
        "/workspace": [
          { kind: "directory", name: "docs", path: "/workspace/docs" },
        ],
        "/workspace/docs": staleEntries,
      });
    });

    await act(async () => {
      await current().toggleDirectory("/workspace/docs");
    });

    expect(host.listDirectory).toHaveBeenCalledWith("/workspace/docs");
    expect(current().expandedDirectories.has("/workspace/docs")).toBe(true);
    expect(current().childrenByDirectory["/workspace/docs"]).toEqual(
      refreshedEntries,
    );
  });

  it("keeps existing entries when a directory watch refresh fails", async () => {
    const callbacks = new Map<string, (event: DirectoryWatchEvent) => void>();
    const existingEntries: DirectoryEntry[] = [
      { kind: "file", name: "old.md", path: "/workspace/docs/old.md" },
    ];
    const host = {
      listDirectory: vi.fn(async () => {
        throw new Error("refresh failed");
      }),
      watchDirectory: vi.fn(
        async (
          path: string,
          onChange: (event: DirectoryWatchEvent) => void,
        ): Promise<WatchHandle> => {
          callbacks.set(path, onChange);
          return {
            dispose() {
              callbacks.delete(path);
            },
          };
        },
      ),
    };
    let api: ReturnType<typeof useFileTreeState> | undefined;
    const current = () => {
      if (!api) {
        throw new Error("hook state was not initialized");
      }
      return api;
    };

    function Harness() {
      const state = useFileTreeState({
        host,
        persistWorkspace: vi.fn(
          async (_partial: Partial<AppConfig["workspace"]>) => undefined,
        ),
        showInlineNotice: vi.fn(),
      });
      useEffect(() => {
        api = state;
      });
      return null;
    }

    await act(async () => {
      root.render(<Harness />);
    });
    await act(async () => {
      current().setRootDirectory("/workspace/docs");
      current().setChildrenByDirectory({ "/workspace/docs": existingEntries });
    });
    await act(async () => {
      callbacks.get("/workspace/docs")?.({
        path: "/workspace/docs",
        kind: "created",
      });
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(current().childrenByDirectory["/workspace/docs"]).toEqual(
      existingEntries,
    );
    expect(current().directoryErrors["/workspace/docs"]).toBe("refresh failed");
  });

  it("skips directory watchers in WSL mitigation mode while manual refresh still works", async () => {
    const refreshedEntries: DirectoryEntry[] = [
      { kind: "file", name: "fresh.md", path: "/workspace/docs/fresh.md" },
    ];
    const host = {
      listDirectory: vi.fn(async () => refreshedEntries),
      watchDirectory: vi.fn(
        async (): Promise<WatchHandle> => ({
          dispose: vi.fn(),
        }),
      ),
    };
    const onWorkspaceFileChange = vi.fn();
    let api: ReturnType<typeof useFileTreeState> | undefined;
    const current = () => {
      if (!api) {
        throw new Error("hook state was not initialized");
      }
      return api;
    };

    function Harness() {
      const state = useFileTreeState({
        host,
        persistWorkspace: vi.fn(
          async (_partial: Partial<AppConfig["workspace"]>) => undefined,
        ),
        workspacePerformanceMode: "wsl-mitigated",
        showInlineNotice: vi.fn(),
        onWorkspaceFileChange,
      });
      useEffect(() => {
        api = state;
      });
      return null;
    }

    await act(async () => {
      root.render(<Harness />);
    });
    await act(async () => {
      current().setRootDirectory("/workspace/docs");
    });

    expect(host.watchDirectory).not.toHaveBeenCalled();

    await act(async () => {
      await current().refreshTree();
    });

    expect(host.listDirectory).toHaveBeenCalledWith("/workspace/docs");
    expect(onWorkspaceFileChange).toHaveBeenCalledWith({
      reason: "manual-refresh",
      changedPath: null,
    });
    expect(current().childrenByDirectory["/workspace/docs"]).toEqual(
      refreshedEntries,
    );
  });
});
