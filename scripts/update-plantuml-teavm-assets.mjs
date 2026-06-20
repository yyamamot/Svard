import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const targetRoot = path.join(repoRoot, "public", "vendor", "plantuml-teavm");
const artifactRoot = path.join(repoRoot, ".artifacts", "plantuml-assets");
const reportPath = path.join(artifactRoot, "update-report.json");
const requiredAssets = ["plantuml.js", "viz-global.js"];
const cdnAssets = {
  "plantuml.js": "https://plantuml.github.io/plantuml/js-plantuml/plantuml.js",
  "viz-global.js":
    "https://plantuml.github.io/plantuml/js-plantuml/viz-global.js",
};

const sourceArg =
  process.argv.find((arg) => arg.startsWith("--source=")) ?? "--source=npm";
const source = sourceArg.slice("--source=".length);
if (!["npm", "cdn"].includes(source)) {
  throw new Error("Unsupported source. Use --source=npm or --source=cdn.");
}

await fs.mkdir(targetRoot, { recursive: true });
await fs.mkdir(artifactRoot, { recursive: true });

const report = {
  generatedAt: new Date().toISOString(),
  source,
  packageName: "@plantuml/core",
  packageVersion: null,
  plantumlVersion: null,
  targetRoot,
  assets: [],
};

if (source === "npm") {
  await copyFromNpmPackage(report);
} else {
  await copyFromCdn(report);
}

await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`PlantUML TeaVM asset update report: ${reportPath}`);

async function copyFromNpmPackage(report) {
  const require = createRequire(import.meta.url);
  const packageJsonPath = require.resolve("@plantuml/core/package.json");
  const packageRoot = path.dirname(packageJsonPath);
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, "utf8"));
  report.packageVersion = packageJson.version;
  report.plantumlVersion = packageJson.version;

  for (const fileName of requiredAssets) {
    const bytes = await fs.readFile(path.join(packageRoot, fileName));
    await writeAsset(report, fileName, bytes, {
      sourcePath: path.join(packageRoot, fileName),
    });
  }
}

async function copyFromCdn(report) {
  for (const [fileName, url] of Object.entries(cdnAssets)) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`failed to download ${url}: HTTP ${response.status}`);
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    await writeAsset(report, fileName, bytes, { sourceUrl: url });
  }
}

async function writeAsset(report, fileName, bytes, sourceInfo) {
  const targetPath = path.join(targetRoot, fileName);
  const normalizedBytes = normalizeTextAsset(bytes);
  await fs.writeFile(targetPath, normalizedBytes);
  const sha256 = createHash("sha256").update(normalizedBytes).digest("hex");
  report.assets.push({
    fileName,
    targetPath,
    rawBytes: normalizedBytes.byteLength,
    sha256,
    ...sourceInfo,
  });
  console.log(
    `${fileName}: ${normalizedBytes.byteLength} bytes sha256=${sha256}`,
  );
}

function normalizeTextAsset(bytes) {
  return Buffer.from(bytes.toString("utf8").replace(/\r\n/g, "\n"), "utf8");
}
