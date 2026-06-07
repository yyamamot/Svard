import { describe, expect, it, vi } from "vitest";
import type {
  DocumentLinkResolution,
  DocumentPayload,
  RenderResult,
} from "../../src/core/types";

vi.mock("../../src/core/renderDocument", () => ({
  renderDocument: vi.fn(async (document: DocumentPayload) => ({
    html: document.source
      .replace(/^# Next$/gmu, '<h1 id="next">Next</h1>')
      .replace(/^## Intro$/gmu, '<h2 id="intro">Intro</h2>')
      .replace(/^(?!<h[12] id=)([^#\n].+)$/gmu, "<p>$1</p>"),
    headings: [
      ...(document.source.includes("# Next")
        ? [{ id: "next", level: 1, text: "Next" }]
        : []),
      ...(document.source.includes("## Intro")
        ? [{ id: "intro", level: 2, text: "Intro" }]
        : []),
    ],
    sourceBlocks: [],
    diagnostics: [],
    diagramSlots: [],
    mermaidDiagrams: [],
    plantUmlDiagrams: [],
    graphvizDiagrams: [],
    krokiDiagrams: [],
  })),
}));

import {
  buildLinkPreview,
  linkPreviewCacheLimit,
  linkPreviewKey,
  rememberLinkPreviewCache,
  shouldPreviewLinkHref,
  type LinkPreviewState,
} from "../../src/ui/lib/linkPreview";

const currentDocument: DocumentPayload = {
  path: "/workspace/docs/current.md",
  basePath: "/workspace/docs",
  format: "markdown",
  source: "# Current\n\n## Target\n\nCurrent target paragraph.",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const currentRenderResult = {
  html: `<h1 id="current">Current</h1><h2 id="target">Target</h2><p>Current target paragraph.</p>`,
  headings: [
    { id: "current", level: 1, text: "Current" },
    { id: "target", level: 2, text: "Target" },
  ],
  sourceBlocks: [],
  diagnostics: [],
  diagramSlots: [],
  mermaidDiagrams: [],
  plantUmlDiagrams: [],
  graphvizDiagrams: [],
  krokiDiagrams: [],
} satisfies RenderResult;

function resolved(path: string, hash?: string): DocumentLinkResolution {
  return { status: "resolved", path, hash };
}

function blocked(message: string): DocumentLinkResolution {
  return { status: "blocked", message };
}

function markdownDocument(path: string, source: string): DocumentPayload {
  return {
    path,
    basePath: "/workspace/docs",
    format: "markdown",
    source,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function articleFrom(html: string) {
  const article = document.createElement("article");
  article.innerHTML = html;
  return article;
}

describe("link preview", () => {
  it("builds a same-document heading preview without loading another document", async () => {
    const loadDocument = vi.fn();
    const preview = await buildLinkPreview({
      href: "#target",
      currentDocument,
      renderResult: currentRenderResult,
      article: articleFrom(
        `<h1 id="current">Current</h1><h2 id="target">Target</h2><p>Current target paragraph.</p>`,
      ),
      x: 10,
      y: 20,
      resolveDocumentLink: vi.fn(),
      loadDocument,
    });

    expect(loadDocument).not.toHaveBeenCalled();
    expect(preview).toMatchObject({
      status: "ready",
      title: "Current",
      heading: "Target",
      snippet: "Current target paragraph.",
    });
  });

  it("resolves and renders a local document preview", async () => {
    const preview = await buildLinkPreview({
      href: "./next.md#intro",
      currentDocument,
      renderResult: currentRenderResult,
      article: articleFrom(`<h1 id="current">Current</h1>`),
      x: 10,
      y: 20,
      resolveDocumentLink: vi.fn(async () =>
        resolved("/workspace/docs/next.md", "intro"),
      ),
      loadDocument: vi.fn(async () =>
        markdownDocument(
          "/workspace/docs/next.md",
          "# Next\n\n## Intro\n\nPreview paragraph for the linked document.",
        ),
      ),
    });

    expect(preview).toMatchObject({
      status: "ready",
      title: "Next",
      heading: "Intro",
      snippet: "Preview paragraph for the linked document.",
    });
  });

  it("returns a degraded preview for a missing target heading", async () => {
    const preview = await buildLinkPreview({
      href: "./next.md#missing",
      currentDocument,
      renderResult: currentRenderResult,
      article: articleFrom(`<h1 id="current">Current</h1>`),
      x: 10,
      y: 20,
      resolveDocumentLink: vi.fn(async () =>
        resolved("/workspace/docs/next.md", "missing"),
      ),
      loadDocument: vi.fn(async () =>
        markdownDocument(
          "/workspace/docs/next.md",
          "# Next\n\nExisting paragraph.",
        ),
      ),
    });

    expect(preview).toMatchObject({
      status: "degraded",
      title: "Next",
      message: "Target heading is not available.",
    });
  });

  it("returns a degraded preview for blocked local links without exposing paths", async () => {
    const preview = await buildLinkPreview({
      href: "./blocked.md",
      currentDocument,
      renderResult: currentRenderResult,
      article: articleFrom(`<h1 id="current">Current</h1>`),
      x: 10,
      y: 20,
      resolveDocumentLink: vi.fn(async () =>
        blocked("Document link is outside the current workspace."),
      ),
      loadDocument: vi.fn(),
    });

    expect(preview).toMatchObject({
      status: "degraded",
      title: "Preview unavailable",
      message: "Document link is outside the current workspace.",
    });
    expect(JSON.stringify(preview)).not.toContain("/tmp/secret");
  });

  it("does not preview external or dangerous URLs", () => {
    expect(shouldPreviewLinkHref("https://example.com")).toBe(false);
    expect(shouldPreviewLinkHref("javascript:alert(1)")).toBe(false);
    expect(shouldPreviewLinkHref("data:text/html,hello")).toBe(false);
    expect(shouldPreviewLinkHref("#target")).toBe(true);
  });

  it("bounds the preview cache", () => {
    const cache = new Map<string, LinkPreviewState>();
    for (let index = 0; index < linkPreviewCacheLimit + 3; index += 1) {
      const key = linkPreviewKey(
        "/workspace/docs/current.md",
        `next-${index}.md`,
      );
      rememberLinkPreviewCache(cache, key, {
        status: "ready",
        key,
        x: 0,
        y: 0,
        title: `Next ${index}`,
      });
    }

    expect(cache.size).toBe(linkPreviewCacheLimit);
    expect(
      cache.has(linkPreviewKey("/workspace/docs/current.md", "next-0.md")),
    ).toBe(false);
  });
});
