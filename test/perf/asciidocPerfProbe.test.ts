import Asciidoctor from "@asciidoctor/core";
import fs from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { describe, expect, it, vi } from "vitest";

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
import type {
  AsciiDocIncludeFile,
  AsciiDocRenderContext,
  DocumentPayload,
  RenderResult,
} from "../../src/core/types";
import { prepareDocumentHtml } from "../../src/ui/lib/documentHtml";

const budgets = {
  totalRenderPrepareMs: 12_000,
  prepareDocumentHtmlMs: 10_000,
  sanitizeMs: 5_000,
  sanitizedDomParseMs: 25,
  mathSkippedMs: 25,
};

function now() {
  return performance.now();
}

function duration(startedAt: number) {
  return Number((performance.now() - startedAt).toFixed(2));
}

function generatedSection(index: number) {
  const image =
    index % 10 === 0
      ? `\nimage::images/synthetic-${index}.svg[Synthetic image ${index}]\n`
      : "";
  return `== Synthetic Section ${index}

Synthetic prose ${index} describes a generated interface state. This text is repeated to create a large privacy-safe AsciiDoc fixture without copying external documents.
The section references link:https://example.test/reference-${index}[Reference ${index}] and link:https://example.test/trace-${index}[Trace ${index}].
Generated fields ${index}: alpha, beta, gamma, delta, epsilon, zeta, eta, theta, iota, kappa.
Generated timing notes ${index}: queue, dispatch, render, prepare, sanitize, commit, paint, and settle are represented as neutral placeholder words.
Generated compatibility notes ${index}: local image, document link, table marker, heading source reference, and navigation target are represented without private content.
${image}
`;
}

function createSyntheticDocument() {
  const includeFiles: AsciiDocIncludeFile[] = [];
  const rootPath = "/perf/generated/large-asciidoc/index.adoc";
  const includeCount = 10;
  const sectionsPerInclude = 50;
  const rootLines = [
    "= Synthetic Large AsciiDoc",
    ":toc:",
    ":imagesdir: images",
    "",
  ];

  for (let includeIndex = 1; includeIndex <= includeCount; includeIndex += 1) {
    const includeName = `part-${String(includeIndex).padStart(2, "0")}.adoc`;
    const includePath = `/perf/generated/large-asciidoc/partials/${includeName}`;
    rootLines.push(`include::partials/${includeName}[]`);
    const firstSection = (includeIndex - 1) * sectionsPerInclude + 1;
    const source = Array.from({ length: sectionsPerInclude }, (_, offset) =>
      generatedSection(firstSection + offset),
    ).join("\n");
    includeFiles.push({ path: includePath, source });
  }

  const source = rootLines.join("\n");
  return {
    basename: "large-synthetic.adoc",
    includeFiles,
    path: rootPath,
    source,
  };
}

function summarizeEvents(events: Array<Record<string, unknown>>) {
  const prepareEvents = events
    .filter(
      (event) =>
        typeof event.event === "string" &&
        event.event.startsWith("render.prepareDocumentHtml."),
    )
    .map((event) => ({
      event: event.event,
      bytes: event.bytes,
      count: event.count,
      durationMs: event.durationMs,
      format: event.format,
      skipped: event.skipped,
    }));
  const byName = Object.fromEntries(
    prepareEvents.map((event) => [
      String(event.event).replace("render.prepareDocumentHtml.", ""),
      event,
    ]),
  );
  return { byName, events: prepareEvents };
}

function average(rows: Array<Record<string, number>>, key: string) {
  return Number(
    (
      rows.reduce((total, row) => total + Number(row[key] ?? 0), 0) /
      Math.max(1, rows.length)
    ).toFixed(2),
  );
}

function budgetResult(name: string, actual: number, limit: number) {
  return {
    actual,
    limit,
    name,
    passed: actual <= limit,
  };
}

