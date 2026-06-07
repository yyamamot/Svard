import fs from "node:fs";
import path from "node:path";

const budgets = [
  {
    path: "docs/05-traceability.md",
    maxBytes: 20_000,
    maxLines: 250,
  },
  {
    path: "docs/history/04-implementation-history.md",
    maxBytes: 20_000,
    maxLines: 250,
  },
  {
    glob: "docs/history/implementation/*.md",
    maxBytes: 60_000,
    maxLines: 1_200,
  },
  {
    glob: "docs/traceability/*.md",
    maxBytes: 40_000,
    maxLines: 800,
  },
];

function repoPath(relativePath) {
  return path.join(process.cwd(), relativePath);
}

function markdownFiles(pattern) {
  const directory = path.dirname(pattern);
  const suffix = path.basename(pattern).replace("*", "");
  const absoluteDirectory = repoPath(directory);
  if (!fs.existsSync(absoluteDirectory)) {
    return [];
  }
  return fs
    .readdirSync(absoluteDirectory)
    .filter((entry) => entry.endsWith(suffix))
    .sort()
    .map((entry) => path.join(directory, entry));
}

function budgetFiles(budget) {
  return budget.path ? [budget.path] : markdownFiles(budget.glob);
}

function measure(relativePath) {
  const content = fs.readFileSync(repoPath(relativePath), "utf8");
  return {
    bytes: Buffer.byteLength(content, "utf8"),
    lines: content.split(/\r?\n/).length,
  };
}

function checkBudget(budget) {
  return budgetFiles(budget).map((relativePath) => {
    const metrics = measure(relativePath);
    const passed =
      metrics.bytes <= budget.maxBytes && metrics.lines <= budget.maxLines;
    return {
      ...metrics,
      maxBytes: budget.maxBytes,
      maxLines: budget.maxLines,
      passed,
      path: relativePath,
    };
  });
}

const results = budgets.flatMap(checkBudget);
const failed = results.filter((result) => !result.passed);

for (const result of results) {
  const status = result.passed ? "ok" : "over";
  console.log(
    `${status} ${result.bytes}/${result.maxBytes} bytes ${result.lines}/${result.maxLines} lines ${result.path}`,
  );
}

if (failed.length > 0) {
  process.exitCode = 1;
}
