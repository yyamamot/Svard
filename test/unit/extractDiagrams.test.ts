import { describe, expect, it } from "vitest";

import {
  detectDiagramDiagnostics,
  extractDiagramSlots,
  extractGraphvizDiagrams,
  extractKrokiDiagrams,
  extractMermaidDiagrams,
  extractPlantUmlDiagrams,
  replaceDiagramBlocksWithPlaceholders,
} from "../../src/core/extractDiagrams";

describe("diagram extraction", () => {
  it("routes PlantUML to the local renderer instead of Kroki", () => {
    const source = `[plantuml]
----
@startuml
Alice -> Bob
@enduml
----

[graphviz]
----
digraph G { A -> B }
----

[dot]
----
digraph D { X -> Y }
----`;

    expect(extractPlantUmlDiagrams(source)).toHaveLength(1);
    expect(extractGraphvizDiagrams(source)).toHaveLength(2);
    expect(extractGraphvizDiagrams(source)[0].diagramType).toBe("graphviz");
    expect(extractGraphvizDiagrams(source)[1].diagramType).toBe("dot");
    expect(extractKrokiDiagrams(source)).toHaveLength(0);
    expect(detectDiagramDiagnostics(source)).toHaveLength(0);
  });

  it("returns source locations for diagram diagnostics and local diagrams", () => {
    const source = `= Fixture

== Diagrams

[graphviz]
----
digraph G { A -> B }
----

[blockdiag]
----
A -> B
----`;

    const graphviz = extractGraphvizDiagrams(source);
    const diagnostics = detectDiagramDiagnostics(source);
    const kroki = extractKrokiDiagrams(source);

    expect(graphviz[0].sourceLocation).toEqual({ line: 5, column: 1 });
    expect(diagnostics[0].sourceLocation).toEqual({ line: 10, column: 1 });
    expect(kroki[0].sourceLocation).toEqual({ line: 10, column: 1 });
  });

  it("replaces diagram blocks with stable inline placeholders", () => {
    const source = `= Fixture

[mermaid]
----
flowchart LR
  A --> B
----

[plantuml]
----
@startuml
Alice -> Bob
@enduml
----

[dot]
----
digraph D { X -> Y }
----

[blockdiag]
----
A -> B
----

[source,ts]
----
const keep = true;
----`;

    const slots = extractDiagramSlots(source);
    const replaced = replaceDiagramBlocksWithPlaceholders(source);

    expect(slots.map((slot) => slot.id)).toEqual([
      "mermaid-1",
      "plantuml-1",
      "graphviz-1",
      "kroki-1",
    ]);
    expect(replaced).toContain('data-diagram-id="mermaid-1"');
    expect(replaced).toContain('data-diagram-id="plantuml-1"');
    expect(replaced).toContain('data-diagram-id="graphviz-1"');
    expect(replaced).toContain('data-diagram-id="kroki-1"');
    expect(replaced).not.toContain("flowchart LR");
    expect(replaced).not.toContain("@startuml");
    expect(replaced).not.toContain("digraph D");
    expect(replaced).toContain("const keep = true;");
  });

  it("extracts diagram blocks with AsciiDoc attributes without changing generated ids", () => {
    const source = `= Fixture

[mermaid,format=svg]
----
flowchart LR
  A --> B
----

[plantuml,id=sequence-a]
----
@startuml
Alice -> Bob
@enduml
----

[graphviz,opts=inline]
----
digraph G { A -> B }
----

[dot,id=g1]
----
digraph D { X -> Y }
----`;

    const slots = extractDiagramSlots(source);
    const replaced = replaceDiagramBlocksWithPlaceholders(source);

    expect(slots.map((slot) => slot.id)).toEqual([
      "mermaid-1",
      "plantuml-1",
      "graphviz-1",
      "graphviz-2",
    ]);
    expect(slots.map((slot) => slot.diagramType)).toEqual([
      "mermaid",
      "plantuml",
      "graphviz",
      "dot",
    ]);
    expect(extractMermaidDiagrams(source)[0].source).toContain("flowchart LR");
    expect(extractPlantUmlDiagrams(source)[0].source).toContain("@startuml");
    expect(
      extractGraphvizDiagrams(source).map((diagram) => diagram.id),
    ).toEqual(["graphviz-1", "graphviz-2"]);
    expect(replaced).toContain('data-diagram-id="mermaid-1"');
    expect(replaced).toContain('data-diagram-id="plantuml-1"');
    expect(replaced).toContain('data-diagram-id="graphviz-1"');
    expect(replaced).toContain('data-diagram-id="graphviz-2"');
    expect(replaced).not.toContain("flowchart LR");
    expect(replaced).not.toContain("@startuml");
    expect(replaced).not.toContain("digraph G");
    expect(replaced).not.toContain("digraph D");
  });

  it("keeps source blocks with diagram languages out of diagram extraction", () => {
    const source = `= Fixture

[source,plantuml]
----
@startuml
Alice -> Bob
@enduml
----

[source,mermaid]
----
flowchart LR
  A --> B
----`;

    expect(extractDiagramSlots(source)).toEqual([]);
    expect(extractPlantUmlDiagrams(source)).toEqual([]);
    expect(extractMermaidDiagrams(source)).toEqual([]);

    const replaced = replaceDiagramBlocksWithPlaceholders(source);
    expect(replaced).toContain("@startuml");
    expect(replaced).toContain("flowchart LR");
    expect(replaced).not.toContain("diagram-slot");
  });

  it("extracts common literal-delimited PlantUML blocks", () => {
    const source = `= Fixture

[plantuml]
....
@startuml
Alice -> Bob
@enduml
....`;

    const diagrams = extractPlantUmlDiagrams(source);
    const replaced = replaceDiagramBlocksWithPlaceholders(source);

    expect(diagrams).toHaveLength(1);
    expect(diagrams[0].source).toContain("@startuml");
    expect(replaced).toContain('data-diagram-id="plantuml-1"');
    expect(replaced).not.toContain("@startuml");
  });

  it("extracts markerless PlantUML blocks without changing source", () => {
    const source = `= Fixture

[plantuml]
....
actor User
User -> Renderer: Render
....`;

    const diagrams = extractPlantUmlDiagrams(source);
    const replaced = replaceDiagramBlocksWithPlaceholders(source);

    expect(diagrams).toHaveLength(1);
    expect(diagrams[0].source).toBe("actor User\nUser -> Renderer: Render");
    expect(replaced).toContain('data-diagram-id="plantuml-1"');
    expect(replaced).not.toContain("User -> Renderer");
  });

  it("extracts CRLF literal-delimited PlantUML blocks", () => {
    const source = [
      "= Fixture",
      "",
      "[plantuml]",
      "....",
      "@startuml",
      "Alice -> Bob",
      "@enduml",
      "....",
      "",
    ].join("\r\n");

    expect(extractPlantUmlDiagrams(source)).toHaveLength(1);
    expect(replaceDiagramBlocksWithPlaceholders(source)).toContain(
      'data-diagram-id="plantuml-1"',
    );
  });

  it("reports Kroki diagnostics for attributed unsupported diagram blocks", () => {
    const source = `= Fixture

[blockdiag,id=unsupported]
----
A -> B
----`;

    expect(extractKrokiDiagrams(source)).toMatchObject([
      {
        id: "kroki-1",
        diagramType: "blockdiag",
        source: "A -> B",
        sourceLocation: { line: 3, column: 1 },
      },
    ]);
    expect(detectDiagramDiagnostics(source)).toMatchObject([
      {
        id: "kroki-1",
        severity: "info",
        message: "Kroki blockdiag diagram is disabled by default.",
        sourceLocation: { line: 3, column: 1 },
      },
    ]);
  });
});
