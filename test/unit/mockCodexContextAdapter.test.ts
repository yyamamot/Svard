import { afterEach, describe, expect, it } from "vitest";
import { createMockCodexContextFacade } from "../../src/adapters/mockHost/codex";

afterEach(() => {
  (
    window as unknown as {
      __SVARD_CODEX_CONTEXT_FILES__?: unknown;
      __SVARD_PICK_CODEX_CONTEXT_FILES__?: unknown;
    }
  ).__SVARD_CODEX_CONTEXT_FILES__ = undefined;
  (
    window as unknown as {
      __SVARD_PICK_CODEX_CONTEXT_FILES__?: unknown;
    }
  ).__SVARD_PICK_CODEX_CONTEXT_FILES__ = undefined;
});

describe("Mock Codex context adapter", () => {
  it("loads supported context without exposing the workspace in its label", async () => {
    const adapter = createMockCodexContextFacade();
    const file = await adapter.loadCodexContextFile({
      contextId: "D1",
      path: "/workspace/src/config.ts",
      workspaceRoot: "/workspace",
    });

    expect(file).toMatchObject({
      contextId: "D1",
      displayLabel: "src/config.ts",
      format: "code",
      language: "typescript",
    });
    expect(file.byteLength).toBeGreaterThan(0);
  });

  it("searches only supported files inside the workspace", async () => {
    const adapter = createMockCodexContextFacade();
    const items = await adapter.searchCodexContextFiles({
      workspaceRoot: "/workspace",
      query: "config.ts",
    });

    expect(items).toEqual([
      expect.objectContaining({
        path: "/workspace/src/config.ts",
        displayLabel: "src/config.ts",
      }),
    ]);
  });

  it("allows explicitly picked external files while keeping a basename label", async () => {
    (
      window as unknown as {
        __SVARD_CODEX_CONTEXT_FILES__?: Record<string, { source: string }>;
        __SVARD_PICK_CODEX_CONTEXT_FILES__?: string[];
      }
    ).__SVARD_CODEX_CONTEXT_FILES__ = {
      "/outside/sample.py": { source: "answer = 42" },
    };
    (
      window as unknown as {
        __SVARD_PICK_CODEX_CONTEXT_FILES__?: string[];
      }
    ).__SVARD_PICK_CODEX_CONTEXT_FILES__ = ["/outside/sample.py"];

    const [file] =
      await createMockCodexContextFacade().pickCodexContextFiles("/workspace");

    expect(file).toMatchObject({
      path: "/outside/sample.py",
      displayLabel: "sample.py",
      language: "python",
    });
  });

  it("authorizes explicitly registered external Markdown and code drops", async () => {
    (
      window as unknown as {
        __SVARD_CODEX_CONTEXT_FILES__?: Record<string, { source: string }>;
      }
    ).__SVARD_CODEX_CONTEXT_FILES__ = {
      "/outside/notes.md": { source: "# External notes" },
      "/outside/config.ts": { source: "export const safe = true;" },
    };

    const adapter = createMockCodexContextFacade();
    await expect(
      adapter.resolveDroppedCodexContextPath("/outside/notes.md"),
    ).resolves.toBe("/outside/notes.md");
    await expect(
      adapter.resolveDroppedCodexContextPath("/outside/config.ts"),
    ).resolves.toBe("/outside/config.ts");
  });

  it("rejects secret-looking files", async () => {
    (
      window as unknown as {
        __SVARD_CODEX_CONTEXT_FILES__?: Record<string, { source: string }>;
      }
    ).__SVARD_CODEX_CONTEXT_FILES__ = {
      "/workspace/client-secret.json": { source: "{}" },
    };

    await expect(
      createMockCodexContextFacade().loadCodexContextFile({
        contextId: "D1",
        path: "/workspace/client-secret.json",
        workspaceRoot: "/workspace",
      }),
    ).rejects.toThrow("cannot be shared");
  });
});
