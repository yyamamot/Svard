import { describe, expect, it } from "vitest";

import { defaultConfig } from "../../src/core/defaultConfig";
import type { AppConfig } from "../../src/core/types";
import { normalizeConfig } from "../../src/ui/lib/config";

describe("config normalization", () => {
  it("keeps mouse wheel zoom disabled by default", () => {
    expect(defaultConfig.zoomWithMouseWheel).toBe(false);
  });

  it("keeps experimental defaults aligned with feature policy", () => {
    expect(defaultConfig.experimental.searchHitRuler).toBe(false);
    expect(defaultConfig.experimental.restoreAdditionalWindowsOnStartup).toBe(
      false,
    );
    expect(defaultConfig.experimental.diagramPlaceholderRendering).toBe(true);
    expect(
      defaultConfig.experimental.diagramPlaceholderRenderingConfigured,
    ).toBe(true);
    expect(defaultConfig.experimental.postDiffGitMarkers).toBe(false);
    expect(defaultConfig.experimental.changeReviewDisplay).toBe("detailed");
  });

  it("normalizes Change Review display to the compatible detailed default", () => {
    const missing = normalizeConfig({
      ...defaultConfig,
      experimental: {
        ...defaultConfig.experimental,
        changeReviewDisplay: undefined,
      },
    } as unknown as typeof defaultConfig);
    const invalid = normalizeConfig({
      ...defaultConfig,
      experimental: {
        ...defaultConfig.experimental,
        changeReviewDisplay: "unknown",
      },
    } as unknown as typeof defaultConfig);
    const subtle = normalizeConfig({
      ...defaultConfig,
      experimental: {
        ...defaultConfig.experimental,
        changeReviewDisplay: "subtle",
      },
    });

    expect(missing.experimental.changeReviewDisplay).toBe("detailed");
    expect(invalid.experimental.changeReviewDisplay).toBe("detailed");
    expect(subtle.experimental.changeReviewDisplay).toBe("subtle");
  });

  it("keeps external PlantUML fallback disabled unless explicitly configured", () => {
    const normalized = normalizeConfig({
      ...defaultConfig,
      diagram: {
        ...defaultConfig.diagram,
        plantumlExternalFallback: "on-local-failure",
        plantumlExternalBinaryPath: "  /opt/bin/plantuml  ",
        plantumlExternalTimeoutMs: 999999,
        plantumlExternalDotPath: "  ",
      },
    });

    expect(defaultConfig.diagram.plantumlExternalFallback).toBe("disabled");
    expect(normalized.diagram.plantumlExternalFallback).toBe(
      "on-local-failure",
    );
    expect(normalized.diagram.plantumlExternalBinaryPath).toBe(
      "/opt/bin/plantuml",
    );
    expect(normalized.diagram.plantumlExternalTimeoutMs).toBe(60000);
    expect(normalized.diagram.plantumlExternalDotPath).toBeNull();
  });

  it("migrates missing mouse wheel zoom setting to disabled", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      zoomWithMouseWheel: undefined,
    } as unknown as typeof defaultConfig);

    expect(config.zoomWithMouseWheel).toBe(false);
  });

  it("keeps explicit mouse wheel zoom opt-in", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      zoomWithMouseWheel: true,
    });

    expect(config.zoomWithMouseWheel).toBe(true);
  });

  it("migrates old mouse gesture config without mappings", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      mouseGestures: {
        enabled: true,
        trigger: "rightButton",
        showTrail: true,
        minDistancePx: 32,
      } as typeof defaultConfig.mouseGestures,
    });

    expect(config.mouseGestures.mappings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          pattern: "Left",
          commandId: "navigation.back",
          builtIn: true,
        }),
      ]),
    );
  });

  it("falls back hidden vim and emacs keybinding presets to native", () => {
    const vimConfig = normalizeConfig({
      ...defaultConfig,
      keybindings: {
        preset: "vim",
      },
    });
    const emacsConfig = normalizeConfig({
      ...defaultConfig,
      keybindings: {
        preset: "emacs",
      },
    });

    expect(vimConfig.keybindings.preset).toBe("native");
    expect(emacsConfig.keybindings.preset).toBe("native");
    expect(
      vimConfig.keybindings.mappings?.find(
        (binding) => binding.commandId === "search.focus",
      )?.keys,
    ).toBe("Mod+F");
    expect(
      emacsConfig.keybindings.mappings?.find(
        (binding) => binding.commandId === "search.focus",
      )?.keys,
    ).toBe("Mod+F");
  });

  it("migrates old timeline sidebar state to source control graph", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      workspace: {
        ...defaultConfig.workspace,
        sidebarTab: "timeline",
      } as unknown as typeof defaultConfig.workspace,
    });

    expect(config.workspace.sidebarTab).toBe("sourceControl");
    expect(config.workspace.sourceControlView).toBe("graph");
    expect(config.workspace.sourceControlGraphScope).toBe("file");
  });

  it("keeps Source Control Branch Diff config fields", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      workspace: {
        ...defaultConfig.workspace,
        sourceControlView: "branchDiff",
        sourceControlBranchDiffBaseRef: "origin/main",
      },
    });

    expect(config.workspace.sourceControlView).toBe("branchDiff");
    expect(config.workspace.sourceControlBranchDiffBaseRef).toBe("origin/main");
  });

  it("migrates legacy workspace session into main window session", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      workspace: {
        ...defaultConfig.workspace,
        activePath: "/workspace/docs/main.md",
        openTabs: ["/workspace/docs/main.md"],
        windowSessions: {},
      },
    });

    expect(config.workspace.windowSessions.main).toMatchObject({
      activePath: "/workspace/docs/main.md",
      openTabs: ["/workspace/docs/main.md"],
    });
  });

  it("migrates legacy local Kroki mode to remote", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      kroki: {
        ...defaultConfig.kroki,
        mode: "local",
        endpointUrl: "  http://127.0.0.1:8000  ",
      },
    } as unknown as typeof defaultConfig);

    expect(config.kroki.mode).toBe("remote");
    expect(config.kroki.endpointUrl).toBe("http://127.0.0.1:8000");
  });

  it("defaults missing Kroki remote confirmation to enabled", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      kroki: {
        ...defaultConfig.kroki,
        mode: "remote",
        endpointUrl: "http://127.0.0.1:8000",
        requireRemoteConfirmation: undefined,
      },
    } as unknown as typeof defaultConfig);

    expect(config.kroki.requireRemoteConfirmation).toBe(true);
  });

  it("preserves explicit Kroki remote confirmation opt-out for self-managed endpoints", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      kroki: {
        ...defaultConfig.kroki,
        mode: "remote",
        endpointUrl: "http://127.0.0.1:8000",
        requireRemoteConfirmation: false,
      },
    });

    expect(config.kroki.requireRemoteConfirmation).toBe(false);
  });

  it("forces Kroki public mode confirmation on", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      kroki: {
        ...defaultConfig.kroki,
        mode: "public",
        endpointUrl: null,
        requireRemoteConfirmation: false,
      },
    });

    expect(config.kroki.endpointUrl).toBe("https://kroki.io");
    expect(config.kroki.requireRemoteConfirmation).toBe(true);
  });

  it("migrates missing network config to disabled HTTP proxy", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      network: undefined,
    } as unknown as typeof defaultConfig);

    expect(config.network.httpProxy).toEqual({
      mode: "disabled",
      url: null,
    });
  });

  it("normalizes Agent provider defaults and supported Codex quality settings", () => {
    const missing = normalizeConfig({
      ...defaultConfig,
      agentProviders: undefined,
    } as unknown as typeof defaultConfig);
    const configured = normalizeConfig({
      ...defaultConfig,
      agentProviders: {
        activeProvider: "codex-app-server",
        codex: {
          executable: { mode: "auto", path: null },
          model: "  gpt-5.6-sol  ",
          reasoningEffort: "high",
          personality: "pragmatic",
          permissionMode: "agent",
          networkAccess: true,
          webSearch: true,
        },
      },
    });

    expect(missing.agentProviders).toEqual(defaultConfig.agentProviders);
    expect(configured.agentProviders.codex).toEqual({
      executable: { mode: "auto", path: null },
      model: "gpt-5.6-sol",
      reasoningEffort: "high",
      personality: "pragmatic",
      permissionMode: "agent",
      networkAccess: true,
      webSearch: true,
    });
  });

  it("migrates legacy Codex settings to automatic executable discovery", () => {
    const legacy = structuredClone(defaultConfig) as unknown as {
      agentProviders: {
        activeProvider: string;
        codex: Omit<AppConfig["agentProviders"]["codex"], "executable"> & {
          executable?: undefined;
        };
      };
    };
    delete legacy.agentProviders.codex.executable;
    const normalized = normalizeConfig(legacy as unknown as AppConfig);
    expect(normalized.agentProviders.codex.executable).toEqual({
      mode: "auto",
      path: null,
    });
  });

  it("preserves provider-defined reasoning effort while normalizing other settings", () => {
    const normalized = normalizeConfig({
      ...defaultConfig,
      agentProviders: {
        activeProvider: "unknown",
        codex: {
          model: " ",
          reasoningEffort: "maximum",
          personality: "dramatic",
          permissionMode: "unrestricted",
          networkAccess: "yes",
          webSearch: 1,
        },
      },
    } as unknown as typeof defaultConfig);

    expect(normalized.agentProviders).toEqual({
      ...defaultConfig.agentProviders,
      codex: {
        ...defaultConfig.agentProviders.codex,
        reasoningEffort: "maximum",
      },
    });
  });

  it("migrates missing external image setting to hidden", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      security: {
        allowLocalImages: true,
        confirmExternalLinks: true,
      },
    } as unknown as typeof defaultConfig);

    expect(config.security.showExternalImages).toBe(false);
  });

  it("migrates missing experimental config to default features", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      experimental: undefined,
    } as unknown as typeof defaultConfig);

    expect(config.experimental.searchHitRuler).toBe(false);
    expect(config.experimental.restoreAdditionalWindowsOnStartup).toBe(false);
    expect(config.experimental.diagramPlaceholderRendering).toBe(true);
    expect(config.experimental.diagramPlaceholderRenderingConfigured).toBe(
      true,
    );
    expect(config.experimental.postDiffGitMarkers).toBe(false);
  });

  it("migrates old saved default false for fast diagram loading to enabled", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      experimental: {
        searchHitRuler: false,
        restoreAdditionalWindowsOnStartup: false,
        diagramPlaceholderRendering: false,
        postDiffGitMarkers: false,
      },
    });

    expect(config.experimental.diagramPlaceholderRendering).toBe(true);
    expect(config.experimental.diagramPlaceholderRenderingConfigured).toBe(
      true,
    );
  });

  it("keeps explicit fast diagram loading opt-out after migration", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      experimental: {
        searchHitRuler: false,
        restoreAdditionalWindowsOnStartup: false,
        diagramPlaceholderRendering: false,
        diagramPlaceholderRenderingConfigured: true,
        postDiffGitMarkers: false,
      },
    });

    expect(config.experimental.diagramPlaceholderRendering).toBe(false);
    expect(config.experimental.diagramPlaceholderRenderingConfigured).toBe(
      true,
    );
  });

  it("keeps explicit experimental feature opt-ins", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      experimental: {
        searchHitRuler: true,
        restoreAdditionalWindowsOnStartup: true,
        diagramPlaceholderRendering: true,
        diagramPlaceholderRenderingConfigured: true,
        postDiffGitMarkers: true,
      },
    });

    expect(config.experimental.searchHitRuler).toBe(true);
    expect(config.experimental.restoreAdditionalWindowsOnStartup).toBe(true);
    expect(config.experimental.diagramPlaceholderRendering).toBe(true);
    expect(config.experimental.diagramPlaceholderRenderingConfigured).toBe(
      true,
    );
    expect(config.experimental.postDiffGitMarkers).toBe(true);
  });

  it("normalizes HTTP proxy config and preserves custom URL", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      network: {
        httpProxy: {
          mode: "custom",
          url: "  http://proxy.local:8080  ",
        },
      },
    });

    expect(config.network.httpProxy).toEqual({
      mode: "custom",
      url: "http://proxy.local:8080",
    });
  });

  it("migrates missing remote provider config to disabled providers", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      remoteProviders: undefined,
    } as unknown as typeof defaultConfig);

    expect(config.remoteProviders.github).toEqual({
      enabled: false,
      hostUrl: "https://github.com",
      tokenStored: false,
      lastTestStatus: null,
    });
    expect(config.remoteProviders.gitlab.hostUrl).toBe("https://gitlab.com");
  });

  it("normalizes remote provider metadata without storing tokens", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      remoteProviders: {
        ...defaultConfig.remoteProviders,
        github: {
          enabled: true,
          hostUrl: "  https://github.example.com  ",
          tokenStored: true,
          lastTestStatus: { status: "ok", message: "Connected" },
        },
      },
    });

    expect(config.remoteProviders.github).toEqual({
      enabled: true,
      hostUrl: "https://github.example.com",
      tokenStored: true,
      lastTestStatus: { status: "ok", message: "Connected" },
    });
  });

  it("migrates missing reader config to Antora theme", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      reader: undefined,
    } as unknown as typeof defaultConfig);

    expect(config.reader.asciidocTheme).toBe("antora");
  });

  it("migrates missing Zen mode config to reader-focused defaults", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      zenMode: undefined,
    } as unknown as typeof defaultConfig);

    expect(config.zenMode).toEqual(defaultConfig.zenMode);
  });

  it("normalizes Zen mode content width and boolean fields", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      zenMode: {
        ...defaultConfig.zenMode,
        centerLayout: false,
        maxContentWidth: 5000,
        hideTopbar: "yes",
        hideTabs: "yes",
        hideLeftSidebar: false,
        hideRightSidebar: false,
        hideStatusBar: false,
        fullScreen: true,
        exitOnEscape: false,
        restorePreviousLayout: false,
        applyToDiffPreview: true,
      },
    } as unknown as typeof defaultConfig);

    expect(config.zenMode).toEqual({
      centerLayout: false,
      maxContentWidth: 1280,
      hideTopbar: false,
      hideTabs: false,
      hideLeftSidebar: false,
      hideRightSidebar: false,
      hideStatusBar: false,
      fullScreen: true,
      exitOnEscape: false,
      restorePreviousLayout: false,
      applyToDiffPreview: true,
    });
  });

  it("falls back invalid AsciiDoc theme to Antora", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      reader: {
        asciidocTheme: "unknown",
      },
    } as unknown as typeof defaultConfig);

    expect(config.reader.asciidocTheme).toBe("antora");
  });

  it("keeps explicit Asciidoctor theme selection", () => {
    const config = normalizeConfig({
      ...defaultConfig,
      reader: {
        asciidocTheme: "asciidoctor",
      },
    });

    expect(config.reader.asciidocTheme).toBe("asciidoctor");
  });
});
