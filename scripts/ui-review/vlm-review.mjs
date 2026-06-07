import fs from "node:fs/promises";
import path from "node:path";
import { UI_REVIEW_SCHEMA_VERSION } from "./core/constants.mjs";
import { optionalCoreMarkersForScenario } from "./scenarios/metadata.mjs";

const findingCategories = new Set([
  "missing-control",
  "density",
  "blank-or-broken-render",
  "schema",
]);

const findingSeverities = new Set(["minor", "major", "blocker"]);

function normalizeFinding(finding) {
  const severity = findingSeverities.has(finding.severity)
    ? finding.severity
    : "major";
  const category = findingCategories.has(finding.category)
    ? finding.category
    : "schema";
  const reviewId =
    typeof finding.reviewId === "string" && finding.reviewId
      ? finding.reviewId
      : "ui-review";
  const description =
    typeof finding.description === "string" && finding.description
      ? finding.description
      : `${reviewId} has an invalid review finding.`;
  return { severity, reviewId, category, description };
}

export async function runVlmReview(artifactRoot) {
  const report = JSON.parse(
    await fs.readFile(path.join(artifactRoot, "ui-review-report.json"), "utf8"),
  );
  const geometryDocument = JSON.parse(
    await fs.readFile(path.join(artifactRoot, "ui-geometry.json"), "utf8"),
  );
  const geometry = Array.isArray(geometryDocument)
    ? geometryDocument
    : (geometryDocument.elements ?? []);
  const findings = [];
  const optionalWhenEmptyDocument = new Set(["toc"]);
  const optionalCoreMarkers = new Set(
    optionalCoreMarkersForScenario(report.scenarioId),
  );
  const elementsByReviewId = Map.groupBy(
    geometry,
    (element) => element.reviewId,
  );

  for (const [reviewId, elements] of elementsByReviewId) {
    const visibleElements = elements.filter((element) => element.visible);
    const hasVisibleInlineDiagram =
      reviewId.endsWith("-render") &&
      (elementsByReviewId
        .get("diagram-inline-image")
        ?.some((element) => element.visible) ??
        false);
    const mayBeHidden =
      (report.scenarioId === "viewer-start-page" ||
        report.scenarioId === "viewer-close-last-tab" ||
        report.scenarioId === "viewer-close-all-tabs" ||
        report.scenarioId.startsWith("viewer-git-diff-") ||
        report.scenarioId.startsWith("viewer-diff-") ||
        report.scenarioId === "viewer-rendered-diff-quality" ||
        report.scenarioId.startsWith("viewer-rendered-visual-diff-")) &&
      optionalWhenEmptyDocument.has(reviewId);
    if (mayBeHidden) {
      continue;
    }
    if (visibleElements.length === 0 && !hasVisibleInlineDiagram) {
      findings.push({
        severity: "major",
        reviewId,
        category: "missing-control",
        description: `${reviewId} is not visible in the captured scenario.`,
      });
    }

    for (const element of visibleElements) {
      if (element.rect.width < 24 || element.rect.height < 16) {
        findings.push({
          severity: "minor",
          reviewId,
          category: "density",
          description: `${reviewId} is smaller than the minimum reviewable control size.`,
        });
      }
    }
  }

  if (
    !report.assertions.hasDocument &&
    !optionalCoreMarkers.has("document-viewer")
  ) {
    findings.push({
      severity: "blocker",
      reviewId: "document-viewer",
      category: "blank-or-broken-render",
      description: "Rendered document text was not found.",
    });
  }

  if (
    report.scenarioId === "viewer-diff-preview-regression-suite" &&
    !report.assertions.hasDiffPreviewRegressionSuite
  ) {
    findings.push({
      severity: "blocker",
      reviewId: "git-full-preview-diff",
      category: "blank-or-broken-render",
      description:
        "Diff preview regression suite failed: check word highlights, nested list structure, Preview labels, and removed/added block pairing.",
    });
  }

  if (report.schemaVersion !== UI_REVIEW_SCHEMA_VERSION) {
    findings.push({
      severity: "major",
      reviewId: "ui-review-report",
      category: "schema",
      description: `ui-review-report schemaVersion must be ${UI_REVIEW_SCHEMA_VERSION}.`,
    });
  }

  if (geometryDocument.schemaVersion !== UI_REVIEW_SCHEMA_VERSION) {
    findings.push({
      severity: "major",
      reviewId: "ui-geometry",
      category: "schema",
      description: `ui-geometry schemaVersion must be ${UI_REVIEW_SCHEMA_VERSION}.`,
    });
  }

  const normalizedFindings = findings.map(normalizeFinding);
  const outcome = normalizedFindings.some(
    (finding) => finding.severity === "blocker",
  )
    ? "blocked"
    : normalizedFindings.length > 0
      ? "needs-fix"
      : "passed";
  const result = {
    schemaVersion: UI_REVIEW_SCHEMA_VERSION,
    runId: report.runId,
    scenarioId: report.scenarioId,
    outcome,
    findings: normalizedFindings,
    artifactRoot,
  };

  await fs.writeFile(
    path.join(artifactRoot, "vlm-ui-review.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  return result;
}
