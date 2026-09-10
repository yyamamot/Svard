import { afterEach, describe, expect, it, vi } from "vitest";
// @ts-expect-error UI assertion handlers are runtime JavaScript modules.
import { buildAppShellAssertions } from "../../scripts/ui-review/assertions/handlers/appShell.mjs";
// @ts-expect-error UI assertion handlers are runtime JavaScript modules.
import { buildAppShellCodexAssertions } from "../../scripts/ui-review/assertions/handlers/appShell/codex.mjs";
import {
  buildAppShellAgentOpenUiAssertions,
  buildAppShellAgentChatAssertions,
  // @ts-expect-error UI assertion handlers are runtime JavaScript modules.
} from "../../scripts/ui-review/assertions/handlers/appShell/agentChat.mjs";

// Existing report keys and order; extraction must not silently drop or overwrite assertions.
const expectedKeys = [
  "hasMacosMenuSettings",
  "hasAppQuit",
  "hasTabClose",
  "hasManyTabs",
  "hasManyTabsHorizontal",
  "hasPreferencesLayout",
  "hasPreferencesKrokiDiagnostic",
  "hasPreferencesKrokiSelfManaged",
  "hasPreferencesTab",
  "hasWindowLocalRecentTabs",
  "hasNewWindowRequest",
  "hasDuplicateWindowRequest",
  "hasRestoreAdditionalWindowsOptIn",
  "hasPreferencesZoomWheel",
  "hasMouseWheelZoom",
  "hasPreferencesSecurityPersistence",
  "hasPreferencesZenMode",
  "hasPreferencesStableSize",
  "hasPreferencesExperimental",
  "hasPreferencesRemoteProviders",
  "hasPreferencesDiagramsPolish",
  "hasPreferencesKeybindings",
  "hasPreferencesKeybindingsRecordCancel",
  "hasBrowserKeybindingTabs",
  "hasBrowserKeybindingNavigation",
  "hasBrowserMouseNavigation",
  "hasTopbarLayoutMenu",
  "hasCodexOpenUi",
  "hasCodexInitialSidebar",
  "hasCodexSplitBlock",
  "hasCodexFocusedResponse",
  "hasCodexPlainTextFallback",
  "hasCodexSidebarRestore",
  "hasAgentStage5",
  "hasOpenUiLimitDiagnostics",
  "hasOpenUiBasicProfileEvaluation",
  "hasSelectionExtraction",
  "hasAgentOutputHygiene",
  "hasAgentConversationUsability",
  "hasAgentRunningInputControl",
  "hasAgentDisconnectRecovery",
  "hasAgentChangeReview",
  "hasAgentImageInput",
  "hasAgentSelection",
  "hasPublicSiteAiChat",
  "hasAgentMediaContext",
  "hasAgentActiveFile",
  "hasAgentSessionManagement",
  "hasAgentWorkspaceIsolation",
  "hasAgentMainBottomDock",
  "hasAgentDetachedWindow",
  "hasAgentProviderSetup",
  "hasAgentComposerAccess",
  "hasAgentContextPressure",
  "hasAgentTokenDiagnostics",
  "hasAgentContextProfile",
  "hasSplitBasic",
  "hasSplitSearch",
  "hasSplitNavigation",
  "hasQuickOpen",
  "hasCommandPalette",
  "hasZenModePrototype",
  "hasViewerShortcutHintsCommand",
  "hasCommandPaletteHeadings",
  "hasCommandPaletteLineJump",
  "hasMouseGesturesDisabled",
  "hasMouseGesturesNavigation",
  "hasMouseGesturesTabs",
  "hasMouseGesturesCustomAssignment",
  "hasSearchControls",
  "hasSearchResultList",
  "hasSearchClearRemovesPinned",
  "hasBodySearchHighlights",
  "hasStableManualScrollDuringSearch",
  "hasSearchHitRuler",
  "hasRightSidebarTabs",
  "hasContentsLinkMap",
  "hasKeybindingsNative",
  "hasKeybindingsVim",
  "hasKeybindingsEmacs",
  "hasCommandAutomation",
];

function createContext(scenario: string) {
  return {
    scenario,
    bodyText: "",
    page: {
      evaluate: vi.fn(
        async (callback: (input?: string) => unknown, input?: string) =>
          callback(input),
      ),
      locator: vi.fn(() => {
        throw new Error("Unexpected DOM locator");
      }),
    },
  };
}

