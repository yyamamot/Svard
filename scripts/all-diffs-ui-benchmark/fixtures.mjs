function markdownDocument(documentIndex, variant) {
  const lines = [`# Benchmark document ${documentIndex}`];
  for (let changeIndex = 0; changeIndex < 12; changeIndex += 1) {
    const value = variant === "base" ? "Before" : "After";
    lines.push(`\n## Section ${changeIndex + 1}`);
    if (changeIndex % 3 === 0) {
      lines.push(
        `\n${value} paragraph ${documentIndex}-${changeIndex} with deterministic benchmark text.`,
      );
    } else if (changeIndex % 3 === 1) {
      lines.push(
        "",
        `- Stable item ${documentIndex}-${changeIndex}`,
        `- ${value} list item ${documentIndex}-${changeIndex}`,
      );
    } else {
      lines.push(
        "",
        "| Key | Value |",
        "| --- | --- |",
        `| ${documentIndex}-${changeIndex} | ${value} |`,
      );
    }
  }
  return lines.join("\n");
}

function asciidocDocument(documentIndex, variant) {
  const lines = [`= Benchmark document ${documentIndex}`];
  for (let changeIndex = 0; changeIndex < 12; changeIndex += 1) {
    const value = variant === "base" ? "Before" : "After";
    lines.push(`\n== Section ${changeIndex + 1}`);
    if (changeIndex % 3 === 0) {
      lines.push(
        "",
        `${value} paragraph ${documentIndex}-${changeIndex} with deterministic benchmark text.`,
      );
    } else if (changeIndex % 3 === 1) {
      lines.push(
        "",
        `* Stable item ${documentIndex}-${changeIndex}`,
        `* ${value} list item ${documentIndex}-${changeIndex}`,
      );
    } else {
      lines.push(
        "",
        '[cols="1,1",options="header"]',
        "|===",
        "|Key |Value",
        `|${documentIndex}-${changeIndex} |${value}`,
        "|===",
      );
    }
  }
  return lines.join("\n");
}

function denseMarkdownList(variant) {
  const value = variant === "base" ? "Before" : "After";
  return [
    "# Dense list",
    "",
    ...Array.from(
      { length: 200 },
      (_, index) => `- ${value} item ${String(index + 1).padStart(3, "0")}`,
    ),
  ].join("\n");
}

function denseMarkdownTable(variant) {
  const value = variant === "base" ? "Before" : "After";
  return [
    "# Dense table",
    "",
    "| Row | Value |",
    "| --- | --- |",
    ...Array.from(
      { length: 200 },
      (_, index) =>
        `| ${String(index + 1).padStart(3, "0")} | ${value} value ${index + 1} |`,
    ),
  ].join("\n");
}

function documentPair({ extension, fixtureId, index, sourceFor }) {
  const relativePath = `benchmark-${fixtureId}-${index}.${extension}`;
  const path = `/benchmark/${relativePath}`;
  return {
    left: {
      path,
      relativePath,
      source: sourceFor(index, "base"),
    },
    right: {
      path,
      relativePath,
      source: sourceFor(index, "working"),
    },
  };
}

function multiDocumentFixture({ fixtureId, extension, sourceFor }) {
  return {
    fixtureId,
    expectedChangeCount: 14 * 12,
    pairs: Array.from({ length: 14 }, (_, index) =>
      documentPair({ extension, fixtureId, index, sourceFor }),
    ),
  };
}

function denseFixture({ fixtureId, sourceFor }) {
  return {
    fixtureId,
    expectedChangeCount: 200,
    pairs: [
      documentPair({
        extension: "md",
        fixtureId,
        index: 0,
        sourceFor: (_index, variant) => sourceFor(variant),
      }),
    ],
  };
}

export const allDiffsUiFixtures = [
  multiDocumentFixture({
    fixtureId: "markdown-14x12-mixed",
    extension: "md",
    sourceFor: markdownDocument,
  }),
  multiDocumentFixture({
    fixtureId: "asciidoc-14x12-mixed",
    extension: "adoc",
    sourceFor: asciidocDocument,
  }),
  denseFixture({
    fixtureId: "markdown-dense-list-200",
    sourceFor: denseMarkdownList,
  }),
  denseFixture({
    fixtureId: "markdown-dense-table-200",
    sourceFor: denseMarkdownTable,
  }),
];

export function allDiffsUiFixture(fixtureId) {
  const fixture = allDiffsUiFixtures.find(
    (candidate) => candidate.fixtureId === fixtureId,
  );
  if (!fixture) {
    throw new Error(`Unknown All Diffs UI fixture: ${fixtureId}`);
  }
  return fixture;
}
