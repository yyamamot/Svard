import { useRef } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultConfig } from "../../src/core/defaultConfig";
import { useCommandDispatcher } from "../../src/ui/hooks/useCommandDispatcher";
import { registerDocumentsPanelCommandBridge } from "../../src/ui/lib/documentsPanelCommandBridge";

describe("documents reveal current command", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    registerDocumentsPanelCommandBridge(null);
    container.remove();
    delete window.__SVARD_COMMANDS__;
  });

  function Harness({
    canSelectAntoraContext = false,
    onFeedback,
    onSelectAntoraContextCommand = vi.fn(),
  }: {
    canSelectAntoraContext?: boolean;
    onFeedback: (message: string) => void;
    onSelectAntoraContextCommand?: () => void;
  }) {
    const searchInputRef = useRef<HTMLInputElement | null>(null);
    const openFilesFilterInputRef = useRef<HTMLInputElement | null>(null);
    const viewerRef = useRef<HTMLElement | null>(null);
    useCommandDispatcher({
      config: defaultConfig,
      documentPayload: null,
      focusedPaneId: "left",
      lastClosedTabs: [],
      lastMouseGesture: null,
      navigationBackStack: [],
      navigationForwardStack: [],
      preferencesOpen: false,
      quickOpenOpen: false,
      splitEnabled: false,
      tabs: [],
      zenModeActive: false,
      canSwitchToRecentTab: false,
      canSelectAntoraContext,
      zenModeEscapeBlocked: false,
      onActivateRelativeTab: vi.fn(),
      onActivateTabByIndex: vi.fn(),
      onClearSearch: vi.fn(),
      onCloseSplitView: vi.fn(),
      onCloseAllTabs: vi.fn(),
      onCloseOtherTabs: vi.fn(),
      onCloseTab: vi.fn(),
      onCompareActiveWithPickedDocument: vi.fn(),
      onCompareGitRef: vi.fn(),
      onComparePickedDocuments: vi.fn(),
      onCopyHeadingLink: vi.fn(),
      onClearContentCursor: vi.fn(),
      onFocusPane: vi.fn(),
      onMoveContentCursor: vi.fn(() => false),
      onOpenFocusedLink: vi.fn(),
      onOpenWebsite: vi.fn(),
      onShowGitDiff: vi.fn(),
      onShowGitFileHistory: vi.fn(),
      onShowViewerShortcuts: vi.fn(),
      onOpenQuickOpen: vi.fn(),
      onOpenNewWindow: vi.fn(),
      onDuplicateWindow: vi.fn(),
      onOpenDocument: vi.fn(),
      onOpenCurrentDocumentInNewWindow: vi.fn(),
      onPickAndOpenDirectory: vi.fn(),
      onPickAndOpenDocument: vi.fn(),
      onSaveConfig: vi.fn(),
      onScrollViewer: vi.fn(),
      onSearchIndexChange: vi.fn(),
      onSetPreferencesOpen: vi.fn(),
      onSetRightSidebarTab: vi.fn(),
      onSetSidebarTab: vi.fn(),
      onSplitRight: vi.fn(),
      onToggleZenMode: vi.fn(),
      onExitZenMode: vi.fn(),
      onToggleActiveBookmark: vi.fn(),
      onAddCurrentFolderBookmark: vi.fn(),
      onTogglePinned: vi.fn(),
      onNavigateHistory: vi.fn(),
      onRestoreClosedTab: vi.fn(),
      onSwitchToRecentTab: vi.fn(),
      onSelectAntoraContextCommand,
      searchInputRef,
      openFilesFilterInputRef,
      viewerRef,
      showInlineNotice: vi.fn(),
      showLightweightActionFeedback: onFeedback,
    });
    return null;
  }

  it("enables and dispatches reveal current only when Docs order can reveal", async () => {
    const onReveal = vi.fn(() => true);
    const onFeedback = vi.fn();

    await act(async () => {
      root.render(<Harness onFeedback={onFeedback} />);
    });

    expect(
      window.__SVARD_COMMANDS__?.getCommandState("documents.revealCurrent")
        .enabled,
    ).toBe(false);
    await expect(
      window.__SVARD_COMMANDS__?.dispatch("documents.revealCurrent"),
    ).resolves.toEqual({
      status: "disabled",
      commandId: "documents.revealCurrent",
    });
    expect(onReveal).not.toHaveBeenCalled();

    await act(async () => {
      registerDocumentsPanelCommandBridge({
        collapseAllDocumentSections: vi.fn(),
        revealCurrentDocument: onReveal,
        canRevealCurrentDocument: () => true,
      });
    });

    expect(
      window.__SVARD_COMMANDS__?.getCommandState("documents.revealCurrent")
        .enabled,
    ).toBe(true);
    await expect(
      window.__SVARD_COMMANDS__?.dispatch("documents.revealCurrent"),
    ).resolves.toEqual({
      status: "handled",
      commandId: "documents.revealCurrent",
    });
    expect(onReveal).toHaveBeenCalledTimes(1);
    expect(onFeedback).toHaveBeenCalledWith("Revealed current document");
  });

  it("enables and dispatches Antora context selection only when multiple contexts exist", async () => {
    const onSelectAntoraContextCommand = vi.fn();

    await act(async () => {
      root.render(
        <Harness
          onFeedback={vi.fn()}
          onSelectAntoraContextCommand={onSelectAntoraContextCommand}
        />,
      );
    });
    expect(
      window.__SVARD_COMMANDS__?.getCommandState(
        "documents.selectAntoraContext",
      ).enabled,
    ).toBe(false);

    await act(async () => {
      root.render(
        <Harness
          canSelectAntoraContext
          onFeedback={vi.fn()}
          onSelectAntoraContextCommand={onSelectAntoraContextCommand}
        />,
      );
    });
    expect(
      window.__SVARD_COMMANDS__?.getCommandState(
        "documents.selectAntoraContext",
      ).enabled,
    ).toBe(true);
    await expect(
      window.__SVARD_COMMANDS__?.dispatch("documents.selectAntoraContext"),
    ).resolves.toEqual({
      status: "handled",
      commandId: "documents.selectAntoraContext",
    });
    expect(onSelectAntoraContextCommand).toHaveBeenCalledTimes(1);
  });
});
