import fs from "node:fs/promises";
import path from "node:path";
import { UI_REVIEW_SCHEMA_VERSION } from "./core/constants.mjs";
import { captureScenario, createArtifactRoot } from "./core/capture.mjs";

export const SYSTEM_UI_CONSISTENCY_SCHEMA_VERSION = 1;

export const DEFAULT_SYSTEM_UI_SCENARIOS = [
  "viewer-basic",
  "viewer-bookmarks",
  "viewer-source-control-changes",
  "viewer-preferences-tab",
  "viewer-preferences-zen-mode",
  "viewer-search",
  "viewer-diff-overview",
];

const findingCategories = new Set([
  "navigation_hierarchy",
  "density",
  "control_style",
  "terminology",
  "color_weight",
  "layout_scope",
  "discoverability",
]);

const findingSeverities = new Set(["advisory", "minor", "major", "blocker"]);

function uniqueScenarioIds(value) {
  const scenarios = value
    .split(",")
    .map((scenario) => scenario.trim())
    .filter(Boolean);
  return [...new Set(scenarios)];
}

export function parseSystemReviewArgs(argv) {
  const args = {
    id: "system-ui-consistency",
    reuseLatest: false,
    scenarioIds: DEFAULT_SYSTEM_UI_SCENARIOS,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--scenario") {
      const next = argv[index + 1];
      args.scenarioIds = next
        ? uniqueScenarioIds(next)
        : DEFAULT_SYSTEM_UI_SCENARIOS;
      index += 1;
    } else if (value === "--id") {
      args.id = argv[index + 1] ?? args.id;
      index += 1;
    } else if (value === "--reuse-latest") {
      args.reuseLatest = true;
    }
  }

  if (args.scenarioIds.length === 0) {
    args.scenarioIds = DEFAULT_SYSTEM_UI_SCENARIOS;
  }

  return args;
}

export function normalizeSystemFinding(finding) {
  const category = findingCategories.has(finding?.category)
    ? finding.category
    : "layout_scope";
  const severity = findingSeverities.has(finding?.severity)
    ? finding.severity
    : "advisory";
  const description =
    typeof finding?.description === "string" && finding.description
      ? finding.description
      : "System UI consistency finding needs review.";
  const evidenceScreens = Array.isArray(finding?.evidenceScreens)
    ? finding.evidenceScreens.filter((screen) => typeof screen === "string")
    : [];
  const recommendation =
    typeof finding?.recommendation === "string" ? finding.recommendation : "";

  return {
    category,
    severity,
    description,
    evidenceScreens,
    recommendation,
  };
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function findLatestScenarioArtifact(
  scenarioId,
  uiReviewRoot = path.resolve(".artifacts", "ui-review"),
) {
  const entries = await fs.readdir(uiReviewRoot, { withFileTypes: true });
  const candidates = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("ui-review-")) {
      continue;
    }
    const artifactRoot = path.join(uiReviewRoot, entry.name);
    const reportPath = path.join(artifactRoot, "ui-review-report.json");
    if (!(await pathExists(reportPath))) {
      continue;
    }
    const report = await readJson(reportPath);
    if (report.scenarioId === scenarioId) {
      candidates.push(artifactRoot);
    }
  }

  candidates.sort();
  return candidates.at(-1) ?? null;
}

function summarizeGeometry(geometryDocument) {
  const elements = Array.isArray(geometryDocument)
    ? geometryDocument
    : (geometryDocument.elements ?? []);
  return {
    visibleControlCount: elements.filter((element) => element.visible).length,
    reviewIdCount: new Set(elements.map((element) => element.reviewId)).size,
  };
}

async function collectScreen({
  scenarioId,
  sourceArtifactRoot,
  systemRoot,
  findings,
}) {
  const reportPath = path.join(sourceArtifactRoot, "ui-review-report.json");
  const geometryPath = path.join(sourceArtifactRoot, "ui-geometry.json");
  const report = await readJson(reportPath);
  const geometry = await readJson(geometryPath);
  const sourceScreenshot =
    typeof report.screenshotPath === "string"
      ? report.screenshotPath
      : path.join(sourceArtifactRoot, "screenshots", `${scenarioId}.png`);
  const screenshotName = `${scenarioId}.png`;
  const screenshotPath = path.join(systemRoot, "screenshots", screenshotName);

  if (report.schemaVersion !== UI_REVIEW_SCHEMA_VERSION) {
    findings.push(
      normalizeSystemFinding({
        category: "layout_scope",
        severity: "blocker",
        description: `${scenarioId} ui-review-report schemaVersion is invalid.`,
        evidenceScreens: [scenarioId],
      }),
    );
  }
  if (geometry.schemaVersion !== UI_REVIEW_SCHEMA_VERSION) {
    findings.push(
      normalizeSystemFinding({
        category: "layout_scope",
        severity: "blocker",
        description: `${scenarioId} ui-geometry schemaVersion is invalid.`,
        evidenceScreens: [scenarioId],
      }),
    );
  }
  if (!(await pathExists(sourceScreenshot))) {
    findings.push(
      normalizeSystemFinding({
        category: "layout_scope",
        severity: "blocker",
        description: `${scenarioId} screenshot is missing.`,
        evidenceScreens: [scenarioId],
      }),
    );
  } else {
    await fs.copyFile(sourceScreenshot, screenshotPath);
  }

  return {
    scenarioId,
    sourceRunId: path.basename(sourceArtifactRoot),
    screenshot: `screenshots/${screenshotName}`,
    outcome: report.outcome ?? "unknown",
    assertionFailureCount: Array.isArray(report.assertionFailures)
      ? report.assertionFailures.length
      : 0,
    geometry: summarizeGeometry(geometry),
  };
}

