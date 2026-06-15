import { describe, expect, it, vi } from "vitest";

import { renderMarkdownCore } from "../../src/core/renderMarkdownCore";
import type { DocumentPayload } from "../../src/core/types";
import { prepareDocumentHtml } from "../../src/ui/lib/documentHtml";

const markdownDocumentPayload: DocumentPayload = {
  path: "/workspace/obsidian-vault/index.md",
  basePath: "/workspace/obsidian-vault",
  format: "markdown",
  source: "",
  updatedAt: "2026-05-15T00:00:00.000Z",
};

describe("prepareDocumentHtml Obsidian wikilinks", () => {
  it("resolves Obsidian wikilinks through the document link resolver", async () => {
    const result = renderMarkdownCore(
      "Open [[Guide|the guide]] and [[Guide#Intro]].",
    );
    const html = await prepareDocumentHtml(
      result.html,
      markdownDocumentPayload,
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      result,
      {
        resolveDocumentLink: async (_href, _documentPath, options) => ({
          status: "resolved",
          path: `/workspace/obsidian-vault/${options?.target?.split("#")[0]}.md`,
          hash: options?.target?.split("#")[1] ?? null,
          metrics: {
            kind: "wikilink",
            status: "resolved",
            cacheStatus: "miss",
            noteCount: 2,
            scannedDirs: 1,
            durationMs: 1.25,
            performanceMode: "normal",
          },
        }),
      },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const links = Array.from(doc.querySelectorAll("a"));

    expect(links[0]?.textContent).toBe("the guide");
    expect(links[0]?.getAttribute("href")).toBe(
      "/workspace/obsidian-vault/Guide.md",
    );
    expect(links[1]?.getAttribute("href")).toBe(
      "/workspace/obsidian-vault/Guide.md#Intro",
    );
    expect(links[0]?.hasAttribute("data-wikilink-target")).toBe(false);
  });

  it("leaves Obsidian wikilinks as plain text when the vault resolver blocks them", async () => {
    const result = renderMarkdownCore("Open [[Guide]].");
    const html = await prepareDocumentHtml(
      result.html,
      markdownDocumentPayload,
      { security: { allowLocalImages: true, confirmExternalLinks: true } },
      result,
      {
        resolveDocumentLink: async () => ({
          status: "blocked",
          message: "Obsidian vault is not available.",
        }),
      },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelector("a")).toBeNull();
    expect(doc.body.textContent).toContain("[[Guide]]");
  });

  it("traces Obsidian wikilink resolver metrics without source or path payload", async () => {
    const events: Array<Record<string, unknown>> = [];
    localStorage.setItem("SVARD_PERF_TRACE", "1");
    const infoSpy = vi
      .spyOn(console, "info")
      .mockImplementation((label: unknown, payload: unknown) => {
        if (label === "[perf]" && payload && typeof payload === "object") {
          events.push(payload as Record<string, unknown>);
        }
      });
    try {
      const result = renderMarkdownCore("Open [[Guide]].");
      await prepareDocumentHtml(
        result.html,
        markdownDocumentPayload,
        { security: { allowLocalImages: true, confirmExternalLinks: true } },
        result,
        {
          resolveDocumentLink: async () => ({
            status: "resolved",
            path: "/workspace/obsidian-vault/Guide.md",
            metrics: {
              kind: "wikilink",
              status: "resolved",
              cacheStatus: "hit",
              noteCount: 3,
              scannedDirs: 2,
              durationMs: 0.5,
              performanceMode: "normal",
            },
          }),
        },
      );
    } finally {
      infoSpy.mockRestore();
      localStorage.removeItem("SVARD_PERF_TRACE");
    }

    const wikilinkEvent = events.find(
      (event) => event.event === "documentLink.resolveWikilink",
    );
    const scanEvent = events.find(
      (event) => event.event === "obsidian.noteIndex.scan",
    );
    expect(wikilinkEvent).toMatchObject({
      status: "resolved",
      cacheStatus: "hit",
      durationMs: 0.5,
      performanceMode: "normal",
    });
    expect(scanEvent).toMatchObject({
      status: "resolved",
      cacheStatus: "hit",
      noteCount: 3,
      scannedDirs: 2,
      durationMs: 0.5,
      performanceMode: "normal",
    });
    const serialized = JSON.stringify([wikilinkEvent, scanEvent]);
    expect(serialized).not.toContain("[[Guide]]");
    expect(serialized).not.toContain("/workspace/obsidian-vault");
    expect(serialized).not.toContain("Guide.md");
  });
});
