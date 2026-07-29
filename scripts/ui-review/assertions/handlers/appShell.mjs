import { buildAppShellPreferencesAssertions } from "./appShell/preferences.mjs";

export async function buildAppShellAssertions(context) {
  const scenario = context.scenario;
  const page = context.page;
  const bodyText = context.bodyText;
  const commandAutomation = context.commandAutomation;
  const geometryReviewIds = context.geometryReviewIds;
  const searchManualScrollStable = context.searchManualScrollStable;
  return {
    hasTabClose:
      scenario === "viewer-basic" || scenario === "viewer-files"
        ? (await page.locator('[data-review-id="tab-close"]').count()) > 0 ||
          (await page.locator('[data-review-id="open-file-close"]').count()) > 0
        : true,
    hasManyTabs:
      scenario === "viewer-many-tabs"
        ? (await page.locator('[data-review-id="tab-bar"]').count()) === 0 &&
          (await page.locator('[data-review-id="tab-more"]').count()) === 0 &&
          (await page.locator('[data-review-id="active-tab"]').count()) === 0 &&
          (await page
            .locator('[data-review-id="active-document-title"]')
            .count()) === 1 &&
          (await page.locator('[data-review-id="open-files"]').count()) > 0 &&
          (await page.locator('[data-review-id="open-file-item"]').count()) >=
            7 &&
          (await page
            .locator('[data-review-id="open-files-close-others"]')
            .count()) === 0 &&
          (await page
            .locator('[data-review-id="open-files-close-all"]')
            .count()) === 0 &&
          (await page
            .locator('[data-review-id="open-files-collapse"]')
            .count()) === 1 &&
          bodyText.includes("preferences.adoc")
        : true,
    hasManyTabsHorizontal:
      scenario === "viewer-many-tabs-horizontal"
        ? (await page.locator('[data-review-id="left-sidebar"]').count()) ===
            0 &&
          (await page.locator('[data-review-id="open-files"]').count()) === 0 &&
          (await page.locator('[data-review-id="tab-bar"]').count()) === 1 &&
          (await page.locator('[data-review-id="tab-more"]').count()) > 0 &&
          (await page.locator('[data-review-id="active-tab"]').count()) === 1
        : true,
    ...(await buildAppShellPreferencesAssertions(context)),
    hasBrowserKeybindingTabs:
      scenario === "viewer-browser-keybindings-tabs"
        ? bodyText.includes("Render Fixtures") &&
          (await page
            .locator('[data-review-id="active-document-title"]')
            .filter({ hasText: "render-fixtures.adoc" })
            .count()) === 1 &&
          commandAutomation.availableCommands.includes("tab.restoreClosed") &&
          commandAutomation.availableCommands.includes("tab.activateLast")
        : true,
    hasBrowserKeybindingNavigation:
      scenario === "viewer-browser-keybindings-navigation"
        ? bodyText.includes("Quick Start") &&
          commandAutomation.availableCommands.includes("navigation.back") &&
          commandAutomation.availableCommands.includes("navigation.forward")
        : true,
    hasBrowserMouseNavigation:
      scenario === "viewer-browser-mouse-navigation"
        ? commandAutomation.lastMouseNavigation?.button === 4 &&
          commandAutomation.lastMouseNavigation?.commandId ===
            "navigation.forward" &&
          commandAutomation.lastMouseNavigation?.status === "handled" &&
          !commandAutomation.disabledCommands.includes("navigation.back")
        : true,
    hasTopbarLayoutMenu:
      scenario === "viewer-topbar-direct-layout-controls"
        ? await page.evaluate(() => {
            const sample = window.__SVARD_LAYOUT_MENU_CHECK__ ?? {};
            return (
              sample.triggerCount === 0 &&
              sample.menuCount === 0 &&
              sample.historyTriggerCount === 0 &&
              sample.splitButtonCount === 1 &&
              sample.zenButtonCount === 1 &&
              sample.leftToggleCount === 1 &&
              sample.rightToggleCount === 1 &&
              sample.quickOpenTriggerCount === 0 &&
              sample.preferencesButtonCount === 0 &&
              sample.leftSidebarCount === 0 &&
              sample.splitChecked === "true" &&
              sample.zenChecked === "false" &&
              sample.leftChecked === "false" &&
              sample.rightChecked === "true"
            );
          })
        : true,
    hasCodexOpenUi:
      scenario === "viewer-codex-openui" ||
      scenario === "viewer-codex-multifile"
        ? await page.evaluate(() => {
            if (
              window.__SVARD_CODEX_MULTIFILE_CHECK__ &&
              !window.__SVARD_CODEX_OPENUI_CHECK__
            ) {
              const result = window.__SVARD_CODEX_MULTIFILE_CHECK__;
              return (
                result.currentDocumentPending === true &&
                result.readOnlyDefault === true &&
                result.settingsRequireNewChat === true &&
                result.executionSettingsApplied === true &&
                result.dangerConfirmationShown === true &&
                result.dangerCancelKeptWorkspaceWrite === true &&
                result.initialComposerBottomAligned === true &&
                result.sharedCount === 4 &&
                result.contextCountAfterSwitch === 4 &&
                result.internalDragAdded === true &&
                result.internalDragPreviewVisible === true &&
                result.internalDropTargetVisible === true &&
                result.nativeDropAdded === true &&
                result.newChatAvailable === true &&
                result.staleBlocked === true &&
                result.unsupportedRejected === true &&
                document.querySelectorAll(
                  '[data-review-id="codex-openui-response"]',
                ).length >= 1
              );
            }
            const result = window.__SVARD_CODEX_OPENUI_CHECK__;
            return (
              result?.documentWidth >= 300 &&
              result?.aiWidth >= 320 &&
              document.querySelectorAll('[data-review-id="codex-main-split"]')
                .length === 1 &&
              document.querySelectorAll(
                '[data-review-id="codex-openui-response"]',
              ).length >= 1 &&
              document.querySelectorAll('[data-review-id="right-sidebar"]')
                .length === 0
            );
          })
        : true,
    hasCodexInitialSidebar:
      scenario === "viewer-codex-openui" ||
      scenario === "viewer-codex-multifile"
        ? await page.evaluate(
            () =>
              (
                window.__SVARD_CODEX_OPENUI_CHECK__ ??
                window.__SVARD_CODEX_MULTIFILE_CHECK__
              )?.initialRightSidebar === true,
          )
        : true,
    hasCodexSplitBlock:
      scenario === "viewer-codex-openui"
        ? await page.evaluate(
            () =>
              window.__SVARD_CODEX_OPENUI_CHECK__?.splitViewBlocked === true,
          )
        : true,
    hasCodexFocusedResponse:
      scenario === "viewer-codex-openui" ||
      scenario === "viewer-codex-multifile"
        ? await page.evaluate(
            () =>
              (
                window.__SVARD_CODEX_OPENUI_CHECK__ ??
                window.__SVARD_CODEX_MULTIFILE_CHECK__
              )?.focusedResponseVisible === true,
          )
        : true,
    hasCodexPlainTextFallback:
      scenario === "viewer-codex-openui"
        ? await page.evaluate(
            () =>
              window.__SVARD_CODEX_OPENUI_CHECK__?.plainTextFallback === true,
          )
        : true,
    hasCodexSidebarRestore:
      scenario === "viewer-codex-openui" ||
      scenario === "viewer-codex-multifile"
        ? await page.evaluate(
            () =>
              (
                window.__SVARD_CODEX_OPENUI_CHECK__ ??
                window.__SVARD_CODEX_MULTIFILE_CHECK__
              )?.rightSidebarRestored === true,
          )
        : true,
    hasAgentStage5:
      scenario === "viewer-agent-chat-streaming" ||
      scenario === "viewer-agent-chat-approval" ||
      scenario === "viewer-agent-chat-openui" ||
      scenario === "viewer-agent-chat-openui-exploration" ||
      scenario === "viewer-agent-chat-openui-basic-review" ||
      scenario === "viewer-agent-chat-openui-basic-gallery" ||
      scenario === "viewer-agent-chat-openui-basic-balanced" ||
      scenario === "viewer-agent-chat-openui-basic-lean" ||
      scenario === "viewer-agent-chat-openui-component-challengers" ||
      scenario === "viewer-agent-chat-image-input" ||
      scenario === "viewer-agent-chat-activity" ||
      scenario === "viewer-agent-chat-output-hygiene" ||
      scenario === "viewer-agent-chat-markdown-answer" ||
      scenario === "viewer-agent-chat-conversation-usability" ||
      scenario === "viewer-agent-chat-running-input-control" ||
      scenario === "viewer-agent-chat-change-review" ||
      scenario === "viewer-agent-chat-selection" ||
      scenario === "viewer-agent-chat-selection-image" ||
      scenario === "viewer-agent-chat-active-file" ||
      scenario === "viewer-agent-chat-session-management" ||
      scenario === "viewer-agent-chat-workspace-isolation" ||
      scenario === "viewer-agent-chat-main-bottom-dock" ||
      scenario === "viewer-agent-chat-dark-theme" ||
      scenario === "viewer-agent-chat-composer-access" ||
      scenario === "viewer-agent-chat-context-pressure" ||
      scenario === "viewer-agent-chat-token-diagnostics" ||
      scenario === "viewer-agent-chat-context-profile"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_STAGE5_CHECK__;
            return (
              result?.initialRightSidebar === true &&
              result?.composerBottomAligned === true &&
              result?.compactComposerBottomAligned === true &&
              result?.currentActivityVisible === true &&
              result?.darkControlsThemed === true &&
              result?.reasoningVisible === true &&
              result?.toolVisible === true &&
              result?.approvalResolved === true &&
              result?.activityFailureVisible === true &&
              result?.emptyActivityHidden === true &&
              result?.openUiVisible === true &&
              result?.openUiEvaluationVisible === true &&
              result?.explorationInteraction === true &&
              result?.groupedReadActivity === true &&
              result?.rightSidebarRestored === true
            );
          })
        : true,
    hasOpenUiBasicProfileEvaluation:
      scenario === "viewer-agent-chat-openui-basic-review" ||
      scenario === "viewer-agent-chat-openui-basic-gallery" ||
      scenario === "viewer-agent-chat-openui-basic-balanced" ||
      scenario === "viewer-agent-chat-openui-basic-lean" ||
      scenario === "viewer-agent-chat-openui-component-challengers"
        ? await page.evaluate(
            () =>
              window.__SVARD_AGENT_STAGE5_CHECK__?.openUiEvaluationVisible ===
                true &&
              window.__SVARD_AGENT_STAGE5_CHECK__
                ?.openUiEvaluationWideLayout === true,
          )
        : true,
    hasSelectionExtraction:
      scenario === "viewer-selection-extraction"
        ? await page.evaluate(() => {
            const result = window.__SVARD_SELECTION_EXTRACTION_CHECK__;
            return (
              result?.inspectorVisible === true &&
              result?.toolbarVisible === true &&
              result?.toolbarAvoidsSelection === true
            );
          })
        : true,
    hasAgentOutputHygiene:
      scenario === "viewer-agent-chat-output-hygiene"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_OUTPUT_HYGIENE_CHECK__;
            return (
              result?.hasOpenUiRoot === false &&
              result?.hasInternalMemory === false &&
              result?.hasZeroDuration === false &&
              result?.emptyDetails === 0 &&
              result?.workspaceReadVisible === true
            );
          })
        : true,
    hasAgentConversationUsability:
      scenario === "viewer-agent-chat-conversation-usability"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_USABILITY_CHECK__;
            return (
              result?.restoredInput === true &&
              result?.markdownCopied === true &&
              result?.codeCopied === true &&
              result?.rawDslCopied === false &&
              result?.newActivityVisible === true &&
              result?.jumpedToLatest === true &&
              result?.turnCount === 3
            );
          })
        : true,
    hasAgentRunningInputControl:
      scenario === "viewer-agent-chat-running-input-control"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_RUNNING_INPUT_CHECK__;
            return (
              result?.steeredVisible === true && result?.queuedTurnCount >= 2
            );
          })
        : true,
    hasAgentChangeReview:
      scenario === "viewer-agent-chat-change-review"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_CHANGE_REVIEW_CHECK__;
            return (
              result?.chatMaintained === true && result?.fivePaths === true
            );
          })
        : true,
    hasAgentImageInput:
      scenario === "viewer-agent-chat-image-input"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_IMAGE_CHECK__;
            return (
              result?.attachedBeforeRemove === 3 &&
              result?.attachedAfterRemove === 2 &&
              result?.attachedWhileWorking === true &&
              result?.internalDragPreviewVisible === true &&
              result?.historyImages === 3 &&
              result?.pendingImages === 0
            );
          })
        : true,
    hasAgentSelection:
      scenario === "viewer-agent-chat-selection" ||
      scenario === "viewer-agent-chat-selection-image"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_SELECTION_CHECK__;
            return (
              result?.historySelections === 1 &&
              result?.pendingSelections === 0 &&
              result?.mixedContentOrder === true
            );
          })
        : true,
    hasAgentMediaContext:
      scenario === "viewer-agent-chat-media-context"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_MEDIA_CHECK__;
            return (
              result?.historyMedia === true &&
              result?.pendingMedia === 0 &&
              result?.hasLocation === true &&
              result?.hasDiagramSource === true &&
              result?.ordered === true
            );
          })
        : true,
    hasAgentActiveFile:
      scenario === "viewer-agent-chat-active-file"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_ACTIVE_FILE_CHECK__;
            return (
              result?.initialFocusChipCount === 0 &&
              result?.firstFocusCount === 0 &&
              result?.firstActivePath?.endsWith("/docs/mvp-guide.adoc") &&
              result?.secondActivePath?.endsWith(
                "/docs/render-fixtures.adoc",
              ) &&
              result?.secondFocusCount === 1 &&
              typeof result?.secondFocusPath === "string" &&
              result.secondFocusPath !== result.secondActivePath
            );
          })
        : true,
    hasAgentSessionManagement:
      scenario === "viewer-agent-chat-session-management"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_SESSION_MANAGEMENT_CHECK__;
            return (
              result?.automaticTitleVisible === true &&
              result?.currentNamed === true &&
              result?.deleteConfirmation === true &&
              result?.readOnlyHistory === true &&
              result?.searchControlsHidden === true
            );
          })
        : true,
    hasAgentWorkspaceIsolation:
      scenario === "viewer-agent-chat-workspace-isolation"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_WORKSPACE_ISOLATION_CHECK__;
            return (
              result?.darkThemeMaintained === true &&
              result?.draftCleared === true &&
              result?.newConversationStarted === true &&
              result?.oldConversationCleared === true &&
              result?.panelMaintained === true
            );
          })
        : true,
    hasAgentMainBottomDock:
      scenario === "viewer-agent-chat-main-bottom-dock"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_MAIN_BOTTOM_DOCK_CHECK__;
            return (
              result?.bottomPlacement === true &&
              result?.bottomRestored === true &&
              result?.compactLayoutValid === true &&
              result?.darkThemeMaintained === true &&
              result?.diffDrawerMaintained === true &&
              result?.draftPreserved === true &&
              result?.resized === true &&
              result?.rightPlacementMaintained === true &&
              result?.rightSidebarHidden === true &&
              result?.splitReopenMaintained === true &&
              result?.splitViewMaintained === true &&
              result?.streamingMoveMaintained === true
            );
          })
        : true,
    hasAgentComposerAccess:
      scenario === "viewer-agent-chat-composer-access"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_COMPOSER_ACCESS_CHECK__;
            return (
              result?.bottomMaintained === true &&
              result?.darkThemeMaintained === true &&
              result?.diffMaintained === true &&
              result?.draftPreserved === true &&
              result?.focusRestored === true &&
              result?.headerControlRemoved === true &&
              result?.initialObserve === true &&
              result?.insideViewport === true &&
              result?.opensAbove === true &&
              result?.popoverStayedOpen === true &&
              result?.rightMaintained === true &&
              result?.toolbarBelowInput === true
            );
          })
        : true,
    hasAgentContextPressure:
      scenario === "viewer-agent-chat-context-pressure"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_CONTEXT_PRESSURE_CHECK__;
            return (
              result?.automaticNoticeVisible === true &&
              result?.bottomMaintained === true &&
              result?.diffMaintained === true &&
              result?.draftPreserved === true &&
              result?.exactUsageVisible === true &&
              result?.gettingFullVisible === true &&
              result?.manualResultVisible === true &&
              result?.nearlyFullVisible === true &&
              result?.normalVisible === true &&
              result?.rightMaintained === true &&
              result?.sendSuppressed === true
            );
          })
        : true,
    hasAgentTokenDiagnostics:
      scenario === "viewer-agent-chat-token-diagnostics"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_TOKEN_DIAGNOSTICS_CHECK__;
            return (
              result?.bottomMaintained === true &&
              result?.compactReachable === true &&
              result?.comparisonVisible === true &&
              result?.darkThemeMaintained === true &&
              result?.diffMaintained === true &&
              result?.exactValuesVisible === true &&
              result?.insideCompactViewport === true &&
              result?.provenanceVisible === true
            );
          })
        : true,
    hasAgentContextProfile:
      scenario === "viewer-agent-chat-context-profile"
        ? await page.evaluate(() => {
            const result = window.__SVARD_AGENT_CONTEXT_PROFILE_CHECK__;
            return (
              result?.bottomMaintained === true &&
              result?.boundaryVisible === true &&
              result?.darkThemeMaintained === true &&
              result?.diffMaintained === true &&
              result?.draftPreserved === true &&
              result?.focusedVisible === true &&
              result?.insideViewport === true &&
              result?.opensAbove === true &&
              result?.providerExtensionsSelected === true &&
              result?.rightMaintained === true
            );
          })
        : true,
    hasSplitBasic:
      scenario === "viewer-split-basic"
        ? (await page.locator('[data-review-id="viewer-split"]').count()) ===
            1 &&
          (await page.locator('[data-review-id="document-viewer"]').count()) ===
            1 &&
          (await page
            .locator('[data-review-id="document-viewer-secondary"]')
            .count()) === 1 &&
          (await page.locator('[data-pane-id="right"].focused').count()) ===
            1 &&
          bodyText.includes("Render Fixtures") &&
          commandAutomation.availableCommands.includes("view.splitRight") &&
          commandAutomation.availableCommands.includes("view.closeSplit")
        : true,
    hasSplitSearch:
      scenario === "viewer-split-search"
        ? (await page.locator('[data-review-id="viewer-split"]').count()) ===
            1 &&
          (await page
            .locator('[data-review-id="search-result-item"]')
            .count()) > 0 &&
          (await page.locator('[data-pane-id="right"].focused').count()) === 1
        : true,
    hasSplitNavigation:
      scenario === "viewer-split-navigation"
        ? (await page.locator('[data-review-id="viewer-split"]').count()) ===
            1 &&
          !commandAutomation.disabledCommands.includes("navigation.forward") &&
          commandAutomation.availableCommands.includes("view.focusLeftPane") &&
          commandAutomation.availableCommands.includes("view.focusRightPane")
        : true,
    hasQuickOpen:
      scenario === "viewer-quick-open"
        ? bodyText.includes("Quick Start") &&
          (await page.locator('[data-review-id="quick-open"]').count()) === 0 &&
          !geometryReviewIds.has("quick-open-trigger") &&
          (await page.evaluate(() =>
            Boolean(window.__SVARD_QUICK_OPEN_HINTS_SEEN__),
          )) &&
          (await page.evaluate(() =>
            Boolean(window.__SVARD_QUICK_OPEN_CLOSE_SEEN__),
          )) &&
          commandAutomation.availableCommands.includes("quickOpen.focus") &&
          commandAutomation.availableCommands.includes("bookmark.toggleActive")
        : true,
    hasCommandPalette:
      scenario === "viewer-command-palette"
        ? (await page.locator('[data-review-id="quick-open"]').count()) === 0 &&
          (await page
            .locator('[data-review-id="right-sidebar-tab-search"].active')
            .count()) === 1 &&
          commandAutomation.lastCommand === "search.focus" &&
          commandAutomation.availableCommands.includes("search.focus")
        : true,
    hasZenModePrototype:
      scenario === "viewer-zen-mode-prototype"
        ? (await page.evaluate(() => {
            const result = window.__SVARD_ZEN_MODE_CHECK__;
            return (
              result?.active === true &&
              result?.leftSidebarCount === 0 &&
              result?.rightSidebarCount === 0 &&
              result?.topbarCount === 0 &&
              result?.tabBarCount === 0 &&
              result?.activeTitleCount === 0 &&
              result?.quickOpenTriggerCount === 0 &&
              result?.inlineNoticeCount === 0 &&
              result?.exitControlCount === 1 &&
              result?.documentViewerHeight > result?.viewportHeight * 0.7 &&
              result?.documentBodyWidth > 0 &&
              result?.documentBodyWidth <= 980 &&
              result?.documentBodyWidth < result?.viewportWidth &&
              window.__SVARD_ZEN_MODE_EXIT_CHECK__?.activeAfterExit === false &&
              window.__SVARD_ZEN_MODE_EXIT_CHECK__
                ?.exitControlCountAfterExit === 0 &&
              window.__SVARD_ZEN_MODE_EXIT_CHECK__?.exitCommandObserved === true
            );
          })) &&
          commandAutomation.availableCommands.includes("view.toggleZenMode") &&
          commandAutomation.availableCommands.includes("view.exitZenMode")
        : true,
    hasViewerShortcutHintsCommand:
      scenario === "viewer-shortcut-gesture-hints-command"
        ? await page.evaluate(() => {
            const result = window.__SVARD_VIEWER_SHORTCUT_HINTS_CHECK__;
            const text = result?.text ?? "";
            return (
              text.includes("Shortcuts and Gestures") &&
              text.includes("Keyboard") &&
              text.includes("Mouse Gestures") &&
              text.includes("Quick Open") &&
              text.includes("Focus Search") &&
              text.includes("Next Content Block") &&
              text.includes("Navigate Back") &&
              text.includes("Mouse Gestures disabled") &&
              result?.triggerCount === 0 &&
              result?.panelCountAfterClose === 0
            );
          })
        : true,
    hasCommandPaletteHeadings:
      scenario === "viewer-command-palette-headings"
        ? (await page
            .locator('[data-review-id="toc"] a.active')
            .filter({ hasText: "Search" })
            .count()) === 1
        : true,
    hasCommandPaletteLineJump:
      scenario === "viewer-command-palette-line-jump"
        ? (await page.evaluate(() =>
            Boolean(window.__SVARD_LINE_JUMP_SEEN__),
          )) &&
          bodyText.includes("Reader Workflow") &&
          (await page.locator('[data-review-id="quick-open"]').count()) === 0
        : true,
    hasMouseGesturesDisabled:
      scenario === "viewer-mouse-gestures-disabled"
        ? bodyText.includes("Quick Start") &&
          commandAutomation.lastMouseGesture === null
        : true,
    hasMouseGesturesNavigation:
      scenario === "viewer-mouse-gestures-navigation"
        ? bodyText.includes("Quick Start") &&
          commandAutomation.lastMouseGesture?.pattern === "Right" &&
          commandAutomation.lastMouseGesture?.commandId ===
            "navigation.forward" &&
          commandAutomation.lastMouseGesture?.status === "handled"
        : true,
    hasMouseGesturesTabs:
      scenario === "viewer-mouse-gestures-tabs"
        ? bodyText.includes("Preferences Defaults") &&
          commandAutomation.lastMouseGesture?.pattern === "Down Left" &&
          commandAutomation.lastMouseGesture?.commandId ===
            "tab.restoreClosed" &&
          commandAutomation.lastMouseGesture?.status === "handled"
        : true,
    hasMouseGesturesCustomAssignment:
      scenario === "viewer-mouse-gestures-custom-assignment"
        ? commandAutomation.lastMouseGesture?.pattern === "Down Up" &&
          commandAutomation.lastMouseGesture?.commandId === "quickOpen.focus" &&
          commandAutomation.lastMouseGesture?.status === "handled"
        : true,
    hasSearchControls:
      scenario === "viewer-search" ||
      scenario === "viewer-search-hit-ruler" ||
      scenario === "viewer-search-clear-pinned" ||
      scenario === "viewer-keybindings-native" ||
      scenario === "viewer-right-sidebar-tabs"
        ? await (async () => {
            const searchText =
              (await page.locator('[data-review-id="search"]').textContent()) ??
              "";
            const pinLabel =
              (await page
                .locator('[data-review-id="search-pin"]')
                .textContent()) ?? "";
            return (
              (await page.locator('[data-review-id="search-next"]').count()) >
                0 &&
              (await page.locator('[data-review-id="search-pin"]').count()) >
                0 &&
              pinLabel.trim() === "Pin" &&
              !searchText.includes("Default") &&
              !searchText.includes("No default search")
            );
          })()
        : true,
    hasSearchResultList:
      scenario === "viewer-right-sidebar-tabs"
        ? (await page
            .locator('[data-review-id="search-result-list"]')
            .count()) > 0 &&
          (await page
            .locator('[data-review-id="search-result-item"]')
            .count()) > 0 &&
          (await page
            .locator('[data-review-id="search-result-item"].active')
            .count()) > 0
        : true,
    hasSearchClearRemovesPinned:
      scenario === "viewer-search-clear-pinned"
        ? (await page
            .locator('[data-review-id="search-input"]')
            .inputValue()) === "" &&
          bodyText.includes("No search query") &&
          !bodyText.includes("Pinned search: Kroki")
        : true,
    hasBodySearchHighlights:
      scenario === "viewer-right-sidebar-tabs"
        ? (await page.locator('[data-review-id="search-hit"]').count()) > 0 &&
          (await page
            .locator('[data-review-id="search-hit"].active')
            .count()) === 1
        : true,
    hasStableManualScrollDuringSearch:
      scenario === "viewer-search" ? searchManualScrollStable === true : true,
    hasSearchHitRuler:
      scenario === "viewer-search-hit-ruler"
        ? (await page
            .locator('[data-review-id="search-hit-ruler"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="search-hit-ruler-marker"]')
            .count()) > 0 &&
          (await page
            .locator('[data-review-id="search-hit-ruler-active-marker"]')
            .count()) === 1
        : true,
    hasRightSidebarTabs:
      scenario === "viewer-right-sidebar-tabs"
        ? (await page
            .locator('[data-review-id="right-sidebar-tabs"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="right-sidebar-tab-contents"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="right-sidebar-tab-search"]')
            .count()) === 1 &&
          (await page.evaluate(() => {
            const primaryTabs = document.querySelector(
              '[data-review-id="sidebar-tabs"]',
            );
            const secondaryTabs = document.querySelector(
              '[data-review-id="right-sidebar-tabs"]',
            );
            const activeSecondary = document.querySelector(
              '[data-review-id="right-sidebar-tabs"] button.active',
            );
            if (
              !(primaryTabs instanceof HTMLElement) ||
              !(secondaryTabs instanceof HTMLElement) ||
              !(activeSecondary instanceof HTMLElement)
            ) {
              return false;
            }
            const primaryStyle = getComputedStyle(primaryTabs);
            const secondaryStyle = getComputedStyle(secondaryTabs);
            const activeStyle = getComputedStyle(activeSecondary);
            return (
              secondaryStyle.backgroundColor === "rgba(0, 0, 0, 0)" &&
              secondaryStyle.borderTopStyle === "none" &&
              primaryStyle.borderTopStyle !== "none" &&
              activeStyle.boxShadow === "none" &&
              Number.parseFloat(activeStyle.borderBottomWidth) >= 1
            );
          }))
        : true,
    hasContentsLinkMap:
      scenario === "viewer-contents-link-map"
        ? (await page
            .locator('[data-review-id="link-inspector-section"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="link-inspector-outgoing"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="link-inspector-backlinks"]')
            .count()) === 1 &&
          (await page.evaluate(() => {
            const toc = document.querySelector('[data-review-id="toc"]');
            const links = document.querySelector(
              '[data-review-id="link-inspector-section"]',
            );
            const includes = document.querySelector(
              '[data-review-id="include-inspector-toggle"]',
            );
            if (
              !(toc instanceof HTMLElement) ||
              !(links instanceof HTMLElement)
            ) {
              return false;
            }
            const tocBeforeLinks = Boolean(
              toc.compareDocumentPosition(links) &
              Node.DOCUMENT_POSITION_FOLLOWING,
            );
            if (!(includes instanceof HTMLElement)) {
              return tocBeforeLinks;
            }
            return (
              tocBeforeLinks &&
              Boolean(
                links.compareDocumentPosition(includes) &
                Node.DOCUMENT_POSITION_FOLLOWING,
              )
            );
          })) &&
          bodyText.includes("No document links") &&
          bodyText.includes("No loaded documents link here") &&
          !bodyText.includes("private source body")
        : true,
    hasKeybindingsNative:
      scenario === "viewer-keybindings-native"
        ? (await page
            .locator('[data-review-id="search-input"]')
            .inputValue()) === "Kroki" &&
          (await page
            .locator('[data-review-id="right-sidebar-tab-search"].active')
            .count()) === 1 &&
          (await page.locator('[data-review-id="open-files"]').count()) > 0 &&
          commandAutomation.availableCommands.includes("search.focus")
        : true,
    hasKeybindingsVim:
      scenario === "viewer-keybindings-vim"
        ? !bodyText.includes("Vim-style") &&
          (await page
            .locator('[data-review-id="keybinding-preset-control"] option')
            .count()) === 1
        : true,
    hasKeybindingsEmacs:
      scenario === "viewer-keybindings-emacs"
        ? !bodyText.includes("Emacs-style") &&
          (await page
            .locator('[data-review-id="keybinding-preset-control"] option')
            .count()) === 1
        : true,
    hasCommandAutomation:
      scenario === "viewer-command-automation"
        ? (await page.locator('[data-review-id="tab-bar"]').count()) === 1 &&
          commandAutomation.lastCommand === "sidebar.toggleLeft" &&
          commandAutomation.availableCommands.includes("tab.close") &&
          commandAutomation.availableCommands.includes("tab.restoreClosed") &&
          commandAutomation.availableCommands.includes("tab.togglePinned") &&
          commandAutomation.availableCommands.includes("tab.search") &&
          commandAutomation.availableCommands.includes("quickOpen.focus") &&
          commandAutomation.availableCommands.includes("navigation.back") &&
          commandAutomation.availableCommands.includes(
            "bookmark.toggleActive",
          ) &&
          commandAutomation.availableCommands.includes("sidebar.showFiles") &&
          commandAutomation.availableCommands.includes(
            "sidebar.showBookmarks",
          ) &&
          commandAutomation.availableCommands.includes("viewer.reloadForce") &&
          commandAutomation.availableCommands.includes("heading.copyLink") &&
          Object.hasOwn(commandAutomation, "lastMouseGesture") &&
          Object.hasOwn(commandAutomation, "lastMouseNavigation")
        : true,
  };
}
