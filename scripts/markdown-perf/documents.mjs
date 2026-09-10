import fs from "node:fs/promises";
import path from "node:path";

const defaultDocumentFiles = [
  "docs/04-implementation-plan.md",
  "docs/01-specification.md",
];

export const placeholderChainDepths = [5, 10, 15];

const legacyDetailsMarkerPrefix = "SVARD_MARKDOWN_DETAILS_PLACEHOLDER";

const legacyCompatibilityMarkerPrefix = "SVARD_MARKDOWN_COMPAT_PLACEHOLDER";

export function createPlaceholderChainSource(depth) {
  const details = Array.from({ length: depth }, (_, index) => {
    const nextMarker =
      index + 1 < depth
        ? `${legacyDetailsMarkerPrefix}_${index + 1}`
        : "chain leaf";
    return `<details><summary>Level ${index}</summary>\n\n${nextMarker}\n\n${nextMarker}\n</details>`;
  }).join("\n\n");
  const compatibility = Array.from({ length: depth }, (_, index) => {
    const nextMarker =
      index + 1 < depth
        ? `${legacyCompatibilityMarkerPrefix}_${index + 1}`
        : "chain leaf";
    return `| --- | --- |\n| Level ${index} | ${nextMarker} ${nextMarker} |`;
  }).join("\n\n");
  return `# Placeholder chain depth ${depth}\n\n${details}\n\n${compatibility}\n`;
}

const syntheticDocuments = [
  {
    path: "/perf/plain-small.md",
    basename: "plain-small.md",
    source: `# Plain small

This is a small Markdown document used for render warmup attribution.

- one
- two
- three
`,
  },
  {
    path: "/perf/code-heavy.md",
    basename: "code-heavy.md",
    source: `# Code heavy

\`\`\`ts
export function render(value: string) {
  return value.trim().toUpperCase();
}
\`\`\`

\`\`\`rust
fn main() {
    println!("markup render");
}
\`\`\`

\`\`\`json
{ "name": "svard", "kind": "perf" }
\`\`\`

\`\`\`sql
select id, title from documents where format = 'markdown';
\`\`\`
`,
  },
];

const placeholderChainDocuments = placeholderChainDepths.map(
  (placeholderDepth) => ({
    path: `/perf/placeholder-chain-${placeholderDepth}.md`,
    basename: `placeholder-chain-${placeholderDepth}.md`,
    placeholderDepth,
    source: createPlaceholderChainSource(placeholderDepth),
  }),
);

function basename(filePath) {
  return filePath.split(/[\\/]/).at(-1) ?? filePath;
}

export async function readDocuments(documentArgs, includePlaceholderChains) {
  const cwd = process.cwd();
  const documentPaths =
    documentArgs.length > 0 ? documentArgs : defaultDocumentFiles;
  const fileDocuments = await Promise.all(
    documentPaths.map(async (documentPath) => {
      const absolutePath = path.resolve(cwd, documentPath);
      const source = await fs.readFile(absolutePath, "utf8");
      return {
        path: `/perf/file/${basename(absolutePath)}`,
        basename: basename(absolutePath),
        bytes: Buffer.byteLength(source),
        source,
      };
    }),
  );
  const synthetic = [
    ...(documentArgs.length === 0 ? syntheticDocuments : []),
    ...(includePlaceholderChains ? placeholderChainDocuments : []),
  ].map((document) => ({
    ...document,
    bytes: Buffer.byteLength(document.source),
  }));
  return [...synthetic, ...fileDocuments];
}

export function cloneDocumentForPhase(document, phase, index) {
  const safeName = document.basename.replace(/[^A-Za-z0-9_.-]+/g, "-");
  return {
    ...document,
    path: `/perf/${phase}/${index}-${safeName}`,
  };
}
