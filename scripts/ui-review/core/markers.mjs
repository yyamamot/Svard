import { UI_REVIEW_SCHEMA_VERSION } from "./constants.mjs";
import {
  optionalCoreMarkersForScenario,
  requiredMarkersForScenario,
  scenarioContractFor,
} from "../scenarios/metadata.mjs";

const coreReviewMarkers = [
  "shell",
  "left-sidebar",
  "right-sidebar",
  "document-viewer",
  "document-body",
  "file-tree",
  "tree-root",
  "tree-refresh",
  "tree-collapse-all",
  "open-files",
  "open-file-item",
  "right-sidebar-tabs",
  "right-sidebar-tab-contents",
  "right-sidebar-tab-search",
  "toc",
];

export const legacyMarkerFallbackPolicy = Object.freeze({
  exact: Object.freeze([
    "viewer-content-cursor-diff-change-only",
    "viewer-content-cursor-diff-preview",
    "viewer-file-tree-git-badge-open-diff",
    "viewer-git-status-rename-hints",
    "viewer-open-files-git-badge-open-diff",
    "viewer-rendered-diff-placeholder-grouping",
    "viewer-rendered-diff-quality",
    "viewer-source-control-branch-diff",
    "viewer-source-control-branch-diff-provider-base",
    "viewer-source-control-branch-diff-provider-fallback",
    "viewer-source-control-changes",
    "viewer-source-control-graph",
    "viewer-source-control-performance-cache",
    "viewer-source-control-watch-debounce",
  ]),
  prefixes: Object.freeze([
    "viewer-diff-",
    "viewer-git-compare-",
    "viewer-git-diff-",
    "viewer-git-timeline-",
    "viewer-rendered-visual-diff-",
  ]),
});

export function usesLegacyMarkerFallback(scenario, scenarioContract) {
  if (scenarioContract) {
    return false;
  }
  return (
    legacyMarkerFallbackPolicy.exact.includes(scenario) ||
    legacyMarkerFallbackPolicy.prefixes.some((prefix) =>
      scenario.startsWith(prefix),
    )
  );
}

