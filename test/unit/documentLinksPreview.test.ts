import { describe, expect, it, vi } from "vitest";
import type {
  DocumentLinkResolution,
  DocumentPayload,
  RenderResult,
} from "../../src/core/types";
import { renderMarkdownCore } from "../../src/core/renderMarkdownCore";

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
import { renderDocument } from "../../src/core/renderDocument";

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

  it("does not retain private renderer identities in direct link preview state", async () => {
    vi.mocked(renderDocument).mockResolvedValueOnce({
      ...currentRenderResult,
      html: `<h1 id="next" data-source-renderer-id="svard-renderer-${"11".repeat(16)}-0">Next</h1><p data-source-renderer-id="svard-renderer-${"11".repeat(16)}-1">Private identity is not state.</p>`,
      headings: [{ id: "next", level: 1, text: "Next" }],
    });
    const preview = await buildLinkPreview({
      href: "./next.md",
      currentDocument,
      renderResult: currentRenderResult,
      article: articleFrom(`<h1 id="current">Current</h1>`),
      x: 10,
      y: 20,
      resolveDocumentLink: vi.fn(async () =>
        resolved("/workspace/docs/next.md"),
      ),
      loadDocument: vi.fn(async () =>
        markdownDocument(
          "/workspace/docs/next.md",
          "# Next\n\nPrivate identity is not state.",
        ),
      ),
    });

    expect(preview).toMatchObject({
      status: "ready",
      title: "Next",
      snippet: "Private identity is not state.",
    });
    expect(JSON.stringify(preview)).not.toContain("svard-renderer-");
  });

  it("keeps Safe HTML visible text without leaking author provenance into preview state", async () => {
    const source = "# <kbd>Next</kbd>\n\nPreview <mark>visible</mark> text.";
    vi.mocked(renderDocument).mockResolvedValueOnce(renderMarkdownCore(source));
    const resolveDocumentLink = vi.fn(async () =>
      resolved("/workspace/docs/next.md"),
    );
    const loadDocument = vi.fn(async () =>
      markdownDocument("/workspace/docs/next.md", source),
    );

    const preview = await buildLinkPreview({
      href: "./next.md",
      currentDocument,
      renderResult: currentRenderResult,
      article: articleFrom('<h1 id="current">Current</h1>'),
      x: 10,
      y: 20,
      resolveDocumentLink,
      loadDocument,
    });

    expect(preview).toMatchObject({
      status: "ready",
      title: "Next",
      heading: "Next",
      snippet: "Preview visible text.",
    });
    expect(resolveDocumentLink).toHaveBeenCalledTimes(1);
    expect(loadDocument).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(preview)).not.toMatch(
      /svard-markdown-author-html|data-svard-markdown-author-html-id|svard-author-/u,
    );
  });

  it("matches a formatted Markdown heading by its raw source text", async () => {
    vi.mocked(renderDocument).mockResolvedValueOnce({
      html: `<h1 id="next">Next</h1><h2 id="hugging-face-conv1d">Hugging Face <code>Conv1D</code></h2><p>Formatted heading preview.</p>`,
      headings: [
        { id: "next", level: 1, text: "Next", rawText: "Next" },
        {
          id: "hugging-face-conv1d",
          level: 2,
          text: "Hugging Face Conv1D",
          rawText: "**Hugging Face** `Conv1D`",
        },
      ],
      sourceBlocks: [],
      diagnostics: [],
      diagramSlots: [],
      mermaidDiagrams: [],
      plantUmlDiagrams: [],
      graphvizDiagrams: [],
      krokiDiagrams: [],
    });

    const preview = await buildLinkPreview({
      href: "./next.md#hugging-face-conv1d",
      currentDocument,
      renderResult: currentRenderResult,
      article: articleFrom(`<h1 id="current">Current</h1>`),
      x: 10,
      y: 20,
      resolveDocumentLink: vi.fn(async () =>
        resolved("/workspace/docs/next.md", "hugging-face-conv1d"),
      ),
      loadDocument: vi.fn(async () =>
        markdownDocument(
          "/workspace/docs/next.md",
          "# Next\n\n## **Hugging Face** `Conv1D`\n\nFormatted heading preview.",
        ),
      ),
    });

    expect(preview).toMatchObject({
      status: "ready",
      title: "Next",
      heading: "Hugging Face Conv1D",
      snippet: "Formatted heading preview.",
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
