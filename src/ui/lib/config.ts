import { defaultConfig, publicKrokiEndpoint } from "../../core/defaultConfig";
import {
  defaultSidebarLayout,
  normalizeSidebarLayout,
  sidebarLayoutBounds,
} from "../../core/layout";
import type { SidebarLayoutConfig } from "../../core/layout";
import { normalizeKeybindingMappings } from "../../core/keybindings";
import {
  defaultMouseGestureConfig,
  normalizeMouseGestureMappings,
} from "../../core/mouseGestures";
import type {
  AppConfig,
  SplitSessionState,
  WorkspaceWindowSession,
} from "../../core/types";

const visibleKeybindingPreset = "native";
export const MAIN_WINDOW_SESSION_ID = "main";

type RawAppConfig = Partial<AppConfig> & {
  reader?: { asciidocTheme?: unknown };
  zenMode?: {
    centerLayout?: unknown;
    maxContentWidth?: unknown;
    hideTopbar?: unknown;
    hideTabs?: unknown;
    hideLeftSidebar?: unknown;
    hideRightSidebar?: unknown;
    hideStatusBar?: unknown;
    fullScreen?: unknown;
    exitOnEscape?: unknown;
    restorePreviousLayout?: unknown;
    applyToDiffPreview?: unknown;
  };
  network?: {
    httpProxy?: {
      mode?: unknown;
      url?: unknown;
    };
  };
  remoteProviders?: {
    github?: RawRemoteProviderConfig;
    gitlab?: RawRemoteProviderConfig;
  };
  kroki?: {
    mode?: unknown;
    endpointUrl?: unknown;
  };
  diagram?: {
    plantumlExternalFallback?: unknown;
    plantumlExternalBinaryPath?: unknown;
    plantumlExternalTimeoutMs?: unknown;
    plantumlExternalDotPath?: unknown;
  };
  security?: {
    allowLocalImages?: unknown;
    showExternalImages?: unknown;
    confirmExternalLinks?: unknown;
  };
  experimental?: {
    searchHitRuler?: unknown;
    restoreAdditionalWindowsOnStartup?: unknown;
    diagramPlaceholderRendering?: unknown;
    diagramPlaceholderRenderingConfigured?: unknown;
    postDiffGitMarkers?: unknown;
  };
};

type RawRemoteProviderConfig = {
  enabled?: unknown;
  hostUrl?: unknown;
  tokenStored?: unknown;
  lastTestStatus?: unknown;
};

export function normalizeSplitSession(
  splitSession: SplitSessionState | null | undefined,
): SplitSessionState | null {
  if (!splitSession?.enabled) {
    return null;
  }

  return {
    enabled: true,
    focusedPaneId: splitSession.focusedPaneId === "right" ? "right" : "left",
    splitRatio: Math.min(0.75, Math.max(0.25, splitSession.splitRatio || 0.5)),
    panePaths: {
      left: splitSession.panePaths?.left ?? null,
      right: splitSession.panePaths?.right ?? null,
    },
  };
}

export function normalizeConfig(config: AppConfig): AppConfig {
  const keybindingPreset = visibleKeybindingPreset;
  const rawConfig = config as unknown as RawAppConfig;
  return {
    ...config,
    zoomWithMouseWheel: booleanDefault(
      rawConfig.zoomWithMouseWheel,
      defaultConfig.zoomWithMouseWheel,
    ),
    reader: normalizeReaderConfig(config, rawConfig),
    zenMode: normalizeZenModeConfig(config, rawConfig),
    network: normalizeNetworkConfig(config, rawConfig),
    diagram: normalizeDiagramConfig(config, rawConfig),
    remoteProviders: normalizeRemoteProvidersConfig(rawConfig),
    security: normalizeSecurityConfig(config, rawConfig),
    experimental: normalizeExperimentalConfig(config, rawConfig),
    kroki: normalizeKrokiConfig(config, rawConfig),
    layout: normalizeSidebarLayout(config.layout),
    workspace: normalizeWorkspaceConfig(config),
    keybindings: {
      ...(defaultConfig.keybindings ?? { preset: "native" }),
      ...(config.keybindings ?? {}),
      preset: keybindingPreset,
      mappings: normalizeKeybindingMappings(
        keybindingPreset,
        config.keybindings?.preset === keybindingPreset
          ? config.keybindings?.mappings
          : undefined,
      ),
    },
    mouseGestures: {
      ...defaultMouseGestureConfig,
      ...(config.mouseGestures ?? {}),
      mappings: normalizeMouseGestureMappings(config.mouseGestures?.mappings),
    },
  };
}

