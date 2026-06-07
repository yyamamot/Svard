import { afterEach, describe, expect, it, vi } from "vitest";

describe("renderMermaidDiagrams", () => {
  afterEach(() => {
    vi.doUnmock("mermaid");
    vi.resetModules();
  });

  it("does not import mermaid when there are no diagrams", async () => {
    vi.doMock("mermaid", () => {
      throw new Error("Mermaid should not be imported for an empty batch");
    });

    const { renderMermaidDiagrams } =
      await import("../../src/core/renderMermaid");

    await expect(renderMermaidDiagrams([], "light")).resolves.toEqual([]);
  });

  it("uses the default Mermaid renderer theme even when the app theme is dark", async () => {
    const initialize = vi.fn();
    const render = vi.fn(async (id: string) => ({
      svg: `<svg id="${id}"></svg>`,
    }));
    vi.doMock("mermaid", () => ({
      default: {
        initialize,
        render,
      },
    }));

    const { renderMermaidDiagrams } =
      await import("../../src/core/renderMermaid");

    await expect(
      renderMermaidDiagrams(
        [{ id: "diagram-dark", source: "flowchart TD" }],
        "dark",
      ),
    ).resolves.toEqual([
      { id: "diagram-dark", svg: '<svg id="diagram-dark"></svg>' },
    ]);

    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({ theme: "default" }),
    );
  });
});
