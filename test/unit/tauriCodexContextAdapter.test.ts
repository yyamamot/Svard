import { beforeEach, describe, expect, it, vi } from "vitest";

const tauriMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  open: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  Channel: class {
    onmessage?: (message: unknown) => void;
  },
  invoke: tauriMocks.invoke,
}));
vi.mock("@tauri-apps/api/app", () => ({ setTheme: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
vi.mock("@tauri-apps/api/webview", () => ({
  getCurrentWebview: vi.fn(),
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: tauriMocks.open }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

import { TauriHostAdapter } from "../../src/adapters/tauriHostAdapter";

describe("TauriHostAdapter Codex context boundary", () => {
  beforeEach(() => {
    tauriMocks.invoke.mockReset();
    tauriMocks.open.mockReset();
  });

  it("uses the dedicated load and search commands", async () => {
    tauriMocks.invoke.mockResolvedValueOnce({ contextId: "D1" });
    const adapter = new TauriHostAdapter();
    const loadInput = {
      contextId: "D1",
      path: "/workspace/src/config.ts",
      workspaceRoot: "/workspace",
    };

    await adapter.loadCodexContextFile(loadInput);
    expect(tauriMocks.invoke).toHaveBeenCalledWith("load_codex_context_file", {
      input: loadInput,
    });

    tauriMocks.invoke.mockResolvedValueOnce([]);
    const searchInput = {
      workspaceRoot: "/workspace",
      query: "config",
    };
    await adapter.searchCodexContextFiles(searchInput);
    expect(tauriMocks.invoke).toHaveBeenCalledWith(
      "search_codex_context_files",
      { input: searchInput },
    );
  });

  it("keeps the workspace root only for picked files inside that root", async () => {
    tauriMocks.open.mockResolvedValue([
      "/workspace/docs/guide.md",
      "/external/sample.py",
    ]);
    tauriMocks.invoke.mockImplementation(
      (command: string, args: Record<string, unknown>) =>
        Promise.resolve(
          command === "resolve_dropped_codex_context_path"
            ? args.path
            : (args.input as Record<string, unknown>),
        ),
    );

    await new TauriHostAdapter().pickCodexContextFiles("/workspace");

    expect(tauriMocks.invoke).toHaveBeenNthCalledWith(
      1,
      "load_codex_context_file",
      {
        input: expect.objectContaining({
          path: "/workspace/docs/guide.md",
          workspaceRoot: "/workspace",
        }),
      },
    );
    expect(tauriMocks.invoke).toHaveBeenNthCalledWith(
      2,
      "resolve_dropped_codex_context_path",
      {
        path: "/external/sample.py",
      },
    );
    expect(tauriMocks.invoke).toHaveBeenNthCalledWith(
      3,
      "load_codex_context_file",
      {
        input: expect.objectContaining({
          path: "/external/sample.py",
          workspaceRoot: null,
        }),
      },
    );
  });

  it("uses a Codex-specific authorization command for dropped code files", async () => {
    tauriMocks.invoke.mockResolvedValue("/external/config.ts");

    await expect(
      new TauriHostAdapter().resolveDroppedCodexContextPath(
        "/external/config.ts",
      ),
    ).resolves.toBe("/external/config.ts");

    expect(tauriMocks.invoke).toHaveBeenCalledWith(
      "resolve_dropped_codex_context_path",
      {
        path: "/external/config.ts",
      },
    );
  });
});