function normalizeDiagramConfig(
  config: AppConfig,
  rawConfig: RawAppConfig,
): AppConfig["diagram"] {
  return {
    ...defaultConfig.diagram,
    ...(config.diagram ?? {}),
    plantumlExternalFallback: oneOf(
      rawConfig.diagram?.plantumlExternalFallback,
      ["on-local-failure"] as const,
      "disabled",
    ),
    plantumlExternalBinaryPath: trimmedStringOrNull(
      rawConfig.diagram?.plantumlExternalBinaryPath,
    ),
    plantumlExternalTimeoutMs: boundedNumber(
      rawConfig.diagram?.plantumlExternalTimeoutMs,
      1000,
      60000,
      defaultConfig.diagram.plantumlExternalTimeoutMs,
    ),
    plantumlExternalDotPath: trimmedStringOrNull(
      rawConfig.diagram?.plantumlExternalDotPath,
    ),
  };
}

function normalizeZenModeConfig(
  config: AppConfig,
  rawConfig: RawAppConfig,
): AppConfig["zenMode"] {
  const rawZenMode = (rawConfig.zenMode ?? {}) as NonNullable<
    RawAppConfig["zenMode"]
  >;
  return {
    ...defaultConfig.zenMode,
    ...(config.zenMode ?? {}),
    centerLayout: booleanDefault(
      rawZenMode.centerLayout,
      defaultConfig.zenMode.centerLayout,
    ),
    maxContentWidth: boundedNumber(
      rawZenMode.maxContentWidth,
      640,
      1280,
      defaultConfig.zenMode.maxContentWidth,
    ),
    hideTopbar: booleanDefault(
      rawZenMode.hideTopbar,
      defaultConfig.zenMode.hideTopbar,
    ),
    hideTabs: booleanDefault(
      rawZenMode.hideTabs,
      defaultConfig.zenMode.hideTabs,
    ),
    hideLeftSidebar: booleanDefault(
      rawZenMode.hideLeftSidebar,
      defaultConfig.zenMode.hideLeftSidebar,
    ),
    hideRightSidebar: booleanDefault(
      rawZenMode.hideRightSidebar,
      defaultConfig.zenMode.hideRightSidebar,
    ),
    hideStatusBar: booleanDefault(
      rawZenMode.hideStatusBar,
      defaultConfig.zenMode.hideStatusBar,
    ),
    fullScreen: booleanDefault(
      rawZenMode.fullScreen,
      defaultConfig.zenMode.fullScreen,
    ),
    exitOnEscape: booleanDefault(
      rawZenMode.exitOnEscape,
      defaultConfig.zenMode.exitOnEscape,
    ),
    restorePreviousLayout: booleanDefault(
      rawZenMode.restorePreviousLayout,
      defaultConfig.zenMode.restorePreviousLayout,
    ),
    applyToDiffPreview: booleanDefault(
      rawZenMode.applyToDiffPreview,
      defaultConfig.zenMode.applyToDiffPreview,
    ),
  };
}

function normalizeReaderConfig(
  config: AppConfig,
  rawConfig: RawAppConfig,
): AppConfig["reader"] {
  return {
    ...defaultConfig.reader,
    ...(config.reader ?? {}),
    asciidocTheme: oneOf(
      rawConfig.reader?.asciidocTheme,
      ["asciidoctor"] as const,
      "antora",
    ),
  };
}

