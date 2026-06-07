import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { defaultConfig } from "../../src/core/defaultConfig";
import { defaultMouseGestureConfig } from "../../src/core/mouseGestures";
import type { AppConfig } from "../../src/core/types";
import { MockHostAdapter } from "../../src/adapters/mockHostAdapter";
import { PreferencesPanel } from "../../src/ui/components/PreferencesPanel";
import {
  createReactRootHarness,
  type ReactRootHarness,
} from "./helpers/reactHarness";

describe("PreferencesPanel settings and recording", () => {
  let harness: ReactRootHarness;
  let config: AppConfig;
  let closeSpy: () => void;
  let host: MockHostAdapter;

  beforeEach(() => {
    harness = createReactRootHarness();
    config = structuredClone(defaultConfig);
    closeSpy = vi.fn<() => void>();
    host = new MockHostAdapter();
  });

  afterEach(() => {
    harness.cleanup();
  });

  function render() {
    harness.render(
      <PreferencesPanel
        config={config}
        onChange={(nextConfig) => {
          config = nextConfig;
          render();
        }}
        onClearKrokiCache={() => undefined}
        onTestKroki={async () => ({ status: "rendered" })}
        host={host}
        onClose={closeSpy}
      />,
    );
  }

  async function openKeybindings() {
    render();
    await harness.click(harness.buttonByText("Keybindings"));
  }

  it("shows AsciiDoc theme selector with Antora selected by default", async () => {
    render();

    expect(harness.container.textContent).not.toContain("Zen mode");
    const themeControl = harness.byReviewId("asciidoc-theme-control");
    expect(themeControl?.textContent).toContain("Asciidoctor");
    expect(themeControl?.textContent).toContain("Antora");
    expect(
      [...(themeControl?.querySelectorAll("label") ?? [])].map((label) =>
        label.textContent?.trim(),
      ),
    ).toEqual(["Antora", "Asciidoctor"]);
    expect(
      themeControl?.querySelector<HTMLInputElement>('input[value="antora"]')
        ?.checked,
    ).toBe(true);
    expect(
      themeControl?.querySelector<HTMLInputElement>(
        'input[value="asciidoctor"]',
      )?.name,
    ).toBe("asciidoc-theme");

    await harness.click(
      themeControl.querySelector<HTMLInputElement>(
        'input[value="asciidoctor"]',
      ),
    );

    expect(config.reader.asciidocTheme).toBe("asciidoctor");
  });

  it("keeps Zen mode settings on a dedicated Preferences section", async () => {
    render();

    expect(harness.container.textContent).not.toContain("Center reader layout");

    await harness.click(harness.buttonByText("Zen Mode"));

    expect(harness.byReviewId("preferences-tab-zen-mode")).toBeTruthy();
    expect(harness.byReviewId("zen-mode-preset-control").textContent).toContain(
      "Default",
    );
    expect(harness.byReviewId("zen-mode-preset-control").textContent).toContain(
      "Custom",
    );
    expect(
      harness.byReviewId("zen-mode-preset-control").textContent,
    ).not.toContain("Fullscreen");
    expect(
      harness.inputByReviewId("zen-mode-center-layout-control").checked,
    ).toBe(true);
    expect(harness.inputByReviewId("zen-mode-max-width-control").disabled).toBe(
      false,
    );

    await harness.click(
      harness.inputByReviewId("zen-mode-center-layout-control"),
    );

    expect(config.zenMode.centerLayout).toBe(false);
    expect(harness.inputByReviewId("zen-mode-max-width-control").disabled).toBe(
      true,
    );
    expect(
      harness
        .byReviewId("zen-mode-preset-control")
        .querySelector<HTMLInputElement>('input[value="minimal"]')?.checked,
    ).toBe(true);

    await harness.setInputValue(
      harness.inputByReviewId("zen-mode-max-width-control"),
      "1040",
    );

    expect(config.zenMode.maxContentWidth).toBe(1040);
    expect(
      harness
        .byReviewId("zen-mode-preset-control")
        .querySelector<HTMLInputElement>('input[value="custom"]')?.checked,
    ).toBe(true);

    await harness.click(
      harness
        .byReviewId("zen-mode-advanced-settings")
        .querySelector<HTMLElement>("summary"),
    );
    await harness.click(
      harness.inputByReviewId("zen-mode-hide-interface-control"),
    );

    expect(config.zenMode.hideTopbar).toBe(false);
    expect(config.zenMode.hideTabs).toBe(false);
    expect(config.zenMode.hideLeftSidebar).toBe(false);
    expect(config.zenMode.hideRightSidebar).toBe(false);
    expect(config.zenMode.hideStatusBar).toBe(false);

    await harness.click(
      harness.inputByReviewId("zen-mode-hide-topbar-control"),
    );

    expect(config.zenMode.hideTopbar).toBe(true);

    await harness.click(
      harness.inputByReviewId("zen-mode-full-screen-control"),
    );

    expect(config.zenMode.fullScreen).toBe(true);
    expect(harness.container.textContent).toContain(
      "Hide Diff Preview controls",
    );

    await harness.click(harness.inputByReviewId("zen-mode-hide-tabs-control"));

    expect(config.zenMode.hideTabs).toBe(true);
  });

  it("stores custom HTTP proxy settings in the Network section", async () => {
    render();
    await harness.click(harness.buttonByText("Network"));

    const proxyControl = harness.byReviewId("http-proxy-mode-control");
    const proxyUrl = harness.inputByReviewId("http-proxy-url-control");

    expect(proxyControl?.textContent).toContain("Disabled");
    expect(proxyControl?.textContent).toContain("Custom");
    expect(proxyUrl?.disabled).toBe(true);

    await harness.click(
      proxyControl.querySelector<HTMLInputElement>('input[value="custom"]'),
    );
    await harness.setInputValue(proxyUrl, "http://proxy.local:8080");

    expect(config.network.httpProxy).toEqual({
      mode: "custom",
      url: "http://proxy.local:8080",
    });
  });

  it("stores Security checkbox changes in the next config payload", async () => {
    render();
    await harness.click(harness.buttonByText("Security"));

    const showLocalImages = harness.inputByReviewId(
      "show-local-images-control",
    );
    const showExternalImages = harness.inputByReviewId(
      "show-external-images-control",
    );
    const confirmExternalLinks = harness.inputByReviewId(
      "confirm-external-links-control",
    );

    expect(showLocalImages?.checked).toBe(true);
    expect(showExternalImages?.checked).toBe(false);
    expect(confirmExternalLinks?.checked).toBe(true);

    await harness.click(showLocalImages);
    await harness.click(showExternalImages);
    await harness.click(confirmExternalLinks);

    expect(config.security).toEqual({
      allowLocalImages: false,
      showExternalImages: true,
      confirmExternalLinks: false,
    });
  });

  it("stores General git marker toggle in the next config payload", async () => {
    render();

    const postDiffGitMarkers = harness.inputByReviewId(
      "general-post-diff-git-markers-control",
    );

    expect(harness.byReviewId("preferences-tab-general")).toBeTruthy();
    expect(postDiffGitMarkers?.checked).toBe(false);

    await harness.click(postDiffGitMarkers);

    expect(config.experimental.postDiffGitMarkers).toBe(true);
  });

  it("stores Experimental feature toggles in the next config payload", async () => {
    render();
    await harness.click(harness.buttonByText("Experimental"));

    const searchHitRuler = harness.inputByReviewId(
      "experimental-search-hit-ruler-control",
    );
    const restoreAdditionalWindows = harness.inputByReviewId(
      "experimental-restore-additional-windows-control",
    );
    const diagramPlaceholderRendering = harness.inputByReviewId(
      "experimental-diagram-placeholder-rendering-control",
    );
    expect(harness.byReviewId("preferences-tab-experimental")).toBeTruthy();
    expect(searchHitRuler?.checked).toBe(false);
    expect(restoreAdditionalWindows?.checked).toBe(false);
    expect(diagramPlaceholderRendering?.checked).toBe(false);
    expect(harness.container.textContent).toContain(
      "These features are opt-in",
    );

    await harness.click(searchHitRuler);
    await harness.click(restoreAdditionalWindows);
    await harness.click(diagramPlaceholderRendering);

    expect(config.experimental.searchHitRuler).toBe(true);
    expect(config.experimental.restoreAdditionalWindowsOnStartup).toBe(true);
    expect(config.experimental.diagramPlaceholderRendering).toBe(true);
  });

  it("stores remote provider tokens outside config metadata", async () => {
    render();
    await harness.click(harness.buttonByText("PR / MR Providers"));

    const githubCard = harness.byReviewId("remote-provider-github");
    const gitlabCard = harness.byReviewId("remote-provider-gitlab");
    const tokenInput = harness.inputByReviewId("remote-provider-github-token");
    const saveButton = harness.byReviewId<HTMLButtonElement>(
      "remote-provider-github-save-token",
    );

    expect(harness.container.textContent).toContain(
      "Used by Source Control > Branch Diff to detect PR/MR target branches.",
    );
    expect(harness.container.textContent).toContain(
      "Workflow: set token, enable provider, open Source Control > Branch Diff, then choose PR target or MR target.",
    );
    expect(githubCard?.textContent).toContain("Not configured");
    expect(githubCard?.textContent).toContain(
      "Use GitHub to detect PR target branches",
    );
    expect(gitlabCard?.textContent).toContain(
      "Use GitLab to detect MR target branches",
    );
    expect(githubCard?.textContent).toContain(
      "Required for private repositories or API access.",
    );
    await harness.setInputValue(tokenInput, "secret-token");
    await harness.click(saveButton);

    expect(config.remoteProviders.github.tokenStored).toBe(true);
    expect(githubCard?.textContent).toContain("Ready for PR target detection");
    expect(JSON.stringify(config)).not.toContain("secret-token");
    expect(tokenInput?.value).toBe("");
  });

  function rowForCommand(commandId: string) {
    const rows = [
      ...harness.container.querySelectorAll<HTMLTableRowElement>(
        '[data-review-id="keybinding-shortcut-row"]',
      ),
    ];
    const row = rows.find((element) =>
      element.textContent?.includes(commandId),
    );
    if (!row) {
      throw new Error(`Keybinding row not found: ${commandId}`);
    }
    return row;
  }

  function shortcutFor(commandId: string) {
    return rowForCommand(commandId).querySelector<HTMLElement>(
      '[data-review-id="keybinding-shortcut"]',
    );
  }

  function clearFor(commandId: string) {
    const button = rowForCommand(commandId).querySelector<HTMLButtonElement>(
      '[data-review-id="keybinding-clear"]',
    );
    if (!button) {
      throw new Error(`Clear button not found: ${commandId}`);
    }
    return button;
  }

  function recordFor(commandId: string) {
    const button = rowForCommand(commandId).querySelector<HTMLButtonElement>(
      '[data-review-id="keybinding-record"]',
    );
    if (!button) {
      throw new Error(`Record button not found: ${commandId}`);
    }
    return button;
  }

  async function pressKey(
    key: string,
    init: Pick<
      KeyboardEventInit,
      "ctrlKey" | "metaKey" | "altKey" | "shiftKey"
    > = {},
  ) {
    await harness.pressKey(key, init);
  }

  it("records a valid shortcut and exits recording", async () => {
    await openKeybindings();

    await harness.click(recordFor("search.focus"));
    await pressKey("k", { ctrlKey: true });

    expect(shortcutFor("search.focus")?.textContent).toContain("Ctrl+K");
    expect(
      harness.container.querySelector(
        '[data-review-id="keybinding-recording"]',
      ),
    ).toBeNull();
  });

  it("shows the VS Code style Zen Mode toggle shortcut", async () => {
    await openKeybindings();

    expect(rowForCommand("view.toggleZenMode").textContent).toContain(
      "Toggle Zen Mode",
    );
    expect(shortcutFor("view.toggleZenMode")?.textContent).toContain(
      "Ctrl+K Z",
    );
  });

  it("filters keybindings by action, command, shortcut, and context", async () => {
    await openKeybindings();
    const search = harness.inputByReviewId("keybinding-search");

    await harness.setInputValue(search, "zen");
    expect(rowForCommand("view.toggleZenMode").textContent).toContain(
      "Toggle Zen Mode",
    );
    expect(harness.container.textContent).not.toContain("quickOpen.focus");
    expect(harness.byReviewId("keybinding-search-count").textContent).toBe(
      "1 shortcut",
    );

    await harness.setInputValue(search, "view.toggleZenMode");
    expect(rowForCommand("view.toggleZenMode").textContent).toContain(
      "Ctrl+K Z",
    );

    await harness.setInputValue(search, "Ctrl+K Z");
    expect(rowForCommand("view.toggleZenMode").textContent).toContain(
      "Toggle Zen Mode",
    );

    await harness.setInputValue(search, "search");
    expect(rowForCommand("search.focus").textContent).toContain("search");
  });

  it("shows an empty state when no keybindings match", async () => {
    await openKeybindings();

    await harness.setInputValue(
      harness.inputByReviewId("keybinding-search"),
      "no-such-shortcut",
    );

    expect(harness.byReviewId("keybinding-search-count").textContent).toBe(
      "0 shortcuts",
    );
    expect(harness.byReviewId("keybinding-search-empty").textContent).toBe(
      "No keybindings match your search.",
    );
  });

  it("keeps row actions working after filtering keybindings", async () => {
    await openKeybindings();

    await harness.setInputValue(
      harness.inputByReviewId("keybinding-search"),
      "zen",
    );
    await harness.click(clearFor("view.toggleZenMode"));

    expect(shortcutFor("view.toggleZenMode")?.textContent).toContain(
      "Unassigned",
    );
  });

  it("cancels recording with Escape, Tab, and other control clicks", async () => {
    await openKeybindings();
    const originalShortcut = shortcutFor("search.focus")?.textContent;

    await harness.click(recordFor("search.focus"));
    await pressKey("Escape");
    expect(shortcutFor("search.focus")?.textContent).toBe(originalShortcut);
    expect(
      harness.container.querySelector(
        '[data-review-id="keybinding-recording"]',
      ),
    ).toBeNull();

    await harness.click(recordFor("search.focus"));
    await pressKey("Tab");
    expect(shortcutFor("search.focus")?.textContent).toBe(originalShortcut);
    expect(
      harness.container.querySelector(
        '[data-review-id="keybinding-recording"]',
      ),
    ).toBeNull();

    await harness.click(recordFor("search.focus"));
    await harness.pointerDown(harness.buttonByText("Reset to defaults"));
    await harness.click(harness.buttonByText("Reset to defaults"));
    expect(shortcutFor("search.focus")?.textContent).toBe(originalShortcut);
    expect(
      harness.container.querySelector(
        '[data-review-id="keybinding-recording"]',
      ),
    ).toBeNull();
  });

  it("keeps modifier-only keys in recording without changing mappings", async () => {
    await openKeybindings();
    const originalShortcut = shortcutFor("search.focus")?.textContent;

    await harness.click(recordFor("search.focus"));
    await pressKey("Control");

    expect(shortcutFor("search.focus")?.textContent).toBe(originalShortcut);
    expect(
      harness.container.querySelector(
        '[data-review-id="keybinding-recording"]',
      ),
    ).not.toBeNull();
  });

  it("shows validation errors without saving duplicate shortcuts", async () => {
    await openKeybindings();
    const originalShortcut = shortcutFor("search.focus")?.textContent;

    await harness.click(recordFor("search.focus"));
    await pressKey("g", { ctrlKey: true });

    expect(shortcutFor("search.focus")?.textContent).toBe(originalShortcut);
    expect(
      rowForCommand("search.focus").querySelector(
        '[data-review-id="keybinding-duplicate-error"]',
      )?.textContent,
    ).toContain("Duplicate shortcut");
    expect(
      harness.container.querySelector(
        '[data-review-id="keybinding-recording"]',
      ),
    ).toBeNull();
  });

  it("cancels mouse gesture recording when switching sections", async () => {
    render();
    await harness.click(harness.buttonByText("Mouse Gestures"));

    await harness.click(harness.byReviewId("mouse-gesture-record"));
    expect(
      harness.container.querySelector(
        '[data-review-id="mouse-gesture-record-pad"]',
      ),
    ).not.toBeNull();

    await harness.pointerDown(harness.buttonByText("Keybindings"));
    await harness.click(harness.buttonByText("Keybindings"));

    await harness.click(harness.buttonByText("Mouse Gestures"));
    expect(
      harness.container.querySelector(
        '[data-review-id="mouse-gesture-record-pad"]',
      ),
    ).toBeNull();
    expect(config.mouseGestures.mappings).toEqual(
      defaultMouseGestureConfig.mappings,
    );
  });
});
