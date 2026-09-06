import { settingsLabel } from "../lib/appLabels";
import { useMemo, type CSSProperties } from "react";
import type {
  AppConfig,
  DirectoryEntry,
  DocumentDiffPreview,
  DocumentPayload,
} from "../../core/types";
import { defaultConfig } from "../../core/defaultConfig";
import type {
  ContextMenuState,
  DiagramPreviewState,
  RecentlyVisitedLocation,
  WorkspaceTab,
} from "../types";
import {
  shouldHideDiffPreviewChromeForZenMode,
  shouldHideTopbarForZenMode,
  shouldShowZenModeExitControl,
} from "../lib/zenMode";
import { clampOpenFilesHeight } from "../lib/config";
import { fileName } from "../lib/path";

interface UseAppShellViewStateOptions {
  activeDocumentPayload: DocumentPayload | null;
  activeWorkspaceTabId: string | undefined;
  childrenByDirectory: Record<string, DirectoryEntry[]>;
  config: AppConfig | null;
  contextMenu: ContextMenuState | null;
  documentDiffPreview: DocumentDiffPreview | null;
  documentPayload: DocumentPayload | null;
  externalLinkConfirmation: unknown;
  fileComparePickerOpen: boolean;
  focusedPaneId: string;
  gitCommitDetails: unknown;
  gitRefPicker: unknown;
  isLoading: boolean;
  lastClosedTabs: DocumentPayload[];
  navigationBackStackLength: number;
  navigationForwardStackLength: number;
  orderedTabs: DocumentPayload[];
  paneSnapshots: {
    left: { documentPayload: DocumentPayload | null };
    right: { documentPayload: DocumentPayload | null };
  };
  pinnedTabs: string[];
  preferencesOpen: boolean;
  quickOpenOpen: boolean;
  recentlyVisitedLocations: RecentlyVisitedLocation[];
  rootDirectory: string;
  sidebarLayout: AppConfig["layout"];
  splitEnabled: boolean;
  splitRatio: number;
  viewerShortcutHintsOpen: boolean;
  workspaceTabs: WorkspaceTab[];
  zenModeActive: boolean;
  maxOpenFilesHeightForDisplay: () => number | undefined;
  diagramPreview: DiagramPreviewState | null;
}

