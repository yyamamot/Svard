import { runDiagramAndReviewScenarios } from "./diagramAndReviewScenarios";
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

  if (await runSearchAndReaderScenarios(context)) return;
  if (await runFilesAndNavigationScenarios(context)) return;
  if (await runSourceControlScenarios(context)) return;
  if (await runDiagramAndReviewScenarios(context)) return;
  await runPreferencesScenarios(context);
}
