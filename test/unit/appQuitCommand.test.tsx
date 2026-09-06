import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultConfig } from "../../src/core/defaultConfig";
import { MockHostAdapter } from "../../src/adapters/mockHostAdapter";
import {
  useCommandDispatcher,
  type UseCommandDispatcherOptions,
} from "../../src/ui/hooks/useCommandDispatcher";
import { createReactRootHarness } from "./helpers/reactHarness";

function commandOptions(): UseCommandDispatcherOptions {
  return {
    config: defaultConfig,
    onQuitApp: vi.fn(),
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
    searchInputRef: { current: null },
    openFilesFilterInputRef: { current: null },
    viewerRef: { current: null },
    showInlineNotice: vi.fn(),
    showLightweightActionFeedback: vi.fn(),
  };
}
function Harness({ options }: { options: UseCommandDispatcherOptions }) {
  useCommandDispatcher(options);
  return <textarea aria-label="AI Chat input" />;
}

describe("application quit command", () => {
  let harness: ReturnType<typeof createReactRootHarness>;
  beforeEach(() => {
    harness = createReactRootHarness();
  });
  afterEach(() => {
    harness.cleanup();
    delete window.__SVARD_COMMANDS__;
    vi.restoreAllMocks();
  });

  it.each([false, true])(
    "is enabled without a document (Preferences open: %s) and preserves state",
    async (preferencesOpen) => {
      const host = new MockHostAdapter();
      const config = await host.loadConfig();
      const options = {
        ...commandOptions(),
        config,
        preferencesOpen,
        onQuitApp: () => host.quitApp(),
      };
      const before = structuredClone(config);
      harness.render(<Harness options={options} />);
      expect(
        window.__SVARD_COMMANDS__?.getCommandState("app.quit").enabled,
      ).toBe(true);
      await act(async () => {
        expect(await window.__SVARD_COMMANDS__?.dispatch("app.quit")).toEqual({
          status: "handled",
          commandId: "app.quit",
        });
      });
      expect(host.getQuitRequestCount()).toBe(1);
      expect(options.tabs).toEqual([]);
      expect(config).toEqual(before);
      expect(await host.loadConfig()).toEqual(before);
      expect(options.onCloseTab).not.toHaveBeenCalled();
      expect(options.onCloseAllTabs).not.toHaveBeenCalled();
      expect(options.onSaveConfig).not.toHaveBeenCalled();
      expect(options.onSetPreferencesOpen).not.toHaveBeenCalled();
    },
  );

  it("reports a safe error notice when the host rejects quitting", async () => {
    const options = commandOptions();
    options.onQuitApp = vi
      .fn()
      .mockRejectedValue(new Error("private runtime details"));
    harness.render(<Harness options={options} />);
    await act(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("app.quit");
    });
    expect(options.showInlineNotice).toHaveBeenCalledWith(
      "Unable to quit Svard.",
      { tone: "error" },
    );
    expect(options.onCloseAllTabs).not.toHaveBeenCalled();
  });

  it("does not quit through native command dispatch while recording a shortcut", async () => {
    const options = { ...commandOptions(), preferencesOpen: true };
    harness.render(<Harness options={options} />);
    const recording = document.createElement("span");
    recording.dataset.reviewId = "keybinding-recording";
    harness.container.append(recording);
    await act(async () => {
      expect(await window.__SVARD_COMMANDS__?.dispatch("app.quit")).toEqual({
        status: "disabled",
        commandId: "app.quit",
      });
    });
    expect(options.onQuitApp).not.toHaveBeenCalled();
    recording.remove();
    await act(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("app.quit");
    });
    expect(options.onQuitApp).toHaveBeenCalledTimes(1);
  });

  it("leaves open documents and saved reading sessions intact", async () => {
    const host = new MockHostAdapter();
    const config = await host.loadConfig();
    const documentPayload = await host.openDocument(
      "/workspace/docs/mvp-guide.adoc",
    );
    const options = {
      ...commandOptions(),
      config,
      documentPayload,
      tabs: [documentPayload],
      onQuitApp: () => host.quitApp(),
    };
    const before = structuredClone(config);
    const closeWindow = vi
      .spyOn(window, "close")
      .mockImplementation(() => undefined);
    harness.render(<Harness options={options} />);
    await act(async () => {
      await window.__SVARD_COMMANDS__?.dispatch("app.quit");
    });
    expect(host.getQuitRequestCount()).toBe(1);
    expect(options.tabs).toEqual([documentPayload]);
    expect(await host.loadConfig()).toEqual(before);
    expect(options.onCloseTab).not.toHaveBeenCalled();
    expect(options.onCloseAllTabs).not.toHaveBeenCalled();
    expect(options.onSaveConfig).not.toHaveBeenCalled();
    expect(closeWindow).not.toHaveBeenCalled();
  });

  it("honors configured and cleared quit shortcuts while typing, without taking other input shortcuts", async () => {
    vi.spyOn(window.navigator, "platform", "get").mockReturnValue("MacIntel");
    const options = commandOptions();
    options.config = structuredClone(defaultConfig);
    options.config.keybindings.mappings = [
      { commandId: "app.quit", keys: "Mod+Shift+Q" },
    ];
    options.preferencesOpen = true;
    harness.render(<Harness options={options} />);
    const input = harness.container.querySelector("textarea")!;
    const press = async (key: string, shiftKey = false) => {
      const event = new KeyboardEvent("keydown", {
        key,
        metaKey: true,
        shiftKey,
        bubbles: true,
        cancelable: true,
      });
      await act(async () => {
        input.dispatchEvent(event);
      });
      return event.defaultPrevented;
    };
    expect(await press("q")).toBe(false);
    expect(await press("q", true)).toBe(true);
    expect(options.onQuitApp).toHaveBeenCalledTimes(1);
    expect(await press("w")).toBe(false);
    options.config.keybindings.mappings = [{ commandId: "app.quit", keys: "" }];
    harness.render(<Harness options={options} />);
    expect(await press("q", true)).toBe(false);
    expect(options.onQuitApp).toHaveBeenCalledTimes(1);
  });
});
