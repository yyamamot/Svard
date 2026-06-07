import { beforeAll, describe, expect, it } from "vitest";

import { defaultConfig } from "../../src/core/defaultConfig";
import {
  applyDiagramPlaceholdersToHtml,
  applyInlineDiagramsToHtml,
  normalizeSvgAspectRatio,
  svgScaleClass,
} from "../../src/ui/lib/diagramHtml";
import { markSafeHtml } from "../../src/ui/lib/safeHtml";
import type { DocumentPayload } from "../../src/core/types";

const documentPayload: DocumentPayload = {
  path: "/workspace/docs/sample.adoc",
  basePath: "/workspace/docs",
  format: "asciidoc",
  source: "",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

beforeAll(() => {
  globalThis.CSS ??= {} as typeof CSS;
  globalThis.CSS.escape ??= (value: string) =>
    value.replaceAll('"', '\\"').replaceAll("\\", "\\\\");
});

describe("svgScaleClass", () => {
  it("fits small horizontal diagrams to reader width", () => {
    expect(
      svgScaleClass('<svg viewBox="0 0 360 160" width="360" height="160" />', {
        allowFitWidth: true,
      }),
    ).toBe("diagram-scale-fit-width");
  });

  it("fits normal aspect diagrams to reader width", () => {
    expect(
      svgScaleClass('<svg viewBox="0 0 240 240" />', { allowFitWidth: true }),
    ).toBe("diagram-scale-fit-width");
  });

  it("keeps non-fit diagrams readable instead of full width", () => {
    expect(svgScaleClass('<svg viewBox="0 0 240 240" />')).toBe(
      "diagram-scale-readable",
    );
  });

  it("does not force tall diagrams to full width", () => {
    expect(svgScaleClass('<svg viewBox="0 0 140 420" />')).toBe(
      "diagram-scale-natural",
    );
  });

  it("keeps unknown-size SVGs natural", () => {
    expect(svgScaleClass("<svg><text>Diagram</text></svg>")).toBe(
      "diagram-scale-natural",
    );
  });

  it("keeps compact Kroki C4 SVGs readable instead of full width", () => {
    expect(
      svgScaleClass(
        '<svg width="234px" height="258px" viewBox="0 0 234 258" preserveAspectRatio="none" />',
      ),
    ).toBe("diagram-scale-readable");
  });

  it("keeps Kroki SVGs at natural size when requested", () => {
    expect(
      svgScaleClass(
        '<svg width="234px" height="258px" viewBox="0 0 234 258" preserveAspectRatio="none" />',
        { preferNaturalSize: true },
      ),
    ).toBe("diagram-scale-natural");
  });
});

describe("normalizeSvgAspectRatio", () => {
  it("replaces Kroki SVG stretch mode with meet scaling", () => {
    expect(
      normalizeSvgAspectRatio(
        markSafeHtml(
          '<svg width="234px" height="258px" viewBox="0 0 234 258" preserveAspectRatio="none"><rect /></svg>',
        ),
      ),
    ).toContain('preserveAspectRatio="xMidYMid meet"');
  });

  it("leaves existing non-stretch SVG aspect ratio untouched", () => {
    const svg =
      '<svg viewBox="0 0 120 80" preserveAspectRatio="xMidYMid meet"><rect /></svg>';
    expect(normalizeSvgAspectRatio(markSafeHtml(svg))).toBe(svg);
  });
});

describe("applyInlineDiagramsToHtml", () => {
  it("keeps diagram slots visible as loading placeholders before hydration", () => {
    const html = applyDiagramPlaceholdersToHtml({
      html: markSafeHtml(
        '<div class="diagram-slot" data-diagram-id="plantuml-1" data-diagram-type="plantuml" data-diagram-renderer="plantuml"></div>',
      ),
      slots: [
        {
          id: "plantuml-1",
          diagramType: "plantuml",
          renderer: "plantuml",
          sourceLocation: {
            line: 3,
            column: 1,
            sourcePath: "/workspace/docs/sample.adoc",
          },
        },
      ],
    });

    expect(html).toContain("diagram-placeholder");
    expect(html).toContain("diagram-placeholder-plantuml");
    expect(html).toContain('data-review-id="diagram-placeholder"');
    expect(html).toContain("Rendering PlantUML diagram...");
    expect(html).toContain('data-source-line="3"');
    expect(html).toContain(
      'data-source-reference="/workspace/docs/sample.adoc:3"',
    );
    expect(html).not.toContain("@startuml");
  });

  it("replaces loading placeholders with hydrated diagram HTML", () => {
    const placeholderHtml = applyDiagramPlaceholdersToHtml({
      html: markSafeHtml(
        '<div class="diagram-slot" data-diagram-id="mermaid-1" data-diagram-type="mermaid" data-diagram-renderer="mermaid"></div>',
      ),
      slots: [
        {
          id: "mermaid-1",
          diagramType: "mermaid",
          renderer: "mermaid",
          sourceLocation: { line: 3, column: 1 },
        },
      ],
    });
    const html = applyInlineDiagramsToHtml({
      html: placeholderHtml,
      document: documentPayload,
      slots: [
        {
          id: "mermaid-1",
          diagramType: "mermaid",
          renderer: "mermaid",
          sourceLocation: { line: 3, column: 1 },
        },
      ],
      mermaidDiagrams: [
        {
          id: "mermaid-1",
          source: "graph TD; A-->B",
          svg: '<svg viewBox="0 0 100 50"><text>Hydrated</text></svg>',
        },
      ],
      plantUmlDiagrams: [],
      graphvizDiagrams: [],
      krokiMode: defaultConfig.kroki.mode,
      krokiDiagrams: [],
    });

    expect(html).toContain('data-review-id="mermaid-render"');
    expect(html).toContain("Hydrated");
    expect(html).not.toContain("Rendering Mermaid diagram...");
    expect(html).not.toContain("diagram-placeholder-slot");
  });

  it("labels local PlantUML failures before Kroki fallback is attempted", () => {
    const html = applyInlineDiagramsToHtml({
      html: markSafeHtml(
        '<div class="diagram-slot" data-diagram-id="plantuml-1" data-diagram-renderer="plantuml"></div>',
      ),
      document: documentPayload,
      slots: [
        {
          id: "plantuml-1",
          diagramType: "plantuml",
          renderer: "plantuml",
          sourceLocation: { line: 3, column: 1 },
        },
      ],
      mermaidDiagrams: [],
      plantUmlDiagrams: [
        {
          id: "plantuml-1",
          source: "@startuml\nAlice -> Bob\n@enduml",
          result: {
            status: "error",
            diagnostics: ["PlantUML render failed."],
          },
        },
      ],
      graphvizDiagrams: [],
      krokiMode: "remote",
      krokiDiagrams: [],
    });

    expect(html).toContain("Local PlantUML render failed.");
    expect(html).toContain("Try with Kroki");
  });

  it("labels Kroki PlantUML failures after Kroki rendering is attempted", () => {
    const html = applyInlineDiagramsToHtml({
      html: markSafeHtml(
        '<div class="diagram-slot" data-diagram-id="plantuml-1" data-diagram-renderer="plantuml"></div>',
      ),
      document: documentPayload,
      slots: [
        {
          id: "plantuml-1",
          diagramType: "plantuml",
          renderer: "plantuml",
          sourceLocation: { line: 3, column: 1 },
        },
      ],
      mermaidDiagrams: [],
      plantUmlDiagrams: [
        {
          id: "plantuml-1",
          source: "@startuml\nAlice -> Bob\n@enduml",
          fallbackResult: {
            status: "error",
            message: "failed to call Kroki endpoint",
          },
        },
      ],
      graphvizDiagrams: [],
      krokiMode: defaultConfig.kroki.mode,
      krokiDiagrams: [],
    });

    expect(html).toContain("Kroki endpoint request failed.");
    expect(html).not.toContain("Try with Kroki");
  });

  it("sanitizes inline diagram SVG output", () => {
    const html = applyInlineDiagramsToHtml({
      html: markSafeHtml(
        '<div class="diagram-slot" data-diagram-id="mermaid-1" data-diagram-renderer="mermaid"></div>',
      ),
      document: documentPayload,
      slots: [
        {
          id: "mermaid-1",
          diagramType: "mermaid",
          renderer: "mermaid",
          sourceLocation: { line: 3, column: 1 },
        },
      ],
      mermaidDiagrams: [
        {
          id: "mermaid-1",
          source: "graph TD; A-->B",
          svg: '<svg viewBox="0 0 100 50" onclick="alert(1)"><foreignObject><script>alert(1)</script></foreignObject><a href="javascript:alert(2)"><text>Unsafe</text></a><text>Safe</text></svg>',
        },
      ],
      plantUmlDiagrams: [],
      graphvizDiagrams: [],
      krokiMode: defaultConfig.kroki.mode,
      krokiDiagrams: [],
    });

    expect(html).toContain("<svg");
    expect(html).toContain("Safe");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("foreignObject");
    expect(html).not.toContain("script");
    expect(html).not.toContain("javascript:");
  });
});
