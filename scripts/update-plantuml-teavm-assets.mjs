import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const targetRoot = path.join(repoRoot, "public", "vendor", "plantuml-teavm");

const assets = {
  "plantuml.js": "https://plantuml.github.io/plantuml/js-plantuml/plantuml.js",
  "viz-global.js":
    "https://plantuml.github.io/plantuml/js-plantuml/viz-global.js",
};

await fs.mkdir(targetRoot, { recursive: true });

for (const [fileName, url] of Object.entries(assets)) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to download ${url}: HTTP ${response.status}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const targetPath = path.join(targetRoot, fileName);
  await fs.writeFile(targetPath, bytes);
  console.log(`${fileName}: ${bytes.byteLength} bytes`);
}
