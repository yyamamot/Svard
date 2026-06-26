const screenshotScenarioIds = new Set([
  "hero-plantuml",
  "files",
  "documents-order",
  "file-compare-files",
  "file-compare-context-menu",
  "file-compare-preview",
  "reader-main",
  "search",
  "workspace-search",
  "workspace-search-result",
  "reading-markup-markdown",
  "reading-markup-asciidoc",
  "first-document-open-folder",
  "first-document-reader",
  "table-of-contents",
  "table-of-contents-jump",
  "includes-local-assets",
  "includes-local-assets-boundary",
  "themes-zoom-preferences",
  "themes-zoom-reader",
  "zen-mode-entry",
  "tabs-open-files",
  "tabs-open-files-tabs",
  "quick-open",
  "command-palette",
  "history-recently-closed",
  "split-view-entry",
  "split-view",
  "bookmarks",
  "source-control",
  "source-control-changes",
  "source-control-ref-context-menu",
  "source-control-open-diff",
  "source-control-branch-diff",
  "source-control-branch-diff-preview",
  "source-control-repo-graph",
  "source-control-file-history",
  "rendered-diff",
  "table-list-diff-review",
  "table-list-diff-table",
  "table-copy-context-menu",
  "link-hover-preview",
  "link-context-menu",
  "change-review-mode-markers",
  "change-review-settings",
  "diagram-inspector",
  "diagram-inline-preview-entry",
  "diagram-preview",
  "diagram-save-action",
  "diagram-loading-cache",
  "kroki-fallback",
  "external-plantuml-fallback",
  "network-settings",
  "pr-mr-providers",
  "keybindings",
  "mouse-gestures",
  "mouse-gestures-record",
  "navigation",
  "preferences",
  "zen-mode",
  "privacy-boundary",
]);

export function inferScreenshotScenario(path: string | null | undefined) {
  if (
    !path ||
    (!path.includes("/svard-site-viewer-fixtures/") &&
      !path.includes("/source-control-workspace/") &&
      !path.includes("/site-captures/"))
  ) {
    return null;
  }
  const fileName = path.split("/").pop() ?? "";
  const stem = fileName.replace(/\.[^.]+$/, "");
  return screenshotScenarioIds.has(stem) ? stem : null;
}
