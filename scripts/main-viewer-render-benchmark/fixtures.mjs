const duplicateRasterCount = 8;
const uniqueRasterCount = 6;

function domDenseSource() {
  return [
    "# DOM dense fixture",
    "",
    ...Array.from({ length: 72 }, (_, index) => {
      const section = index + 1;
      return [
        `## Generated section ${section}`,
        "",
        `Generated paragraph ${section} keeps the benchmark content synthetic and deterministic.`,
        "",
        `- item ${section}.1`,
        `- item ${section}.2`,
        `- item ${section}.3`,
        "",
        "| Column A | Column B | Column C |",
        "| --- | --- | --- |",
        `| ${section} | generated | [next](./generated-next.md#section-${section}) |`,
        "",
      ].join("\n");
    }),
  ].join("\n");
}

function rasterRows(paths, label) {
  return paths
    .map(
      (asset, index) =>
        `![${label} ${index + 1}](${asset})\n\nGenerated raster paragraph ${index + 1}.`,
    )
    .join("\n\n");
}

const duplicateRasterPath = "assets/imp-560-raster-1.png";
const uniqueRasterPaths = Array.from(
  { length: uniqueRasterCount },
  (_, index) => `assets/imp-560-raster-${index + 1}.png`,
);

export const mainViewerRenderFixtures = Object.freeze([
  Object.freeze({
    cacheStatus: "not-applicable",
    expectedMediaCount: 0,
    fixtureId: "plain-control",
    mediaKind: "none",
    sizeBucket: "none",
    source: [
      "# Plain control",
      "",
      "Synthetic Markdown without images or document links.",
      "",
      "- one",
      "- two",
      "- three",
      "",
    ].join("\n"),
  }),
  Object.freeze({
    cacheStatus: "not-applicable",
    expectedMediaCount: 0,
    fixtureId: "dom-dense",
    mediaKind: "none",
    sizeBucket: "none",
    source: domDenseSource(),
  }),
  Object.freeze({
    cacheStatus: "not-applicable",
    expectedMediaCount: 1,
    fixtureId: "svg-one",
    mediaKind: "svg",
    sizeBucket: "under-64-kib",
    source: [
      "# One SVG",
      "",
      "![Generated SVG](assets/svard-sample.svg)",
      "",
    ].join("\n"),
  }),
  Object.freeze({
    cacheStatus: "not-applicable",
    expectedMediaCount: duplicateRasterCount,
    fixtureId: "raster-duplicate",
    mediaKind: "raster",
    sizeBucket: "64-kib-to-1-mib",
    source: [
      "# Duplicate raster",
      "",
      rasterRows(
        Array.from({ length: duplicateRasterCount }, () => duplicateRasterPath),
        "Duplicate raster",
      ),
      "",
    ].join("\n"),
  }),
  Object.freeze({
    cacheStatus: "not-applicable",
    expectedMediaCount: uniqueRasterCount,
    fixtureId: "raster-unique",
    mediaKind: "raster",
    sizeBucket: "64-kib-to-1-mib",
    source: [
      "# Unique raster",
      "",
      rasterRows(uniqueRasterPaths, "Unique raster"),
      "",
    ].join("\n"),
  }),
  Object.freeze({
    cacheStatus: "not-applicable",
    expectedMediaCount: 1,
    fixtureId: "raster-near-5-mib",
    mediaKind: "raster",
    sizeBucket: "1-mib-to-5-mib",
    source: [
      "# Near five MiB raster",
      "",
      "![Generated large raster](assets/imp-560-raster-near-5-mib.png)",
      "",
    ].join("\n"),
  }),
]);

export const mainViewerRenderFixtureIds = Object.freeze(
  mainViewerRenderFixtures.map((fixture) => fixture.fixtureId),
);

export function mainViewerRenderFixture(fixtureId) {
  const fixture = mainViewerRenderFixtures.find(
    (candidate) => candidate.fixtureId === fixtureId,
  );
  if (!fixture) {
    throw new Error(`Unknown Main Viewer render fixture: ${fixtureId}`);
  }
  return fixture;
}
