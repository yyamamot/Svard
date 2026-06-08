import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = process.cwd();
const artifactRoot = path.join(repoRoot, ".artifacts", "maintainability");
const reportPath = path.join(artifactRoot, "report.json");
const budgetMode = process.argv.includes("--budget");
const budgetPath = path.join(artifactRoot, "budget-report.json");
const budgets = {
  severeCountMax: 1,
  warningCountMax: 10,
  severeFileLineMax: {
    "scripts/ui-review/scenarios/handlers/gitDiff.mjs": 2026,
  },
};

const trackedExtensions = new Set([
  ".css",
  ".js",
  ".jsx",
  ".mjs",
  ".rs",
  ".ts",
  ".tsx",
]);

const excludedDirectoryNames = new Set(["node_modules"]);

const excludedDirectoryPrefixes = [
  ".artifacts/",
  "Arto/",
  "dist/",
  "public/vendor/",
  "site/.astro/",
  "site/dist/",
  "src-tauri/gen/",
  "src-tauri/icons/",
  "src-tauri/target/",
  "docs/history/",
  "docs/research/",
  "docs/samples/",
];

const excludedExactFiles = new Set([
  "src-tauri/Cargo.lock",
  "src/core/fixtures.ts",
  "test/e2e/viewer.spec.ts",
]);

const criticalFiles = new Map([
  [
    "src/ui/App.tsx",
    {
      warningLines: 1200,
      targetLines: 900,
      owner: "frontend shell / orchestration",
      recommendation:
        "Extract action hooks and leaf panels before adding new behavior.",
    },
  ],
  [
    "src-tauri/src/lib.rs",
    {
      warningLines: 1200,
      targetLines: 900,
      owner: "Tauri command / backend boundary",
      recommendation:
        "Move filesystem, config, Kroki, watchers, and workspace path logic into modules.",
    },
  ],
  [
    "src/adapters/mockHostAdapter.ts",
    {
      warningLines: 900,
      targetLines: 650,
      owner: "browser harness / mock host",
      recommendation:
        "Split mock files, Git, Kroki, watchers, native drop, and fixtures by responsibility.",
    },
  ],
  [
    "src/ui/components/GitDiffPreviewPanel.tsx",
    {
      warningLines: 900,
      targetLines: 650,
      owner: "diff preview UI",
      recommendation:
        "Split mode controls, rendered panes, overview, scroll sync, and change navigation.",
    },
  ],
  [
    "src/ui/hooks/useDocumentLinks.ts",
    {
      warningLines: 700,
      targetLines: 500,
      owner: "document interaction hook",
      recommendation:
        "Split link open, context menu, copy actions, diagram actions, and table actions.",
    },
  ],
  [
    "scripts/ui-review/scenarios/registry.mjs",
    {
      warningLines: 1200,
      targetLines: 900,
      owner: "UI scenario registry",
      recommendation:
        "Split scenarios by feature area while preserving deterministic IDs.",
    },
  ],
  [
    "scripts/ui-review/assertions/registry.mjs",
    {
      warningLines: 1200,
      targetLines: 900,
      owner: "UI assertion registry",
      recommendation:
        "Split assertions by feature area and keep the central registry as composition only.",
    },
  ],
]);

const defaultWarningLines = 900;
const defaultSevereLines = 1800;

function normalizeRelativePath(relativePath) {
  return relativePath.replaceAll(path.sep, "/").replace(/^\.?\//u, "");
}

export function isExcludedMaintainabilityPath(relativePath) {
  const normalizedPath = normalizeRelativePath(relativePath);
  if (!normalizedPath) {
    return false;
  }
  if (excludedExactFiles.has(normalizedPath)) {
    return true;
  }
  const segments = normalizedPath.split("/");
  if (segments.some((segment) => excludedDirectoryNames.has(segment))) {
    return true;
  }
  return excludedDirectoryPrefixes.some((prefix) => {
    const directory = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
    return normalizedPath === directory || normalizedPath.startsWith(prefix);
  });
}

async function listFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path
      .relative(repoRoot, absolutePath)
      .replaceAll(path.sep, "/");
    if (isExcludedMaintainabilityPath(relativePath)) {
      continue;
    }
    if (entry.isDirectory()) {
      files.push(...(await listFiles(absolutePath)));
      continue;
    }
    if (entry.isFile() && trackedExtensions.has(path.extname(entry.name))) {
      files.push(relativePath);
    }
  }
  return files;
}

