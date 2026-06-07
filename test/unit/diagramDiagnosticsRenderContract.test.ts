import { describe, expect, it } from "vitest";

import {
  renderAsciiDocContract,
  renderMarkdownContract,
} from "./renderContractTestUtils";

describe("diagram diagnostics render contract", () => {
  it("keeps AsciiDoc diagram slots, diagnostics, and source non-leak stable", async () => {
    const { doc, renderResult } = await renderAsciiDocContract({
      source: `= Diagram Diagnostics

[mermaid]
----
flowchart TD
  A --> B
----

[plantuml]
----
@startuml
Alice -> Bob: Hello
@enduml
----

[graphviz]
----
digraph G { A -> B }
----

[blockdiag]
----
blockdiag { A -> B; }
----`,
    });
    const bodyText = doc.body.textContent ?? "";

    expect(renderResult.diagramSlots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "mermaid-1", renderer: "mermaid" }),
        expect.objectContaining({ id: "plantuml-1", renderer: "plantuml" }),
        expect.objectContaining({ id: "graphviz-1", renderer: "graphviz" }),
        expect.objectContaining({ id: "kroki-1", renderer: "kroki" }),
      ]),
    );
    expect(renderResult.diagnostics).toEqual([
      expect.objectContaining({
        id: "kroki-1",
        message: "Kroki blockdiag diagram is disabled by default.",
      }),
    ]);
    expect(doc.querySelector("[data-diagram-id='mermaid-1']")).toBeTruthy();
    expect(doc.querySelector("[data-diagram-id='plantuml-1']")).toBeTruthy();
    expect(doc.querySelector("[data-diagram-id='graphviz-1']")).toBeTruthy();
    expect(doc.querySelector("[data-diagram-id='kroki-1']")).toBeTruthy();
    expect(bodyText).not.toContain("flowchart TD");
    expect(bodyText).not.toContain("@startuml");
    expect(bodyText).not.toContain("digraph G");
    expect(bodyText).not.toContain("blockdiag {");
  });

  it("keeps Markdown diagram slots, Kroki diagnostics, and source non-leak stable", async () => {
    const { doc, renderResult } = await renderMarkdownContract({
      source: `# Markdown Diagram Diagnostics

\`\`\`mermaid
flowchart LR
  A --> B
\`\`\`

\`\`\`puml
@startuml
Alice -> Bob: Hello
@enduml
\`\`\`

\`\`\`dot
digraph G { A -> B }
\`\`\`

\`\`\`blockdiag
blockdiag { A -> B; }
\`\`\``,
    });
    const bodyText = doc.body.textContent ?? "";

    expect(renderResult.diagramSlots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "mermaid-1", renderer: "mermaid" }),
        expect.objectContaining({ id: "plantuml-1", renderer: "plantuml" }),
        expect.objectContaining({ id: "graphviz-1", renderer: "graphviz" }),
        expect.objectContaining({ id: "kroki-1", renderer: "kroki" }),
      ]),
    );
    expect(renderResult.diagnostics).toEqual([
      expect.objectContaining({
        id: "kroki-1",
        message: "Kroki blockdiag diagram is disabled by default.",
      }),
    ]);
    expect(doc.querySelector("[data-diagram-id='mermaid-1']")).toBeTruthy();
    expect(doc.querySelector("[data-diagram-id='plantuml-1']")).toBeTruthy();
    expect(doc.querySelector("[data-diagram-id='graphviz-1']")).toBeTruthy();
    expect(doc.querySelector("[data-diagram-id='kroki-1']")).toBeTruthy();
    expect(bodyText).not.toContain("flowchart LR");
    expect(bodyText).not.toContain("@startuml");
    expect(bodyText).not.toContain("digraph G");
    expect(bodyText).not.toContain("blockdiag {");
  });
});
