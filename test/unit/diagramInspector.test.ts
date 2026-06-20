import { describe, expect, it } from "vitest";
import { buildDiagramInspectorItems } from "../../src/ui/lib/diagramInspector";
import type { DocumentPayload, RenderResult } from "../../src/core/types";

const documentPayload: DocumentPayload = {
  path: "/workspace/doc.adoc",
  source: "",
  format: "asciidoc",
  basePath: "/workspace",
  updatedAt: "2026-06-20T00:00:00.000Z",
};

function renderResult(): RenderResult {
  return {
    html: "",
    headings: [],
    sourceBlocks: [],
    diagnostics: [],
    diagramSlots: [
      {
        id: "plantuml-1",
        renderer: "plantuml",
        diagramType: "plantuml",
        sourceLocation: { line: 4 },
      },
      {
        id: "kroki-1",
        renderer: "kroki",
        diagramType: "blockdiag",
        sourceLocation: { sourcePath: "/workspace/include.adoc", line: 8 },
      },
    ],
    mermaidDiagrams: [],
    plantUmlDiagrams: [
      {
        id: "plantuml-1",
        source: "@startuml\nAlice -> Bob\n@enduml",
        sourceLocation: { line: 4 },
      },
    ],
    graphvizDiagrams: [],
    krokiDiagrams: [
      {
        id: "kroki-1",
        diagramType: "blockdiag",
        source: "blockdiag { A -> B }",
        sourceLocation: { sourcePath: "/workspace/include.adoc", line: 8 },
      },
    ],
  };
}

describe("buildDiagramInspectorItems", () => {
  it("marks diagrams pending before async render results arrive", () => {
    const items = buildDiagramInspectorItems({
      document: documentPayload,
      renderResult: renderResult(),
      renderSnapshot: null,
    });

    expect(items[0]).toMatchObject({
      id: "plantuml-1",
      renderPath: "local",
      status: "pending",
      sourceReference: "/workspace/doc.adoc:4",
    });
  });

  it("merges PlantUML metrics and cache status", () => {
    const items = buildDiagramInspectorItems({
      document: documentPayload,
      renderResult: renderResult(),
      renderSnapshot: {
        graphvizDiagrams: [],
        mermaidDiagrams: [],
        krokiDiagrams: [
          {
            id: "kroki-1",
            diagramType: "blockdiag",
            source: "blockdiag { A -> B }",
            result: { status: "disabled", cacheStatus: "disabled" },
          },
        ],
        plantUmlDiagrams: [
          {
            id: "plantuml-1",
            source: "@startuml\nAlice -> Bob\n@enduml",
            result: {
              status: "rendered",
              svg: "<svg></svg>",
              diagnostics: [],
              metrics: { renderMs: 12, svgBytes: 100, cacheStatus: "hit" },
            },
          },
        ],
      },
    });

    expect(items[0]).toMatchObject({
      status: "rendered",
      renderPath: "local",
      svg: "<svg></svg>",
      cacheStatus: "hit",
      metrics: { renderMs: 12, svgBytes: 100, cacheStatus: "hit" },
    });
    expect(items[1]).toMatchObject({
      status: "disabled",
      renderPath: "disabled",
      sourceReference: "/workspace/include.adoc:8",
    });
  });

  it("marks PlantUML external fallback results separately from Kroki", () => {
    const items = buildDiagramInspectorItems({
      document: documentPayload,
      renderResult: renderResult(),
      renderSnapshot: {
        graphvizDiagrams: [],
        mermaidDiagrams: [],
        krokiDiagrams: [],
        plantUmlDiagrams: [
          {
            id: "plantuml-1",
            source: "@startuml\nAlice -> Bob\n@enduml",
            result: {
              status: "error",
              diagnostics: ["Built-in PlantUML failed"],
            },
            externalResult: {
              status: "rendered",
              svg: "<svg><text>external</text></svg>",
              diagnostics: [],
              metrics: {
                renderMs: 25,
                svgBytes: 32,
                cacheStatus: "miss",
              },
            },
          },
        ],
      },
    });

    expect(items[0]).toMatchObject({
      status: "rendered",
      renderPath: "external-fallback",
      svg: "<svg><text>external</text></svg>",
      cacheStatus: "miss",
      metrics: { renderMs: 25, svgBytes: 32, cacheStatus: "miss" },
    });
  });
});
