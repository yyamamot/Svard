import fs from "node:fs";
import path from "node:path";
import { legacyMarkerFallbackPolicy } from "./ui-review/core/markers.mjs";

const repoRoot = process.cwd();
const contractPath = path.join(
  repoRoot,
  "docs/contracts/ui-review-scenario-contract.json",
);
const scenarioDocsPath = path.join(
  repoRoot,
  "docs/contracts/appendix-ui-scenarios.md",
);

const contract = JSON.parse(fs.readFileSync(contractPath, "utf8"));
const scenarioDocs = fs.readFileSync(scenarioDocsPath, "utf8");
const markersSource = fs.readFileSync(
  path.join(repoRoot, "scripts/ui-review/core/markers.mjs"),
  "utf8",
);
const documentedScenarioIds = new Set(
  [...scenarioDocs.matchAll(/^- `([^`]+)`:/gm)].map((match) => match[1]),
);

const messages = [];
const scenarioIds = new Set();

if (contract.schemaVersion !== 1) {
  messages.push("ui-review scenario contract schemaVersion must be 1");
}

for (const scenario of contract.scenarios ?? []) {
  if (!scenario.id || typeof scenario.id !== "string") {
    messages.push("scenario contract entry is missing string id");
    continue;
  }
  if (scenarioIds.has(scenario.id)) {
    messages.push(`duplicate scenario contract id: ${scenario.id}`);
  }
  scenarioIds.add(scenario.id);

  for (const key of ["group", "handler"]) {
    if (!scenario[key] || typeof scenario[key] !== "string") {
      messages.push(`${scenario.id} is missing string ${key}`);
    }
  }
  for (const key of ["requiredMarkers", "optionalCoreMarkers"]) {
    if (!Array.isArray(scenario[key])) {
      messages.push(`${scenario.id} is missing ${key} array`);
    }
  }
  if (scenario.documented === true && !documentedScenarioIds.has(scenario.id)) {
    messages.push(
      `${scenario.id} is marked documented but is missing from docs`,
    );
  }
  if (scenario.documented === false && documentedScenarioIds.has(scenario.id)) {
    messages.push(`${scenario.id} is marked undocumented but appears in docs`);
  }
}

for (const scenarioId of documentedScenarioIds) {
  if (!shouldBeInScenarioContract(scenarioId)) {
    continue;
  }
  if (!scenarioIds.has(scenarioId)) {
    messages.push(
      `${scenarioId} is documented but missing from UI scenario contract`,
    );
  }
}

validateLegacyMarkerFallbackPolicy();

const serialized = JSON.stringify(contract);
for (const forbidden of ["/Users/", "diagramSource", "fileContent", "token:"]) {
  if (serialized.includes(forbidden)) {
    messages.push(
      `ui-review scenario contract contains forbidden data: ${forbidden}`,
    );
  }
}

if (messages.length > 0) {
  console.error("ui scenario contract check failed");
  for (const message of messages) {
    console.error(`- ${message}`);
  }
  process.exitCode = 1;
} else {
  console.log("ui scenario contract check passed");
}

function shouldBeInScenarioContract(scenarioId) {
  return (
    scenarioId.startsWith("viewer-git-diff-") ||
    scenarioId.startsWith("viewer-git-status-") ||
    scenarioId.startsWith("viewer-git-timeline-") ||
    scenarioId.startsWith("viewer-git-compare-") ||
    scenarioId.startsWith("viewer-source-control-") ||
    scenarioId === "viewer-rendered-diff-quality" ||
    scenarioId === "viewer-rendered-diff-placeholder-grouping" ||
    scenarioId === "viewer-diff-preview-regression-suite"
  );
}

function validateLegacyMarkerFallbackPolicy() {
  const rawFallbackBranches =
    markersSource.match(/!scenarioContract\s*&&/g) ?? [];
  if (rawFallbackBranches.length > 0) {
    messages.push(
      "markers.mjs must use legacyMarkerFallbackPolicy instead of raw !scenarioContract fallback branches",
    );
  }
  for (const [key, values] of Object.entries(legacyMarkerFallbackPolicy)) {
    if (!Array.isArray(values)) {
      messages.push(`legacy marker fallback policy ${key} must be an array`);
      continue;
    }
    const seen = new Set();
    for (const value of values) {
      if (typeof value !== "string" || value.length === 0) {
        messages.push(`legacy marker fallback policy ${key} has invalid value`);
        continue;
      }
      if (seen.has(value)) {
        messages.push(
          `legacy marker fallback policy ${key} has duplicate value: ${value}`,
        );
      }
      seen.add(value);
    }
  }
}
