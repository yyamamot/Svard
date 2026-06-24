import Asciidoctor from "@asciidoctor/core";
import { beforeAll, describe, expect, it } from "vitest";

import { MockHostAdapter } from "../../src/adapters/mockHostAdapter";
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
import type { DocumentPayload, RenderResult } from "../../src/core/types";
import { applyInlineDiagramsToHtml } from "../../src/ui/lib/diagramHtml";
import { markSafeHtml } from "../../src/ui/lib/safeHtml";
import { prepareDocumentHtml } from "../../src/ui/lib/documentHtml";
import {
  changedRenderedBlocks,
  compareRenderedBlocks,
  extractRenderedBlocksFromHtml,
} from "../../src/ui/lib/gitRenderedDiff";
import {
  compareRenderedTable,
  extractRenderedTablesFromHtml,
} from "../../src/ui/lib/gitTableDiff";

const asciidoctor = Asciidoctor();

beforeAll(() => {
  if (!globalThis.CSS) {
    Object.defineProperty(globalThis, "CSS", {
      value: {
        escape: (value: string) => value.replaceAll('"', '\\"'),
      },
      configurable: true,
    });
  }
});

function renderAsciiDocCore(document: DocumentPayload): RenderResult {
  const source = replaceDiagramBlocksWithPlaceholders(document.source);
  const html = asciidoctor.convert(source, {
    base_dir: document.asciidocContext?.baseDir ?? document.basePath,
    safe: "safe",
    sourcemap: true,
    attributes: {
      showtitle: true,
      icons: "font",
    },
  }) as string;

  return {
    html,
    headings: [],
    sourceBlocks: [],
    diagnostics: detectDiagramDiagnostics(document.source),
    diagramSlots: extractDiagramSlots(document.source),
    mermaidDiagrams: extractMermaidDiagrams(document.source),
    plantUmlDiagrams: extractPlantUmlDiagrams(document.source),
    graphvizDiagrams: extractGraphvizDiagrams(document.source),
    krokiDiagrams: extractKrokiDiagrams(document.source),
  };
}

function renderDocumentCore(document: DocumentPayload): RenderResult {
  if (document.format === "markdown") {
    return renderMarkdownCore(document.source);
  }
  return renderAsciiDocCore(document);
}

async function renderPreparedDocument(
  host: MockHostAdapter,
  path: string,
): Promise<{ document: DocumentPayload; html: string }> {
  const [document, config] = await Promise.all([
    host.openDocument(path),
    host.loadConfig(),
  ]);
  const result = renderDocumentCore(document);
  const html = await prepareDocumentHtml(
    result.html,
    document,
    config,
    result,
    {
      resolveLocalImage: (source, documentPath, context) =>
        host.resolveLocalImage(source, documentPath, context),
    },
  );

  return { document, html };
}