export function useAppShellViewState({
  activeDocumentPayload,
  activeWorkspaceTabId,
  childrenByDirectory,
  config,
  contextMenu,
  documentDiffPreview,
  documentPayload,
  externalLinkConfirmation,
  fileComparePickerOpen,
  focusedPaneId,
  gitCommitDetails,
  gitRefPicker,
  isLoading,
  lastClosedTabs,
  navigationBackStackLength,
  navigationForwardStackLength,
  orderedTabs,
  paneSnapshots,
  pinnedTabs,
  preferencesOpen,
  quickOpenOpen,
  recentlyVisitedLocations,
  rootDirectory,
  sidebarLayout,
  splitEnabled,
  splitRatio,
  viewerShortcutHintsOpen,
  workspaceTabs,
  zenModeActive,
  maxOpenFilesHeightForDisplay,
  diagramPreview,
}: UseAppShellViewStateOptions) {
  const effectiveZenModeConfig = config?.zenMode ?? defaultConfig.zenMode;
  const zenModeApplies =
    zenModeActive &&
    !preferencesOpen &&
    !(documentDiffPreview && !effectiveZenModeConfig.applyToDiffPreview);
  const effectiveSidebarVisible =
    (config?.sidebarVisible ?? true) &&
    !(zenModeApplies && effectiveZenModeConfig.hideLeftSidebar);
  const effectiveRightSidebarVisible =
    (config?.rightSidebarVisible ?? true) &&
    !(zenModeApplies && effectiveZenModeConfig.hideRightSidebar);
  const zenModeBlockingOverlay = Boolean(
    preferencesOpen ||
    quickOpenOpen ||
    fileComparePickerOpen ||
    viewerShortcutHintsOpen ||
    diagramPreview ||
    documentDiffPreview ||
    externalLinkConfirmation ||
    gitCommitDetails ||
    gitRefPicker ||
    contextMenu,
  );
  const centeredContentWidth =
    zenModeApplies && effectiveZenModeConfig.centerLayout && !splitEnabled
      ? effectiveZenModeConfig.maxContentWidth
      : null;
  const topbarHidden = shouldHideTopbarForZenMode(
    zenModeApplies,
    effectiveZenModeConfig,
  );
  const diffPreviewChromeHidden = shouldHideDiffPreviewChromeForZenMode(
    zenModeApplies,
    effectiveZenModeConfig,
  );
  const showZenModeExitControl = shouldShowZenModeExitControl({
    blockingOverlay: zenModeBlockingOverlay,
    diffPreviewOpen: Boolean(documentDiffPreview),
    topbarHidden,
    zenModeApplies,
  });
  const activeTitle = preferencesOpen
    ? settingsLabel()
    : documentPayload
      ? fileName(documentPayload.path)
      : isLoading
        ? "Loading"
        : "Start";
  const rootEntries = childrenByDirectory[rootDirectory] ?? [];
  const appShellStyle = {
    "--left-sidebar-width": `${sidebarLayout.leftSidebarWidth}px`,
    "--right-sidebar-width": `${sidebarLayout.rightSidebarWidth}px`,
    "--zen-content-width": `${effectiveZenModeConfig.maxContentWidth}px`,
    "--open-files-height": `${clampOpenFilesHeight(
      sidebarLayout.openFilesHeight,
      maxOpenFilesHeightForDisplay(),
    )}px`,
    "--split-left-width": `${Math.round(splitRatio * 100)}%`,
  } as CSSProperties;
  const siteScreenshotScenario = import.meta.env
    .VITE_SVARD_SITE_SCREENSHOT_SCENARIO as string | undefined;
  const hasSiteScreenshotGitWorkspaceTab = orderedTabs.some((tab) =>
    tab.path.includes("/source-control-workspace/"),
  );
  const hideOpenFilesForSiteScreenshot = Boolean(
    hasSiteScreenshotGitWorkspaceTab &&
    (siteScreenshotScenario === "source-control" ||
      config?.workspace.sidebarTab === "sourceControl"),
  );
  const nativeAppMenuStateKey = useMemo(
    () =>
      JSON.stringify({
        activePath: activeDocumentPayload?.path ?? null,
        bookmarks: (config?.workspace.bookmarks ?? []).map(
          (bookmark) => `${bookmark.kind}:${bookmark.path}`,
        ),
        keybindings: config?.keybindings ?? null,
        lastClosed: lastClosedTabs.map((tab) => tab.path),
        navigationBack: navigationBackStackLength,
        navigationForward: navigationForwardStackLength,
        openTabs: orderedTabs.map((tab) => tab.path),
        pinnedTabs,
        recentTabs: config?.workspace.recentTabs ?? [],
        preferencesOpen,
        recentDirectories: config?.workspace.recentDirectories ?? [],
        recentDocuments: config?.workspace.recentDocuments ?? [],
        recentlyVisited: recentlyVisitedLocations.map(
          (location) =>
            `${location.path}:${location.headingId ?? ""}:${location.label ?? ""}:${location.visitedAt}`,
        ),
        rightSidebarVisible: config?.rightSidebarVisible ?? false,
        rootDirectory,
        sidebarVisible: config?.sidebarVisible ?? false,
        splitEnabled,
        zenModeActive,
      }),
    [
      activeDocumentPayload?.path,
      config,
      lastClosedTabs,
      navigationBackStackLength,
      navigationForwardStackLength,
      orderedTabs,
      pinnedTabs,
      preferencesOpen,
      recentlyVisitedLocations,
      rootDirectory,
      splitEnabled,
      zenModeActive,
    ],
  );

  return {
    activeTitle,
    appShellStyle,
    centeredContentWidth,
    diffPreviewChromeHidden,
    effectiveRightSidebarVisible,
    effectiveSidebarVisible,
    hideOpenFilesForSiteScreenshot,
    nativeAppMenuStateKey,
    rootEntries,
    showZenModeExitControl,
    topbarHidden,
    zenModeApplies,
    zenModeConfig: effectiveZenModeConfig,
    zenModeBlockingOverlay,
    activeWorkspaceTabId,
    paneSnapshots,
    focusedPaneId,
    workspaceTabs,
  };
}
