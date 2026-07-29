import type { AppConfig } from "./types";
import { defaultKeybindingMappings } from "./keybindings";
import { defaultSidebarLayout } from "./layout";
import { defaultMouseGestureConfig } from "./mouseGestures";

export const publicKrokiEndpoint = "https://kroki.io";
export const localKrokiEndpointPlaceholder = "http://192.168.1.10:8000";

export const defaultConfig: AppConfig = {
  theme: "light",
  sidebarVisible: true,
  rightSidebarVisible: true,
  zoom: 100,
  zoomWithMouseWheel: false,
  reader: {
    asciidocTheme: "antora",
  },
  zenMode: {
    centerLayout: true,
    maxContentWidth: 960,
    hideTopbar: true,
    hideTabs: true,
    hideLeftSidebar: true,
    hideRightSidebar: true,
    hideStatusBar: true,
    fullScreen: false,
    exitOnEscape: true,
    restorePreviousLayout: true,
    applyToDiffPreview: false,
  },
  layout: defaultSidebarLayout,
  workspace: {
    lastDirectory: null,
    openTabs: [],
    activePath: null,
    pinnedSearch: null,
    expandedDirectories: [],
    sidebarTab: "files",
    sourceControlView: "changes",
    sourceControlGraphScope: "repository",
    sourceControlBranchDiffBaseRef: null,
    bookmarks: [],
    recentDocuments: [],
    recentDirectories: [],
    recentTabs: [],
    pinnedTabs: [],
    scrollPositions: {},
    activeHeadingByPath: {},
    splitSession: null,
    windowSessions: {},
    restorableWindowSessionIds: [],
  },
  diagram: {
    mermaidRenderer: "local",
    plantumlRenderer: "local",
    plantumlTimeoutMs: 10000,
    plantumlExternalFallback: "disabled",
    plantumlExternalBinaryPath: null,
    plantumlExternalTimeoutMs: 5000,
    plantumlExternalDotPath: null,
    graphvizRenderer: "local",
    graphvizTimeoutMs: 10000,
  },
  kroki: {
    mode: "disabled",
    endpointUrl: null,
    outputFormat: "svg",
    timeoutMs: 10000,
    maxBodyBytes: 1048576,
    cacheEnabled: true,
    requireRemoteConfirmation: true,
  },
  network: {
    httpProxy: {
      mode: "disabled",
      url: null,
    },
  },
  agentProviders: {
    activeProvider: "codex-app-server",
    codex: {
      executable: {
        mode: "auto",
        path: null,
      },
      model: null,
      reasoningEffort: "default",
      personality: "default",
      permissionMode: "observe",
      networkAccess: false,
      webSearch: false,
      contextProfile: "focused",
    },
  },
  remoteProviders: {
    github: {
      enabled: false,
      hostUrl: "https://github.com",
      tokenStored: false,
      lastTestStatus: null,
    },
    gitlab: {
      enabled: false,
      hostUrl: "https://gitlab.com",
      tokenStored: false,
      lastTestStatus: null,
    },
  },
  security: {
    allowLocalImages: true,
    showExternalImages: false,
    confirmExternalLinks: true,
  },
  experimental: {
    searchHitRuler: false,
    restoreAdditionalWindowsOnStartup: false,
    diagramPlaceholderRendering: true,
    diagramPlaceholderRenderingConfigured: true,
    postDiffGitMarkers: false,
    changeReviewDisplay: "detailed",
  },
  keybindings: {
    preset: "native",
    mappings: defaultKeybindingMappings("native"),
  },
  mouseGestures: defaultMouseGestureConfig,
};