function normalizeNetworkConfig(
  config: AppConfig,
  rawConfig: RawAppConfig,
): AppConfig["network"] {
  return {
    ...defaultConfig.network,
    ...(config.network ?? {}),
    httpProxy: {
      ...defaultConfig.network.httpProxy,
      ...(config.network?.httpProxy ?? {}),
      mode: oneOf(
        rawConfig.network?.httpProxy?.mode,
        ["custom"] as const,
        "disabled",
      ),
      url: trimmedStringOrNull(rawConfig.network?.httpProxy?.url),
    },
  };
}

function normalizeRemoteProvidersConfig(
  rawConfig: RawAppConfig,
): AppConfig["remoteProviders"] {
  return {
    github: normalizeRemoteProvider(
      rawConfig.remoteProviders?.github,
      defaultConfig.remoteProviders.github,
    ),
    gitlab: normalizeRemoteProvider(
      rawConfig.remoteProviders?.gitlab,
      defaultConfig.remoteProviders.gitlab,
    ),
  };
}

function normalizeSecurityConfig(
  config: AppConfig,
  rawConfig: RawAppConfig,
): AppConfig["security"] {
  return {
    ...defaultConfig.security,
    ...(config.security ?? {}),
    allowLocalImages: booleanDefault(
      rawConfig.security?.allowLocalImages,
      true,
    ),
    showExternalImages: rawConfig.security?.showExternalImages === true,
    confirmExternalLinks: booleanDefault(
      rawConfig.security?.confirmExternalLinks,
      true,
    ),
  };
}

function normalizeExperimentalConfig(
  config: AppConfig,
  rawConfig: RawAppConfig,
): AppConfig["experimental"] {
  const diagramPlaceholderRenderingConfigured =
    rawConfig.experimental?.diagramPlaceholderRenderingConfigured === true;
  const rawDiagramPlaceholderRendering =
    rawConfig.experimental?.diagramPlaceholderRendering;
  return {
    ...defaultConfig.experimental,
    ...(config.experimental ?? {}),
    searchHitRuler: rawConfig.experimental?.searchHitRuler === true,
    restoreAdditionalWindowsOnStartup:
      rawConfig.experimental?.restoreAdditionalWindowsOnStartup === true,
    diagramPlaceholderRendering: diagramPlaceholderRenderingConfigured
      ? rawDiagramPlaceholderRendering !== false
      : booleanDefault(
          rawDiagramPlaceholderRendering === false
            ? undefined
            : rawDiagramPlaceholderRendering,
          defaultConfig.experimental.diagramPlaceholderRendering,
        ),
    diagramPlaceholderRenderingConfigured: true,
    postDiffGitMarkers: rawConfig.experimental?.postDiffGitMarkers === true,
  };
}

function normalizeKrokiConfig(
  config: AppConfig,
  rawConfig: RawAppConfig,
): AppConfig["kroki"] {
  const rawMode: unknown = rawConfig.kroki?.mode;
  const mode = oneOf(
    rawMode === "local" ? "remote" : rawMode,
    ["public", "remote"] as const,
    "disabled",
  );
  return {
    ...defaultConfig.kroki,
    ...(config.kroki ?? {}),
    mode,
    endpointUrl:
      mode === "public"
        ? publicKrokiEndpoint
        : trimmedStringOrNull(rawConfig.kroki?.endpointUrl),
  };
}