describe("AsciiDoc perf probe", () => {
  it("measures generated large AsciiDoc render phases", async () => {
    const outPath =
      process.env.SVARD_ASCIIDOC_PERF_OUT ??
      path.resolve(process.cwd(), ".artifacts/perf/asciidoc.json");
    const budgetMode = process.env.SVARD_ASCIIDOC_PERF_BUDGET === "1";
    const fixture = createSyntheticDocument();
    const context: AsciiDocRenderContext = {
      attributes: {},
      baseDir: "/perf/generated/large-asciidoc",
      documentDir: "/perf/generated/large-asciidoc",
      resourceRoots: ["/perf/generated/large-asciidoc"],
      workspaceRoot: "/perf/generated/large-asciidoc",
    };
    const documentPayload: DocumentPayload = {
      asciidocContext: context,
      basePath: context.documentDir,
      format: "asciidoc",
      includeFiles: fixture.includeFiles,
      path: fixture.path,
      source: fixture.source,
      updatedAt: new Date(0).toISOString(),
    };
    const asciidoctor = Asciidoctor();
    const runs: Array<Record<string, number>> = [];
    const safeEvents: Array<Record<string, unknown>> = [];
    const originalLocalStorage = globalThis.localStorage;
    const infoSpy = vi
      .spyOn(console, "info")
      .mockImplementation((label: unknown, payload: unknown) => {
        if (label === "[perf]" && payload && typeof payload === "object") {
          safeEvents.push(payload as Record<string, unknown>);
        }
      });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => (key === "SVARD_PERF_TRACE" ? "1" : null),
      },
    });

    try {
      for (let iteration = 0; iteration < 3; iteration += 1) {
        const eventStart = safeEvents.length;
        const totalStartedAt = now();

        const expandStartedAt = now();
        const expanded = expandAsciiDocIncludes(
          fixture.source,
          fixture.path,
          fixture.includeFiles,
        );
        const expandIncludesMs = duration(expandStartedAt);

        const diagramStartedAt = now();
        const renderSource = replaceDiagramBlocksWithPlaceholders(
          expanded.source,
        );
        const replaceDiagramsMs = duration(diagramStartedAt);

        const convertStartedAt = now();
        const html = asciidoctor.convert(renderSource, {
          attributes: { icons: "font", showtitle: true },
          base_dir: context.baseDir,
          safe: "safe",
          sourcemap: true,
        }) as string;
        const asciidoctorConvertMs = duration(convertStartedAt);

        const extractStartedAt = now();
        const renderResult: RenderResult = {
          html,
          headings: extractHeadings(
            html,
            expanded.source,
            expanded.lineOrigins,
          ),
          sourceBlocks: extractSourceBlocks(
            expanded.source,
            expanded.lineOrigins,
          ),
          diagnostics: [
            ...expanded.diagnostics,
            ...detectDiagramDiagnostics(expanded.source, expanded.lineOrigins),
          ],
          diagramSlots: extractDiagramSlots(
            expanded.source,
            expanded.lineOrigins,
          ),
          graphvizDiagrams: extractGraphvizDiagrams(
            expanded.source,
            expanded.lineOrigins,
          ),
          krokiDiagrams: extractKrokiDiagrams(
            expanded.source,
            expanded.lineOrigins,
          ),
          mermaidDiagrams: extractMermaidDiagrams(
            expanded.source,
            expanded.lineOrigins,
          ),
          plantUmlDiagrams: extractPlantUmlDiagrams(
            expanded.source,
            expanded.lineOrigins,
          ),
        };
        const extractMetadataMs = duration(extractStartedAt);

        const prepareStartedAt = now();
        const preparedHtml = await prepareDocumentHtml(
          html,
          documentPayload,
          {
            security: {
              allowLocalImages: true,
              confirmExternalLinks: true,
            },
          },
          renderResult,
        );
        const prepareDocumentHtmlMs = duration(prepareStartedAt);
        const phaseEvents = summarizeEvents(safeEvents.slice(eventStart));
        const totalRenderPrepareMs = duration(totalStartedAt);

        runs.push({
          asciidoctorConvertMs,
          expandIncludesMs,
          expandedBytes: expanded.source.length,
          extractMetadataMs,
          headingCount: renderResult.headings.length,
          htmlBytes: html.length,
          imageCount: Number(phaseEvents.byName.images?.count ?? 0),
          includeBytes: fixture.includeFiles.reduce(
            (total, file) => total + file.source.length,
            0,
          ),
          includeCount: fixture.includeFiles.length,
          iteration,
          linkCount: Number(phaseEvents.byName.links?.count ?? 0),
          mathMs: Number(phaseEvents.byName.math?.durationMs ?? 0),
          mathSkipped: phaseEvents.byName.math?.skipped ? 1 : 0,
          prepareDocumentHtmlMs,
          preparedHtmlBytes: preparedHtml.length,
          replaceDiagramsMs,
          sanitizedDomParseMs: Number(
            phaseEvents.byName.sanitizedDomParse?.durationMs ?? 0,
          ),
          sanitizedDomParseSkipped: phaseEvents.byName.sanitizedDomParse
            ?.skipped
            ? 1
            : 0,
          sanitizeMs: Number(phaseEvents.byName.sanitize?.durationMs ?? 0),
          sourceBytes: fixture.source.length,
          totalRenderPrepareMs,
        });
      }

      const warmRuns = runs.slice(1);
      const summary = {
        averages: {
          asciidoctorConvertMs: average(warmRuns, "asciidoctorConvertMs"),
          extractMetadataMs: average(warmRuns, "extractMetadataMs"),
          mathMs: average(warmRuns, "mathMs"),
          mathSkipped: average(warmRuns, "mathSkipped"),
          prepareDocumentHtmlMs: average(warmRuns, "prepareDocumentHtmlMs"),
          sanitizedDomParseMs: average(warmRuns, "sanitizedDomParseMs"),
          sanitizedDomParseSkipped: average(
            warmRuns,
            "sanitizedDomParseSkipped",
          ),
          sanitizeMs: average(warmRuns, "sanitizeMs"),
          totalRenderPrepareMs: average(warmRuns, "totalRenderPrepareMs"),
        },
        document: {
          basename: fixture.basename,
          expandedBytes: runs[0].expandedBytes,
          headingCount: runs[0].headingCount,
          htmlBytes: runs[0].htmlBytes,
          imageCount: runs[0].imageCount,
          includeBytes: runs[0].includeBytes,
          includeCount: runs[0].includeCount,
          linkCount: runs[0].linkCount,
          preparedHtmlBytes: runs[0].preparedHtmlBytes,
          sourceBytes: runs[0].sourceBytes,
        },
      };
      const budgetResults = [
        budgetResult(
          "totalRenderPrepareMs",
          summary.averages.totalRenderPrepareMs,
          budgets.totalRenderPrepareMs,
        ),
        budgetResult(
          "prepareDocumentHtmlMs",
          summary.averages.prepareDocumentHtmlMs,
          budgets.prepareDocumentHtmlMs,
        ),
        budgetResult(
          "sanitizeMs",
          summary.averages.sanitizeMs,
          budgets.sanitizeMs,
        ),
        budgetResult(
          "sanitizedDomParseMs",
          summary.averages.sanitizedDomParseMs,
          budgets.sanitizedDomParseMs,
        ),
        budgetResult(
          "mathSkippedMs",
          summary.averages.mathMs,
          budgets.mathSkippedMs,
        ),
      ];
      const sanitizedDomParseSkipped = {
        actual: summary.averages.sanitizedDomParseSkipped,
        limit: 1,
        name: "sanitizedDomParseSkipped",
        passed: summary.averages.sanitizedDomParseSkipped === 1,
      };
      budgetResults.push(sanitizedDomParseSkipped);
      const report = {
        budgetPassed: budgetResults.every((result) => result.passed),
        budgetResults: budgetMode ? budgetResults : undefined,
        budgets: budgetMode ? budgets : undefined,
        generatedAt: new Date().toISOString(),
        runs,
        schemaVersion: 1,
        summary,
      };

      await fs.mkdir(path.dirname(outPath), { recursive: true });
      await fs.writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`);
      expect(JSON.stringify(report)).not.toContain(["", "Users", ""].join("/"));
      expect(JSON.stringify(report)).not.toContain(["test", "data"].join(""));
      if (budgetMode) {
        expect(report.budgetPassed).toBe(true);
      }
    } finally {
      infoSpy.mockRestore();
      Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  }, 120_000);
});
