import { runAgentChatScenarios } from "./agentChatScenarios";
import { runDiagramAndReviewScenarios } from "./diagramAndReviewScenarios";
import { runDocsFeatureScenarios } from "./docsFeatureScenarios";
import { runFilesAndNavigationScenarios } from "./filesAndNavigationScenarios";
import { runPreferencesScenarios } from "./preferencesScenarios";
import { runSearchAndReaderScenarios } from "./searchAndReaderScenarios";
import { runSourceControlScenarios } from "./sourceControlScenarios";
import type { SiteScreenshotScenarioContext } from "./types";

const scenariosWithoutInitialOpen = new Set([
  "files",
  "file-compare-files",
  "file-compare-context-menu",
  "workspace-search",
  "workspace-search-result",
  "first-document-open-folder",
  "first-document-reader",
  "tabs-open-files",
  "tabs-open-files-tabs",
  "quick-open",
  "link-hover-preview",
  "link-context-menu",
  "diagram-inspector",
  "diagram-inline-preview-entry",
  "diagram-preview",
  "diagram-save-action",
  "change-review-mode-markers",
  "viewer-site-ai-chat-main",
  "viewer-site-ai-chat-provider-settings",
  "viewer-site-ai-chat-context-access",
  "viewer-site-ai-chat-session-history",
  "viewer-site-ai-chat-display-review",
  "reading-math-details",
  "copy-reference-actions",
  "copy-image-reference",
  "source-control-all-diffs",
]);

export async function runSiteScreenshotScenario(
  context: SiteScreenshotScenarioContext,
) {
  const { closeAllTabs, fixturePath, openDocument, scenario, setConfig } =
    context;

  if (!scenariosWithoutInitialOpen.has(scenario)) {
    closeAllTabs();
    await openDocument(fixturePath);
  }

  setConfig((current) =>
    current
      ? {
          ...current,
          sidebarVisible: true,
          workspace: {
            ...current.workspace,
            sidebarTab: "files",
          },
        }
      : current,
  );

  if (await runAgentChatScenarios(context)) return;
  if (await runDocsFeatureScenarios(context)) return;
  if (await runSearchAndReaderScenarios(context)) return;
  if (await runFilesAndNavigationScenarios(context)) return;
  if (await runSourceControlScenarios(context)) return;
  if (await runDiagramAndReviewScenarios(context)) return;
  await runPreferencesScenarios(context);
}
