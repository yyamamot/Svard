import fs from "node:fs/promises";
import path from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const vendorRoot = path.join(repoRoot, "public", "vendor", "plantuml-teavm");
const distVendorRoot = path.join(repoRoot, "dist", "vendor", "plantuml-teavm");
const artifactRoot = path.join(repoRoot, ".artifacts", "plantuml-assets");
const reportPath = path.join(artifactRoot, "report.json");
const runtimeFiles = [
  "plantuml.js",
  "viz-global.js",
  "worker.html",
  "graphviz-worker.html",
];
const budgets = {
  rawBytes: Number(process.env.PLANTUML_ASSET_RAW_BUDGET ?? 9_100_000),
  gzipBytes: Number(process.env.PLANTUML_ASSET_GZIP_BUDGET ?? 2_100_000),
  brotliBytes: Number(process.env.PLANTUML_ASSET_BROTLI_BUDGET ?? 1_600_000),
};

async function main() {
  await fs.mkdir(artifactRoot, { recursive: true });
  const publicAssets = await measureRuntimeRoot(vendorRoot);
  const distAssets = await measureOptionalRuntimeRoot(distVendorRoot);
  const tauriBundle = await measureTauriBundle();
  const publicSummary = summarize(publicAssets);
  const budgetResults = {
    rawBytes: publicSummary.rawBytes <= budgets.rawBytes,
    gzipBytes: publicSummary.gzipBytes <= budgets.gzipBytes,
    brotliBytes: publicSummary.brotliBytes <= budgets.brotliBytes,
  };
  const unexpectedPublicFiles = await findUnexpectedFiles(vendorRoot);
  const passed =
    Object.values(budgetResults).every(Boolean) &&
    unexpectedPublicFiles.length === 0;

  const report = {
    generatedAt: new Date().toISOString(),
    artifactRoot,
    budgets,
    passed,
    budgetResults,
    unexpectedPublicFiles,
    publicAssets,
    publicSummary,
    distAssets,
    distSummary: summarize(distAssets),
    tauriBundle,
  };

  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        outcome: passed ? "passed" : "failed",
        reportPath,
        publicSummary,
        unexpectedPublicFiles,
      },
      null,
      2,
    ),
  );

  if (!passed) {
    process.exitCode = 1;
  }
}

async function measureRuntimeRoot(root) {
  const assets = [];
  for (const fileName of runtimeFiles) {
    const filePath = path.join(root, fileName);
    const bytes = await fs.readFile(filePath);
    assets.push(measureBytes(fileName, filePath, bytes));
  }
  return assets;
}

async function measureOptionalRuntimeRoot(root) {
  try {
    return await measureRuntimeRoot(root);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function measureBytes(fileName, filePath, bytes) {
  return {
    fileName,
    filePath,
    rawBytes: bytes.byteLength,
    gzipBytes: gzipSync(bytes).byteLength,
    brotliBytes: brotliCompressSync(bytes).byteLength,
  };
}

function summarize(assets) {
  return assets.reduce(
    (summary, asset) => ({
      rawBytes: summary.rawBytes + asset.rawBytes,
      gzipBytes: summary.gzipBytes + asset.gzipBytes,
      brotliBytes: summary.brotliBytes + asset.brotliBytes,
    }),
    { rawBytes: 0, gzipBytes: 0, brotliBytes: 0 },
  );
}

async function findUnexpectedFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && !runtimeFiles.includes(entry.name))
    .map((entry) => path.join(root, entry.name));
}

async function measureTauriBundle() {
  const bundleRoot = path.join(
    repoRoot,
    "src-tauri",
    "target",
    "release",
    "bundle",
  );
  const files = await listFiles(bundleRoot).catch(() => []);
  const measured = [];
  for (const filePath of files) {
    const stat = await fs.stat(filePath);
    measured.push({
      filePath,
      bytes: stat.size,
    });
  }
  return {
    bundleRoot,
    files: measured,
    totalBytes: measured.reduce((total, file) => total + file.bytes, 0),
  };
}

async function listFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