function normalizeWorkspaceConfig(config: AppConfig): AppConfig["workspace"] {
  const rawWorkspace = config.workspace as unknown as {
    sidebarTab?: string;
    sourceControlView?: string;
    sourceControlGraphScope?: string;
    sourceControlBranchDiffBaseRef?: unknown;
    windowSessions?: unknown;
    restorableWindowSessionIds?: unknown;
  };
  const migratedTimeline = rawWorkspace.sidebarTab === "timeline";
  const sidebarTab =
    rawWorkspace.sidebarTab === "files" ||
    rawWorkspace.sidebarTab === "bookmarks"
      ? rawWorkspace.sidebarTab
      : rawWorkspace.sidebarTab === "sourceControl" || migratedTimeline
        ? "sourceControl"
        : "files";
  const sourceControlView =
    rawWorkspace.sourceControlView === "branchDiff"
      ? "branchDiff"
      : rawWorkspace.sourceControlView === "graph" || migratedTimeline
        ? "graph"
        : "changes";
  const sourceControlGraphScope =
    rawWorkspace.sourceControlGraphScope === "file" || migratedTimeline
      ? "file"
      : "repository";

  const legacyWorkspace: AppConfig["workspace"] = {
    ...defaultConfig.workspace,
    ...config.workspace,
    bookmarks: config.workspace.bookmarks ?? [],
    sidebarTab,
    sourceControlView,
    sourceControlGraphScope,
    sourceControlBranchDiffBaseRef:
      typeof rawWorkspace.sourceControlBranchDiffBaseRef === "string"
        ? rawWorkspace.sourceControlBranchDiffBaseRef
        : null,
    recentDocuments: config.workspace.recentDocuments ?? [],
    recentDirectories: config.workspace.recentDirectories ?? [],
    recentTabs: stringArray(config.workspace.recentTabs),
    pinnedTabs: config.workspace.pinnedTabs ?? [],
    scrollPositions: config.workspace.scrollPositions ?? {},
    activeHeadingByPath: config.workspace.activeHeadingByPath ?? {},
    splitSession: config.workspace.splitSession ?? null,
    restorableWindowSessionIds: stringArray(
      rawWorkspace.restorableWindowSessionIds,
    ),
  };
  const rawSessions =
    rawWorkspace.windowSessions &&
    typeof rawWorkspace.windowSessions === "object" &&
    !Array.isArray(rawWorkspace.windowSessions)
      ? (rawWorkspace.windowSessions as Record<string, unknown>)
      : {};
  const windowSessions = Object.fromEntries(
    Object.entries(rawSessions).map(([sessionId, session]) => [
      sessionId,
      normalizeWorkspaceWindowSession(session),
    ]),
  );
  windowSessions[MAIN_WINDOW_SESSION_ID] =
    windowSessions[MAIN_WINDOW_SESSION_ID] ??
    workspaceSessionFromWorkspace(legacyWorkspace);

  return {
    ...legacyWorkspace,
    windowSessions,
  };
}

export function workspaceSessionFromWorkspace(
  workspace: AppConfig["workspace"],
): WorkspaceWindowSession {
  return {
    lastDirectory: workspace.lastDirectory,
    openTabs: workspace.openTabs,
    activePath: workspace.activePath,
    pinnedSearch: workspace.pinnedSearch,
    expandedDirectories: workspace.expandedDirectories,
    sidebarTab: workspace.sidebarTab,
    sourceControlView: workspace.sourceControlView,
    sourceControlGraphScope: workspace.sourceControlGraphScope,
    sourceControlBranchDiffBaseRef: workspace.sourceControlBranchDiffBaseRef,
    recentDirectories: workspace.recentDirectories,
    recentTabs: workspace.recentTabs,
    pinnedTabs: workspace.pinnedTabs,
    scrollPositions: workspace.scrollPositions,
    activeHeadingByPath: workspace.activeHeadingByPath,
    splitSession: workspace.splitSession,
  };
}

export function workspaceWithWindowSession(
  workspace: AppConfig["workspace"],
  sessionId: string,
  session: WorkspaceWindowSession,
): AppConfig["workspace"] {
  return {
    ...workspace,
    ...session,
    bookmarks: workspace.bookmarks,
    recentDocuments: workspace.recentDocuments,
    windowSessions: {
      ...workspace.windowSessions,
      [sessionId]: session,
    },
  };
}

