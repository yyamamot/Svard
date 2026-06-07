import { act } from "react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { defaultConfig } from "../../src/core/defaultConfig";
import type { AppConfig, HostAdapter } from "../../src/core/types";
import { useWorkspacePersistence } from "../../src/ui/hooks/useWorkspacePersistence";
import { workspaceSessionFromWorkspace } from "../../src/ui/lib/config";
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
        config,
        documentPayload: null,
        focusedPaneId: "left",
        host: {
          loadConfig: async () => persistedConfig,
          saveConfig,
        } as unknown as HostAdapter,
        isLoading: false,
        paneSnapshots: {
          left: { id: "left", documentPayload: null },
          right: { id: "right", documentPayload: null },
        } as any,
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
        config,
        documentPayload: null,
        focusedPaneId: "left",
        host: {
          loadConfig: async () => persistedConfig,
          saveConfig,
        } as unknown as HostAdapter,
        isLoading: false,
        paneSnapshots: {
          left: { id: "left", documentPayload: null },
          right: { id: "right", documentPayload: null },
        } as any,
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
});