const sampleWindow = window as unknown as Record<string, unknown>;
const sampleNames = [
  "__SVARD_CODEX_OPENUI_CHECK__",
  "__SVARD_AGENT_ACTIVE_FILE_CHECK__",
  "__SVARD_AGENT_SELECTION_CHECK__",
];
afterEach(() => {
  for (const name of sampleNames) delete sampleWindow[name];
  document.body.innerHTML = "";
});

describe("App Shell assertion composition", () => {
  it("keeps every existing key and true defaults without browser work for unrelated scenarios", async () => {
    const context = createContext("unrelated-scenario");
    const assertions = await buildAppShellAssertions(context);
    expect(Object.keys(assertions)).toEqual(expectedKeys);
    expect(Object.values(assertions).every((value) => value === true)).toBe(
      true,
    );
    expect(context.page.evaluate).not.toHaveBeenCalled();
    expect(context.page.locator).not.toHaveBeenCalled();
  });

  it("evaluates Codex assertions sequentially and retains all six outcomes", async () => {
    document.body.innerHTML =
      '<div data-review-id="codex-main-split"></div><div data-review-id="codex-openui-response"></div>';
    sampleWindow.__SVARD_CODEX_OPENUI_CHECK__ = {
      documentWidth: 320,
      aiWidth: 350,
      initialRightSidebar: true,
      splitViewBlocked: true,
      focusedResponseVisible: true,
      plainTextFallback: true,
      rightSidebarRestored: true,
    };
    const context = createContext("viewer-codex-openui");
    const reads: string[] = [];
    let pending = false;
    context.page.evaluate.mockImplementation(async (callback, input) => {
      expect(pending).toBe(false);
      pending = true;
      await Promise.resolve();
      reads.push(callback.toString());
      pending = false;
      return callback(input);
    });
    const assertions = await buildAppShellAssertions(context);
    expect(Object.keys(assertions)).toEqual(expectedKeys);
    expect(Object.values(assertions).every((value) => value === true)).toBe(
      true,
    );
    expect(reads).toHaveLength(6);
    for (const [index, field] of [
      "documentWidth",
      "initialRightSidebar",
      "splitViewBlocked",
      "focusedResponseVisible",
      "plainTextFallback",
      "rightSidebarRestored",
    ].entries()) {
      expect(reads[index]).toContain(field);
    }
  });

  it("keeps missing active-path evidence undefined rather than coercing it to false", async () => {
    sampleWindow.__SVARD_AGENT_ACTIVE_FILE_CHECK__ = {
      initialFocusChipCount: 0,
      firstFocusCount: 0,
    };
    const result = await buildAppShellAgentChatAssertions(
      createContext("viewer-agent-chat-active-file"),
    );
    expect(result).toHaveProperty("hasAgentActiveFile");
    expect(result.hasAgentActiveFile).toBeUndefined();
  });

  it("requires math serialization only for the text-selection scenario", async () => {
    sampleWindow.__SVARD_AGENT_SELECTION_CHECK__ = {
      historySelections: 1,
      pendingSelections: 0,
      mixedContentOrder: true,
      mathSerialized: false,
    };
    const textResult = await buildAppShellAgentChatAssertions(
      createContext("viewer-agent-chat-selection"),
    );
    const imageResult = await buildAppShellAgentChatAssertions(
      createContext("viewer-agent-chat-selection-image"),
    );
    expect(textResult.hasAgentSelection).toBe(false);
    expect(imageResult.hasAgentSelection).toBe(true);
  });

  it("fails the applicable OpenUI or Codex check when its evidence is absent", async () => {
    const openUi = await buildAppShellAgentOpenUiAssertions(
      createContext("viewer-agent-chat-openui-limit-diagnostics"),
    );
    expect(openUi.hasAgentStage5).toBe(false);
    expect(openUi.hasOpenUiLimitDiagnostics).toBe(false);
    expect(openUi.hasOpenUiBasicProfileEvaluation).toBe(true);
    const codex = await buildAppShellCodexAssertions(
      createContext("viewer-codex-openui"),
    );
    expect(Object.values(codex).every((value) => value === false)).toBe(true);
  });
});