export function normalizeWorkspaceWindowSession(
  session: unknown,
): WorkspaceWindowSession {
  const raw =
    session && typeof session === "object"
      ? (session as Partial<WorkspaceWindowSession> & {
          sidebarTab?: string;
          sourceControlView?: string;
          sourceControlGraphScope?: string;
          sourceControlBranchDiffBaseRef?: unknown;
        })
      : {};
  const sidebarTab =
    raw.sidebarTab === "files" ||
    raw.sidebarTab === "bookmarks" ||
    raw.sidebarTab === "sourceControl"
      ? raw.sidebarTab
      : defaultConfig.workspace.sidebarTab;
  const sourceControlView =
    raw.sourceControlView === "branchDiff" || raw.sourceControlView === "graph"
      ? raw.sourceControlView
      : defaultConfig.workspace.sourceControlView;
  const sourceControlGraphScope =
    raw.sourceControlGraphScope === "file"
      ? "file"
      : defaultConfig.workspace.sourceControlGraphScope;

  return {
    lastDirectory:
      typeof raw.lastDirectory === "string" ? raw.lastDirectory : null,
    openTabs: stringArray(raw.openTabs),
    activePath: typeof raw.activePath === "string" ? raw.activePath : null,
    pinnedSearch:
      typeof raw.pinnedSearch === "string" ? raw.pinnedSearch : null,
    expandedDirectories: stringArray(raw.expandedDirectories),
    sidebarTab,
    sourceControlView,
    sourceControlGraphScope,
    sourceControlBranchDiffBaseRef:
      typeof raw.sourceControlBranchDiffBaseRef === "string"
        ? raw.sourceControlBranchDiffBaseRef
        : null,
    recentDirectories: Array.isArray(raw.recentDirectories)
      ? raw.recentDirectories
      : [],
    recentTabs: stringArray(raw.recentTabs),
    pinnedTabs: stringArray(raw.pinnedTabs),
    scrollPositions: raw.scrollPositions ?? {},
    activeHeadingByPath: raw.activeHeadingByPath ?? {},
    splitSession: normalizeSplitSession(raw.splitSession),
  };
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function normalizeRemoteProvider(
  provider: RawRemoteProviderConfig | undefined,
  fallback: AppConfig["remoteProviders"]["github"],
): AppConfig["remoteProviders"]["github"] {
  const hostUrl = trimmedStringOrNull(provider?.hostUrl) ?? fallback.hostUrl;
  const lastTestStatus =
    provider?.lastTestStatus &&
    typeof provider.lastTestStatus === "object" &&
    "status" in provider.lastTestStatus &&
    ((provider.lastTestStatus as { status?: unknown }).status === "ok" ||
      (provider.lastTestStatus as { status?: unknown }).status === "error" ||
      (provider.lastTestStatus as { status?: unknown }).status === "untested")
      ? (provider.lastTestStatus as AppConfig["remoteProviders"]["github"]["lastTestStatus"])
      : null;
  return {
    enabled: provider?.enabled === true,
    hostUrl,
    tokenStored: provider?.tokenStored === true,
    lastTestStatus,
  };
}

function trimmedStringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function booleanDefault(value: unknown, fallback: boolean): boolean {
  return value === undefined ? fallback : value === true;
}

function boundedNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}

function oneOf<const T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}

export function layoutFromSidebarResize(
  resizeState: {
    side: "left" | "right";
    startX: number;
    startLayout: SidebarLayoutConfig;
  },
  clientX: number,
): SidebarLayoutConfig {
  const deltaX = clientX - resizeState.startX;
  return normalizeSidebarLayout({
    leftSidebarWidth:
      resizeState.side === "left"
        ? resizeState.startLayout.leftSidebarWidth + deltaX
        : resizeState.startLayout.leftSidebarWidth,
    rightSidebarWidth:
      resizeState.side === "right"
        ? resizeState.startLayout.rightSidebarWidth - deltaX
        : resizeState.startLayout.rightSidebarWidth,
    openFilesHeight: resizeState.startLayout.openFilesHeight,
    openFilesCollapsed: resizeState.startLayout.openFilesCollapsed,
  });
}

export function clampOpenFilesHeight(
  value: number,
  maxAvailable?: number,
): number {
  const maxHeight =
    maxAvailable === undefined
      ? sidebarLayoutBounds.openFiles.max
      : Math.min(sidebarLayoutBounds.openFiles.max, maxAvailable);
  return Math.min(
    maxHeight,
    Math.max(sidebarLayoutBounds.openFiles.min, Math.round(value)),
  );
}

export { defaultSidebarLayout };