async function lineCount(relativePath) {
  const source = await fs.readFile(path.join(repoRoot, relativePath), "utf8");
  if (!source) {
    return 0;
  }
  return source.split(/\r?\n/u).length;
}

function classify(relativePath, lines) {
  const policy = criticalFiles.get(relativePath);
  const warningLines = policy?.warningLines ?? defaultWarningLines;
  const severeLines = Math.max(
    policy?.warningLines ?? defaultSevereLines,
    defaultSevereLines,
  );
  if (lines >= severeLines) {
    return "severe";
  }
  if (lines >= warningLines) {
    return "warning";
  }
  return "ok";
}

function adviceFor(relativePath) {
  return (
    criticalFiles.get(relativePath) ?? {
      warningLines: defaultWarningLines,
      targetLines: 700,
      owner: "general source file",
      recommendation:
        "Check whether the file now mixes unrelated responsibilities before adding more code.",
    }
  );
}

async function buildMaintainabilityReport() {
  const files = await listFiles(repoRoot);
  const items = [];
  for (const relativePath of files) {
    const lines = await lineCount(relativePath);
    const status = classify(relativePath, lines);
    if (status !== "ok" || criticalFiles.has(relativePath)) {
      const policy = adviceFor(relativePath);
      items.push({
        path: relativePath,
        lines,
        status,
        owner: policy.owner,
        warningLines: policy.warningLines,
        targetLines: policy.targetLines,
        recommendation: policy.recommendation,
      });
    }
  }

  items.sort(
    (left, right) =>
      right.lines - left.lines || left.path.localeCompare(right.path),
  );

  const summary = {
    checkedAt: new Date().toISOString(),
    fileCount: files.length,
    warningCount: items.filter((item) => item.status === "warning").length,
    severeCount: items.filter((item) => item.status === "severe").length,
  };
  return {
    schemaVersion: 1,
    outcome: "passed-with-warnings",
    summary,
    items,
  };
}

async function run() {
  const report = await buildMaintainabilityReport();
  const { summary, items } = report;

  const budgetResults = budgetMode ? evaluateBudgets(summary, items) : [];
  if (budgetMode) {
    report.budgets = budgets;
    report.budgetResults = budgetResults;
    report.budgetPassed = budgetResults.every((result) => result.passed);
  }

  await fs.mkdir(artifactRoot, { recursive: true });
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  if (budgetMode) {
    await fs.writeFile(budgetPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  console.log("maintainability check completed");
  console.log(`artifact: ${reportPath}`);
  console.log(
    `warnings: ${summary.warningCount}, severe: ${summary.severeCount}, files: ${summary.fileCount}`,
  );

  for (const item of items.slice(0, 12)) {
    console.log(
      `${item.status.padEnd(7)} ${String(item.lines).padStart(5)} ${item.path} - ${item.recommendation}`,
    );
  }

  if (budgetMode) {
    console.log(`budget artifact: ${budgetPath}`);
    if (report.budgetPassed) {
      console.log("maintainability budget passed");
    } else {
      console.error("maintainability budget failed");
      for (const result of budgetResults.filter((result) => !result.passed)) {
        console.error(
          `- ${result.name}: actual ${result.actual}, expected <= ${result.limit}`,
        );
      }
      process.exitCode = 1;
    }
  }
}

function evaluateBudgets(summary, items) {
  const results = [
    atMost("severeCount", summary.severeCount, budgets.severeCountMax),
    atMost("warningCount", summary.warningCount, budgets.warningCountMax),
  ];
  for (const [filePath, limit] of Object.entries(budgets.severeFileLineMax)) {
    const item = items.find((entry) => entry.path === filePath);
    results.push(atMost(`${filePath}:lines`, item?.lines ?? 0, limit));
  }
  return results;
}

function atMost(name, actual, limit) {
  return {
    name,
    actual,
    limit,
    passed: actual <= limit,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await run();
}
