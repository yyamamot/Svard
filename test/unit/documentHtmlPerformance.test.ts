import { describe, expect, it, vi } from "vitest";

import { renderMarkdownCore } from "../../src/core/renderMarkdownCore";
import { prepareDocumentHtml } from "../../src/ui/lib/documentHtml";
import {
  collectPrepareDocumentEvents,
  documentPayload,
  renderResult,
} from "./helpers/documentHtml";

describe("prepareDocumentHtml", () => {
  it.each([
    {
      format: "markdown" as const,
      name: "Markdown without math",
      rawHtml: "<h1>Plain Markdown</h1><p>No math here.</p>",
      source: "# Plain Markdown\n\nNo math here.",
      reparseSkipped: true,
      expectedMathSelector: null,
    },
    {
      format: "markdown" as const,
      name: "Markdown with math placeholders",
      markdownSource: "Inline math: $a + b$.",
      reparseSkipped: false,
      expectedMathSelector: ".math-inline .katex",
    },
    {
      format: "asciidoc" as const,
      name: "AsciiDoc without stem",
      rawHtml: "<p>Plain AsciiDoc prose.</p>",
      source: "= Plain\n\nPlain AsciiDoc prose.",
      reparseSkipped: true,
      expectedMathSelector: null,
    },
    {
      format: "asciidoc" as const,
      name: "AsciiDoc with stem",
      rawHtml:
        '<div class="paragraph"><p>Inline \\$E = mc^2\\$ prose.</p></div>',
      source: "= Stem\n\nstem:[E = mc^2]",
      reparseSkipped: false,
      expectedMathSelector: ".math-inline .katex",
    },
  ])("keeps the post-sanitize reparse contract for $name", async (caseSpec) => {
    const markdownResult = caseSpec.markdownSource
      ? renderMarkdownCore(caseSpec.markdownSource)
      : null;
    const { events, html } = await collectPrepareDocumentEvents(
      markdownResult?.html ?? caseSpec.rawHtml ?? "",
      {
        ...documentPayload,
        format: caseSpec.format,
        path: `/workspace/docs/example.${caseSpec.format === "markdown" ? "md" : "adoc"}`,
        source: caseSpec.markdownSource ?? caseSpec.source ?? "",
      },
      markdownResult ?? { headings: [], sourceBlocks: [] },
    );
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(
      events.find(
        (event) =>
          event.event === "render.prepareDocumentHtml.sanitizedDomParse",
      ),
    ).toEqual(
      expect.objectContaining({
        skipped: caseSpec.reparseSkipped,
      }),
    );
    expect(
      events.find((event) => event.event === "render.prepareDocumentHtml.math"),
    ).toEqual(
      expect.objectContaining({
        skipped: caseSpec.reparseSkipped,
      }),
    );
    if (caseSpec.expectedMathSelector) {
      expect(doc.querySelector(caseSpec.expectedMathSelector)).toBeTruthy();
    } else {
      expect(doc.querySelector(".math-inline, .math-block")).toBeNull();
    }
  });

  it("skips AsciiDoc math scan when stem markers are absent", async () => {
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
      const html = await prepareDocumentHtml(
        "<p>Plain AsciiDoc prose without math.</p>",
        {
          ...documentPayload,
          source: "= Plain\n\nPlain AsciiDoc prose without math.",
        },
        { security: { allowLocalImages: true, confirmExternalLinks: true } },
        { headings: [], sourceBlocks: [] },
      );
      const doc = new DOMParser().parseFromString(html, "text/html");

      expect(doc.querySelector(".math-inline, .math-block")).toBeNull();
      expect(
        events.find(
          (event) => event.event === "render.prepareDocumentHtml.math",
        ),
      ).toEqual(
        expect.objectContaining({
          skipped: true,
        }),
      );
      expect(
        events.find(
          (event) =>
            event.event === "render.prepareDocumentHtml.sanitizedDomParse",
        ),
      ).toEqual(
        expect.objectContaining({
          skipped: true,
        }),
      );
    } finally {
      infoSpy.mockRestore();
      localStorage.removeItem("SVARD_PERF_TRACE");
    }
  });

  it("marks absent expensive element phases as skipped", async () => {
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
      await prepareDocumentHtml(
        "<p>Plain document.</p>",
        {
          ...documentPayload,
          source: "= Plain\n\nPlain document.",
        },
        { security: { allowLocalImages: true, confirmExternalLinks: true } },
        { headings: [], sourceBlocks: [] },
      );

      for (const eventName of [
        "render.prepareDocumentHtml.sourceBlocks",
        "render.prepareDocumentHtml.tableSourceScan",
        "render.prepareDocumentHtml.tables",
        "render.prepareDocumentHtml.images",
        "render.prepareDocumentHtml.links",
      ]) {
        expect(events.find((event) => event.event === eventName)).toEqual(
          expect.objectContaining({
            skipped: true,
            count: 0,
          }),
        );
      }
      expect(
        events.find(
          (event) => event.event === "render.prepareDocumentHtml.imageResolver",
        ),
      ).toEqual(
        expect.objectContaining({
          callCount: 0,
          resolvedCount: 0,
          blockedCount: 0,
          errorCount: 0,
          status: "unused",
        }),
      );
    } finally {
      infoSpy.mockRestore();
      localStorage.removeItem("SVARD_PERF_TRACE");
    }
  });

  it("records aggregate local image resolver timing without resource data", async () => {
    const events: Array<Record<string, unknown>> = [];
    localStorage.setItem("SVARD_PERF_TRACE", "1");
    const infoSpy = vi
      .spyOn(console, "info")
      .mockImplementation((label: unknown, payload: unknown) => {
        if (label === "[perf]" && payload && typeof payload === "object") {
          events.push(payload as Record<string, unknown>);
        }
      });
    const results = [
      {
        status: "resolved" as const,
        mediaType: "image/png",
        content: "AA==",
      },
      { status: "blocked" as const, placeholderText: "blocked" },
      { status: "error" as const, placeholderText: "error" },
    ];
    const resolveLocalImage = vi.fn(async () => results.shift()!);

    try {
      await prepareDocumentHtml(
        '<p><img src="./private-a.png"><img src="./private-b.png"><img src="./private-c.png"></p>',
        documentPayload,
        { security: { allowLocalImages: true, confirmExternalLinks: true } },
        renderResult,
        { resolveLocalImage },
      );

      const event = events.find(
        (candidate) =>
          candidate.event === "render.prepareDocumentHtml.imageResolver",
      );
      expect(event).toEqual(
        expect.objectContaining({
          callCount: 3,
          resolvedCount: 1,
          blockedCount: 1,
          errorCount: 1,
          status: "used",
        }),
      );
      expect(typeof event?.durationMs).toBe("number");
      expect(JSON.stringify(event)).not.toContain("private-a");
      expect(JSON.stringify(event)).not.toContain("/workspace");
    } finally {
      infoSpy.mockRestore();
      localStorage.removeItem("SVARD_PERF_TRACE");
    }
  });
});
