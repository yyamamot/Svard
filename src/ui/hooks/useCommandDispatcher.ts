import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { RefObject } from "react";
import {
  commandDefinitions,
  isCommandId,
  type CommandDispatchResult,
  type CommandId,
} from "../../core/commands";
import { isSupportedDocumentPath } from "../../core/documentFormat";
import {
  detectPlatform,
  normalizeKeyboardEvent,
  resolveKeybinding,
} from "../../core/keybindings";
import type { AppConfig, DocumentPayload, GitRefKind } from "../../core/types";
import {
  canRevealCurrentDocumentInDocsOrder,
  getDocumentsPanelCommands,
  subscribeDocumentsPanelCommandBridge,
} from "../lib/documentsPanelCommandBridge";
import { fileName, isEditableTarget } from "../lib/path";
import type {
  MouseGestureAutomation,
  MouseNavigationAutomation,
  NavigationLocation,
  PaneId,
} from "../types";

declare global {
  interface Window {
    __SVARD_COMMANDS__?: SvardCommands;
  }
}

interface SvardCommands {
  listCommands(): typeof commandDefinitions;
  dispatch(commandId: string): Promise<CommandDispatchResult>;
  getCommandState(commandId: string): { enabled: boolean };
  getFocusedContext(): string;
  getLastCommand(): CommandId | null;
  getLastMouseGesture(): MouseGestureAutomation | null;
  getLastMouseNavigation(): MouseNavigationAutomation | null;
}

export interface UseCommandDispatcherOptions {
  config: AppConfig | null;
  documentPayload: DocumentPayload | null;
  focusedPaneId: PaneId;
  lastClosedTabs: DocumentPayload[];
  lastMouseGesture: MouseGestureAutomation | null;
  navigationBackStack: NavigationLocation[];
  navigationForwardStack: NavigationLocation[];
  preferencesOpen: boolean;
  quickOpenOpen: boolean;
  splitEnabled: boolean;
  tabs: DocumentPayload[];
  zenModeActive: boolean;
  canSwitchToRecentTab: boolean;
  zenModeEscapeBlocked: boolean;
  onActivateRelativeTab: (delta: number) => void;
  onActivateTabByIndex: (index: number) => void;
  onClearSearch: () => void | Promise<void>;
  onCloseSplitView: () => void;
  onCloseAllTabs: () => void;
  onCloseOtherTabs: (path: string) => void;
  onCloseTab: (path: string) => void;
  onCompareActiveWithPickedDocument: () => void | Promise<void>;
  onCompareGitRef: (kind: GitRefKind, path?: string) => void | Promise<void>;
  onComparePickedDocuments: () => void | Promise<void>;
  onCopyHeadingLink: () => void | Promise<void>;
  onClearContentCursor: () => void;
  onFocusPane: (paneId: PaneId) => void;
  onMoveContentCursor: (direction: "next" | "previous") => boolean;
  onOpenFocusedLink: () => void | Promise<void>;
  onOpenWebsite: () => void | Promise<void>;
  onShowGitDiff: (path?: string) => void | Promise<void>;
  onShowGitFileHistory: (path?: string) => void | Promise<void>;
  onShowViewerShortcuts: () => void;
  onOpenQuickOpen: () => void;
  onOpenNewWindow: () => Promise<void>;
  onDuplicateWindow: () => Promise<void>;
  onOpenDocument: (
    path: string,
    options?: { recordNavigation?: boolean; clearDocumentLinkCache?: boolean },
  ) => Promise<void>;
  onOpenCurrentDocumentInNewWindow: (path: string) => Promise<void>;
  onPickAndOpenDirectory: () => Promise<void>;
  onPickAndOpenDocument: () => Promise<void>;
  onSaveConfig: (config: AppConfig) => Promise<void>;
  onScrollViewer: (kind: "lineDown" | "lineUp" | "pageDown" | "pageUp") => void;
  onSearchIndexChange: (delta: number) => void;
  onSetPreferencesOpen: (open: boolean) => void;
  onSetRightSidebarTab: (tab: "contents" | "search") => void;
  onSetSidebarTab: (tab: AppConfig["workspace"]["sidebarTab"]) => Promise<void>;
  onSplitRight: () => void;
  onToggleZenMode: () => Promise<void>;
  onExitZenMode: () => Promise<void>;
  onToggleActiveBookmark: () => Promise<void>;
  onAddCurrentFolderBookmark: () => Promise<void>;
  onTogglePinned: (path: string) => void;
  onNavigateHistory: (direction: "back" | "forward") => Promise<void>;
  onRestoreClosedTab: () => void;
  onSwitchToRecentTab: () => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  openFilesFilterInputRef: RefObject<HTMLInputElement | null>;
  viewerRef: RefObject<HTMLElement | null>;
  showInlineNotice: (
    message: string,
    options?: { tone?: "info" | "success" | "warning" | "error" },
  ) => void;
  showLightweightActionFeedback: (message: string) => void;
}