export function markerCompletenessForScenario(scenario, geometry) {
  const reviewIds = new Set(geometry.map((element) => element.reviewId));
  const scenarioContract = scenarioContractFor(scenario);
  const legacyFallback = usesLegacyMarkerFallback(scenario, scenarioContract);
  const optional = new Set();
  if (
    scenario === "viewer-start-page" ||
    scenario === "viewer-close-last-tab" ||
    scenario === "viewer-close-all-tabs"
  ) {
    optional.add("document-body");
    optional.add("toc");
  }
  if (scenario === "viewer-open-files-collapse") {
    optional.add("open-file-item");
  }
  if (scenario === "viewer-lightweight-action-feedback") {
    optional.add("toc");
  }
  for (const reviewId of optionalCoreMarkersForScenario(scenario)) {
    optional.add(reviewId);
  }
  if (legacyFallback && scenario === "viewer-git-status-rename-hints") {
    optional.add("document-body");
    optional.add("toc");
  }
  if (legacyFallback && scenario.startsWith("viewer-git-timeline-")) {
    optional.add("file-tree");
    optional.add("tree-root");
    optional.add("tree-refresh");
    optional.add("tree-collapse-all");
  }
  const scenarioMarkers = [];
  if (
    scenario.includes("search") ||
    scenario === "viewer-copy-actions" ||
    scenario === "viewer-copy-location-reference" ||
    scenario === "viewer-code-block-actions" ||
    scenario === "viewer-asciidoc-code-highlight" ||
    scenario === "viewer-section-collapse-search-auto-expand"
  ) {
    scenarioMarkers.push("search-input");
  }
  if (scenario === "viewer-lightweight-action-feedback") {
    scenarioMarkers.push("search-input", "lightweight-action-feedback");
  }
  if (scenario === "viewer-shortcut-gesture-hints-command") {
    scenarioMarkers.push("viewer-shortcut-gesture-hints-panel");
  }
  if (scenario.startsWith("viewer-context-menu")) {
    scenarioMarkers.push("context-menu");
  }
  if (
    scenario === "viewer-content-cursor-basic" ||
    scenario === "viewer-content-cursor-diff-preview" ||
    scenario === "viewer-content-cursor-diff-change-only"
  ) {
    scenarioMarkers.push("content-cursor-active");
  }
  scenarioMarkers.push(...requiredMarkersForScenario(scenario));
  if (scenario === "viewer-kroki-c4-scale") {
    scenarioMarkers.push("kroki-render", "diagram-inline-image");
  }
  if (scenario === "viewer-plantuml-concurrency") {
    scenarioMarkers.push("plantuml-render", "diagram-inline-image");
  }
  if (scenario === "viewer-asciidoc-diagram-attributes") {
    scenarioMarkers.push(
      "mermaid-render",
      "plantuml-render",
      "graphviz-render",
      "diagram-inline-diagnostic",
      "diagram-inline-image",
    );
  }
  if (scenario === "viewer-diagram-preview-panel") {
    scenarioMarkers.push(
      "diagram-preview-panel",
      "diagram-preview-canvas",
      "diagram-preview-zoom-in",
      "diagram-preview-zoom-reset",
      "diagram-preview-expand",
      "diagram-preview-close",
    );
  }
  if (legacyFallback && scenario.startsWith("viewer-git-diff-")) {
    scenarioMarkers.push("git-diff-preview-panel", "git-diff-preview-close");
    if (scenario === "viewer-git-diff-clean") {
      scenarioMarkers.push("git-diff-empty-state");
    } else if (scenario.startsWith("viewer-git-diff-rendered-")) {
      scenarioMarkers.push(
        "git-diff-rendered-view",
        "git-rendered-diff",
        "git-rendered-left-pane",
        "git-rendered-right-pane",
        "git-rendered-block",
      );
      if (scenario === "viewer-git-diff-rendered-diagram-placeholder") {
        scenarioMarkers.push(
          "mermaid-render",
          "plantuml-render",
          "graphviz-render",
          "diagram-inline-image",
        );
      }
    } else if (
      scenario === "viewer-git-diff-large-markdown-table-row-addition"
    ) {
      scenarioMarkers.push(
        "git-diff-rendered-view",
        "git-rendered-diff",
        "git-rendered-left-pane",
        "git-rendered-right-pane",
      );
    } else if (
      scenario === "viewer-git-diff-markdown-table" ||
      scenario === "viewer-git-diff-asciidoc-table-dom"
    ) {
      scenarioMarkers.push(
        "git-diff-table-view",
        "git-diff-table-diff",
        "git-diff-table-left-pane",
        "git-diff-table-right-pane",
      );
    } else if (scenario === "viewer-git-diff-asciidoc-table-marker") {
      scenarioMarkers.push(
        "git-diff-left-pane",
        "git-diff-right-pane",
        "git-diff-asciidoc-table-badge",
      );
    } else {
      scenarioMarkers.push("git-diff-left-pane", "git-diff-right-pane");
    }
  }
  if (
    legacyFallback &&
    (scenario === "viewer-git-timeline-file-history" ||
      scenario === "viewer-git-timeline-file-history-cache")
  ) {
    scenarioMarkers.push(
      "source-control-panel",
      "timeline-panel",
      "timeline-list",
      "timeline-item",
    );
  }
  if (
    legacyFallback &&
    (scenario === "viewer-source-control-changes" ||
      scenario === "viewer-source-control-performance-cache" ||
      scenario === "viewer-source-control-watch-debounce")
  ) {
    scenarioMarkers.push(
      "source-control-panel",
      "source-control-changes-list",
      "source-control-change-item",
    );
  }
  if (
    legacyFallback &&
    (scenario === "viewer-source-control-branch-diff" ||
      scenario === "viewer-source-control-branch-diff-provider-base" ||
      scenario === "viewer-source-control-branch-diff-provider-fallback")
  ) {
    scenarioMarkers.push(
      "source-control-panel",
      "source-control-view-branch-diff",
      "source-control-branch-diff-base",
      "source-control-branch-diff-list",
      "source-control-branch-diff-item",
    );
  }
  if (legacyFallback && scenario === "viewer-source-control-graph") {
    scenarioMarkers.push(
      "source-control-panel",
      "source-control-view-repo-graph",
      "timeline-list",
      "timeline-item",
    );
  }
  if (legacyFallback && scenario === "viewer-git-status-rename-hints") {
    scenarioMarkers.push(
      "git-status-badge",
      "git-diff-preview-panel",
      "git-diff-preview-close",
    );
  }
  if (legacyFallback && scenario === "viewer-file-tree-git-badge-open-diff") {
    scenarioMarkers.push(
      "tree-file",
      "git-status-diff-button",
      "git-diff-preview-panel",
      "git-diff-preview-close",
    );
  }
  if (legacyFallback && scenario === "viewer-open-files-git-badge-open-diff") {
    scenarioMarkers.push(
      "open-file-item",
      "git-status-diff-button",
      "git-diff-preview-panel",
      "git-diff-preview-close",
    );
  }
  if (
    legacyFallback &&
    (scenario === "viewer-git-status-directory-hints" ||
      scenario === "viewer-git-status-directory-badge-polish" ||
      scenario === "viewer-git-status-directory-source-control-cache" ||
      scenario === "viewer-git-status-directory-idle-cache" ||
      scenario === "viewer-git-status-directory-cache-invalidation")
  ) {
    scenarioMarkers.push("tree-folder-toggle", "tree-file", "git-status-badge");
  }
  if (scenario === "viewer-files-tree-auto-refresh") {
    scenarioMarkers.push("tree-file", "git-status-badge");
  }
  if (scenario === "viewer-file-tree-new-file-watch-refresh") {
    scenarioMarkers.push("tree-file");
  }
  if (
    legacyFallback &&
    (scenario === "viewer-git-timeline-compare-commit" ||
      scenario === "viewer-git-timeline-vscode-left-click" ||
      scenario === "viewer-git-timeline-select-compare")
  ) {
    scenarioMarkers.push(
      "timeline-panel",
      "timeline-list",
      "timeline-item",
      "git-diff-preview-panel",
      "git-full-preview-left-pane",
      "git-full-preview-right-pane",
    );
  }
  if (legacyFallback && scenario === "viewer-git-timeline-context-menu") {
    scenarioMarkers.push("timeline-panel", "timeline-item", "context-menu");
  }
  if (legacyFallback && scenario === "viewer-git-timeline-view-commit") {
    scenarioMarkers.push(
      "timeline-panel",
      "timeline-item",
      "git-commit-details-panel",
      "git-commit-details-file",
    );
  }
  if (legacyFallback && scenario.startsWith("viewer-git-compare-")) {
    scenarioMarkers.push(
      "git-diff-preview-panel",
      "git-diff-preview-close",
      "git-full-preview-left-pane",
      "git-full-preview-right-pane",
    );
  }
  if (
    legacyFallback &&
    (scenario.startsWith("viewer-diff-") ||
      scenario === "viewer-rendered-diff-quality" ||
      scenario === "viewer-rendered-diff-placeholder-grouping" ||
      scenario.startsWith("viewer-rendered-visual-diff-") ||
      scenario === "viewer-content-cursor-diff-preview" ||
      scenario === "viewer-content-cursor-diff-change-only")
  ) {
    scenarioMarkers.push(
      "git-diff-preview-panel",
      "git-diff-preview-expand",
      "git-diff-preview-close",
      "git-diff-change-navigation",
      "git-diff-change-count",
      "git-diff-scroll-sync",
    );
    if (scenario === "viewer-diff-shortcut-gesture-hints") {
      scenarioMarkers.push(
        "diff-shortcut-gesture-hints-open",
        "diff-shortcut-gesture-hints-panel",
      );
    }
    if (
      scenario.startsWith("viewer-diff-full-preview-") ||
      scenario === "viewer-diff-code-syntax-highlight" ||
      scenario === "viewer-diff-context-menu-rendered" ||
      scenario === "viewer-diff-mouse-gestures-change-navigation" ||
      scenario === "viewer-diff-mouse-gestures-expanded-actions" ||
      scenario === "viewer-diff-mouse-gestures-scroll-sync" ||
      scenario === "viewer-diff-scroll-anchor-sync" ||
      scenario === "viewer-diff-preview-expand" ||
      scenario === "viewer-diff-local-image-preview" ||
      scenario === "viewer-diff-same-path-image-revision" ||
      scenario === "viewer-diff-diagram-unchanged-with-image-change" ||
      scenario === "viewer-diff-image-placeholder-source-change" ||
      scenario === "viewer-diff-external-images-security-policy" ||
      scenario === "viewer-diff-preview-regression-suite" ||
      scenario === "viewer-content-cursor-diff-preview" ||
      scenario === "viewer-content-cursor-diff-change-only"
    ) {
      scenarioMarkers.push(
        "git-diff-full-preview-view",
        "git-full-preview-diff",
        "git-full-preview-left-pane",
        "git-full-preview-right-pane",
        "git-full-preview-block",
        "git-diff-change-ruler",
      );
      if (scenario === "viewer-diff-context-menu-rendered") {
        scenarioMarkers.push("context-menu");
      }
    } else if (scenario === "viewer-diff-context-menu-table") {
      scenarioMarkers.push(
        "git-diff-table-view",
        "git-diff-table-diff",
        "git-diff-table-left-pane",
        "git-diff-table-right-pane",
        "context-menu",
      );
      if (scenario === "viewer-diff-full-preview-overview-jump") {
        scenarioMarkers.push(
          "git-diff-overview-view",
          "git-diff-overview-jump-preview",
        );
      }
    } else if (scenario === "viewer-diff-overview") {
      scenarioMarkers.push(
        "git-diff-overview-view",
        "git-diff-overview",
        "git-diff-overview-sections",
      );
    } else if (scenario === "viewer-diff-diagram-placeholder") {
      scenarioMarkers.push(
        "git-diff-rendered-view",
        "git-full-preview-diff",
        "diagram-inline-diagnostic",
      );
    } else if (scenario === "viewer-diff-diagram-rendered-preview") {
      scenarioMarkers.push(
        "git-diff-full-preview-view",
        "git-full-preview-diff",
        "mermaid-render",
        "plantuml-render",
        "graphviz-render",
        "diagram-inline-image",
        "diagram-preview-panel",
        "diagram-preview-canvas",
        "diagram-preview-close",
      );
    } else if (scenario === "viewer-diff-diagram-before-after-preview") {
      scenarioMarkers.push(
        "git-diff-full-preview-view",
        "git-full-preview-diff",
        "diagram-inline-image",
        "diagram-preview-panel",
        "diagram-preview-comparison",
        "diagram-preview-comparison-before",
        "diagram-preview-comparison-after",
      );
    } else if (scenario === "viewer-diff-math-rendering") {
      scenarioMarkers.push(
        "git-diff-full-preview-view",
        "git-diff-rendered-view",
        "git-rendered-diff",
        "math-block",
        "mermaid-render",
      );
    } else if (scenario === "viewer-diff-rich-asciidoc-preview") {
      scenarioMarkers.push(
        "git-diff-full-preview-view",
        "git-full-preview-diff",
      );
    } else {
      scenarioMarkers.push(
        "git-diff-change-ruler",
        "git-diff-rendered-view",
        "git-rendered-diff",
        "git-rendered-block",
      );
    }
    if (
      scenario === "viewer-rendered-diff-quality" ||
      scenario === "viewer-rendered-diff-placeholder-grouping" ||
      scenario === "viewer-rendered-visual-diff-inline-highlight" ||
      scenario === "viewer-diff-preview-regression-suite"
    ) {
      scenarioMarkers.push("git-diff-word-highlight");
    }
    if (scenario === "viewer-rendered-diff-placeholder-grouping") {
      scenarioMarkers.push("git-rendered-placeholder-group");
    }
    if (scenario.startsWith("viewer-rendered-visual-diff-")) {
      scenarioMarkers.push("git-rendered-left-pane", "git-rendered-right-pane");
    }
  }
  if (
    scenario.startsWith("viewer-file-diff-") ||
    scenario.startsWith("viewer-file-compare-picker-") ||
    scenario === "viewer-cli-file-diff-open" ||
    scenario === "viewer-cli-open-contract"
  ) {
    if (
      scenario === "viewer-file-compare-picker-swap-clear" ||
      scenario === "viewer-file-compare-picker-validation"
    ) {
      scenarioMarkers.push(
        "file-compare-picker",
        "file-compare-left-slot",
        "file-compare-right-slot",
      );
    }
    if (
      !scenario.endsWith("swap-clear") &&
      !scenario.endsWith("validation") &&
      scenario !== "viewer-cli-open-contract"
    ) {
      scenarioMarkers.push("git-diff-preview-panel", "git-diff-preview-close");
    }
    if (scenario === "viewer-cli-open-contract") {
      scenarioMarkers.push("inline-notice");
    }
    if (scenario === "viewer-file-diff-rendered") {
      scenarioMarkers.push(
        "git-diff-rendered-view",
        "git-rendered-diff",
        "git-rendered-left-pane",
        "git-rendered-right-pane",
        "git-rendered-block",
      );
    } else if (scenario === "viewer-file-diff-table") {
      scenarioMarkers.push(
        "git-diff-table-view",
        "git-diff-table-diff",
        "git-diff-table-left-pane",
        "git-diff-table-right-pane",
      );
    } else if (
      !scenario.endsWith("swap-clear") &&
      !scenario.endsWith("validation") &&
      scenario !== "viewer-cli-open-contract"
    ) {
      scenarioMarkers.push("git-diff-left-pane", "git-diff-right-pane");
    }
  }
  if (scenario === "viewer-open-files-collapse") {
    scenarioMarkers.push("open-files-collapsed-bar", "open-files-expand");
  }
  if (scenario === "viewer-table-copy") {
    scenarioMarkers.push(
      "context-menu",
      "context-menu-item-copy-table-tsv",
      "context-menu-item-copy-table-csv",
      "context-menu-item-copy-table-markdown",
      "context-menu-item-copy-table-reference",
    );
  }
  if (scenario === "viewer-link-hover-status") {
    scenarioMarkers.push("link-hover-status");
  }
  const required = [...coreReviewMarkers, ...scenarioMarkers].filter(
    (reviewId) => !optional.has(reviewId),
  );
  const missing = required.filter((reviewId) => !reviewIds.has(reviewId));
  return {
    schemaVersion: UI_REVIEW_SCHEMA_VERSION,
    required,
    missing,
    presentCount: required.length - missing.length,
    requiredCount: required.length,
  };
}
