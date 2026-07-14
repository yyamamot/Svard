import { act } from "react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { defaultConfig } from "../../src/core/defaultConfig";
import type {
  AppConfig,
  DocumentPayload,
  HostAdapter,
} from "../../src/core/types";
import { useWorkspacePersistence } from "../../src/ui/hooks/useWorkspacePersistence";
import { workspaceSessionFromWorkspace } from "../../src/ui/lib/config";
import { createEmptyPaneSnapshot } from "../../src/ui/lib/split";
import { createReactRootHarness } from "./helpers/reactHarness";

describe("useWorkspacePersistence", () => {
  it("saves only the current window session", async () => {
    const persistedConfig: AppConfig = {
      ...defaultConfig,
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
    const saveConfig = vi.fn(async (_config: AppConfig) => undefined);
    let persistWorkspace:
      | ((partial: Partial<AppConfig["workspace"]>) => Promise<void>)
      | null = null;
    const harness = createReactRootHarness();

    function Probe() {
      const [config, setConfig] = useState<AppConfig | null>(defaultConfig);
      const hook = useWorkspacePersistence({
        activeHeadingId: null,
        canAutoPersist: true,
        config,
        documentPayload: null,
        focusedPaneId: "left",
        host: {
          loadConfig: async () => persistedConfig,
          saveConfig,
        } as unknown as HostAdapter,
        paneSnapshots: {
          left: createEmptyPaneSnapshot("left"),
          right: createEmptyPaneSnapshot("right"),
        },
        setConfig,
        splitEnabled: false,
        splitRatio: 0.5,
        viewerRef: { current: null },
        windowSessionId: "viewer-1",
      });
      persistWorkspace = hook.persistWorkspace;
      return null;
    }

    harness.render(<Probe />);

    await act(async () => {
      await persistWorkspace?.({ activePath: "/workspace/docs/a.md" });
    });

    expect(saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: expect.objectContaining({
          windowSessions: expect.objectContaining({
            other: expect.objectContaining({
              activePath: "/workspace/docs/other.md",
            }),
            "viewer-1": expect.objectContaining({
              activePath: "/workspace/docs/a.md",
            }),
          }),
        }),
      }),
    );
    harness.cleanup();
  });

  it("saves bookmarks without overwriting another window session", async () => {
    const persistedConfig: AppConfig = {
      ...defaultConfig,
      workspace: {
        ...defaultConfig.workspace,
        activePath: "/workspace/docs/main.md",
        openTabs: ["/workspace/docs/main.md"],
        splitSession: {
          enabled: true,
          focusedPaneId: "left",
          splitRatio: 0.5,
          panePaths: {
            left: "/workspace/docs/main.md",
            right: "/workspace/docs/ref.md",
          },
        },
        windowSessions: {
          main: {
            ...workspaceSessionFromWorkspace(defaultConfig.workspace),
            activePath: "/workspace/docs/main.md",
            openTabs: ["/workspace/docs/main.md"],
          },
        },
      },
    };
    const saveConfig = vi.fn(async (_config: AppConfig) => undefined);
    let persistWorkspace:
      | ((partial: Partial<AppConfig["workspace"]>) => Promise<void>)
      | null = null;
    const harness = createReactRootHarness();

    function Probe() {
      const [config, setConfig] = useState<AppConfig | null>({
        ...defaultConfig,
        workspace: {
          ...defaultConfig.workspace,
          activePath: "/workspace/docs/viewer.md",
          openTabs: ["/workspace/docs/viewer.md"],
        },
      });
      const hook = useWorkspacePersistence({
        activeHeadingId: null,
        canAutoPersist: true,
        config,
        documentPayload: null,
        focusedPaneId: "left",
        host: {
          loadConfig: async () => persistedConfig,
          saveConfig,
        } as unknown as HostAdapter,
        paneSnapshots: {
          left: createEmptyPaneSnapshot("left"),
          right: createEmptyPaneSnapshot("right"),
        },
        setConfig,
        splitEnabled: false,
        splitRatio: 0.5,
        viewerRef: { current: null },
        windowSessionId: "viewer-2",
      });
      persistWorkspace = hook.persistWorkspace;
      return null;
    }

    harness.render(<Probe />);

    await act(async () => {
      await persistWorkspace?.({
        bookmarks: [
          {
            kind: "file",
            path: "/workspace/docs/viewer.md",
          },
        ],
      });
    });

    expect(saveConfig).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace: expect.objectContaining({
          bookmarks: [
            {
              kind: "file",
              path: "/workspace/docs/viewer.md",
            },
          ],
          windowSessions: expect.objectContaining({
            main: expect.objectContaining({
              activePath: "/workspace/docs/main.md",
              openTabs: ["/workspace/docs/main.md"],
            }),
            "viewer-2": expect.objectContaining({
              activePath: "/workspace/docs/viewer.md",
              openTabs: ["/workspace/docs/viewer.md"],
            }),
          }),
        }),
      }),
    );
    harness.cleanup();
  });

  it("allows manual persistence while automatic persistence waits for boot completion", async () => {
    vi.useFakeTimers();
    const activeDocument: DocumentPayload = {
      path: "/workspace/docs/active.md",
      basePath: "/workspace/docs",
      format: "markdown",
      source: "# Active",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const initialConfig: AppConfig = {
      ...defaultConfig,
      workspace: {
        ...defaultConfig.workspace,
        activePath: activeDocument.path,
        openTabs: [activeDocument.path],
      },
    };
    const saveConfig = vi.fn(async (_config: AppConfig) => undefined);
    let persistWorkspace:
      | ((partial: Partial<AppConfig["workspace"]>) => Promise<void>)
      | null = null;
    const harness = createReactRootHarness();

    function Probe({ canAutoPersist }: { canAutoPersist: boolean }) {
      const [config, setConfig] = useState<AppConfig | null>(initialConfig);
      const hook = useWorkspacePersistence({
        activeHeadingId: "overview",
        canAutoPersist,
        config,
        documentPayload: activeDocument,
        focusedPaneId: "left",
        host: {
          loadConfig: async () => initialConfig,
          saveConfig,
        } as unknown as HostAdapter,
        paneSnapshots: {
          left: {
            ...createEmptyPaneSnapshot("left"),
            documentPayload: activeDocument,
          },
          right: createEmptyPaneSnapshot("right"),
        },
        setConfig,
        splitEnabled: false,
        splitRatio: 0.5,
        viewerRef: { current: null },
        windowSessionId: "main",
      });
      persistWorkspace = hook.persistWorkspace;
      return null;
    }

    try {
      harness.render(<Probe canAutoPersist={false} />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(600);
      });
      expect(saveConfig).not.toHaveBeenCalled();

      await act(async () => {
        await persistWorkspace?.({
          bookmarks: [{ kind: "file", path: activeDocument.path }],
        });
      });
      expect(saveConfig).toHaveBeenCalledTimes(1);
      expect(saveConfig).toHaveBeenLastCalledWith(
        expect.objectContaining({
          workspace: expect.objectContaining({
            bookmarks: [{ kind: "file", path: activeDocument.path }],
          }),
        }),
      );

      saveConfig.mockClear();
      harness.render(<Probe canAutoPersist />);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(saveConfig).toHaveBeenCalledTimes(1);
      expect(saveConfig).toHaveBeenLastCalledWith(
        expect.objectContaining({
          workspace: expect.objectContaining({
            activePath: activeDocument.path,
            activeHeadingByPath: {
              [activeDocument.path]: "overview",
            },
          }),
        }),
      );
    } finally {
      harness.cleanup();
      vi.useRealTimers();
    }
  });
});