function buildSystemPrompt(scenarioIds) {
  return `# System-wide UI Consistency Review

Review these screenshots as one product, not as isolated scenarios.

Scenarios:
${scenarioIds.map((scenario) => `- ${scenario}`).join("\n")}

Checklist:
- Navigation hierarchy: parent tabs, inner tabs, and mode navigation should have clear hierarchy.
- Density: FileTree/Open Files should read as dense lists; Bookmarks as grouped list; Source Control Changes/Branch Diff as compact action lists; Preferences as form surface; Diff Preview as workbench; normal documents as reader surfaces.
- Control style: topbar actions should be app/viewer-wide; pane toolbar actions should affect the pane; row actions should affect only the row; rare, advanced, or destructive actions should live in context menus.
- Terminology: labels such as Preferences, Source Control, Search, Layout, and Zen Mode should be consistent.
- Color weight: active, selected, status, warning, and Git state colors should not compete with primary content.
- Layout scope: Preferences and Diff Preview should read as mode surfaces, not accidental document content.
- Discoverability: important exits, primary actions, and destructive actions should be easy to find without clutter.

Output findings only when a cross-screen inconsistency is visible. Treat findings as advisory unless a screenshot or schema is missing.
`;
}

export async function runSystemConsistencyReview({
  id = "system-ui-consistency",
  scenarioIds = DEFAULT_SYSTEM_UI_SCENARIOS,
  reuseLatest = false,
  baseURL = "http://127.0.0.1:4173",
  artifactRoot,
  capture = captureScenario,
  findArtifact = findLatestScenarioArtifact,
} = {}) {
  const systemRoot =
    artifactRoot ?? (await createArtifactRoot("system-consistency"));
  await fs.mkdir(path.join(systemRoot, "screenshots"), { recursive: true });
  await fs.mkdir(path.join(systemRoot, "scenarios"), { recursive: true });

  const findings = [];
  const screens = [];

  for (const scenarioId of scenarioIds) {
    const sourceArtifactRoot = reuseLatest
      ? await findArtifact(scenarioId)
      : path.join(systemRoot, "scenarios", scenarioId);
    if (reuseLatest) {
      if (!sourceArtifactRoot) {
        findings.push(
          normalizeSystemFinding({
            category: "layout_scope",
            severity: "blocker",
            description: `${scenarioId} has no reusable UI review artifact.`,
            evidenceScreens: [scenarioId],
          }),
        );
        continue;
      }
    } else {
      await fs.mkdir(path.join(sourceArtifactRoot, "screenshots"), {
        recursive: true,
      });
      await capture({
        scenario: scenarioId,
        id,
        artifactRoot: sourceArtifactRoot,
        baseURL,
      });
    }

    screens.push(
      await collectScreen({
        scenarioId,
        sourceArtifactRoot,
        systemRoot,
        findings,
      }),
    );
  }

  const normalizedFindings = findings.map(normalizeSystemFinding);
  const outcome = normalizedFindings.some(
    (finding) => finding.severity === "blocker",
  )
    ? "blocked"
    : normalizedFindings.length > 0
      ? "advisory-findings"
      : "passed";
  const report = {
    schemaVersion: SYSTEM_UI_CONSISTENCY_SCHEMA_VERSION,
    runId: path.basename(systemRoot),
    featureId: id,
    scenarioIds,
    outcome,
    screens,
    findings: normalizedFindings,
  };

  await fs.writeFile(
    path.join(systemRoot, "system-ui-consistency-prompt.md"),
    buildSystemPrompt(scenarioIds),
  );
  await fs.writeFile(
    path.join(systemRoot, "system-ui-consistency.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );

  return { ...report, artifactRoot: systemRoot };
}
