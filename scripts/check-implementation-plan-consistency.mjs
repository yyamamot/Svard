import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const impIdPattern = /\bIMP-\d{3}(?:-[A-Za-z0-9]+)*\b/g;

/**
 * @typedef {object} ImplementationPlanConsistencyInput
 * @property {string} planMarkdown
 * @property {string=} historyMarkdown
 * @property {string[]=} historyMarkdowns
 */

/**
 * @param {ImplementationPlanConsistencyInput} input
 */
export function implementationPlanConsistency(input) {
  const { planMarkdown, historyMarkdown, historyMarkdowns } = input;
  const completedIds = extractCompletedImpIds(
    joinHistoryMarkdowns({ historyMarkdown, historyMarkdowns }),
  );
  const activeBacklogMarkdown = extractActiveBacklogMarkdown(planMarkdown);
  const conflicts = completedIds
    .filter((id) => hasImpId(activeBacklogMarkdown, id))
    .sort();
  return { completedIds, conflicts };
}

export function extractCompletedImpIds(historyMarkdown) {
  const ids = new Set();
  for (const line of historyMarkdown.split(/\r?\n/)) {
    const match = line.match(/^###\s+(IMP-\d{3}(?:-[A-Za-z0-9]+)*)\b/);
    if (match) {
      ids.add(match[1]);
    }
  }
  return [...ids].sort();
}

export function extractActiveBacklogMarkdown(planMarkdown) {
  const activeStart = headingIndex(planMarkdown, "Active");
  if (activeStart === -1) {
    return "";
  }
  const draftStart = headingIndex(planMarkdown, "Draft / Later", activeStart);
  return planMarkdown.slice(
    activeStart,
    draftStart === -1 ? planMarkdown.length : draftStart,
  );
}

/**
 * @param {ImplementationPlanConsistencyInput} input
 */
export function checkImplementationPlanConsistency(input) {
  const { planMarkdown, historyMarkdown, historyMarkdowns } = input;
  const result = implementationPlanConsistency({
    planMarkdown,
    historyMarkdown,
    historyMarkdowns,
  });
  if (result.conflicts.length > 0) {
    return {
      passed: false,
      messages: result.conflicts.map(
        (id) => `completed IMP remains in active/backlog: ${id}`,
      ),
    };
  }
  return {
    passed: true,
    messages: ["implementation plan consistency check passed"],
  };
}

function joinHistoryMarkdowns({ historyMarkdown, historyMarkdowns }) {
  if (Array.isArray(historyMarkdowns)) {
    return historyMarkdowns.join("\n\n");
  }
  return historyMarkdown ?? "";
}

function headingIndex(markdown, heading, fromIndex = 0) {
  const pattern = new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`, "m");
  const match = pattern.exec(markdown.slice(fromIndex));
  return match ? fromIndex + match.index : -1;
}

function hasImpId(markdown, id) {
  return [...markdown.matchAll(impIdPattern)].some((match) => match[0] === id);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function runCli() {
  const repoRoot = process.cwd();
  const planPath = path.join(repoRoot, "docs", "04-implementation-plan.md");
  const historyPaths = [
    path.join(repoRoot, "docs", "history", "04-implementation-history.md"),
    ...readMarkdownFiles(
      path.join(repoRoot, "docs", "history", "implementation"),
    ),
  ];
  const result = checkImplementationPlanConsistency({
    planMarkdown: fs.readFileSync(planPath, "utf8"),
    historyMarkdowns: historyPaths.map((historyPath) =>
      fs.readFileSync(historyPath, "utf8"),
    ),
  });
  for (const message of result.messages) {
    console[result.passed ? "log" : "error"](message);
  }
  if (!result.passed) {
    process.exitCode = 1;
  }
}

function readMarkdownFiles(directory) {
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs
    .readdirSync(directory)
    .filter((entry) => entry.endsWith(".md"))
    .sort()
    .map((entry) => path.join(directory, entry));
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  runCli();
}
