function section(index) {
  return `== Generated Section ${index}

Generated paragraph ${index} describes queue, render, metadata, source mapping, DOM preparation, and sanitization using synthetic content only.

[source,typescript]
----
export const generated${index} = ${index};
----
`;
}

function plainLarge() {
  return {
    fixtureId: "plain-large",
    source: [
      "= Generated Plain Large",
      ":toc:",
      "",
      ...Array.from({ length: 120 }, (_, index) => section(index + 1)),
    ].join("\n"),
    includeFiles: [],
  };
}

function includeHeavy() {
  const includeFiles = [];
  const root = ["= Generated Include Heavy", ":toc:", ""];
  for (let includeIndex = 0; includeIndex < 12; includeIndex += 1) {
    const name = `part-${String(includeIndex + 1).padStart(2, "0")}.adoc`;
    const includePath = `/perf/asciidoc/include/${name}`;
    root.push(`include::include/${name}[]`);
    includeFiles.push({
      path: includePath,
      source: Array.from({ length: 12 }, (_, sectionIndex) =>
        section(includeIndex * 12 + sectionIndex + 1),
      ).join("\n"),
    });
  }
  return {
    fixtureId: "include-heavy",
    source: root.join("\n"),
    includeFiles,
  };
}

function diagramBlock(type, index) {
  const body =
    type === "mermaid"
      ? `graph TD\n  A${index} --> B${index}`
      : type === "graphviz"
        ? `digraph G { A${index} -> B${index}; }`
        : `Alice${index} -> Bob${index}: generated`;
  return `[${type}]
----
${body}
----
`;
}

function diagramHeavy() {
  const types = ["mermaid", "plantuml", "graphviz", "blockdiag"];
  return {
    fixtureId: "diagram-heavy",
    source: [
      "= Generated Diagram Heavy",
      "",
      ...Array.from({ length: 80 }, (_, index) => [
        `== Generated Diagram ${index + 1}`,
        "",
        diagramBlock(types[index % types.length], index + 1),
      ]).flat(),
    ].join("\n"),
    includeFiles: [],
  };
}

function assets(duplicate) {
  const uniqueCount = duplicate ? 10 : 60;
  const rows = Array.from({ length: 60 }, (_, index) => {
    const requestIndex = index % uniqueCount;
    return [
      `== Generated Asset ${index + 1}`,
      "",
      `image::images/generated-${requestIndex}.png[Generated image ${index + 1}]`,
      "",
      `link:docs/generated-${requestIndex}.adoc[Generated document ${index + 1}]`,
      "",
    ].join("\n");
  });
  return {
    fixtureId: duplicate ? "assets-duplicate" : "assets-unique",
    source: ["= Generated Assets", "", ...rows].join("\n"),
    includeFiles: [],
  };
}

export const asciidocPrepareFixtures = Object.freeze([
  plainLarge(),
  includeHeavy(),
  diagramHeavy(),
  assets(true),
  assets(false),
]);

export const asciidocPrepareFixtureIds = Object.freeze(
  asciidocPrepareFixtures.map((fixture) => fixture.fixtureId),
);
