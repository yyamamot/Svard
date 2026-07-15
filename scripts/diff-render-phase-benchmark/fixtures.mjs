function markdownSections(count, changed) {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const status =
      changed && number === Math.ceil(count / 2) ? "reviewed" : "stable";
    return `## Generated section ${number}\n\nGenerated paragraph ${number} keeps the benchmark synthetic and ${status}.\n\n- Stable item ${number}\n- Status ${status}\n`;
  }).join("\n");
}

function asciidocSections(count, changed) {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    const status =
      changed && number === Math.ceil(count / 2) ? "reviewed" : "stable";
    return `== Generated section ${number}\n\nGenerated paragraph ${number} keeps the benchmark synthetic and ${status}.\n\n* Stable item ${number}\n* Status ${status}\n`;
  }).join("\n");
}

function markdownDocument(id, changed, sectionCount = 72) {
  return {
    documentId: id,
    format: "markdown",
    path: `/perf/diff/${id}.md`,
    relativePath: `${id}.md`,
    source: `# Generated ${id}\n\n${markdownSections(sectionCount, changed)}`,
  };
}

function asciidocDocument(id, changed, sectionCount = 54) {
  return {
    documentId: id,
    format: "asciidoc",
    path: `/perf/diff/${id}.adoc`,
    relativePath: `${id}.adoc`,
    source: `= Generated ${id}\n:toc:\n\n${asciidocSections(sectionCount, changed)}`,
  };
}

function markdownTableDocument(id, changed, rowCount = 96) {
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const number = index + 1;
    const status =
      changed && number === Math.ceil(rowCount / 2) ? "Reviewed" : "Stable";
    return `| Item ${number} | Owner ${number % 8} | ${status} |`;
  });
  return {
    documentId: id,
    format: "markdown",
    path: `/perf/diff/${id}.md`,
    relativePath: `${id}.md`,
    source: [
      `# Generated ${id}`,
      "",
      "| Item | Owner | Status |",
      "| --- | --- | --- |",
      ...rows,
      "",
    ].join("\n"),
  };
}

function asciidocTableDocument(
  id,
  changed,
  { complex = false, rowCount = 72 } = {},
) {
  const rows = Array.from({ length: rowCount }, (_, index) => {
    const number = index + 1;
    const status =
      changed && number === Math.ceil(rowCount / 2) ? "Reviewed" : "Stable";
    if (complex && number === 2) {
      return `2+|Generated span ${status}`;
    }
    return `|Item ${number}\n|Owner ${number % 8}\n|${status}`;
  });
  return {
    documentId: id,
    format: "asciidoc",
    path: `/perf/diff/${id}.adoc`,
    relativePath: `${id}.adoc`,
    source: [
      `= Generated ${id}`,
      "",
      ".Generated matrix",
      '[%header,cols="2,2,1"]',
      "|===",
      "|Item |Owner |Status",
      "",
      ...rows,
      "|===",
      "",
    ].join("\n"),
  };
}

function pair(left, right) {
  return Object.freeze({ left, right });
}

const markdownRendered = pair(
  markdownDocument("markdown-rendered-left", false),
  markdownDocument("markdown-rendered-right", true),
);
const asciidocRendered = pair(
  asciidocDocument("asciidoc-rendered-left", false),
  asciidocDocument("asciidoc-rendered-right", true),
);
const markdownTable = pair(
  markdownTableDocument("markdown-table-left", false),
  markdownTableDocument("markdown-table-right", true),
);
const asciidocTable = pair(
  asciidocTableDocument("asciidoc-table-left", false),
  asciidocTableDocument("asciidoc-table-right", true),
);
const asciidocComplexTable = pair(
  asciidocTableDocument("asciidoc-complex-table-left", false, {
    complex: true,
  }),
  asciidocTableDocument("asciidoc-complex-table-right", true, {
    complex: true,
  }),
);
const markdownMarker = pair(
  markdownTableDocument("markdown-marker-left", false, 64),
  markdownTableDocument("markdown-marker-right", true, 64),
);
const asciidocMarker = pair(
  asciidocTableDocument("asciidoc-marker-left", false, { rowCount: 56 }),
  asciidocTableDocument("asciidoc-marker-right", true, { rowCount: 56 }),
);

