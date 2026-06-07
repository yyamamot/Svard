export async function buildRendererAssertions({
  scenario,
  page,
  bodyText,
  diagramFit,
  svgAspectRatios,
}) {
  return {
    hasKrokiLocalResult:
      scenario === "viewer-kroki-local"
        ? bodyText.includes("Mock Kroki SVG") || bodyText.includes("cache miss")
        : true,
    hasKrokiConfirmation:
      scenario === "viewer-kroki-confirmation"
        ? (await page
            .locator('[data-review-id="diagram-inline-diagnostic"]')
            .count()) > 0 &&
          bodyText.includes("Remote diagram render confirmed")
        : true,
    hasKrokiC4Scale:
      scenario === "viewer-kroki-c4-scale"
        ? bodyText.includes("Kroki C4 Scale Sample") &&
          (await page
            .locator('[data-review-id="kroki-render"] svg')
            .count()) === 1 &&
          svgAspectRatios.some(
            (sample) =>
              sample.parentReviewId === "diagram-inline-image" &&
              sample.preserveAspectRatio !== "none" &&
              sample.delta !== null &&
              sample.delta < 0.08 &&
              sample.rect.width <= 300,
          )
        : true,
    hasPlantUmlLocal:
      scenario === "viewer-plantuml-local"
        ? (await page
            .locator('[data-review-id="plantuml-render"] svg')
            .count()) > 0 &&
          (await page.locator('[data-review-id="plantuml-copy"]').count()) === 0
        : true,
    hasPlantUmlMarkerCompat:
      scenario === "viewer-plantuml-marker-compat"
        ? bodyText.includes("PlantUML Marker Compatibility") &&
          bodyText.includes("Markdown Markerless Fence") &&
          (await page
            .locator('[data-review-id="plantuml-render"] svg')
            .count()) > 0 &&
          !bodyText.includes("@startuml") &&
          !bodyText.includes("@enduml") &&
          !bodyText.includes("User -> Renderer")
        : true,
    hasPlantUmlConcurrency:
      scenario === "viewer-plantuml-concurrency"
        ? bodyText.includes("PlantUML Concurrency Stress") &&
          (await page
            .locator('[data-review-id="plantuml-render"] svg')
            .count()) === 100 &&
          (await page
            .locator('[data-review-id="diagram-inline-diagnostic"]')
            .count()) === 0
        : true,
    hasPlantUmlLargeDiagnostic:
      scenario === "viewer-plantuml-large-diagnostic"
        ? bodyText.includes("Diagram too large") &&
          (await page
            .locator('[data-review-id="plantuml-configure-kroki"]')
            .count()) > 0
        : true,
    hasGraphvizLocal:
      scenario === "viewer-graphviz-local"
        ? (await page
            .locator('[data-review-id="graphviz-render"] svg')
            .count()) > 0 &&
          (await page.locator('[data-review-id="graphviz-copy"]').count()) === 0
        : true,
    hasGraphvizDiagnostic:
      scenario === "viewer-graphviz-diagnostic"
        ? bodyText.includes("Graphviz Diagnostic") &&
          (await page
            .locator('[data-review-id="graphviz-configure-kroki"]')
            .count()) > 0 &&
          (await page
            .locator('[data-review-id="diagram-inline-diagnostic"]')
            .count()) > 0
        : true,
    hasPlantUmlJapanese:
      scenario === "viewer-plantuml-japanese"
        ? (await page
            .locator('[data-review-id="plantuml-render"] svg')
            .count()) > 0 && bodyText.includes("Japanese PlantUML")
        : true,
    hasPlantUmlJapaneseCombined:
      scenario === "viewer-plantuml-japanese-combined"
        ? bodyText.includes("PlantUML Japanese Combined Sample") &&
          (await page
            .locator('[data-review-id="plantuml-render"] svg')
            .count()) >= 3 &&
          (await page
            .locator(
              '[data-review-id="plantuml-render"] .diagram-scale-fit-width',
            )
            .count()) === 0
        : true,
    hasPlantUmlJapaneseLongText:
      scenario === "viewer-plantuml-japanese-long-text"
        ? (await page
            .locator('[data-review-id="plantuml-render"] svg')
            .count()) > 0 && bodyText.includes("Long Japanese PlantUML")
        : true,
    hasPlantUmlMultiline:
      scenario === "viewer-plantuml-multiline"
        ? (await page
            .locator('[data-review-id="plantuml-render"] svg')
            .count()) > 0 && bodyText.includes("Multiline PlantUML")
        : true,
    hasAsciiDocDiagramAttributes:
      scenario === "viewer-asciidoc-diagram-attributes"
        ? bodyText.includes("AsciiDoc Diagram Attributes") &&
          bodyText.includes("source block stays source") &&
          (await page
            .locator('[data-review-id="mermaid-render"] svg')
            .count()) > 0 &&
          (await page
            .locator('[data-review-id="plantuml-render"] svg')
            .count()) > 0 &&
          (await page
            .locator('[data-review-id="graphviz-render"] svg')
            .count()) > 0 &&
          (await page
            .locator('[data-review-id="diagram-inline-diagnostic"]')
            .count()) > 0 &&
          !bodyText.includes("flowchart LR") &&
          !bodyText.includes("digraph G")
        : true,
    hasDiagramSamples:
      scenario === "viewer-diagram-samples"
        ? bodyText.includes("Mixed Diagram Japanese Sample") &&
          bodyText.includes("Mermaid + PlantUML + Graphviz") &&
          (await page
            .locator('[data-review-id="mermaid-render"] svg')
            .count()) > 0 &&
          (await page
            .locator('[data-review-id="plantuml-render"] svg')
            .count()) > 0 &&
          (await page
            .locator('[data-review-id="graphviz-render"] svg')
            .count()) > 0 &&
          (await page
            .locator(
              '[data-review-id="mermaid-copy"], [data-review-id="plantuml-copy"], [data-review-id="graphviz-copy"], [data-review-id="diagram-copy"]',
            )
            .count()) === 0 &&
          !bodyText.includes("Try Kroki") &&
          !bodyText.includes("local rendered") &&
          !bodyText.includes("stateDiagram-v2") &&
          !bodyText.includes("@startuml") &&
          !bodyText.includes("digraph G")
        : true,
    hasDiagramSamplesScrollStability:
      scenario === "viewer-diagram-samples-scroll-stability"
        ? await page.evaluate(() => {
            const result = window.__SVARD_DIAGRAM_SCROLL_STABILITY__;
            return (
              result?.documentBasename === "diagrams-mixed-long-ja.adoc" &&
              result.passed === true &&
              result.scrollCounts?.renderEffectStart === 0 &&
              result.scrollCounts?.applyInlineDiagramsToHtml === 0 &&
              result.scrollCounts?.articleInnerHtmlCommit === 0 &&
              result.scrollCounts?.unstableViewerRender === 0
            );
          })
        : true,
    hasDiagramPlaceholderStartup:
      scenario === "viewer-diagram-placeholder-startup"
        ? await page.evaluate(() => {
            const result = window.__SVARD_DIAGRAM_PLACEHOLDER_STARTUP__;
            return (
              result?.placeholderSeen === true &&
              result.hydratedDiagramCount >= 3 &&
              result.scrollTopStable === true &&
              result.scrollHeightDelta < 900
            );
          })
        : true,
    hasMermaidJapaneseFlow:
      scenario === "viewer-mermaid-japanese-flow"
        ? bodyText.includes("Mermaid Japanese Flow Sample") &&
          (await page
            .locator('[data-review-id="mermaid-render"] svg text')
            .filter({ hasText: "文書を開く" })
            .count()) >= 1 &&
          (await page
            .locator('[data-review-id="mermaid-render"] svg text')
            .filter({ hasText: "ローカルで完結" })
            .count()) >= 1
        : true,
    hasReadableDiagramScale:
      scenario === "viewer-diagram-samples" ||
      scenario === "viewer-theme-contrast-light" ||
      scenario === "viewer-theme-contrast-dark"
        ? diagramFit !== null &&
          diagramFit.canvasRatio >= 0.88 &&
          Math.max(diagramFit.svgWidth, diagramFit.svgHeight) >= 180 &&
          diagramFit.svgHeight <= diagramFit.viewerHeight * 0.82
        : true,
  };
}
