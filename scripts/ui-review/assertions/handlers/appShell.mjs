import { isPreferencesLayoutScenario } from "../../scenarios/metadata.mjs";

export async function buildAppShellAssertions(context) {
  const scenario = context.scenario;
  const page = context.page;
  const bodyText = context.bodyText;
  const commandAutomation = context.commandAutomation;
  const geometryReviewIds = context.geometryReviewIds;
  const searchManualScrollStable = context.searchManualScrollStable;
  const svgAspectRatios = context.svgAspectRatios;
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
    hasPreferencesLayout: isPreferencesLayoutScenario(scenario)
      ? (await page.locator('[data-review-id="preferences-nav"]').count()) ===
          1 &&
        (await page.locator('[data-review-id="preferences-pane"]').count()) ===
          1 &&
        (await page
          .locator('[data-review-id="preferences-nav-item"]')
          .count()) >= 6
      : true,
    hasPreferencesKrokiDiagnostic:
      scenario === "viewer-preferences" ||
      scenario === "viewer-preferences-kroki-remote-self-managed"
        ? (await page
            .locator('[data-review-id="kroki-diagnostic"]')
            .count()) === 1 &&
          (await page.locator('[data-review-id="kroki-test-run"]').count()) ===
            1 &&
          (await page
            .locator('[data-review-id="kroki-test-svg"] svg')
            .count()) === 1 &&
          svgAspectRatios.some(
            (sample) =>
              sample.parentReviewId === "kroki-test-svg" &&
              sample.preserveAspectRatio !== "none" &&
              sample.rect.width <= 260 &&
              sample.rect.height > 0,
          )
        : true,
    hasPreferencesKrokiSelfManaged:
      scenario === "viewer-preferences-kroki-remote-self-managed"
        ? await page.evaluate(() => {
            const samples = window.__SVARD_KROKI_POLICY_SAMPLES__ ?? [];
            const bodyText = document.body.textContent ?? "";
            return (
              bodyText.includes("Remote / self-managed") &&
              !bodyText.includes("Local / self-managed") &&
              bodyText.includes(
                "Public kroki.io always requires confirmation",
              ) &&
              document.querySelector(
                '[data-review-id="kroki-remote-confirmation-control"]',
              ) !== null &&
              samples.some(
                (sample) =>
                  sample.mode === "remote" &&
                  sample.endpoint === "http://192.168.1.10:8000",
              ) &&
              samples.some(
                (sample) =>
                  sample.mode === "public" &&
                  sample.endpoint === "https://kroki.io",
              )
            );
          })
        : true,
    hasPreferencesTab:
      scenario === "viewer-preferences-tab"
        ? bodyText.includes("Preferences") &&
          (await page
            .locator('[data-review-id="preferences-page"]')
            .count()) === 1 &&
          (await page.locator('[data-review-id="preferences-nav"]').count()) ===
            1 &&
          (await page
            .locator('[data-review-id="preferences-pane"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="preferences-nav-item"]')
            .count()) >= 6 &&
          (await page.locator('[data-review-id="zoom-value"]').innerText()) ===
            "110%" &&
          (await page
            .locator('[data-review-id="zoom-wheel-toggle"]')
            .count()) === 1 &&
          (await page.evaluate(() => {
            const samples = window.__SVARD_PREFERENCES_TAB_SAMPLES__ ?? [];
            return (
              samples.length >= 4 &&
              samples[0]?.openFilePreferenceRows === 1 &&
              samples[0]?.preferencesPages === 1 &&
              samples[0]?.rightSidebarCount === 0 &&
              samples[0]?.rightSidebarPlaceholderCount === 1 &&
              samples[1]?.openFilePreferenceRows === 1 &&
              samples[1]?.preferencesPages === 1 &&
              samples[1]?.rightSidebarCount === 0 &&
              samples[1]?.rightSidebarPlaceholderCount === 1 &&
              samples[2]?.activeTopbarPreferenceTabs === 1 &&
              samples[3]?.preferencesPagesAfterClose === 0 &&
              samples[3]?.documentBodiesAfterClose === 1 &&
              samples[3]?.rightSidebarCountAfterClose === 1
            );
          }))
        : true,
    hasWindowLocalRecentTabs:
      scenario === "viewer-window-local-recent-tabs"
        ? await page.evaluate(() => {
            const result = window.__SVARD_WINDOW_LOCAL_RECENT_TABS_CHECK__;
            return (
              result?.commandEnabled === true &&
              result?.lastCommand === "tab.switchToRecent" &&
              result?.activeTitle?.includes("render-fixtures.adoc") &&
              result?.contextMenuHasSwitchRecent === false
            );
          })
        : true,
    hasNewWindowRequest:
      scenario === "viewer-new-window"
        ? await page.evaluate(() => {
            const result = window.__SVARD_NEW_WINDOW_CHECK__;
            const request = result?.request;
            return (
              result?.commandEnabled === true &&
              result?.lastCommand === "window.new" &&
              request != null &&
              request.path === null &&
              typeof request.rootDirectory === "string" &&
              Array.isArray(request.expandedDirectories) &&
              request.sidebarTab === "files" &&
              request.sidebarVisible === true &&
              request.rightSidebarVisible === true &&
              request.layout !== null &&
              Array.isArray(request.bookmarks)
            );
          })
        : true,
    hasDuplicateWindowRequest:
      scenario === "viewer-duplicate-window"
        ? await page.evaluate(() => {
            const result = window.__SVARD_DUPLICATE_WINDOW_CHECK__;
            const request = result?.request;
            const activePath = request?.activePath;
            return (
              result?.commandEnabled === true &&
              result?.lastCommand === "window.duplicate" &&
              request != null &&
              typeof request.path === "string" &&
              request.path === activePath &&
              Array.isArray(request.openTabs) &&
              request.openTabs.includes(activePath) &&
              Array.isArray(request.pinnedTabs) &&
              request.scrollPositions?.[activePath] > 0 &&
              typeof request.rootDirectory === "string" &&
              Array.isArray(request.expandedDirectories) &&
              request.sidebarTab === "files" &&
              request.sidebarVisible === true &&
              request.rightSidebarVisible === true &&
              request.layout !== null &&
              Array.isArray(request.bookmarks)
            );
          })
        : true,
    hasRestoreAdditionalWindowsOptIn:
      scenario === "viewer-restore-additional-windows-opt-in"
        ? await page.evaluate(() => {
            const result = window.__SVARD_RESTORE_ADDITIONAL_WINDOWS_CHECK__;
            const requests = result?.requests ?? [];
            const request = requests[0];
            return (
              result?.restoreChecked === true &&
              requests.length === 1 &&
              request?.sessionId === "viewer-restore-1" &&
              request?.path === "/workspace/docs/render-fixtures.adoc" &&
              request?.activePath === "/workspace/docs/render-fixtures.adoc" &&
              Array.isArray(request?.openTabs) &&
              request.openTabs.includes("/workspace/docs/preferences.adoc") &&
              Array.isArray(request?.pinnedTabs) &&
              request.pinnedTabs.includes(
                "/workspace/docs/render-fixtures.adoc",
              ) &&
              Array.isArray(request?.recentTabs) &&
              request.scrollPositions?.[
                "/workspace/docs/render-fixtures.adoc"
              ] === 240 &&
              request.activeHeadingByPath?.[
                "/workspace/docs/render-fixtures.adoc"
              ] === "links" &&
              request.rootDirectory === "/workspace" &&
              Array.isArray(request.expandedDirectories) &&
              request.expandedDirectories.includes("/workspace/docs") &&
              request.sidebarTab === "bookmarks" &&
              request.sidebarVisible === true &&
              request.rightSidebarVisible === true &&
              request.layout !== null &&
              Array.isArray(request.bookmarks) &&
              request.bookmarks[0]?.path ===
                "/workspace/docs/render-fixtures.adoc"
            );
          })
        : true,
    hasPreferencesZoomWheel:
      scenario === "viewer-preferences-zoom-wheel"
        ? bodyText.includes("Zoom with mouse wheel") &&
          bodyText.includes("Command + scroll") &&
          bodyText.includes("Ctrl + scroll") &&
          (await page
            .locator('[data-review-id="zoom-wheel-toggle"]')
            .isChecked()) &&
          (await page.evaluate(() => {
            const samples =
              window.__SVARD_PREFERENCES_ZOOM_WHEEL_SAMPLES__ ?? [];
            return (
              samples.length === 2 &&
              samples[0]?.step === "initial" &&
              samples[0]?.checked === false &&
              samples[0]?.text?.includes("Zoom with mouse wheel") &&
              samples[1]?.step === "checked" &&
              samples[1]?.checked === true
            );
          }))
        : true,
    hasMouseWheelZoom:
      scenario === "viewer-mouse-wheel-zoom"
        ? await page.evaluate(() => {
            const samples = window.__SVARD_MOUSE_WHEEL_ZOOM_SAMPLES__ ?? [];
            return (
              samples.length === 3 &&
              samples[0]?.step === "initial" &&
              samples[0]?.zoomStyle === "100%" &&
              samples[1]?.step === "default-off" &&
              samples[1]?.zoomStyle === "100%" &&
              samples[2]?.step === "enabled" &&
              samples[2]?.zoomStyle === "110%"
            );
          })
        : true,
    hasPreferencesSecurityPersistence:
      scenario === "viewer-preferences-security-persistence"
        ? bodyText.includes("Security") &&
          bodyText.includes("Show external images") &&
          (await page
            .locator('[data-review-id="preferences-tab-security"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="show-external-images-control"]')
            .isChecked()) &&
          (await page.evaluate(() => {
            const samples = window.__SVARD_PREFERENCES_SECURITY_SAMPLES__ ?? [];
            return (
              samples.length === 3 &&
              samples[0]?.step === "initial" &&
              samples[0]?.showExternalImages === false &&
              samples[1]?.step === "checked" &&
              samples[1]?.showExternalImages === true &&
              samples[2]?.step === "reopened" &&
              samples[2]?.showExternalImages === true
            );
          }))
        : true,
    hasPreferencesZenMode:
      scenario === "viewer-preferences-zen-mode"
        ? bodyText.includes("Zen Mode") &&
          bodyText.includes("Preset") &&
          bodyText.includes("Default") &&
          bodyText.includes("Minimal") &&
          !bodyText.includes("Fullscreen") &&
          bodyText.includes("Custom") &&
          bodyText.includes("Center reader layout") &&
          bodyText.includes("Content width") &&
          bodyText.includes("Hide title and controls") &&
          bodyText.includes(
            "Hides the file name, toolbar buttons, tabs, sidebars, and status feedback.",
          ) &&
          bodyText.includes("Use system full screen") &&
          bodyText.includes("Hide top toolbar") &&
          bodyText.includes("Hide Diff Preview controls") &&
          bodyText.includes("When Zen mode is active") &&
          bodyText.includes("change ruler") &&
          !bodyText.includes("Max content width") &&
          !bodyText.includes("Hide status feedback") &&
          (await page
            .locator('[data-review-id="preferences-tab-zen-mode"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="zen-mode-preset-control"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="zen-mode-advanced-settings"][open]')
            .count()) === 1 &&
          (await page.evaluate(() => {
            const control = document.querySelector(
              '[data-review-id="zen-mode-preset-control"]',
            );
            const activeOption = control?.querySelector(
              ".segmented-option.active",
            );
            if (
              !(control instanceof HTMLElement) ||
              !(activeOption instanceof HTMLElement)
            ) {
              return false;
            }
            const controlStyle = getComputedStyle(control);
            const activeStyle = getComputedStyle(activeOption);
            return (
              controlStyle.backgroundColor !== activeStyle.backgroundColor &&
              activeStyle.color !== "rgb(255, 255, 255)" &&
              activeStyle.boxShadow.includes("inset")
            );
          })) &&
          (await page.evaluate(() => {
            const samples = window.__SVARD_PREFERENCES_ZEN_MODE_SAMPLES__ ?? [];
            return (
              samples.length === 4 &&
              samples[0]?.step === "initial" &&
              samples[0]?.activeSection === "Zen Mode" &&
              samples[0]?.generalHasZenControls === false &&
              samples[0]?.rightSidebarCount === 0 &&
              samples[0]?.rightSidebarPlaceholderCount === 1 &&
              samples[0]?.advancedOpen === false &&
              samples[0]?.widthDisabled === false &&
              samples[1]?.step === "minimal" &&
              samples[1]?.centerLayout === false &&
              samples[1]?.customSelected === false &&
              samples[2]?.step === "custom" &&
              samples[2]?.customSelected === true &&
              samples[2]?.contentWidth === "1040" &&
              samples[3]?.step === "advanced" &&
              samples[3]?.advancedOpen === true &&
              samples[3]?.fullScreen === true
            );
          }))
        : true,
    hasPreferencesStableSize:
      scenario === "viewer-preferences-stable-size"
        ? await page.evaluate(() => {
            const samples = window.__SVARD_PREFERENCES_SIZE_SAMPLES__ ?? [];
            if (samples.length !== 3) {
              return false;
            }
            const [first] = samples;
            return (
              samples.every(
                (sample) =>
                  Math.abs(sample.width - first.width) <= 1 &&
                  Math.abs(sample.height - first.height) <= 1 &&
                  sample.paneHeight > 0,
              ) && samples.some((sample) => sample.paneScrollable)
            );
          })
        : true,
    hasPreferencesExperimental:
      scenario === "viewer-preferences-experimental"
        ? bodyText.includes("Experimental") &&
          bodyText.includes("Search hit ruler") &&
          (await page
            .locator('[data-review-id="preferences-tab-experimental"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="experimental-search-hit-ruler-control"]')
            .isChecked()) &&
          (await page.evaluate(() => {
            const samples =
              window.__SVARD_PREFERENCES_EXPERIMENTAL_SAMPLES__ ?? [];
            return (
              samples.length === 2 &&
              samples[0]?.step === "initial" &&
              samples[0]?.searchHitRuler === false &&
              samples[1]?.step === "checked" &&
              samples[1]?.searchHitRuler === true
            );
          }))
        : true,
    hasPreferencesRemoteProviders:
      scenario === "viewer-preferences-remote-providers"
        ? bodyText.includes("PR / MR Providers") &&
          bodyText.includes(
            "Used by Source Control > Branch Diff to detect PR/MR target branches.",
          ) &&
          bodyText.includes(
            "Workflow: set token, enable provider, open Source Control > Branch Diff, then choose PR target or MR target.",
          ) &&
          bodyText.includes("Tokens are stored in the OS credential store") &&
          bodyText.includes("GitHub") &&
          bodyText.includes("GitLab") &&
          bodyText.includes("Use GitHub to detect PR target branches") &&
          bodyText.includes("Use GitLab to detect MR target branches") &&
          bodyText.includes(
            "Required for private repositories or API access.",
          ) &&
          (await page
            .locator('[data-review-id="preferences-tab-remote-providers"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="remote-provider-github"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="remote-provider-gitlab"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="remote-provider-github-token-status"]')
            .filter({ hasText: "Ready for PR target detection" })
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="remote-provider-github-token"]')
            .inputValue()) === ""
        : true,
    hasPreferencesDiagramsPolish:
      scenario === "viewer-preferences-diagrams-polish"
        ? bodyText.includes("Diagrams") &&
          bodyText.includes("Mermaid uses the built-in renderer.") &&
          bodyText.includes("Built-in") &&
          bodyText.includes("Kroki") &&
          bodyText.includes("Advanced") &&
          bodyText.includes("PlantUML timeout") &&
          bodyText.includes("Graphviz / DOT timeout") &&
          bodyText.includes(
            "Uses the endpoint configured in Kroki settings.",
          ) &&
          !bodyText.includes("Local") &&
          (await page
            .locator('[data-review-id="mermaid-renderer"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="plantuml-renderer-control"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="graphviz-renderer-control"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="diagram-advanced-settings"]')
            .count()) === 1 &&
          (await page.evaluate(() => {
            const samples = window.__SVARD_DIAGRAM_PREFERENCES_SAMPLES__ ?? [];
            return samples.some((sample) => sample.activeSection === "Kroki");
          }))
        : true,
    hasPreferencesKeybindings:
      scenario === "viewer-preferences-keybindings"
        ? (await page
            .locator('[data-review-id="keybinding-shortcut-table"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="keybinding-search"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="keybinding-shortcut-row"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="keybinding-reset"]')
            .count()) === 1 &&
          (await page.locator('[data-review-id="keybinding-record"]').count()) >
            0 &&
          (await page.locator('[data-review-id="keybinding-clear"]').count()) >
            0 &&
          bodyText.includes("view.toggleZenMode") &&
          bodyText.includes("Toggle Zen Mode") &&
          bodyText.includes("1 shortcut") &&
          !bodyText.includes("Vim-style") &&
          !bodyText.includes("Emacs-style")
        : true,
    hasPreferencesKeybindingsRecordCancel:
      scenario === "viewer-preferences-keybindings-record-cancel"
        ? (await page
            .locator('[data-review-id="keybinding-shortcut-table"]')
            .count()) === 1 &&
          (await page
            .locator('[data-review-id="keybinding-recording"]')
            .count()) === 0 &&
          (await page
            .locator('[data-review-id="keybinding-duplicate-error"]')
            .count()) === 0 &&
          bodyText.includes("search.focus") &&
          !bodyText.includes("Vim-style") &&
          !bodyText.includes("Emacs-style")
        : true,
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
        ? (await page.locator('[data-review-id="search-hit-ruler"]').count()) ===
            1 &&
          (await page
            .locator('[data-review-id="search-hit-ruler-marker"]')
            .count()) >
            0 &&
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
