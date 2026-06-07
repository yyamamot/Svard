import { readFileSync } from "node:fs";
import path from "node:path";

import Asciidoctor from "@asciidoctor/core";
import { describe, expect, it } from "vitest";

import { expandAsciiDocIncludes } from "../../src/core/asciidocInclude";
import {
  extractHeadings,
  extractSourceBlocks,
} from "../../src/core/asciidocSourceMap";
import {
  detectDiagramDiagnostics,
  extractDiagramSlots,
  extractGraphvizDiagrams,
  extractKrokiDiagrams,
  extractMermaidDiagrams,
  extractPlantUmlDiagrams,
  replaceDiagramBlocksWithPlaceholders,
} from "../../src/core/extractDiagrams";
import { renderMarkdownCore } from "../../src/core/renderMarkdownCore";
import type {
  AsciiDocIncludeFile,
  DocumentPayload,
  LocalImageResult,
  RenderResult,
} from "../../src/core/types";
import { prepareDocumentHtml } from "../../src/ui/lib/documentHtml";

const asciidoctor = Asciidoctor();
const fixtureRoot = path.resolve("docs/samples/manual");
const securityConfig = {
  security: { allowLocalImages: true, confirmExternalLinks: true },
};

function readFixture(relativePath: string): string {
  return readFileSync(path.join(fixtureRoot, relativePath), "utf8");
}

function workspacePath(relativePath: string): string {
  return `/workspace/docs/samples/manual/${relativePath}`;
}

function mediaTypeForSource(source: string): string | null {
  if (source.endsWith(".svg")) {
    return "image/svg+xml";
  }
  if (source.endsWith(".png")) {
    return "image/png";
  }
  return null;
}

