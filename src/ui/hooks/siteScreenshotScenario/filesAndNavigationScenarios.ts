import { fixtureDirectory, setInputValue } from "./helpers";
import type { SiteScreenshotScenarioContext } from "./types";

export async function runFilesAndNavigationScenarios(
  context: SiteScreenshotScenarioContext,
) {
  const {
    closeAllTabs,
    compareDocumentPaths,
    dismissInlineNotice,
    fixturePath,
    loadDocumentForScreenshot,
    openDirectory,
    openDocument,
    scenario,
    setConfig,
    setDocumentPayload,
    setRootDirectory,
    setSidebarLayout,
    setTabs,
  } = context;

  if (scenario === "files") {
    const directory = fixtureDirectory(fixturePath);
    const applyFilesState = () => {
      dismissInlineNotice();
      setRootDirectory(directory);
      setSidebarLayout((current) => ({
        ...current,
        leftSidebarWidth: 360,
        openFilesCollapsed: true,
      }));
      setConfig((current) =>
        current
          ? {
              ...current,
              sidebarVisible: false,
              rightSidebarVisible: false,
              layout: {
                ...current.layout,
                leftSidebarWidth: 360,
                openFilesCollapsed: true,
              },
              workspace: {
                ...current.workspace,
                sidebarTab: "files",
              },
            }
          : current,
      );
    };

    await openDirectory(directory);
    await openDocument(fixturePath);
    applyFilesState();
    window.setTimeout(applyFilesState, 300);
    window.setTimeout(applyFilesState, 900);
    window.setTimeout(applyFilesState, 1500);
    window.setTimeout(applyFilesState, 2500);
    window.setTimeout(applyFilesState, 3500);
    return true;
  }

  if (scenario === "documents-order") {
    const directory = fixtureDirectory(fixturePath);
    const applyDocumentsOrderState = () => {
      dismissInlineNotice();
      setRootDirectory(directory);
      setSidebarLayout((current) => ({
        ...current,
        leftSidebarWidth: 420,
        openFilesCollapsed: true,
      }));
      setConfig((current) =>
        current
          ? {
              ...current,
              sidebarVisible: true,
              rightSidebarVisible: false,
              layout: {
                ...current.layout,
                leftSidebarWidth: 420,
                openFilesCollapsed: true,
              },
              workspace: {
                ...current.workspace,
                sidebarTab: "files",
              },
            }
          : current,
      );
    };
    const chooseMkDocsOrder = () => {
      applyDocumentsOrderState();
      const trigger = document.querySelector<HTMLButtonElement>(
        '[data-review-id="documents-view-toggle"]',
      );
      const mkdocsItem = document.querySelector<HTMLButtonElement>(
        '[data-review-id="documents-view-mode-mkdocs"]',
      );
      if (!mkdocsItem && trigger?.getAttribute("aria-expanded") !== "true") {
        trigger?.click();
        return;
      }
      if (mkdocsItem && !mkdocsItem.disabled) {
        mkdocsItem.click();
      }
    };
    const expandReviewWorkflow = () => {
      const section = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-review-id="documents-mkdocs-section"]',
        ),
      ).find((candidate) =>
        candidate.textContent?.includes("Review workflow"),
      );
      const toggle = section?.querySelector<HTMLButtonElement>(
        '[data-review-id="documents-order-section-toggle"]',
      );
      if (toggle?.getAttribute("aria-expanded") === "false") {
        toggle.click();
      }
    };

    closeAllTabs();
    await openDirectory(directory);
    await openDocument(fixturePath);
    applyDocumentsOrderState();
    window.setTimeout(applyDocumentsOrderState, 300);
    window.setTimeout(chooseMkDocsOrder, 900);
    window.setTimeout(chooseMkDocsOrder, 1600);
    window.setTimeout(expandReviewWorkflow, 2400);
    window.setTimeout(expandReviewWorkflow, 3600);
    return true;
  }

  if (
    scenario === "first-document-open-folder" ||
    scenario === "first-document-reader"
  ) {
    const directory = fixtureDirectory(fixturePath);
    const applyFirstDocumentState = () => {
      dismissInlineNotice();
      setRootDirectory(directory);
      context.setRightSidebarTab("contents");
      setSidebarLayout((current) => ({
        ...current,
        leftSidebarWidth: 360,
        rightSidebarWidth: 340,
        openFilesCollapsed: true,
      }));
      setConfig((current) =>
        current
          ? {
              ...current,
              sidebarVisible: true,
              rightSidebarVisible: scenario === "first-document-reader",
              layout: {
                ...current.layout,
                leftSidebarWidth: 360,
                rightSidebarWidth: 340,
                openFilesCollapsed: true,
              },
              workspace: {
                ...current.workspace,
                sidebarTab: "files",
              },
              experimental: {
                ...current.experimental,
                postDiffGitMarkers: false,
                searchHitRuler: false,
              },
            }
          : current,
      );
    };
    const showOpenFolderMenu = () => {
      applyFirstDocumentState();
      const menu = document.querySelector(
        '[data-review-id="file-tree-open-menu"]',
      );
      if (!menu) {
        document
          .querySelector<HTMLButtonElement>(
            '[data-review-id="file-tree-open-menu-trigger"]',
          )
          ?.click();
      }
      window.setTimeout(() => {
        document
          .querySelector<HTMLButtonElement>(
            '[data-review-id="directory-open-control"]',
          )
          ?.focus();
      }, 80);
    };

    closeAllTabs();
    await openDirectory(directory);
    await openDocument(fixturePath);
    applyFirstDocumentState();
    window.setTimeout(applyFirstDocumentState, 300);
    window.setTimeout(applyFirstDocumentState, 900);
    window.setTimeout(applyFirstDocumentState, 1500);
    if (scenario === "first-document-open-folder") {
      window.setTimeout(showOpenFolderMenu, 700);
      window.setTimeout(showOpenFolderMenu, 1700);
      window.setTimeout(showOpenFolderMenu, 3000);
    }
    return true;
  }

  if (
    scenario === "tabs-open-files" ||
    scenario === "tabs-open-files-tabs" ||
    scenario === "quick-open" ||
    scenario === "command-palette"
  ) {
    const directory = fixtureDirectory(fixturePath);
    const referencePath = `${directory}/navigation-reference.md`;
    const bookmarksPath = `${directory}/navigation-bookmarks.md`;
    const openedAt = new Date().toISOString();
    const applyNavigationReadingState = () => {
      dismissInlineNotice();
      setRootDirectory(directory);
      setSidebarLayout((current) => ({
        ...current,
        leftSidebarWidth: 360,
        openFilesCollapsed: false,
        openFilesHeight: 150,
      }));
      setConfig((current) =>
        current
          ? {
              ...current,
              sidebarVisible: true,
              rightSidebarVisible: false,
              layout: {
                ...current.layout,
                leftSidebarWidth: 360,
                openFilesCollapsed: false,
                openFilesHeight: 150,
              },
              workspace: {
                ...current.workspace,
                sidebarTab: "files",
                bookmarks: [
                  { kind: "directory", path: directory },
                  { kind: "file", path: fixturePath },
                  { kind: "file", path: referencePath },
                  { kind: "file", path: bookmarksPath },
                ],
                recentDocuments: [
                  {
                    path: fixturePath,
                    name: fixturePath.split("/").pop() ?? "navigation.md",
                    lastOpenedAt: openedAt,
                  },
                  {
                    path: referencePath,
                    name: "navigation-reference.md",
                    lastOpenedAt: openedAt,
                  },
                  {
                    path: bookmarksPath,
                    name: "navigation-bookmarks.md",
                    lastOpenedAt: openedAt,
                  },
                ],
              },
            }
          : current,
      );
    };
    const applyTabBarState = () => {
      setConfig((current) =>
        current
          ? {
              ...current,
              sidebarVisible: false,
              rightSidebarVisible: false,
            }
          : current,
      );
    };
    const applyNavigationDocuments = async () => {
      const documents = await Promise.all([
        loadDocumentForScreenshot(referencePath),
        loadDocumentForScreenshot(bookmarksPath),
        loadDocumentForScreenshot(fixturePath),
      ]);
      setTabs(documents);
      setDocumentPayload(documents[2] ?? null);
      setConfig((current) =>
        current
          ? {
              ...current,
              workspace: {
                ...current.workspace,
                openTabs: documents.map((document) => document.path),
                recentTabs: documents
                  .map((document) => document.path)
                  .reverse(),
              },
            }
          : current,
      );
    };
    const openQuickOpen = () => {
      void window.__SVARD_COMMANDS__?.dispatch("quickOpen.focus");
      window.setTimeout(() => {
        const input = document.querySelector<HTMLInputElement>(
          '[data-review-id="quick-open-input"]',
        );
        if (!input) return;
        input.focus();
        setInputValue(
          input,
          scenario === "command-palette" ? ">view" : "navigation",
        );
      }, 120);
    };

    closeAllTabs();
    await openDirectory(directory);
    applyNavigationReadingState();
    await applyNavigationDocuments();
    applyNavigationReadingState();
    window.setTimeout(() => void applyNavigationDocuments(), 500);
    window.setTimeout(() => void applyNavigationDocuments(), 1500);
    window.setTimeout(applyNavigationReadingState, 300);
    window.setTimeout(applyNavigationReadingState, 900);
    window.setTimeout(applyNavigationReadingState, 1500);
    window.setTimeout(applyNavigationReadingState, 2500);
    if (scenario === "tabs-open-files-tabs") {
      window.setTimeout(applyTabBarState, 2600);
      window.setTimeout(applyTabBarState, 3400);
      window.setTimeout(applyTabBarState, 4400);
    }
    if (scenario === "quick-open" || scenario === "command-palette") {
      window.setTimeout(openQuickOpen, 1200);
      window.setTimeout(openQuickOpen, 2400);
      window.setTimeout(openQuickOpen, 3600);
    }
    return true;
  }

  if (
    scenario === "file-compare-files" ||
    scenario === "file-compare-context-menu"
  ) {
    const directory = fixtureDirectory(fixturePath);
    const applyFileCompareFilesState = () => {
      dismissInlineNotice();
      setRootDirectory(directory);
      setSidebarLayout((current) => ({
        ...current,
        leftSidebarWidth: 360,
        openFilesCollapsed: true,
      }));
      setConfig((current) =>
        current
          ? {
              ...current,
              sidebarVisible: true,
              rightSidebarVisible: false,
              layout: {
                ...current.layout,
                leftSidebarWidth: 360,
                openFilesCollapsed: true,
              },
              workspace: {
                ...current.workspace,
                sidebarTab: "files",
              },
            }
          : current,
      );
    };

    await openDirectory(directory);
    await openDocument(fixturePath);
    applyFileCompareFilesState();
    window.setTimeout(applyFileCompareFilesState, 300);
    window.setTimeout(applyFileCompareFilesState, 900);
    window.setTimeout(applyFileCompareFilesState, 1500);
    window.setTimeout(applyFileCompareFilesState, 2500);
    window.setTimeout(applyFileCompareFilesState, 3500);

    if (scenario === "file-compare-context-menu") {
      const openCompareContextMenu = () => {
        const treeFiles = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[data-review-id="tree-file"]',
          ),
        );
        const target = treeFiles.find((item) =>
          item.textContent?.includes("product-guide-b.md"),
        );
        if (!target) return;
        const rect = target.getBoundingClientRect();
        target.dispatchEvent(
          new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + Math.min(220, rect.width - 12),
            clientY: rect.top + rect.height / 2,
            button: 2,
          }),
        );
      };
      const focusCompareContextMenuItem = () => {
        document
          .querySelector<HTMLButtonElement>(
            '[data-review-id="context-menu-item-compare-with-active-file"]',
          )
          ?.focus();
      };
      const openAndFocusCompareContextMenu = () => {
        openCompareContextMenu();
        window.setTimeout(focusCompareContextMenuItem, 80);
        window.setTimeout(focusCompareContextMenuItem, 180);
      };

      window.setTimeout(openAndFocusCompareContextMenu, 1800);
      window.setTimeout(openAndFocusCompareContextMenu, 3000);
      window.setTimeout(openAndFocusCompareContextMenu, 4200);
    }
    return true;
  }

  if (
    scenario === "navigation" ||
    scenario === "history-recently-closed" ||
    scenario === "split-view-entry" ||
    scenario === "split-view" ||
    scenario === "bookmarks"
  ) {
    const directory = fixtureDirectory(fixturePath);
    const referencePath = `${directory}/navigation-reference.md`;
    const bookmarksPath = `${directory}/navigation-bookmarks.md`;
    const openedAt = new Date().toISOString();

    await openDocument(referencePath);
    await openDocument(bookmarksPath);
    await openDocument(fixturePath);

    const applyNavigationState = () => {
      setRootDirectory(directory);
      setConfig((current) =>
        current
          ? {
              ...current,
              sidebarVisible: true,
              rightSidebarVisible: false,
              layout: {
                ...current.layout,
                leftSidebarWidth: 340,
                openFilesHeight: 120,
                openFilesCollapsed: true,
              },
              workspace: {
                ...current.workspace,
                sidebarTab: "bookmarks",
                bookmarks: [
                  { kind: "directory", path: directory },
                  { kind: "file", path: fixturePath },
                  { kind: "file", path: referencePath },
                  { kind: "file", path: bookmarksPath },
                ],
                recentDocuments: [
                  {
                    path: fixturePath,
                    name: fixturePath.split("/").pop() ?? "navigation.md",
                    lastOpenedAt: openedAt,
                  },
                  {
                    path: referencePath,
                    name: "navigation-reference.md",
                    lastOpenedAt: openedAt,
                  },
                  {
                    path: bookmarksPath,
                    name: "navigation-bookmarks.md",
                    lastOpenedAt: openedAt,
                  },
                ],
              },
              mouseGestures: {
                ...current.mouseGestures,
                enabled: true,
              },
            }
          : current,
      );
    };
    const applyHistoryState = () => {
      setRootDirectory(directory);
      setConfig((current) =>
        current
          ? {
              ...current,
              sidebarVisible: true,
              rightSidebarVisible: false,
              layout: {
                ...current.layout,
                leftSidebarWidth: 340,
                openFilesHeight: 120,
                openFilesCollapsed: true,
              },
              workspace: {
                ...current.workspace,
                sidebarTab: "files",
                recentTabs: [fixturePath, referencePath, bookmarksPath],
                bookmarks: [
                  { kind: "directory", path: directory },
                  { kind: "file", path: fixturePath },
                  { kind: "file", path: referencePath },
                  { kind: "file", path: bookmarksPath },
                ],
                recentDirectories: [
                  {
                    path: directory,
                    name: "Documentation workspace",
                    lastOpenedAt: openedAt,
                  },
                ],
                recentDocuments: [
                  {
                    path: fixturePath,
                    name: fixturePath.split("/").pop() ?? "navigation.md",
                    lastOpenedAt: openedAt,
                  },
                  {
                    path: referencePath,
                    name: "navigation-reference.md",
                    lastOpenedAt: openedAt,
                  },
                  {
                    path: bookmarksPath,
                    name: "navigation-bookmarks.md",
                    lastOpenedAt: openedAt,
                  },
                ],
              },
            }
          : current,
      );
    };
    const applySplitViewState = () => {
      dismissInlineNotice();
      window.__SVARD_COMMANDS__?.dispatch("view.splitRight");
      setConfig((current) =>
        current
          ? {
              ...current,
              sidebarVisible: false,
              rightSidebarVisible: false,
              workspace: {
                ...current.workspace,
                sidebarTab: "files",
              },
            }
          : current,
      );
    };
    const applySplitViewEntryState = () => {
      dismissInlineNotice();
      setConfig((current) =>
        current
          ? {
              ...current,
              sidebarVisible: false,
              rightSidebarVisible: false,
              workspace: {
                ...current.workspace,
                sidebarTab: "files",
              },
            }
          : current,
      );
      window.setTimeout(() => {
        const toggle = document.querySelector<HTMLButtonElement>(
          '[data-review-id="split-view-toggle"]',
        );
        if (!toggle) return;
        toggle.focus();
        toggle.style.borderColor = "#287466";
        toggle.style.background = "#e7f0ef";
        toggle.style.color = "#183d37";
        toggle.style.boxShadow = "0 0 0 3px rgba(40, 116, 102, 0.22)";
      }, 80);
    };

    if (scenario === "history-recently-closed") {
      applyHistoryState();
      window.setTimeout(applyHistoryState, 700);
      window.setTimeout(applyHistoryState, 1500);
      window.setTimeout(applyHistoryState, 3000);
    } else if (scenario === "split-view-entry") {
      applyNavigationState();
      window.setTimeout(applySplitViewEntryState, 500);
      window.setTimeout(applySplitViewEntryState, 1200);
      window.setTimeout(applySplitViewEntryState, 2200);
    } else if (scenario === "split-view") {
      applyNavigationState();
      window.setTimeout(applySplitViewState, 500);
      window.setTimeout(applySplitViewState, 1200);
      window.setTimeout(applySplitViewState, 2200);
    } else {
      applyNavigationState();
      window.setTimeout(applyNavigationState, 300);
      window.setTimeout(applyNavigationState, 900);
      window.setTimeout(applyNavigationState, 1500);
    }
    return true;
  }

  if (scenario === "file-compare-preview") {
    const comparePath = `${fixtureDirectory(fixturePath)}/product-guide-b.md`;
    await compareDocumentPaths(fixturePath, comparePath);
    return true;
  }

  return false;
}
