import { isPreferencesPageScenario } from "../../scenarios/metadata.mjs";

export async function buildCoreAssertions(context) {
  const scenario = context.scenario;
  const page = context.page;
  const bodyText = context.bodyText;
  const documentUsesViewerWidth = context.documentUsesViewerWidth;
  const openFilesSplitResizeOutcome = context.openFilesSplitResizeOutcome;
  const scrollIndependence = context.scrollIndependence;
  const sidebarResize = context.sidebarResize;
  const sidebarResizeOutcome = context.sidebarResizeOutcome;
  const themeContrastOutcome = context.themeContrastOutcome;
  return {
    hasShell:
      scenario === "viewer-many-tabs-horizontal"
        ? (await page.locator('[data-review-id="tab-bar"]').count()) === 1
        : isPreferencesPageScenario(scenario)
          ? (await page
              .locator('[data-review-id="preferences-page"]')
              .count()) === 1
          : (await page
              .locator('[data-review-id="document-viewer"]')
              .count()) === 1,
    hasDocument:
      scenario === "viewer-files-tree-auto-refresh" ||
      (isPreferencesPageScenario(scenario) &&
        bodyText.includes("Preferences") &&
        bodyText.includes("General")) ||
      bodyText.includes("Svard MVP Guide") ||
      bodyText.includes("Preferences Defaults") ||
      bodyText.includes("Copy Actions") ||
      bodyText.includes("Large PlantUML Diagnostic") ||
      bodyText.includes("Graphviz Diagnostic") ||
      bodyText.includes("Japanese PlantUML") ||
      bodyText.includes("Long Japanese PlantUML") ||
      bodyText.includes("Multiline PlantUML") ||
      bodyText.includes("Mixed Diagram Japanese Sample") ||
      bodyText.includes("Mermaid Japanese Flow Sample") ||
      bodyText.includes("PlantUML Japanese Combined Sample") ||
      bodyText.includes("Kroki C4 Scale Sample") ||
      bodyText.includes("Render Fixtures") ||
      bodyText.includes("Include Main") ||
      bodyText.includes("Text Include Files") ||
      bodyText.includes("Conditional Include Compatibility Sample") ||
      bodyText.includes("Include Diagnostics") ||
      bodyText.includes("AsciiDoc Comprehensive Visual Sample") ||
      bodyText.includes("Math Rendering Sample") ||
      bodyText.includes("Quick Start") ||
      bodyText.includes("Markdown Sample") ||
      bodyText.includes("Markdown Code Sample") ||
      bodyText.includes("Markdown GitHub Sample") ||
      bodyText.includes("Markdown Footnotes And Admonitions Sample") ||
      bodyText.includes("Markdown Details Sample") ||
      bodyText.includes("Markdown Math Edge Cases") ||
      bodyText.includes("External Images Security Fixture") ||
      bodyText.includes("Git Diff Modified Fixture") ||
      bodyText.includes("Git Diff Clean Fixture") ||
      bodyText.includes("Git Diff Untracked Fixture") ||
      bodyText.includes("Git Table Diff Fixture") ||
      bodyText.includes("Git Markdown Table Cell Fixture") ||
      bodyText.includes("Git Markdown Table Untracked Fixture") ||
      bodyText.includes("Git AsciiDoc Table Diff Fixture") ||
      bodyText.includes("Git AsciiDoc Complex Table Diff Fixture") ||
      bodyText.includes("Git Rendered Markdown Diff Fixture") ||
      bodyText.includes("Git Rendered List Reorder Fixture") ||
      bodyText.includes("Git Rendered List Deletion Fixture") ||
      bodyText.includes("Large Markdown Scroll Return Fixture") ||
      bodyText.includes("Git Rendered AsciiDoc Diff Fixture") ||
      bodyText.includes("Git Rendered Diagram Diff Fixture") ||
      bodyText.includes("Git Rendered Math Diff Fixture") ||
      bodyText.includes("Git Rendered Unsupported Diagram Diff Fixture") ||
      bodyText.includes("Git Rendered Rich AsciiDoc Diff Fixture") ||
      bodyText.includes("Git Rendered Local Image Diff Fixture") ||
      bodyText.includes("Diagram Image Diff Fixture") ||
      bodyText.includes("Image Placeholder Source Diff Fixture") ||
      bodyText.includes("Backlog Resync Diff Fixture") ||
      bodyText.includes("Diff Preview Regression Gallery") ||
      bodyText.includes("File Diff Markdown Fixture") ||
      bodyText.includes("File Diff AsciiDoc Fixture") ||
      bodyText.includes("File Diff Table Fixture") ||
      bodyText.includes("Markdown Diagram Sample") ||
      bodyText.includes("Markdown 日本語確認") ||
      bodyText.includes("Obsidian Index") ||
      bodyText.includes("Wikilink Disabled") ||
      bodyText.includes("PlantUML Concurrency Stress") ||
      bodyText.includes("PlantUML Marker Compatibility") ||
      bodyText.includes("AsciiDoc Diagram Attributes") ||
      bodyText.includes("AsciiDoc Standard Theme Sample") ||
      bodyText.includes("Cross-platform Local Assets") ||
      bodyText.includes("Project Context Assets") ||
      bodyText.includes("Antora Module Local Assets") ||
      ((scenario === "viewer-start-page" ||
        scenario === "viewer-close-last-tab" ||
        scenario === "viewer-close-all-tabs" ||
        scenario === "viewer-move-tab-to-new-window") &&
        bodyText.includes("Open File")),
    hasThemeContrast:
      scenario === "viewer-theme-contrast-light" ||
      scenario === "viewer-theme-contrast-dark"
        ? themeContrastOutcome?.hasExpectedThemeClass &&
          themeContrastOutcome?.hasReadableDocumentSurfaces &&
          themeContrastOutcome?.hasTableCoverage &&
          themeContrastOutcome?.hasCodeCoverage &&
          themeContrastOutcome?.hasDiagramCoverage &&
          themeContrastOutcome?.hasSidebarSelectionCoverage
        : true,
    hasFullWidthReader:
      scenario === "viewer-basic" ||
      scenario === "viewer-markdown-basic" ||
      scenario === "viewer-diagram-samples" ||
      scenario === "viewer-diagram-samples-after-open"
        ? documentUsesViewerWidth &&
          (await page.locator('[data-review-id="document-body"]').count()) === 1
        : true,
    hasIndependentScroll:
      scenario === "viewer-basic" ||
      scenario === "viewer-files-tree" ||
      scenario === "viewer-search"
        ? scrollIndependence.center &&
          scrollIndependence.sidebarsStable &&
          scrollIndependence.left &&
          scrollIndependence.right
        : true,
    hasResizableSidebars:
      scenario === "viewer-basic" || scenario === "viewer-resizable-sidebars"
        ? sidebarResize.hasLeftHandle &&
          sidebarResize.hasRightHandle &&
          sidebarResize.leftWidth >= 220 &&
          sidebarResize.rightWidth >= 240 &&
          sidebarResize.viewerWidth > 480
        : true,
    hasOpenFilesSplitResize:
      scenario === "viewer-resizable-left-sidebar-split" &&
      openFilesSplitResizeOutcome
        ? openFilesSplitResizeOutcome.hitTarget.reviewId ===
            "open-files-split-resizer" &&
          openFilesSplitResizeOutcome.afterResize.openFiles >
            openFilesSplitResizeOutcome.beforeResize.openFiles + 32 &&
          openFilesSplitResizeOutcome.afterResize.lowerPane >= 180 &&
          Math.abs(openFilesSplitResizeOutcome.afterReset.openFiles - 144) <= 2
        : true,
    hasSidebarResizeDrag:
      scenario === "viewer-resizable-sidebars" && sidebarResizeOutcome
        ? sidebarResizeOutcome.afterLeftResize.left >
            sidebarResizeOutcome.beforeResize.left + 32 &&
          sidebarResizeOutcome.afterRightResize.right <
            sidebarResizeOutcome.afterLeftResize.right - 32 &&
          Math.abs(sidebarResizeOutcome.afterLeftReset.left - 260) <= 2
        : true,
    hasKrokiDiagnostic: true,
    hasDirectoryOpen:
      scenario === "viewer-many-tabs-horizontal" ||
      scenario === "viewer-command-automation" ||
      scenario === "viewer-context-menu-navigation" ||
      scenario === "viewer-open-in-new-window-context-menu" ||
      scenario === "viewer-move-tab-to-new-window" ||
      scenario === "viewer-zen-mode-prototype" ||
      scenario === "viewer-zen-mode-diff-preview" ||
      scenario === "viewer-topbar-direct-layout-controls" ||
      scenario.startsWith("viewer-git-timeline-") ||
      scenario.startsWith("viewer-git-compare-") ||
      scenario.startsWith("viewer-source-control-")
        ? true
        : scenario === "viewer-bookmarks" ||
            scenario === "viewer-drag-reorder-bookmarks"
          ? (await page
              .locator('[data-review-id="file-tree-open-menu-trigger"]')
              .count()) === 0
          : (await page
              .locator('[data-review-id="file-tree-open-menu-trigger"]')
              .count()) > 0,
  };
}