function resolveManualImage(source: string): LocalImageResult {
  const normalized = source.replace(/\\/g, "/").replace(/^\.\//u, "");
  const mediaType = mediaTypeForSource(normalized);
  if (!mediaType) {
    return {
      status: "blocked",
      placeholderText: "Unsupported local image type.",
    };
  }
  const filename = normalized.split("/").at(-1) ?? normalized;
  const filePath = path.join(fixtureRoot, "assets", filename);
  try {
    const bytes = readFileSync(filePath);
    return mediaType === "image/svg+xml"
      ? {
          status: "resolved",
          mediaType,
          encoding: "utf8",
          content: bytes.toString("utf8"),
        }
      : {
          status: "resolved",
          mediaType,
          encoding: "base64",
          content: bytes.toString("base64"),
        };
  } catch {
    return {
      status: "blocked",
      placeholderText: "Local image is not available.",
    };
  }
}

async function renderManualAsciiDoc() {
  const documentPath = workspacePath("index.adoc");
  const documentDir = "/workspace/docs/samples/manual";
  const includeFiles: AsciiDocIncludeFile[] = [
    {
      path: workspacePath("partials/manual-header.adoc"),
      source: readFixture("partials/manual-header.adoc"),
    },
    {
      path: workspacePath("partials/nested-section.adoc"),
      source: readFixture("partials/nested-section.adoc"),
    },
    {
      path: workspacePath("scripts/manual-helper"),
      source: readFixture("scripts/manual-helper"),
    },
  ];
  const source = readFixture("index.adoc");
  const expanded = expandAsciiDocIncludes(source, documentPath, includeFiles);
  const renderSource = replaceDiagramBlocksWithPlaceholders(expanded.source);
  const html = asciidoctor.convert(renderSource, {
    base_dir: documentDir,
    safe: "safe",
    sourcemap: true,
    attributes: {
      showtitle: true,
      icons: "font",
      stem: true,
      imagesdir: "assets",
      "table-caption": "Table",
      "figure-caption": "Figure",
    },
  }) as string;
  const renderResult: RenderResult = {
    html,
    headings: extractHeadings(html, expanded.source, expanded.lineOrigins),
    sourceBlocks: extractSourceBlocks(expanded.source, expanded.lineOrigins),
    diagnostics: [
      ...expanded.diagnostics,
      ...detectDiagramDiagnostics(expanded.source, expanded.lineOrigins),
    ],
    diagramSlots: extractDiagramSlots(expanded.source, expanded.lineOrigins),
    mermaidDiagrams: extractMermaidDiagrams(
      expanded.source,
      expanded.lineOrigins,
    ),
    plantUmlDiagrams: extractPlantUmlDiagrams(
      expanded.source,
      expanded.lineOrigins,
    ),
    graphvizDiagrams: extractGraphvizDiagrams(
      expanded.source,
      expanded.lineOrigins,
    ),
    krokiDiagrams: extractKrokiDiagrams(expanded.source, expanded.lineOrigins),
  };
  const document: DocumentPayload = {
    path: documentPath,
    basePath: documentDir,
    format: "asciidoc",
    source: expanded.source,
    updatedAt: "2026-06-04T00:00:00.000Z",
    includeFiles,
    asciidocContext: {
      baseDir: "/workspace",
      workspaceRoot: "/workspace",
      documentDir,
      attributes: { imagesdir: "assets" },
      resourceRoots: ["/workspace", documentDir],
    },
  };
  const preparedHtml = await prepareDocumentHtml(
    html,
    document,
    securityConfig,
    renderResult,
    {
      resolveLocalImage: async (src) => resolveManualImage(src),
    },
  );
  return {
    expanded,
    renderResult,
    doc: new DOMParser().parseFromString(preparedHtml, "text/html"),
  };
}

async function renderManualMarkdown() {
  const source = readFixture("index.md");
  const result = renderMarkdownCore(source);
  const document: DocumentPayload = {
    path: workspacePath("index.md"),
    basePath: "/workspace/docs/samples/manual",
    format: "markdown",
    source,
    updatedAt: "2026-06-04T00:00:00.000Z",
  };
  const html = await prepareDocumentHtml(
    result.html,
    document,
    securityConfig,
    result,
    {
      resolveLocalImage: async (src) => resolveManualImage(src),
    },
  );
  return {
    renderResult: result,
    doc: new DOMParser().parseFromString(html, "text/html"),
  };
}

function imageBlockByCaption(doc: Document, caption: string): Element {
  const block = Array.from(doc.querySelectorAll(".imageblock")).find(
    (element) =>
      element.querySelector(".title")?.textContent?.trim() === caption,
  );
  expect(block, caption).toBeTruthy();
  return block!;
}

describe("manual render contract fixtures", () => {
  it("keeps the AsciiDoc manual sample user-visible DOM contract", async () => {
    const { doc, expanded, renderResult } = await renderManualAsciiDoc();
    const bodyText = doc.body.textContent ?? "";

    expect(expanded.diagnostics).toEqual([]);
    expect(bodyText).toContain("Manual AsciiDoc Render Check");
    expect(bodyText).toContain("This paragraph comes from an included header.");
    expect(bodyText).toContain("Included Nested Section");
    expect(bodyText).not.toContain(":imagesdir:");
    expect(bodyText).not.toContain(":table-caption:");
    expect(bodyText).not.toContain(":leveloffset: +");

    expect(doc.querySelectorAll(".admonitionblock")).toHaveLength(5);
    expect(doc.querySelector(".admonitionblock.note .icon-note")).toBeTruthy();

    const table = doc.querySelector("table.tableblock");
    expect(table?.querySelector("caption.title")?.textContent).toContain(
      "Merged cell table",
    );
    expect(table?.querySelector("[colspan='2']")).toBeTruthy();
    expect(table?.querySelector("[rowspan='2']")).toBeTruthy();

    const sourceFrames = doc.querySelectorAll(".source-block-frame");
    expect(sourceFrames.length).toBeGreaterThanOrEqual(2);
    expect(doc.querySelector("pre .language-ts")).toBeTruthy();
    expect(bodyText).toContain("Manual source include");

    expect(doc.querySelector(".math-inline .katex")).toBeTruthy();
    expect(doc.querySelector(".math-block .katex-display")).toBeTruthy();

    const normalSvg = imageBlockByCaption(doc, "Figure 1. Normal SVG");
    expect(
      normalSvg.querySelector('img[src^="data:image/svg+xml"]'),
    ).toBeTruthy();
    expect(normalSvg.querySelector(".image-placeholder")).toBeNull();

    const pngImage = imageBlockByCaption(doc, "Figure 2. PNG image");
    expect(pngImage.querySelector('img[src^="data:image/png"]')).toBeTruthy();
    expect(pngImage.querySelector(".image-placeholder")).toBeNull();

    const oversized = imageBlockByCaption(doc, "Figure 3. Oversized SVG");
    expect(
      oversized.querySelector('img[src^="data:image/svg+xml"]'),
    ).toBeTruthy();
    expect(oversized.querySelector(".image-placeholder")).toBeNull();

    const missing = imageBlockByCaption(
      doc,
      "Figure 4. Missing image placeholder",
    );
    expect(missing.querySelector("img")).toBeNull();
    expect(missing.querySelector(".image-placeholder")?.textContent).toBe(
      "Local image is not available.",
    );

    expect(renderResult.mermaidDiagrams.length).toBeGreaterThanOrEqual(1);
    expect(renderResult.plantUmlDiagrams.length).toBeGreaterThanOrEqual(1);
    expect(renderResult.graphvizDiagrams.length).toBeGreaterThanOrEqual(1);
    expect(renderResult.krokiDiagrams.length).toBeGreaterThanOrEqual(1);
    expect(doc.querySelector("[data-diagram-id='mermaid-1']")).toBeTruthy();
    expect(doc.querySelector("[data-diagram-id='plantuml-1']")).toBeTruthy();
    expect(doc.querySelector("[data-diagram-id='graphviz-1']")).toBeTruthy();
    expect(bodyText).not.toContain("@startuml");
    expect(bodyText).not.toContain("flowchart TD");
    expect(doc.querySelector("script, [onclick], iframe, object")).toBeNull();
  });

  it("keeps the Markdown manual sample user-visible DOM contract", async () => {
    const { doc, renderResult } = await renderManualMarkdown();
    const bodyText = doc.body.textContent ?? "";

    expect(doc.querySelector(".markdown-frontmatter")).toBeTruthy();
    expect(doc.querySelector(".markdown-alert-note")).toBeTruthy();
    expect(doc.querySelector(".markdown-alert-warning")).toBeTruthy();
    expect(doc.querySelectorAll(".task-list-item-checkbox")).toHaveLength(2);
    expect(doc.querySelector(".markdown-details")).toBeTruthy();
    expect(doc.querySelector(".markdown-details[open]")).toBeTruthy();
    expect(doc.querySelector(".footnotes")).toBeTruthy();

    expect(doc.querySelector("table")).toBeTruthy();
    expect(doc.querySelector(".math-inline .katex")).toBeTruthy();
    expect(doc.querySelector(".math-block .katex-display")).toBeTruthy();
    expect(bodyText).toContain("USD $5");
    expect(
      Array.from(doc.querySelectorAll("table code")).some((code) =>
        code.textContent?.includes("$x$"),
      ),
    ).toBe(true);

    expect(
      doc.querySelector("pre .language-python .hljs-keyword"),
    ).toBeTruthy();
    expect(doc.querySelector("pre .language-rust .hljs-keyword")).toBeTruthy();

    expect(
      doc.querySelector('img[data-image-path="assets/manual-sample.svg"]'),
    ).toBeTruthy();
    expect(
      doc.querySelector('img[data-image-path="assets/manual-sample.png"]'),
    ).toBeTruthy();
    expect(
      doc.querySelector('img[data-image-path="assets/oversized-diagram.svg"]'),
    ).toBeTruthy();
    expect(
      Array.from(doc.querySelectorAll(".image-placeholder")).some(
        (placeholder) =>
          placeholder.textContent === "Local image is not available.",
      ),
    ).toBe(true);

    expect(renderResult.diagramSlots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ renderer: "mermaid" }),
        expect.objectContaining({ renderer: "plantuml" }),
        expect.objectContaining({ renderer: "graphviz" }),
      ]),
    );
    expect(doc.querySelector("[data-diagram-id='mermaid-1']")).toBeTruthy();
    expect(doc.querySelector("[data-diagram-id='plantuml-1']")).toBeTruthy();
    expect(doc.querySelector("[data-diagram-id='graphviz-1']")).toBeTruthy();
    expect(bodyText).toContain("window.__manualRenderUnsafe = true");
    expect(doc.querySelector("script, [onclick], iframe, object")).toBeNull();
  });
});