export function useCommandDispatcher({
  config,
  documentPayload,
  focusedPaneId,
  lastClosedTabs,
  lastMouseGesture,
  navigationBackStack,
  navigationForwardStack,
  preferencesOpen,
  quickOpenOpen,
  splitEnabled,
  tabs,
  zenModeActive,
  canSwitchToRecentTab,
  zenModeEscapeBlocked,
  onActivateRelativeTab,
  onActivateTabByIndex,
  onClearSearch,
  onCloseSplitView,
  onCloseAllTabs,
  onCloseOtherTabs,
  onCloseTab,
  onCompareActiveWithPickedDocument,
  onCompareGitRef,
  onComparePickedDocuments,
  onCopyHeadingLink,
  onClearContentCursor,
  onFocusPane,
  onMoveContentCursor,
  onOpenFocusedLink,
  onOpenWebsite,
  onShowGitDiff,
  onShowGitFileHistory,
  onShowViewerShortcuts,
  onOpenQuickOpen,
  onOpenNewWindow,
  onDuplicateWindow,
  onOpenDocument,
  onOpenCurrentDocumentInNewWindow,
  onPickAndOpenDirectory,
  onPickAndOpenDocument,
  onSaveConfig,
  onScrollViewer,
  onSearchIndexChange,
  onSetPreferencesOpen,
  onSetRightSidebarTab,
  onSetSidebarTab,
  onSplitRight,
  onToggleZenMode,
  onExitZenMode,
  onToggleActiveBookmark,
  onAddCurrentFolderBookmark,
  onTogglePinned,
  onNavigateHistory,
  onRestoreClosedTab,
  onSwitchToRecentTab,
  searchInputRef,
  openFilesFilterInputRef,
  viewerRef,
  showInlineNotice,
  showLightweightActionFeedback,
}: UseCommandDispatcherOptions) {
  const pendingKeyRef = useRef<string | null>(null);
  const lastMouseNavigationEventRef = useRef<{
    button: 3 | 4;
    time: number;
  } | null>(null);
  const [lastCommand, setLastCommand] = useState<CommandId | null>(null);
  const [lastMouseNavigation, setLastMouseNavigation] =
    useState<MouseNavigationAutomation | null>(null);
  const canRevealCurrentDocument = useSyncExternalStore(
    subscribeDocumentsPanelCommandBridge,
    canRevealCurrentDocumentInDocsOrder,
    canRevealCurrentDocumentInDocsOrder,
  );

  function getFocusedContext(
    target: EventTarget | null = document.activeElement,
  ) {
    if (
      target instanceof HTMLElement &&
      target.closest('[data-review-id="search"]')
    ) {
      return "search";
    }
    if (isEditableTarget(target)) {
      return "textInput";
    }
    return "viewer";
  }

  function isCommandEnabled(commandId: CommandId): boolean {
    if (commandId === "tab.restoreClosed") {
      return lastClosedTabs.length > 0;
    }
    if (commandId === "tab.switchToRecent") {
      return canSwitchToRecentTab;
    }
    if (/^tab\.activate[1-8]$/.test(commandId)) {
      return tabs.length >= Number(commandId.at(-1));
    }
    if (commandId === "tab.activateLast") {
      return tabs.length > 0;
    }
    if (commandId === "tab.closeOthers") {
      if (!documentPayload) {
        return false;
      }
      return tabs.some(
        (tab) =>
          tab.path !== documentPayload.path &&
          !(config?.workspace.pinnedTabs ?? []).includes(tab.path),
      );
    }
    if (commandId === "tab.closeAll") {
      return tabs.length > 0 || preferencesOpen;
    }
    if (commandId.startsWith("tab.")) {
      return tabs.length > 0;
    }
    if (commandId === "heading.copyLink") {
      return Boolean(documentPayload);
    }
    if (commandId === "navigation.back") {
      return navigationBackStack.length > 0;
    }
    if (commandId === "navigation.forward") {
      return navigationForwardStack.length > 0;
    }
    if (commandId === "bookmark.toggleActive") {
      return Boolean(documentPayload);
    }
    if (commandId === "bookmark.addCurrentFolder") {
      return Boolean(config?.workspace.lastDirectory);
    }
    if (commandId === "documents.revealCurrent") {
      return canRevealCurrentDocument;
    }
    if (commandId === "viewer.reload" || commandId === "viewer.reloadForce") {
      return Boolean(documentPayload);
    }
    if (commandId === "viewer.showShortcuts") {
      return Boolean(documentPayload);
    }
    if (
      commandId === "git.showDiff" ||
      commandId === "git.showFileHistory" ||
      commandId === "git.compareWithBranch" ||
      commandId === "git.compareWithTag" ||
      commandId === "git.compareWithCommit"
    ) {
      return Boolean(
        documentPayload && isSupportedDocumentPath(documentPayload.path),
      );
    }
    if (commandId === "file.compareWithActive") {
      return Boolean(
        documentPayload && isSupportedDocumentPath(documentPayload.path),
      );
    }
    if (commandId === "file.compareFiles") {
      return true;
    }
    if (commandId === "window.new" || commandId === "window.duplicate") {
      return true;
    }
    if (commandId === "file.openCurrentInNewWindow") {
      return Boolean(documentPayload);
    }
    if (commandId === "view.splitRight") {
      return Boolean(documentPayload);
    }
    if (commandId === "view.closeSplit") {
      return splitEnabled;
    }
    if (commandId === "view.exitZenMode") {
      return zenModeActive;
    }
    if (commandId === "view.focusLeftPane") {
      return splitEnabled && focusedPaneId !== "left";
    }
    if (commandId === "view.focusRightPane") {
      return splitEnabled && focusedPaneId !== "right";
    }
    if (commandId === "preferences.close") {
      return preferencesOpen;
    }
    if (commandId === "link.openFocused") {
      return document.activeElement instanceof HTMLElement
        ? Boolean(document.activeElement.closest("a[href]"))
        : false;
    }
    return true;
  }

  async function dispatchCommand(
    commandId: CommandId,
  ): Promise<CommandDispatchResult> {
    if (!isCommandEnabled(commandId)) {
      return { status: "disabled", commandId };
    }

    setLastCommand(commandId);

    switch (commandId) {
      case "file.open":
        await onPickAndOpenDocument();
        break;
      case "folder.open":
        await onPickAndOpenDirectory();
        break;
      case "search.focus":
        onSetRightSidebarTab("search");
        if (config && !config.rightSidebarVisible) {
          await onSaveConfig({
            ...config,
            rightSidebarVisible: true,
          });
        }
        requestAnimationFrame(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        });
        break;
      case "search.next":
        onSetRightSidebarTab("search");
        onClearContentCursor();
        onSearchIndexChange(1);
        break;
      case "search.previous":
        onSetRightSidebarTab("search");
        onClearContentCursor();
        onSearchIndexChange(-1);
        break;
      case "search.clear":
        onSetRightSidebarTab("search");
        onClearContentCursor();
        void onClearSearch();
        searchInputRef.current?.blur();
        break;
      case "tab.next":
        onClearContentCursor();
        onActivateRelativeTab(1);
        break;
      case "tab.previous":
        onClearContentCursor();
        onActivateRelativeTab(-1);
        break;
      case "tab.close":
        if (documentPayload) {
          onClearContentCursor();
          onCloseTab(documentPayload.path);
        }
        break;
      case "tab.closeOthers":
        if (documentPayload) {
          onClearContentCursor();
          onCloseOtherTabs(documentPayload.path);
        }
        break;
      case "tab.closeAll":
        onClearContentCursor();
        onCloseAllTabs();
        break;
      case "tab.restoreClosed":
        onClearContentCursor();
        onRestoreClosedTab();
        break;
      case "tab.switchToRecent":
        onClearContentCursor();
        onSwitchToRecentTab();
        break;
      case "tab.togglePinned":
        if (documentPayload) {
          onTogglePinned(documentPayload.path);
        }
        break;
      case "tab.search":
        openFilesFilterInputRef.current?.focus();
        openFilesFilterInputRef.current?.select();
        break;
      case "tab.activate1":
        onClearContentCursor();
        onActivateTabByIndex(0);
        break;
      case "tab.activate2":
        onClearContentCursor();
        onActivateTabByIndex(1);
        break;
      case "tab.activate3":
        onClearContentCursor();
        onActivateTabByIndex(2);
        break;
      case "tab.activate4":
        onClearContentCursor();
        onActivateTabByIndex(3);
        break;
      case "tab.activate5":
        onClearContentCursor();
        onActivateTabByIndex(4);
        break;
      case "tab.activate6":
        onClearContentCursor();
        onActivateTabByIndex(5);
        break;
      case "tab.activate7":
        onClearContentCursor();
        onActivateTabByIndex(6);
        break;
      case "tab.activate8":
        onClearContentCursor();
        onActivateTabByIndex(7);
        break;
      case "tab.activateLast":
        onClearContentCursor();
        onActivateTabByIndex(tabs.length - 1);
        break;
      case "quickOpen.focus":
        onOpenQuickOpen();
        break;
      case "viewer.showShortcuts":
        onShowViewerShortcuts();
        break;
      case "help.openWebsite":
        try {
          await onOpenWebsite();
        } catch {
          showInlineNotice("Could not open Website", {
            tone: "error",
          });
        }
        break;
      case "navigation.back":
        onClearContentCursor();
        await onNavigateHistory("back");
        break;
      case "navigation.forward":
        onClearContentCursor();
        await onNavigateHistory("forward");
        break;
      case "bookmark.toggleActive":
        await onToggleActiveBookmark();
        break;
      case "bookmark.addCurrentFolder":
        await onAddCurrentFolderBookmark();
        break;
      case "documents.revealCurrent":
        if (getDocumentsPanelCommands()?.revealCurrentDocument()) {
          showLightweightActionFeedback("Revealed current document");
        }
        break;
      case "sidebar.showFiles":
        await onSetSidebarTab("files");
        break;
      case "sidebar.showBookmarks":
        await onSetSidebarTab("bookmarks");
        break;
      case "sidebar.toggleLeft":
        if (config) {
          await onSaveConfig({
            ...config,
            sidebarVisible: !config.sidebarVisible,
          });
        }
        break;
      case "sidebar.toggleRight":
        if (config) {
          await onSaveConfig({
            ...config,
            rightSidebarVisible: !config.rightSidebarVisible,
          });
        }
        break;
      case "view.splitRight":
        onSplitRight();
        showLightweightActionFeedback("Opened in split");
        break;
      case "view.closeSplit":
        onCloseSplitView();
        break;
      case "view.focusLeftPane":
        onFocusPane("left");
        break;
      case "view.focusRightPane":
        onFocusPane("right");
        break;
      case "view.toggleZenMode":
        await onToggleZenMode();
        break;
      case "view.exitZenMode":
        await onExitZenMode();
        break;
      case "preferences.open":
        onSetPreferencesOpen(true);
        break;
      case "preferences.close":
        onSetPreferencesOpen(false);
        break;
      case "theme.toggle":
        if (config) {
          await onSaveConfig({
            ...config,
            theme: config.theme === "light" ? "dark" : "light",
          });
        }
        break;
      case "viewer.reload":
        if (documentPayload) {
          await onOpenDocument(documentPayload.path, {
            clearDocumentLinkCache: true,
          });
        }
        break;
      case "viewer.reloadForce":
        if (documentPayload) {
          await onOpenDocument(documentPayload.path, {
            recordNavigation: false,
            clearDocumentLinkCache: true,
          });
          showInlineNotice(`${fileName(documentPayload.path)} force reloaded`, {
            tone: "success",
          });
        }
        break;
      case "git.showDiff":
        await onShowGitDiff(documentPayload?.path);
        break;
      case "git.showFileHistory":
        await onShowGitFileHistory(documentPayload?.path);
        break;
      case "git.compareWithBranch":
        await onCompareGitRef("branch", documentPayload?.path);
        break;
      case "git.compareWithTag":
        await onCompareGitRef("tag", documentPayload?.path);
        break;
      case "git.compareWithCommit":
        await onCompareGitRef("commit", documentPayload?.path);
        break;
      case "file.compareWithActive":
        await onCompareActiveWithPickedDocument();
        break;
      case "file.compareFiles":
        await onComparePickedDocuments();
        break;
      case "window.new":
        await onOpenNewWindow();
        showLightweightActionFeedback("Opened new window");
        break;
      case "window.duplicate":
        await onDuplicateWindow();
        showLightweightActionFeedback("Duplicated window");
        break;
      case "file.openCurrentInNewWindow":
        if (documentPayload) {
          await onOpenCurrentDocumentInNewWindow(documentPayload.path);
          showLightweightActionFeedback("Opened in new window");
        }
        break;
      case "viewer.scrollDown":
        onScrollViewer("lineDown");
        break;
      case "viewer.scrollUp":
        onScrollViewer("lineUp");
        break;
      case "viewer.contentCursor.next":
        requestAnimationFrame(() => onMoveContentCursor("next"));
        break;
      case "viewer.contentCursor.previous":
        requestAnimationFrame(() => onMoveContentCursor("previous"));
        break;
      case "viewer.pageDown":
        onScrollViewer("pageDown");
        break;
      case "viewer.pageUp":
        onScrollViewer("pageUp");
        break;
      case "viewer.top":
        viewerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
        break;
      case "viewer.bottom":
        viewerRef.current?.scrollTo({
          top: viewerRef.current.scrollHeight,
          behavior: "smooth",
        });
        break;
      case "zoom.in":
        if (config) {
          await onSaveConfig({
            ...config,
            zoom: Math.min(140, config.zoom + 10),
          });
        }
        break;
      case "zoom.out":
        if (config) {
          await onSaveConfig({
            ...config,
            zoom: Math.max(80, config.zoom - 10),
          });
        }
        break;
      case "zoom.reset":
        if (config) {
          await onSaveConfig({ ...config, zoom: 100 });
        }
        break;
      case "link.openFocused":
        await onOpenFocusedLink();
        break;
      case "heading.copyLink":
        await onCopyHeadingLink();
        break;
      default:
        return { status: "unknown", commandId };
    }

    return { status: "handled", commandId };
  }

  useEffect(() => {
    if (!config) {
      return;
    }

    const activeConfig = config;
    const platform = detectPlatform();
    function handleKeyDown(event: KeyboardEvent) {
      if (
        preferencesOpen &&
        document.querySelector(
          '[data-review-id="keybinding-recording"], [data-review-id="mouse-gesture-record-pad"]',
        )
      ) {
        return;
      }

      const context = getFocusedContext(event.target);
      if (context === "textInput") {
        return;
      }

      const key = normalizeKeyboardEvent(event);
      if (
        key === "Escape" &&
        zenModeActive &&
        activeConfig.zenMode.exitOnEscape &&
        !zenModeEscapeBlocked
      ) {
        event.preventDefault();
        event.stopPropagation();
        void dispatchCommand("view.exitZenMode");
        return;
      }
      const resolution = resolveKeybinding({
        preset: activeConfig.keybindings?.preset ?? "native",
        platform,
        key,
        context,
        pendingKey: pendingKeyRef.current,
        mappings: activeConfig.keybindings?.mappings,
      });
      pendingKeyRef.current = resolution.pendingKey ?? null;
      if (resolution.pendingKey) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (!resolution.commandId) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      void dispatchCommand(resolution.commandId);
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  });

  useEffect(() => {
    async function handleMouseNavigation(event: globalThis.MouseEvent) {
      if (event.button !== 3 && event.button !== 4) {
        return;
      }
      if (preferencesOpen || quickOpenOpen || isEditableTarget(event.target)) {
        return;
      }

      const button = event.button as 3 | 4;
      const now = performance.now();
      const last = lastMouseNavigationEventRef.current;
      if (last?.button === button && now - last.time < 120) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      lastMouseNavigationEventRef.current = { button, time: now };

      event.preventDefault();
      event.stopPropagation();

      const commandId: CommandId =
        button === 3 ? "navigation.back" : "navigation.forward";
      const result = await dispatchCommand(commandId);
      setLastMouseNavigation({
        button,
        commandId,
        status: result.status,
      });
    }

    window.addEventListener("mousedown", handleMouseNavigation, {
      capture: true,
    });
    window.addEventListener("auxclick", handleMouseNavigation, {
      capture: true,
    });
    return () => {
      window.removeEventListener("mousedown", handleMouseNavigation, {
        capture: true,
      });
      window.removeEventListener("auxclick", handleMouseNavigation, {
        capture: true,
      });
    };
  });

  useEffect(() => {
    const commands: SvardCommands = {
      listCommands: () => commandDefinitions,
      dispatch: (commandId) =>
        isCommandId(commandId)
          ? dispatchCommand(commandId)
          : Promise.resolve({
              status: "unknown",
              commandId,
            }),
      getCommandState: (commandId) => ({
        enabled: isCommandId(commandId) ? isCommandEnabled(commandId) : false,
      }),
      getFocusedContext: () => getFocusedContext(),
      getLastCommand: () => lastCommand,
      getLastMouseGesture: () => lastMouseGesture,
      getLastMouseNavigation: () => lastMouseNavigation,
    };
    window.__SVARD_COMMANDS__ = commands;

    return () => {
      delete window.__SVARD_COMMANDS__;
    };
  });

  return {
    dispatchCommand,
    isCommandEnabled,
    lastCommand,
    lastMouseNavigation,
  };
}