const markdownAllDiffs = Object.freeze([
  markdownRendered,
  pair(
    markdownDocument("markdown-stream-second-left", false, 60),
    markdownDocument("markdown-stream-second-right", true, 60),
  ),
]);
const asciidocAllDiffs = Object.freeze([
  asciidocRendered,
  pair(
    asciidocDocument("asciidoc-stream-second-left", false, 46),
    asciidocDocument("asciidoc-stream-second-right", true, 46),
  ),
]);

export const diffRenderPhaseFixtures = Object.freeze([
  {
    expected: {
      blockParseCount: 2,
      blockTextParseCount: 0,
      coreRenderCount: 2,
      diffOutcomes: ["ready"],
      markerOutcomes: [],
      prepareCount: 2,
      tableOutcomes: [],
    },
    fixtureId: "markdown-rendered-single",
    format: "markdown",
    workflow: "rendered-summary",
    pairs: [markdownRendered],
  },
  {
    expected: {
      blockParseCount: 2,
      blockTextParseCount: 0,
      coreRenderCount: 2,
      diffOutcomes: ["ready"],
      markerOutcomes: [],
      prepareCount: 2,
      tableOutcomes: [],
    },
    fixtureId: "asciidoc-rendered-single",
    format: "asciidoc",
    workflow: "rendered-summary",
    pairs: [asciidocRendered],
  },
  {
    expected: {
      blockParseCount: 4,
      blockTextParseCount: 0,
      coreRenderCount: 4,
      diffOutcomes: ["ready"],
      markerOutcomes: [],
      prepareCount: 2,
      tableOutcomes: ["ready"],
    },
    fixtureId: "markdown-simple-table",
    format: "markdown",
    workflow: "rendered-table",
    pairs: [markdownTable],
  },
  {
    expected: {
      blockParseCount: 4,
      blockTextParseCount: 0,
      coreRenderCount: 4,
      diffOutcomes: ["ready"],
      markerOutcomes: [],
      prepareCount: 2,
      tableOutcomes: ["ready"],
    },
    fixtureId: "asciidoc-simple-table",
    format: "asciidoc",
    workflow: "rendered-table",
    pairs: [asciidocTable],
  },
  {
    expected: {
      blockParseCount: 4,
      blockTextParseCount: 0,
      coreRenderCount: 4,
      diffOutcomes: ["ready"],
      markerOutcomes: [],
      prepareCount: 2,
      tableOutcomes: ["fallback"],
    },
    fixtureId: "asciidoc-complex-table",
    format: "asciidoc",
    workflow: "rendered-table",
    pairs: [asciidocComplexTable],
  },
  {
    expected: {
      blockParseCount: 2,
      blockTextParseCount: 2,
      coreRenderCount: 2,
      diffOutcomes: ["ready"],
      markerOutcomes: ["ready"],
      prepareCount: 2,
      tableOutcomes: [],
    },
    fixtureId: "markdown-marker-first",
    format: "markdown",
    workflow: "marker-context",
    pairs: [markdownMarker],
  },
  {
    expected: {
      blockParseCount: 2,
      blockTextParseCount: 2,
      coreRenderCount: 2,
      diffOutcomes: ["ready"],
      markerOutcomes: ["ready"],
      prepareCount: 2,
      tableOutcomes: [],
    },
    fixtureId: "asciidoc-marker-first",
    format: "asciidoc",
    workflow: "marker-context",
    pairs: [asciidocMarker],
  },
  {
    expected: {
      blockParseCount: 4,
      blockTextParseCount: 0,
      coreRenderCount: 4,
      diffOutcomes: ["ready", "ready"],
      markerOutcomes: [],
      prepareCount: 4,
      tableOutcomes: [],
    },
    fixtureId: "markdown-all-diffs",
    format: "markdown",
    workflow: "all-diffs",
    pairs: markdownAllDiffs,
  },
  {
    expected: {
      blockParseCount: 4,
      blockTextParseCount: 0,
      coreRenderCount: 4,
      diffOutcomes: ["ready", "ready"],
      markerOutcomes: [],
      prepareCount: 4,
      tableOutcomes: [],
    },
    fixtureId: "asciidoc-all-diffs",
    format: "asciidoc",
    workflow: "all-diffs",
    pairs: asciidocAllDiffs,
  },
]);

export const diffRenderPhaseFixtureIds = Object.freeze(
  diffRenderPhaseFixtures.map((fixture) => fixture.fixtureId),
);