describe("render and diff user-visible integration flows", () => {
  it("renders representative AsciiDoc and Markdown documents through the browser host pipeline", async () => {
    const host = new MockHostAdapter();
    const asciidoc = await renderPreparedDocument(
      host,
      "/workspace/docs/render-fixtures.adoc",
    );
    const markdown = await renderPreparedDocument(
      host,
      "/workspace/docs/markdown-sample.md",
    );

    expect(asciidoc.document.format).toBe("asciidoc");
    expect(asciidoc.html).toContain('data-review-id="rendered-table"');
    expect(asciidoc.html).toContain("source-block-frame");
    expect(asciidoc.html).toContain("admonitionblock note");
    expect(asciidoc.html).toContain("Local image: diagram.svg");
    expect(asciidoc.html).not.toContain("<script");

    expect(markdown.document.format).toBe("markdown");
    expect(markdown.html).toContain("<h1");
    expect(markdown.html).toContain("Markdown Sample");
    expect(markdown.html).toContain("<table");
    expect(markdown.html).not.toContain("<script");
  });

  it("keeps Kroki diagram rendering explicit and source-private at the adapter boundary", async () => {
    const host = new MockHostAdapter();
    const document = await host.openDocument(
      "/workspace/docs/git-rendered-unsupported-diagram.adoc",
    );
    const config = await host.loadConfig();
    const result = renderDocumentCore(document);
    const [diagram] = result.krokiDiagrams;

    expect(diagram).toBeTruthy();
    expect(result.diagramSlots[0]).toMatchObject({
      renderer: "kroki",
      diagramType: "c4plantuml",
    });

    const publicWithoutConfirmation = await host.renderDiagram({
      diagramType: diagram!.diagramType,
      source: diagram!.source,
      config: {
        ...config.kroki,
        mode: "public",
        endpointUrl: "https://kroki.io",
      },
      confirmedRemoteSend: false,
    });
    const diagnosticHtml = applyInlineDiagramsToHtml({
      html: markSafeHtml(result.html),
      document,
      slots: result.diagramSlots,
      mermaidDiagrams: [],
      plantUmlDiagrams: [],
      graphvizDiagrams: [],
      krokiMode: "public",
      krokiDiagrams: [{ ...diagram!, result: publicWithoutConfirmation }],
    });

    expect(publicWithoutConfirmation.status).toBe("error");
    expect(diagnosticHtml).toContain(
      "Remote diagram rendering requires explicit confirmation.",
    );
    expect(diagnosticHtml).toContain('data-review-id="kroki-confirm"');
    expect(diagnosticHtml).not.toContain("Person(user");

    const remoteRendered = await host.renderDiagram({
      diagramType: diagram!.diagramType,
      source: diagram!.source,
      config: {
        ...config.kroki,
        mode: "remote",
        endpointUrl: "http://127.0.0.1:8000",
        requireRemoteConfirmation: false,
      },
      confirmedRemoteSend: false,
    });
    const renderedHtml = applyInlineDiagramsToHtml({
      html: markSafeHtml(result.html),
      document,
      slots: result.diagramSlots,
      mermaidDiagrams: [],
      plantUmlDiagrams: [],
      graphvizDiagrams: [],
      krokiMode: "remote",
      krokiDiagrams: [{ ...diagram!, result: remoteRendered }],
    });

    expect(remoteRendered.status).toBe("rendered");
    expect(renderedHtml).toContain('data-review-id="kroki-render"');
    expect(renderedHtml).toContain('data-review-id="diagram-inline-image"');
    expect(renderedHtml).not.toContain("Person(user");
  });

  it("covers source, rendered, and table Git diff preview flows from fixtures", async () => {
    const host = new MockHostAdapter();
    const renderedPreview = await host.getGitDiffPreview(
      "/workspace/docs/git-rendered-markdown.md",
    );
    const leftRendered = renderMarkdownCore(renderedPreview.leftText ?? "");
    const rightRendered = renderMarkdownCore(renderedPreview.rightText ?? "");
    const renderedBlocks = compareRenderedBlocks(
      extractRenderedBlocksFromHtml(leftRendered.html),
      extractRenderedBlocksFromHtml(rightRendered.html),
    );
    const changedKinds = changedRenderedBlocks(renderedBlocks).map(
      (block) => block.blockKind,
    );

    expect(renderedPreview.status).toBe("modified");
    expect(renderedPreview.leftLabel).toBe("HEAD");
    expect(renderedPreview.rightLabel).toBe("Working Tree");
    expect(
      renderedPreview.hunks[0]?.lines.some((line) => line.kind === "removed"),
    ).toBe(true);
    expect(
      renderedPreview.hunks[0]?.lines.some((line) => line.kind === "added"),
    ).toBe(true);
    expect(changedKinds).toContain("paragraph");
    expect(changedKinds).toContain("list");
    expect(changedKinds).toContain("source-block");

    const tablePreview = await host.getGitDiffPreview(
      "/workspace/docs/git-table.md",
    );
    const leftTables = renderMarkdownCore(tablePreview.leftText ?? "");
    const rightTables = renderMarkdownCore(tablePreview.rightText ?? "");
    const [leftTable] = extractRenderedTablesFromHtml(leftTables.html);
    const [rightTable] = extractRenderedTablesFromHtml(rightTables.html);
    const tableDiff = compareRenderedTable(
      leftTable?.rows ?? [],
      rightTable?.rows ?? [],
    );

    expect(leftTable?.label).toBe("Table 1 · Git Table Diff Fixture");
    expect(rightTable?.rows.at(-1)).toEqual(["Enterprise", "$50", "New"]);
    expect(tableDiff.cells[1]?.[1]).toEqual({
      left: "$10",
      right: "$12",
      kind: "changed",
    });
    expect(tableDiff.cells[3]?.[0]).toEqual({
      left: "",
      right: "Enterprise",
      kind: "added",
    });
  });
});
