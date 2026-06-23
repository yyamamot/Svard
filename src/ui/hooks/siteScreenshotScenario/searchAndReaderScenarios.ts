import { fixtureDirectory, setInputValue } from "./helpers";
import type { SiteScreenshotScenarioContext } from "./types";

export async function runSearchAndReaderScenarios(
  context: SiteScreenshotScenarioContext,
) {
  const {
    closeAllTabs,
    dismissInlineNotice,
    fixturePath,
    openDirectory,
    openDocument,
    scenario,
    setConfig,
    setRightSidebarTab,
    setRootDirectory,
    setSearchScope,
    setWindowTheme,
    setZenModeActive,
    updateSearchQuery,
  } = context;

  if (scenario === "search") {
    setRightSidebarTab("search");
    setSearchScope("document");
    updateSearchQuery("local");
    window.setTimeout(() => updateSearchQuery("local"), 250);
    window.setTimeout(() => updateSearchQuery("local"), 750);
    return true;
  }

  if (
    scenario === "workspace-search" ||
    scenario === "workspace-search-result"
  ) {
    const directory = fixtureDirectory(fixturePath);
    const applyWorkspaceSearchQuery = () => {
      document
        .querySelector<HTMLButtonElement>(
          '[data-review-id="search-scope-workspace"]',
        )
        ?.click();
      const input = document.querySelector<HTMLInputElement>(
        '[data-review-id="search-input"]',
      );
      if (input) setInputValue(input, "review");
    };
    const applyWorkspaceSearchState = () => {
      dismissInlineNotice();
      setRootDirectory(directory);
      setRightSidebarTab("search");
      setSearchScope("workspace");
      window.setTimeout(applyWorkspaceSearchQuery, 100);
      window.setTimeout(applyWorkspaceSearchQuery, 300);
      window.setTimeout(applyWorkspaceSearchQuery, 900);
      window.setTimeout(applyWorkspaceSearchQuery, 1500);
      setConfig((current) =>
        current
          ? {
              ...current,
              sidebarVisible: true,
              rightSidebarVisible: true,
              layout: {
                ...current.layout,
                leftSidebarWidth: 340,
                rightSidebarWidth: 360,
                openFilesCollapsed: true,
              },
              workspace: {
                ...current.workspace,
                sidebarTab: "files",
              },
              experimental: {
                ...current.experimental,
                searchHitRuler: false,
              },
            }
          : current,
      );
    };
    const openWorkspaceSearchResultDocument = () => {
      void openDocument(`${directory}/release-plan.md`);
    };
    const focusWorkspaceSearchResult = () => {
      document
        .querySelector<HTMLButtonElement>(
          '[data-review-id="workspace-search-result-item"][data-search-index="1"]',
        )
        ?.focus();
    };

    closeAllTabs();
    await openDirectory(directory);
    await openDocument(fixturePath);
    applyWorkspaceSearchState();
    window.setTimeout(applyWorkspaceSearchState, 300);
    window.setTimeout(applyWorkspaceSearchState, 900);
    window.setTimeout(applyWorkspaceSearchState, 1500);
    window.setTimeout(applyWorkspaceSearchState, 2500);
    if (scenario === "workspace-search-result") {
      window.setTimeout(openWorkspaceSearchResultDocument, 3600);
      window.setTimeout(focusWorkspaceSearchResult, 3900);
      window.setTimeout(focusWorkspaceSearchResult, 4800);
    } else {
      window.setTimeout(focusWorkspaceSearchResult, 3600);
      window.setTimeout(focusWorkspaceSearchResult, 4800);
    }
    return true;
  }

  if (
    scenario === "table-of-contents" ||
    scenario === "table-of-contents-jump"
  ) {
    const applyContentsState = () => {
      dismissInlineNotice();
      setRightSidebarTab("contents");
      setConfig((current) =>
        current
          ? {
              ...current,
              sidebarVisible: false,
              rightSidebarVisible: true,
              layout: {
                ...current.layout,
                rightSidebarWidth: 360,
              },
              experimental: {
                ...current.experimental,
                searchHitRuler: false,
              },
            }
          : current,
      );
    };
    const jumpToDisplaySection = () => {
      if (scenario !== "table-of-contents-jump") return;
      const links = Array.from(
        document.querySelectorAll<HTMLAnchorElement>(
          '[data-review-id="toc"] a',
        ),
      );
      const target = links.find((link) =>
        link.textContent?.includes("Display section"),
      );
      target?.click();
      target?.focus();
    };

    applyContentsState();
    window.setTimeout(applyContentsState, 300);
    window.setTimeout(applyContentsState, 900);
    window.setTimeout(jumpToDisplaySection, 1200);
    window.setTimeout(jumpToDisplaySection, 2000);
    return true;
  }

  if (
    scenario === "includes-local-assets" ||
    scenario === "includes-local-assets-boundary"
  ) {
    const applyIncludesState = () => {
      dismissInlineNotice();
      setRightSidebarTab("contents");
      setConfig((current) =>
        current
          ? {
              ...current,
              sidebarVisible: false,
              rightSidebarVisible:
                scenario === "includes-local-assets-boundary",
              layout: {
                ...current.layout,
                rightSidebarWidth: 380,
              },
            }
          : current,
      );
    };
    const revealIncludes = () => {
      if (scenario !== "includes-local-assets-boundary") return;
      const toggle = document.querySelector<HTMLButtonElement>(
        '[data-review-id="include-inspector-toggle"]',
      );
      if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
      document
        .querySelectorAll<HTMLElement>(".include-inspector-meta")
        .forEach((item) => {
          item.textContent = "sample workspace";
        });
    };

    applyIncludesState();
    window.setTimeout(applyIncludesState, 300);
    window.setTimeout(applyIncludesState, 900);
    window.setTimeout(revealIncludes, 1200);
    window.setTimeout(revealIncludes, 1800);
    window.setTimeout(revealIncludes, 2600);
    return true;
  }

  if (scenario === "themes-zoom-reader") {
    const applyReaderDisplayState = () => {
      dismissInlineNotice();
      void setWindowTheme("dark");
      setConfig((current) =>
        current
          ? {
              ...current,
              theme: "dark",
              zoom: 120,
              sidebarVisible: false,
              rightSidebarVisible: false,
              reader: {
                ...current.reader,
                asciidocTheme: "asciidoctor",
              },
            }
          : current,
      );
    };

    applyReaderDisplayState();
    window.setTimeout(applyReaderDisplayState, 300);
    window.setTimeout(applyReaderDisplayState, 900);
    return true;
  }

  if (scenario === "zen-mode-entry") {
    const applyZenModeEntryState = () => {
      dismissInlineNotice();
      setConfig((current) =>
        current
          ? {
              ...current,
              sidebarVisible: false,
              rightSidebarVisible: true,
            }
          : current,
      );
      document
        .querySelector<HTMLButtonElement>('[data-review-id="zen-mode-toggle"]')
        ?.focus();
    };

    applyZenModeEntryState();
    window.setTimeout(applyZenModeEntryState, 300);
    window.setTimeout(applyZenModeEntryState, 900);
    return true;
  }

  if (scenario === "zen-mode") {
    const applyZenModeState = () => {
      dismissInlineNotice();
      setZenModeActive(true);
      setConfig((current) =>
        current
          ? {
              ...current,
              sidebarVisible: true,
              rightSidebarVisible: true,
              zenMode: {
                ...current.zenMode,
                centerLayout: true,
                hideTopbar: true,
                hideTabs: true,
                hideLeftSidebar: true,
                hideRightSidebar: true,
                hideStatusBar: true,
                fullScreen: false,
              },
            }
          : current,
      );
    };

    applyZenModeState();
    window.setTimeout(applyZenModeState, 300);
    window.setTimeout(applyZenModeState, 900);
    window.setTimeout(applyZenModeState, 1500);
    window.setTimeout(applyZenModeState, 2500);
    window.setTimeout(applyZenModeState, 3500);
    return true;
  }

  return false;
}
