import { describe, expect, it } from "vitest";

import {
  extractHeadings,
  extractSourceBlocks,
} from "../../src/core/asciidocSourceMap";
import { detectDiagramDiagnostics } from "../../src/core/extractDiagrams";

const source = `= Comprehensive Fixture
:toc:

Intro paragraph.

== Source Blocks

[source,ts]
----
export const product = "Svard";
----

[source]
----
plain source block
----

[source,rust,linenums]
----
fn main() {}
----

== Unsupported Diagram

[blockdiag,id=unsupported]
----
A -> B
----
`;

describe("AsciiDoc source map helpers", () => {
  it("keeps heading source locations in rendered order", () => {
    const html =
      '<h1 id="_comprehensive_fixture">Comprehensive Fixture</h1><h2 id="_source_blocks">Source Blocks</h2><h2 id="_unsupported_diagram">Unsupported Diagram</h2>';

    expect(extractHeadings(html, source)).toEqual([
      {
        id: "_comprehensive_fixture",
        level: 1,
        text: "Comprehensive Fixture",
        sourceLocation: { line: 1, column: 1 },
      },
      {
        id: "_source_blocks",
        level: 2,
        text: "Source Blocks",
        sourceLocation: { line: 6, column: 1 },
      },
      {
        id: "_unsupported_diagram",
        level: 2,
        text: "Unsupported Diagram",
        sourceLocation: { line: 23, column: 1 },
      },
    ]);
  });

  it("keeps source block order, language, and source locations stable", () => {
    expect(extractSourceBlocks(source)).toEqual([
      {
        id: "source-1",
        language: "ts",
        sourceLocation: { line: 8, column: 1 },
      },
      {
        id: "source-2",
        sourceLocation: { line: 13, column: 1 },
      },
      {
        id: "source-3",
        language: "rust",
        sourceLocation: { line: 18, column: 1 },
      },
    ]);
  });

  it("keeps unsupported diagram diagnostics source-located", () => {
    expect(detectDiagramDiagnostics(source)[0]).toMatchObject({
      severity: "info",
      sourceLocation: { line: 25, column: 1 },
    });
  });
});
