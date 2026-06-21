import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import type { AppConfig, DocumentPayload } from "../../core/types";
import type { RightSidebarTab, SearchScope } from "../types";

const envScreenshotScenario = import.meta.env
  .VITE_SVARD_SITE_SCREENSHOT_SCENARIO;
const envScreenshotFixture = import.meta.env.VITE_SVARD_SITE_SCREENSHOT_FIXTURE;
const screenshotScenarioIds = new Set([
  "hero-plantuml",
  "files",
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

function inferScreenshotScenario(path: string | null | undefined) {
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

interface UseSiteScreenshotScenarioOptions {
  closeAllTabs: () => void;
  dismissInlineNotice: () => void;
  documentPayload: DocumentPayload | null;
  openDirectory: (path: string) => Promise<void> | void;
  openDocument: (path: string) => Promise<void> | void;
  openPreferences: () => void;
  loadDocumentForScreenshot: (path: string) => Promise<DocumentPayload>;
  setConfig: Dispatch<SetStateAction<AppConfig | null>>;
  setDocumentPayload: Dispatch<SetStateAction<DocumentPayload | null>>;
  setRootDirectory: Dispatch<SetStateAction<string>>;
  setSidebarLayout: Dispatch<SetStateAction<AppConfig["layout"]>>;
  setTabs: Dispatch<SetStateAction<DocumentPayload[]>>;
  setZenModeActive: Dispatch<SetStateAction<boolean>>;
  setWindowTheme: (theme: AppConfig["theme"]) => Promise<void> | void;
  setRightSidebarTab: Dispatch<SetStateAction<RightSidebarTab>>;
  setSearchScope: (scope: SearchScope) => void;
  compareDocumentPaths: (leftPath: string, rightPath: string) => Promise<void>;
  showGitDiff: (path?: string) => Promise<void>;
  updateSearchQuery: (value: string) => void;
}

export function useSiteScreenshotScenario({
  closeAllTabs,
  dismissInlineNotice,
  documentPayload,
  openDirectory,
  openDocument,
  openPreferences,
  loadDocumentForScreenshot,
  setConfig,
  setDocumentPayload,
  setRootDirectory,
  setSidebarLayout,
  setTabs,
  setZenModeActive,
  setWindowTheme,
  setRightSidebarTab,
  setSearchScope,
  compareDocumentPaths,
  showGitDiff,
  updateSearchQuery,
}: UseSiteScreenshotScenarioOptions) {
  const appliedRef = useRef(false);

  useEffect(() => {
    const activePath = documentPayload?.path ?? null;
    const scenario =
      envScreenshotScenario ||
      inferScreenshotScenario(envScreenshotFixture) ||
      inferScreenshotScenario(activePath);

    if (appliedRef.current || !documentPayload || !scenario) {
      return;
    }

    let disposed = false;
    const initialDocumentPath = documentPayload.path;

    async function applyScenario() {
      appliedRef.current = true;
      const fixturePath =
        envScreenshotFixture || activePath || initialDocumentPath;

      if (
        scenario !== "files" &&
        scenario !== "file-compare-files" &&
        scenario !== "file-compare-context-menu" &&
        scenario !== "workspace-search" &&
        scenario !== "workspace-search-result" &&
        scenario !== "first-document-open-folder" &&
        scenario !== "first-document-reader" &&
        scenario !== "tabs-open-files" &&
        scenario !== "tabs-open-files-tabs" &&
        scenario !== "quick-open" &&
        scenario !== "link-hover-preview" &&
        scenario !== "link-context-menu" &&
        scenario !== "diagram-inspector" &&
        scenario !== "diagram-inline-preview-entry" &&
        scenario !== "diagram-preview" &&
        scenario !== "diagram-save-action" &&
        scenario !== "change-review-mode-markers"
      ) {
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

      if (scenario === "search") {
        setRightSidebarTab("search");
        setSearchScope("document");
        updateSearchQuery("local");
        window.setTimeout(() => updateSearchQuery("local"), 250);
        window.setTimeout(() => updateSearchQuery("local"), 750);
      } else if (
        scenario === "workspace-search" ||
        scenario === "workspace-search-result"
      ) {
        const fixtureDirectory = fixturePath.replace(/\/[^/]+$/, "");
        const applyWorkspaceSearchQuery = () => {
          document
            .querySelector<HTMLButtonElement>(
              '[data-review-id="search-scope-workspace"]',
            )
            ?.click();
          const input = document.querySelector<HTMLInputElement>(
            '[data-review-id="search-input"]',
          );
          if (!input) {
            return;
          }
          const valueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            "value",
          )?.set;
          valueSetter?.call(input, "review");
          input.dispatchEvent(new Event("input", { bubbles: true }));
        };
        const applyWorkspaceSearchState = () => {
          dismissInlineNotice();
          setRootDirectory(fixtureDirectory);
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
          void openDocument(`${fixtureDirectory}/release-plan.md`);
        };
        const focusWorkspaceSearchResult = () => {
          document
            .querySelector<HTMLButtonElement>(
              '[data-review-id="workspace-search-result-item"][data-search-index="1"]',
            )
            ?.focus();
        };

        closeAllTabs();
        await openDirectory(fixtureDirectory);
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
      } else if (scenario === "files") {
        const fixtureDirectory = fixturePath.replace(/\/[^/]+$/, "");
        const applyFilesState = () => {
          dismissInlineNotice();
          setRootDirectory(fixtureDirectory);
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

        await openDirectory(fixtureDirectory);
        await openDocument(fixturePath);
        applyFilesState();
        window.setTimeout(applyFilesState, 300);
        window.setTimeout(applyFilesState, 900);
        window.setTimeout(applyFilesState, 1500);
        window.setTimeout(applyFilesState, 2500);
        window.setTimeout(applyFilesState, 3500);
      } else if (
        scenario === "first-document-open-folder" ||
        scenario === "first-document-reader"
      ) {
        const fixtureDirectory = fixturePath.replace(/\/[^/]+$/, "");

        const applyFirstDocumentState = () => {
          dismissInlineNotice();
          setRootDirectory(fixtureDirectory);
          setRightSidebarTab("contents");
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
        await openDirectory(fixtureDirectory);
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
      } else if (
        scenario === "tabs-open-files" ||
        scenario === "tabs-open-files-tabs" ||
        scenario === "quick-open" ||
        scenario === "command-palette"
      ) {
        const fixtureDirectory = fixturePath.replace(/\/[^/]+$/, "");
        const referencePath = `${fixtureDirectory}/navigation-reference.md`;
        const bookmarksPath = `${fixtureDirectory}/navigation-bookmarks.md`;
        const openedAt = new Date().toISOString();

        const applyNavigationReadingState = () => {
          dismissInlineNotice();
          setRootDirectory(fixtureDirectory);
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
                      { kind: "directory", path: fixtureDirectory },
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
            if (!input) {
              return;
            }
            input.focus();
            const valueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype,
              "value",
            )?.set;
            valueSetter?.call(
              input,
              scenario === "command-palette" ? ">view" : "navigation",
            );
            input.dispatchEvent(new Event("input", { bubbles: true }));
          }, 120);
        };

        closeAllTabs();
        await openDirectory(fixtureDirectory);
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
      } else if (
        scenario === "file-compare-files" ||
        scenario === "file-compare-context-menu"
      ) {
        const fixtureDirectory = fixturePath.replace(/\/[^/]+$/, "");
        const applyFileCompareFilesState = () => {
          dismissInlineNotice();
          setRootDirectory(fixtureDirectory);
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

        await openDirectory(fixtureDirectory);
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
            if (!target) {
              return;
            }

            const rect = target.getBoundingClientRect();
            const clientX = rect.left + Math.min(220, rect.width - 12);
            const clientY = rect.top + rect.height / 2;
            target.dispatchEvent(
              new MouseEvent("contextmenu", {
                bubbles: true,
                cancelable: true,
                clientX,
                clientY,
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
      } else if (
        scenario === "navigation" ||
        scenario === "history-recently-closed" ||
        scenario === "split-view-entry" ||
        scenario === "split-view" ||
        scenario === "bookmarks"
      ) {
        const fixtureDirectory = fixturePath.replace(/\/[^/]+$/, "");
        const referencePath = `${fixtureDirectory}/navigation-reference.md`;
        const bookmarksPath = `${fixtureDirectory}/navigation-bookmarks.md`;
        const openedAt = new Date().toISOString();

        await openDocument(referencePath);
        await openDocument(bookmarksPath);
        await openDocument(fixturePath);

        const applyNavigationState = () => {
          setRootDirectory(fixtureDirectory);
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
                      { kind: "directory", path: fixtureDirectory },
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
          setRootDirectory(fixtureDirectory);
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
                      { kind: "directory", path: fixtureDirectory },
                      { kind: "file", path: fixturePath },
                      { kind: "file", path: referencePath },
                      { kind: "file", path: bookmarksPath },
                    ],
                    recentDirectories: [
                      {
                        path: fixtureDirectory,
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
            if (!toggle) {
              return;
            }
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
      } else if (
        scenario === "source-control" ||
        scenario === "source-control-changes" ||
        scenario === "source-control-ref-context-menu"
      ) {
        const fixtureDirectory = fixturePath.replace(/\/[^/]+$/, "");
        const applySourceControlState = () => {
          setRootDirectory(fixtureDirectory);
          setConfig((current) =>
            current
              ? {
                  ...current,
                  sidebarVisible: true,
                  rightSidebarVisible: false,
                  layout: {
                    ...current.layout,
                    leftSidebarWidth: 360,
                  },
                  workspace: {
                    ...current.workspace,
                    sidebarTab: "sourceControl",
                    sourceControlView: "changes",
                  },
                }
              : current,
          );
        };
        const openRefCompareContextMenu = () => {
          const item = document.querySelector<HTMLElement>(
            '[data-review-id="source-control-change-item"]:not([aria-disabled="true"])',
          );
          if (!item) {
            return;
          }
          item.focus();
          const rect = item.getBoundingClientRect();
          item.dispatchEvent(
            new MouseEvent("contextmenu", {
              bubbles: true,
              cancelable: true,
              clientX: rect.left + Math.min(rect.width - 24, 260),
              clientY: rect.top + rect.height / 2,
              button: 2,
            }),
          );
          window.setTimeout(() => {
            document
              .querySelector<HTMLElement>(
                '[data-review-id="context-menu-item-compare-with-branch"]',
              )
              ?.focus();
          }, 80);
        };

        applySourceControlState();
        window.setTimeout(applySourceControlState, 300);
        window.setTimeout(applySourceControlState, 900);
        window.setTimeout(applySourceControlState, 1500);
        if (scenario === "source-control-ref-context-menu") {
          window.setTimeout(openRefCompareContextMenu, 3600);
          window.setTimeout(openRefCompareContextMenu, 5200);
        }
      } else if (scenario === "source-control-open-diff") {
        const fixtureDirectory = fixturePath.replace(/\/[^/]+$/, "");
        const applySourceControlDiffState = () => {
          dismissInlineNotice();
          setRootDirectory(fixtureDirectory);
          setConfig((current) =>
            current
              ? {
                  ...current,
                  sidebarVisible: true,
                  rightSidebarVisible: false,
                  layout: {
                    ...current.layout,
                    leftSidebarWidth: 360,
                  },
                  workspace: {
                    ...current.workspace,
                    sidebarTab: "sourceControl",
                    sourceControlView: "changes",
                  },
                }
              : current,
          );
        };

        applySourceControlDiffState();
        await showGitDiff(fixturePath);
        applySourceControlDiffState();
        window.setTimeout(applySourceControlDiffState, 300);
        window.setTimeout(applySourceControlDiffState, 900);
        window.setTimeout(applySourceControlDiffState, 1500);
      } else if (
        scenario === "source-control-branch-diff" ||
        scenario === "source-control-branch-diff-preview" ||
        scenario === "source-control-repo-graph" ||
        scenario === "source-control-file-history"
      ) {
        const fixtureDirectory = fixturePath.replace(/\/[^/]+$/, "");
        const sourceControlView =
          scenario === "source-control-branch-diff" ||
          scenario === "source-control-branch-diff-preview"
            ? "branchDiff"
            : "graph";
        const applySourceControlReviewState = () => {
          const focusHistorySidebar =
            scenario === "source-control-repo-graph" ||
            scenario === "source-control-file-history";
          dismissInlineNotice();
          setRootDirectory(fixtureDirectory);
          setConfig((current) =>
            current
              ? {
                  ...current,
                  sidebarVisible: true,
                  rightSidebarVisible: false,
                  layout: {
                    ...current.layout,
                    leftSidebarWidth: focusHistorySidebar ? 560 : 390,
                  },
                  workspace: {
                    ...current.workspace,
                    sidebarTab: "sourceControl",
                    sourceControlView,
                  },
                }
              : current,
          );
        };
        const selectBranchDiffBase = () => {
          const select = document.querySelector<HTMLSelectElement>(
            '[data-review-id="source-control-branch-diff-base"]',
          );
          if (
            !select ||
            !Array.from(select.options).some(
              (option) => option.value === "main",
            )
          ) {
            return;
          }
          select.value = "main";
          select.dispatchEvent(new Event("change", { bubbles: true }));
        };
        const clickReviewControl = (reviewId: string) => {
          document
            .querySelector<HTMLButtonElement>(`[data-review-id="${reviewId}"]`)
            ?.click();
        };
        const openFirstBranchDiffItem = () => {
          document
            .querySelector<HTMLButtonElement>(
              '[data-review-id="source-control-branch-diff-item"]:not([aria-disabled="true"])',
            )
            ?.click();
        };

        await openDirectory(fixtureDirectory);
        await openDocument(fixturePath);
        applySourceControlReviewState();
        if (scenario === "source-control-file-history") {
          clickReviewControl("source-control-view-file-history");
        } else if (scenario === "source-control-repo-graph") {
          clickReviewControl("source-control-view-repo-graph");
        } else {
          clickReviewControl("source-control-view-branch-diff");
          selectBranchDiffBase();
        }
        window.setTimeout(applySourceControlReviewState, 300);
        window.setTimeout(() => {
          if (scenario === "source-control-file-history") {
            clickReviewControl("source-control-view-file-history");
          } else if (scenario === "source-control-repo-graph") {
            clickReviewControl("source-control-view-repo-graph");
          } else {
            clickReviewControl("source-control-view-branch-diff");
            selectBranchDiffBase();
          }
        }, 900);
        window.setTimeout(() => {
          applySourceControlReviewState();
          if (
            scenario === "source-control-branch-diff" ||
            scenario === "source-control-branch-diff-preview"
          ) {
            selectBranchDiffBase();
          }
        }, 1800);
        if (scenario === "source-control-branch-diff-preview") {
          window.setTimeout(openFirstBranchDiffItem, 3500);
          window.setTimeout(openFirstBranchDiffItem, 5200);
        }
      } else if (
        scenario === "rendered-diff" ||
        scenario === "table-list-diff-review"
      ) {
        await showGitDiff(fixturePath);
        window.setTimeout(() => {
          document
            .querySelector<HTMLButtonElement>(
              '[data-review-id="git-diff-rendered-view"]',
            )
            ?.click();
        }, 300);
      } else if (scenario === "table-list-diff-table") {
        await showGitDiff(fixturePath);
        const openTableView = () => {
          document
            .querySelector<HTMLButtonElement>(
              '[data-review-id="git-diff-table-view"]',
            )
            ?.click();
        };
        window.setTimeout(openTableView, 300);
        window.setTimeout(openTableView, 900);
        window.setTimeout(openTableView, 1500);
      } else if (scenario === "table-copy-context-menu") {
        const applyTableCopyState = () => {
          dismissInlineNotice();
          setConfig((current) =>
            current
              ? {
                  ...current,
                  sidebarVisible: false,
                  rightSidebarVisible: false,
                }
              : current,
          );
          setTabs((current) => {
            const active = documentPayload ?? current[0];
            return active ? [active] : current;
          });
          const table = document.querySelector<HTMLElement>("article table");
          table?.scrollIntoView({ block: "center" });
        };
        const openTableCopyContextMenu = () => {
          applyTableCopyState();
          const cell =
            document.querySelector<HTMLElement>("article table tbody td") ??
            document.querySelector<HTMLElement>("article table td");
          if (!cell) {
            return;
          }
          const rect = cell.getBoundingClientRect();
          cell.dispatchEvent(
            new MouseEvent("contextmenu", {
              bubbles: true,
              cancelable: true,
              clientX: rect.left + Math.min(80, rect.width / 2),
              clientY: rect.top + rect.height / 2,
              button: 2,
            }),
          );
        };
        const focusCopyMenuItem = () => {
          document
            .querySelector<HTMLButtonElement>(
              '[data-review-id="context-menu-item-copy-table-markdown"]',
            )
            ?.focus();
        };
        const openAndFocusTableCopyMenu = () => {
          openTableCopyContextMenu();
          window.setTimeout(focusCopyMenuItem, 80);
          window.setTimeout(focusCopyMenuItem, 180);
        };

        applyTableCopyState();
        window.setTimeout(applyTableCopyState, 300);
        window.setTimeout(openAndFocusTableCopyMenu, 1200);
        window.setTimeout(openAndFocusTableCopyMenu, 2400);
        window.setTimeout(openAndFocusTableCopyMenu, 3600);
      } else if (
        scenario === "link-hover-preview" ||
        scenario === "link-context-menu"
      ) {
        const fixtureDirectory = fixturePath.replace(/\/[^/]+$/, "");
        const applyLinkDocumentState = () => {
          dismissInlineNotice();
          setRootDirectory(fixtureDirectory);
          setConfig((current) =>
            current
              ? {
                  ...current,
                  sidebarVisible: true,
                  rightSidebarVisible: false,
                  layout: {
                    ...current.layout,
                    leftSidebarWidth: 340,
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
        const targetLink = () =>
          Array.from(document.querySelectorAll<HTMLAnchorElement>("a[href]"))
            .find((link) => link.textContent?.includes("Related runbook"));
        const hoverLink = () => {
          applyLinkDocumentState();
          const link = targetLink();
          if (!link) {
            return;
          }
          link.focus();
          const rect = link.getBoundingClientRect();
          const options = {
            bubbles: true,
            cancelable: true,
            clientX: rect.left + rect.width / 2,
            clientY: rect.top + rect.height / 2,
          };
          link.dispatchEvent(new MouseEvent("mouseover", options));
          link.dispatchEvent(new MouseEvent("mousemove", options));
        };
        const openLinkContextMenu = () => {
          applyLinkDocumentState();
          const link = targetLink();
          if (!link) {
            return;
          }
          link.focus();
          const rect = link.getBoundingClientRect();
          link.dispatchEvent(
            new MouseEvent("contextmenu", {
              bubbles: true,
              cancelable: true,
              clientX: rect.left + rect.width / 2,
              clientY: rect.top + rect.height / 2,
              button: 2,
            }),
          );
          window.setTimeout(() => {
            document
              .querySelector<HTMLElement>(
                '[data-review-id="context-menu-item-open-document"]',
              )
              ?.focus();
          }, 80);
        };

        closeAllTabs();
        await openDirectory(fixtureDirectory);
        await openDocument(fixturePath);
        applyLinkDocumentState();
        if (scenario === "link-hover-preview") {
          window.setTimeout(hoverLink, 1200);
          window.setTimeout(hoverLink, 2400);
          window.setTimeout(hoverLink, 4000);
        } else {
          window.setTimeout(openLinkContextMenu, 1200);
          window.setTimeout(openLinkContextMenu, 2400);
          window.setTimeout(openLinkContextMenu, 4000);
        }
      } else if (scenario === "change-review-mode-markers") {
        const fixtureDirectory = fixturePath.replace(/\/[^/]+$/, "");
        const applyWorkingTreeMarkerState = () => {
          dismissInlineNotice();
          setRootDirectory(fixtureDirectory);
          setConfig((current) =>
            current
              ? {
                  ...current,
                  sidebarVisible: false,
                  rightSidebarVisible: false,
                  experimental: {
                    ...current.experimental,
                    postDiffGitMarkers: true,
                  },
                }
              : current,
          );
        };

        closeAllTabs();
        applyWorkingTreeMarkerState();
        await openDirectory(fixtureDirectory);
        applyWorkingTreeMarkerState();
        await openDocument(fixturePath);
        applyWorkingTreeMarkerState();
        window.setTimeout(applyWorkingTreeMarkerState, 300);
        window.setTimeout(applyWorkingTreeMarkerState, 900);
        window.setTimeout(applyWorkingTreeMarkerState, 1500);
        window.setTimeout(applyWorkingTreeMarkerState, 2500);
      } else if (scenario === "file-compare-preview") {
        const fixtureDirectory = fixturePath.replace(/\/[^/]+$/, "");
        const comparePath = `${fixtureDirectory}/product-guide-b.md`;
        await compareDocumentPaths(fixturePath, comparePath);
      } else if (
        scenario === "diagram-inspector" ||
        scenario === "diagram-inline-preview-entry" ||
        scenario === "diagram-preview" ||
        scenario === "diagram-save-action"
      ) {
        const fixtureDirectory = fixturePath.replace(/\/[^/]+$/, "");

        const applyDiagramInspectorState = () => {
          dismissInlineNotice();
          setRootDirectory(fixtureDirectory);
          setRightSidebarTab("diagrams");
          setConfig((current) =>
            current
              ? {
                  ...current,
                  sidebarVisible: false,
                  rightSidebarVisible: true,
                  layout: {
                    ...current.layout,
                    rightSidebarWidth: 400,
                  },
                  experimental: {
                    ...current.experimental,
                    diagramPlaceholderRendering: true,
                    diagramPlaceholderRenderingConfigured: true,
                    searchHitRuler: false,
                  },
                }
              : current,
          );
          scrubDiagramInspectorValues();
        };
        const scrubDiagramInspectorValues = () => {
          document
            .querySelectorAll<HTMLElement>(".diagram-inspector-facts dt")
            .forEach((label) => {
              if (label.textContent?.trim() !== "Source") {
                return;
              }
              const value = label.nextElementSibling as HTMLElement | null;
              if (value) {
                value.textContent = "overview.adoc:16";
              }
            });
          document
            .querySelectorAll<HTMLButtonElement>(
              ".diagram-inspector-actions button",
            )
            .forEach((button) => {
              if (button.textContent?.includes("Copy Source")) {
                button.style.display = "none";
              }
            });
          const previewReference = document.querySelector<HTMLElement>(
            ".diagram-preview-title small",
          );
          if (previewReference) {
            previewReference.textContent = "overview.adoc:16";
          }
        };
        const focusSecondDiagram = () => {
          scrubDiagramInspectorValues();
          const items = Array.from(
            document.querySelectorAll<HTMLButtonElement>(
              '[data-review-id="diagram-inspector-item"]',
            ),
          );
          const target = items[1] ?? items[0];
          target?.click();
          target?.focus();
          window.setTimeout(scrubDiagramInspectorValues, 80);
        };
        const openDiagramPreview = () => {
          applyDiagramInspectorState();
          document
            .querySelector<HTMLButtonElement>(
              '[data-review-id="diagram-inspector-open-preview"]',
            )
            ?.click();
          window.setTimeout(scrubDiagramInspectorValues, 80);
          window.setTimeout(scrubDiagramInspectorValues, 240);
        };
        const focusSaveAction = () => {
          applyDiagramInspectorState();
          scrubDiagramInspectorValues();
          document
            .querySelector<HTMLButtonElement>(
              '[data-review-id="diagram-inspector-save-svg"]',
            )
            ?.focus();
        };
        const focusInlineDiagram = () => {
          dismissInlineNotice();
          setRootDirectory(fixtureDirectory);
          setConfig((current) =>
            current
              ? {
                  ...current,
                  sidebarVisible: false,
                  rightSidebarVisible: false,
                  experimental: {
                    ...current.experimental,
                    diagramPlaceholderRendering: true,
                    diagramPlaceholderRenderingConfigured: true,
                    searchHitRuler: false,
                  },
                }
              : current,
          );
          const diagram = document.querySelector<HTMLElement>(
            '[data-review-id="diagram-inline-image"]',
          );
          if (!diagram) {
            return;
          }
          document
            .querySelectorAll<HTMLElement>(".tab:not(.active)")
            .forEach((tab) => {
              tab.style.display = "none";
            });
          diagram.scrollIntoView({ block: "center", inline: "nearest" });
          diagram.setAttribute("tabindex", "-1");
          diagram.focus();
          diagram.style.borderColor = "#287466";
          diagram.style.boxShadow = "0 0 0 4px rgba(40, 116, 102, 0.2)";
          diagram.style.background = "#f8fcfb";
        };

        closeAllTabs();
        await openDirectory(fixtureDirectory);
        await openDocument(fixturePath);
        const diagramDocument = await loadDocumentForScreenshot(fixturePath);
        setTabs([diagramDocument]);
        setDocumentPayload(diagramDocument);
        setConfig((current) =>
          current
            ? {
                ...current,
                workspace: {
                  ...current.workspace,
                  openTabs: [fixturePath],
                  recentTabs: [fixturePath],
                },
              }
            : current,
        );
        if (scenario === "diagram-inline-preview-entry") {
          window.setTimeout(focusInlineDiagram, 800);
          window.setTimeout(focusInlineDiagram, 1800);
          window.setTimeout(focusInlineDiagram, 3200);
          return;
        }
        applyDiagramInspectorState();
        window.setTimeout(applyDiagramInspectorState, 300);
        window.setTimeout(applyDiagramInspectorState, 900);
        window.setTimeout(scrubDiagramInspectorValues, 1500);
        window.setTimeout(focusSecondDiagram, 2200);
        window.setTimeout(focusSecondDiagram, 3600);
        if (scenario === "diagram-preview") {
          window.setTimeout(openDiagramPreview, 4500);
          window.setTimeout(openDiagramPreview, 5800);
        }
        if (scenario === "diagram-save-action") {
          window.setTimeout(focusSaveAction, 4200);
          window.setTimeout(focusSaveAction, 5600);
        }
      } else if (
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
          if (scenario !== "table-of-contents-jump") {
            return;
          }
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
      } else if (
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
          if (scenario !== "includes-local-assets-boundary") {
            return;
          }
          const toggle = document.querySelector<HTMLButtonElement>(
            '[data-review-id="include-inspector-toggle"]',
          );
          if (toggle?.getAttribute("aria-expanded") === "false") {
            toggle.click();
          }
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
      } else if (scenario === "themes-zoom-reader") {
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
      } else if (scenario === "zen-mode-entry") {
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
            .querySelector<HTMLButtonElement>(
              '[data-review-id="zen-mode-toggle"]',
            )
            ?.focus();
        };

        applyZenModeEntryState();
        window.setTimeout(applyZenModeEntryState, 300);
        window.setTimeout(applyZenModeEntryState, 900);
      } else if (scenario === "zen-mode") {
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
      } else if (
        scenario === "kroki-fallback" ||
        scenario === "external-plantuml-fallback" ||
        scenario === "change-review-settings" ||
        scenario === "themes-zoom-preferences" ||
        scenario === "diagram-loading-cache" ||
        scenario === "network-settings" ||
        scenario === "pr-mr-providers" ||
        scenario === "keybindings" ||
        scenario === "mouse-gestures" ||
        scenario === "mouse-gestures-record" ||
        scenario === "preferences" ||
        scenario === "privacy-boundary"
      ) {
        const fixtureDirectory = fixturePath.replace(/\/[^/]+$/, "");
        const applyPreferencesScenarioState = () => {
          dismissInlineNotice();
          if (scenario === "themes-zoom-preferences") {
            void setWindowTheme("light");
          }
          setRootDirectory(fixtureDirectory);
          setTabs((current) => {
            const active = documentPayload ?? current[0];
            return active ? [active] : current;
          });
          setSidebarLayout((current) => ({
            ...current,
            openFilesCollapsed: true,
          }));
          setConfig((current) =>
            current
              ? {
                  ...current,
                  theme:
                    scenario === "themes-zoom-preferences"
                      ? "light"
                      : current.theme,
                  zoom:
                    scenario === "themes-zoom-preferences" ? 120 : current.zoom,
                  sidebarVisible: false,
                  rightSidebarVisible: false,
                  reader: {
                    ...current.reader,
                    asciidocTheme:
                      scenario === "themes-zoom-preferences"
                        ? "asciidoctor"
                        : current.reader.asciidocTheme,
                  },
                  layout: {
                    ...current.layout,
                    openFilesCollapsed: true,
                  },
                  workspace: {
                    ...current.workspace,
                    sidebarTab: "files",
                  },
                  network: {
                    ...current.network,
                    httpProxy: {
                      ...current.network.httpProxy,
                      mode:
                        scenario === "network-settings"
                          ? "custom"
                          : current.network.httpProxy.mode,
                      url:
                        scenario === "network-settings"
                          ? null
                          : current.network.httpProxy.url,
                    },
                  },
                  remoteProviders: {
                    ...current.remoteProviders,
                    github:
                      scenario === "pr-mr-providers"
                        ? {
                            ...current.remoteProviders.github,
                            enabled: true,
                            hostUrl: "",
                            tokenStored: true,
                            lastTestStatus: {
                              status: "untested",
                              message: "Connection values are hidden.",
                            },
                          }
                        : current.remoteProviders.github,
                    gitlab:
                      scenario === "pr-mr-providers"
                        ? {
                            ...current.remoteProviders.gitlab,
                            enabled: false,
                            hostUrl: "",
                            tokenStored: false,
                            lastTestStatus: null,
                          }
                        : current.remoteProviders.gitlab,
                  },
                  kroki: {
                    ...current.kroki,
                    mode:
                      scenario === "kroki-fallback"
                        ? "remote"
                        : current.kroki.mode,
                    endpointUrl:
                      scenario === "kroki-fallback"
                        ? null
                        : current.kroki.endpointUrl,
                  },
                  diagram: {
                    ...current.diagram,
                    plantumlExternalFallback:
                      scenario === "external-plantuml-fallback"
                        ? "on-local-failure"
                        : current.diagram.plantumlExternalFallback,
                    plantumlExternalBinaryPath:
                      scenario === "external-plantuml-fallback"
                        ? "public-demo-tools/plantuml-graalvm"
                        : current.diagram.plantumlExternalBinaryPath,
                    plantumlExternalDotPath:
                      scenario === "external-plantuml-fallback"
                        ? null
                        : current.diagram.plantumlExternalDotPath,
                    plantumlExternalTimeoutMs:
                      scenario === "external-plantuml-fallback"
                        ? 5000
                        : current.diagram.plantumlExternalTimeoutMs,
                  },
                  mouseGestures: {
                    ...current.mouseGestures,
                    enabled:
                      scenario === "mouse-gestures" ||
                      scenario === "mouse-gestures-record" ||
                      scenario === "preferences"
                        ? true
                        : current.mouseGestures.enabled,
                  },
                  experimental: {
                    ...current.experimental,
                    postDiffGitMarkers:
                      scenario === "change-review-settings"
                        ? false
                        : current.experimental.postDiffGitMarkers,
                  },
                }
              : current,
          );
        };
        const targetLabel =
          scenario === "kroki-fallback"
            ? "Kroki"
            : scenario === "external-plantuml-fallback"
              ? "Diagrams"
            : scenario === "change-review-settings"
              ? "General"
              : scenario === "themes-zoom-preferences"
                ? "General"
              : scenario === "diagram-loading-cache"
                ? "Diagrams"
                : scenario === "network-settings"
                  ? "Network"
                  : scenario === "pr-mr-providers"
                    ? "PR / MR Providers"
                  : scenario === "keybindings"
                    ? "Keybindings"
                    : scenario === "mouse-gestures" ||
                        scenario === "mouse-gestures-record" ||
                        scenario === "preferences"
                    ? "Mouse Gestures"
                    : "Security";
        const scrubKrokiPublicValues = () => {
          if (scenario !== "kroki-fallback") {
            return;
          }
          const endpointInput = document.querySelector<HTMLInputElement>(
            '[data-review-id="kroki-endpoint-control"]',
          );
          if (!endpointInput) {
            return;
          }
          endpointInput.value = "";
          endpointInput.defaultValue = "";
          endpointInput.setAttribute("value", "");
          endpointInput.placeholder = "Configured endpoint is hidden";

          const modeHelp = document.querySelector<HTMLElement>(
            '[data-review-id="kroki-mode-help"]',
          );
          if (modeHelp) {
            modeHelp.textContent = "Use a trusted self-managed Kroki service.";
          }

          const privacyNote = document.querySelector<HTMLElement>(
            '[data-review-id="kroki-privacy-note"]',
          );
          if (privacyNote) {
            privacyNote.textContent =
              "Remote rendering is used only after this preference is configured.";
          }
        };
        const scrubExternalPlantUmlValues = () => {
          if (scenario !== "external-plantuml-fallback") {
            return;
          }
          const advanced = document.querySelector<HTMLDetailsElement>(
            '[data-review-id="diagram-advanced-settings"]',
          );
          if (advanced) {
            advanced.open = true;
          }
          const binaryPath = document.querySelector<HTMLInputElement>(
            '[data-review-id="plantuml-external-binary-path"]',
          );
          if (binaryPath) {
            binaryPath.value = "public-demo-tools/plantuml-graalvm";
            binaryPath.defaultValue = "public-demo-tools/plantuml-graalvm";
            binaryPath.setAttribute(
              "value",
              "public-demo-tools/plantuml-graalvm",
            );
          }
          const dotPath = document.querySelector<HTMLInputElement>(
            '[data-review-id="plantuml-external-dot-path"]',
          );
          if (dotPath) {
            dotPath.value = "";
            dotPath.defaultValue = "";
            dotPath.setAttribute("value", "");
            dotPath.placeholder = "Configure Graphviz dot only when needed";
          }
        };
        const openPreferencesSection = () => {
          applyPreferencesScenarioState();
          openPreferences();
          applyPreferencesScenarioState();
          const button = Array.from(
            document.querySelectorAll<HTMLButtonElement>(
              '[data-review-id="preferences-nav-item"]',
            ),
          ).find((item) => item.textContent?.trim() === targetLabel);
          button?.click();
          window.setTimeout(scrubKrokiPublicValues, 20);
          window.setTimeout(scrubExternalPlantUmlValues, 20);
          window.setTimeout(scrubKrokiPublicValues, 120);
          window.setTimeout(scrubExternalPlantUmlValues, 120);
          window.setTimeout(() => {
            if (scenario === "network-settings") {
              const proxyInput = document.querySelector<HTMLInputElement>(
                '[data-review-id="http-proxy-url-control"]',
              );
              if (proxyInput) {
                proxyInput.value = "";
                proxyInput.defaultValue = "";
                proxyInput.setAttribute("value", "");
                proxyInput.placeholder = "Configured proxy is hidden";
                proxyInput.focus();
              }
            } else if (scenario === "pr-mr-providers") {
              document
                .querySelector<HTMLInputElement>(
                  '[data-review-id="remote-provider-github-enabled"]',
                )
                ?.focus();
            } else if (scenario === "change-review-settings") {
              document
                .querySelector<HTMLInputElement>(
                  '[data-review-id="general-post-diff-git-markers-control"]',
                )
                ?.focus();
            } else if (scenario === "themes-zoom-preferences") {
              document
                .querySelector<HTMLInputElement>(
                  '[data-review-id="zoom-slider"]',
                )
                ?.focus();
            } else if (scenario === "diagram-loading-cache") {
              document
                .querySelector<HTMLInputElement>(
                  '[data-review-id="experimental-diagram-placeholder-rendering-control"]',
                )
                ?.focus();
            } else if (scenario === "external-plantuml-fallback") {
              scrubExternalPlantUmlValues();
              document
                .querySelector<HTMLInputElement>(
                  '[data-review-id="plantuml-external-binary-path"]',
                )
                ?.focus();
            } else if (scenario === "keybindings") {
              document
                .querySelector<HTMLInputElement>(
                  '[data-review-id="keybinding-search"]',
                )
                ?.focus();
            } else if (scenario === "mouse-gestures") {
              document
                .querySelector<HTMLInputElement>(
                  '[data-review-id="mouse-gestures-enabled"] input',
                )
                ?.focus();
            } else if (scenario === "mouse-gestures-record") {
              const recordButton = document.querySelector<HTMLButtonElement>(
                '[data-review-id="mouse-gesture-record"]',
              );
              recordButton?.click();
              window.setTimeout(() => {
                document
                  .querySelector<HTMLElement>(
                    '[data-review-id="mouse-gesture-record-pad"]',
                  )
                  ?.focus();
              }, 80);
            }
          }, 160);
        };
        await openDirectory(fixtureDirectory);
        applyPreferencesScenarioState();
        openPreferencesSection();
        window.setTimeout(openPreferencesSection, 300);
        window.setTimeout(openPreferencesSection, 900);
        window.setTimeout(openPreferencesSection, 1500);
        window.setTimeout(openPreferencesSection, 2500);
        window.setTimeout(scrubKrokiPublicValues, 3200);
        window.setTimeout(scrubExternalPlantUmlValues, 3200);
        window.setTimeout(applyPreferencesScenarioState, 3500);
        window.setTimeout(scrubKrokiPublicValues, 4200);
        window.setTimeout(scrubExternalPlantUmlValues, 4200);
      }

      if (disposed) {
        return;
      }
    }

    void applyScenario().catch((error) => {
      console.error("site screenshot scenario failed", error);
    });

    return () => {
      disposed = true;
    };
  }, [
    documentPayload,
    closeAllTabs,
    dismissInlineNotice,
    openDirectory,
    openDocument,
    openPreferences,
    setConfig,
    setRootDirectory,
    setSidebarLayout,
    setZenModeActive,
    setRightSidebarTab,
    setSearchScope,
    compareDocumentPaths,
    showGitDiff,
    updateSearchQuery,
  ]);
}
