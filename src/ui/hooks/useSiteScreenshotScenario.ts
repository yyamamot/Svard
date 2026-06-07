import {
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { AppConfig, DocumentPayload } from "../../core/types";
import type { RightSidebarTab, SearchScope } from "../types";

const envScreenshotScenario = import.meta.env.VITE_SVARD_SITE_SCREENSHOT_SCENARIO;
const envScreenshotFixture = import.meta.env.VITE_SVARD_SITE_SCREENSHOT_FIXTURE;
const screenshotScenarioIds = new Set([
  "hero-plantuml",
  "files",
  "reader-main",
  "search",
  "source-control",
  "rendered-diff",
  "kroki-fallback",
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
  setConfig: Dispatch<SetStateAction<AppConfig | null>>;
  setRootDirectory: Dispatch<SetStateAction<string>>;
  setSidebarLayout: Dispatch<SetStateAction<AppConfig["layout"]>>;
  setZenModeActive: Dispatch<SetStateAction<boolean>>;
  setRightSidebarTab: Dispatch<SetStateAction<RightSidebarTab>>;
  setSearchScope: (scope: SearchScope) => void;
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
  setConfig,
  setRootDirectory,
  setSidebarLayout,
  setZenModeActive,
  setRightSidebarTab,
  setSearchScope,
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
      const fixturePath = envScreenshotFixture || activePath || initialDocumentPath;

      if (scenario !== "files") {
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
        applyFilesState();
        window.setTimeout(applyFilesState, 300);
        window.setTimeout(applyFilesState, 900);
        window.setTimeout(applyFilesState, 1500);
        window.setTimeout(applyFilesState, 2500);
        window.setTimeout(applyFilesState, 3500);
      } else if (scenario === "navigation") {
        const fixtureDirectory = fixturePath.replace(/\/[^/]+$/, "");
        const referencePath = `${fixtureDirectory}/navigation-reference.md`;
        const bookmarksPath = `${fixtureDirectory}/navigation-bookmarks.md`;
        const openedAt = new Date().toISOString();

        await openDocument(referencePath);
        await openDocument(bookmarksPath);
        await openDocument(fixturePath);

        const applyNavigationState = () => {
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

        applyNavigationState();
        window.setTimeout(applyNavigationState, 300);
        window.setTimeout(applyNavigationState, 900);
        window.setTimeout(applyNavigationState, 1500);
      } else if (scenario === "source-control") {
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

        applySourceControlState();
        window.setTimeout(applySourceControlState, 300);
        window.setTimeout(applySourceControlState, 900);
        window.setTimeout(applySourceControlState, 1500);
      } else if (scenario === "rendered-diff") {
        await showGitDiff(fixturePath);
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
        scenario === "preferences" ||
        scenario === "privacy-boundary"
      ) {
        setConfig((current) =>
          current
            ? {
                ...current,
                sidebarVisible: false,
                rightSidebarVisible: false,
                kroki: {
                  ...current.kroki,
                  mode: scenario === "kroki-fallback" ? "remote" : current.kroki.mode,
                  endpointUrl:
                    scenario === "kroki-fallback"
                      ? "http://127.0.0.1:8000"
                      : current.kroki.endpointUrl,
                },
                mouseGestures: {
                  ...current.mouseGestures,
                  enabled: true,
                },
              }
            : current,
        );
        const targetLabel =
          scenario === "kroki-fallback"
            ? "Kroki"
            : scenario === "preferences"
              ? "Mouse Gestures"
              : "Security";
        const openPreferencesSection = () => {
          openPreferences();
          const button = Array.from(
            document.querySelectorAll<HTMLButtonElement>(
              '[data-review-id="preferences-nav-item"]',
            ),
          ).find((item) => item.textContent?.trim() === targetLabel);
          button?.click();
        };
        openPreferencesSection();
        window.setTimeout(openPreferencesSection, 300);
        window.setTimeout(openPreferencesSection, 900);
        window.setTimeout(openPreferencesSection, 1500);
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
    showGitDiff,
    updateSearchQuery,
  ]);
}
