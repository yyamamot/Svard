import type { CommandId } from "../commands";
import type { AgentExecutablePreference } from "./agent";
import type { DocumentFormat } from "./document";

export interface AppConfig {
  theme: "light" | "dark";
  sidebarVisible: boolean;
  rightSidebarVisible: boolean;
  zoom: number;
  zoomWithMouseWheel: boolean;
  reader: ReaderConfig;
  zenMode: ZenModeConfig;
  layout: LayoutConfig;
  workspace: WorkspaceState;
  diagram: DiagramConfig;
  kroki: KrokiConfig;
  network: NetworkConfig;
  agentProviders: AgentProvidersConfig;
  remoteProviders: RemoteProvidersConfig;
  security: SecurityConfig;
  experimental: ExperimentalConfig;
  keybindings: KeybindingsConfig;
  mouseGestures: MouseGesturesConfig;
}

export interface ReaderConfig {
  asciidocTheme: "asciidoctor" | "antora";
}

export interface ZenModeConfig {
  centerLayout: boolean;
  maxContentWidth: number;
  hideTopbar: boolean;
  hideTabs: boolean;
  hideLeftSidebar: boolean;
  hideRightSidebar: boolean;
  hideStatusBar: boolean;
  fullScreen: boolean;
  exitOnEscape: boolean;
  restorePreviousLayout: boolean;
  applyToDiffPreview: boolean;
}

export interface LayoutConfig {
  leftSidebarWidth: number;
  rightSidebarWidth: number;
  openFilesHeight: number;
  openFilesCollapsed: boolean;
}

export interface WorkspaceState {
  lastDirectory: string | null;
  openTabs: string[];
  activePath: string | null;
  pinnedSearch: string | null;
  expandedDirectories: string[];
  sidebarTab: "files" | "bookmarks" | "sourceControl";
  sourceControlView: "changes" | "branchDiff" | "graph";
  sourceControlGraphScope: "repository" | "file";
  sourceControlBranchDiffBaseRef: string | null;
  bookmarks: BookmarkEntry[];
  recentDocuments: RecentDocumentEntry[];
  recentDirectories: RecentDirectoryEntry[];
  recentTabs: string[];
  pinnedTabs: string[];
  scrollPositions: Record<string, number>;
  activeHeadingByPath: Record<string, string>;
  splitSession: SplitSessionState | null;
  windowSessions: Record<string, WorkspaceWindowSession>;
  restorableWindowSessionIds: string[];
}

export interface WorkspaceWindowSession {
  lastDirectory: string | null;
  openTabs: string[];
  activePath: string | null;
  pinnedSearch: string | null;
  expandedDirectories: string[];
  sidebarTab: "files" | "bookmarks" | "sourceControl";
  sourceControlView: "changes" | "branchDiff" | "graph";
  sourceControlGraphScope: "repository" | "file";
  sourceControlBranchDiffBaseRef: string | null;
  recentDirectories: RecentDirectoryEntry[];
  recentTabs: string[];
  pinnedTabs: string[];
  scrollPositions: Record<string, number>;
  activeHeadingByPath: Record<string, string>;
  splitSession: SplitSessionState | null;
}

export interface BookmarkEntry {
  path: string;
  kind: "file" | "directory";
  name?: string;
}

export interface RecentDocumentEntry {
  path: string;
  name?: string;
  format?: DocumentFormat;
  lastOpenedAt: string;
}

export interface RecentDirectoryEntry {
  path: string;
  name?: string;
  lastOpenedAt: string;
}

export interface SplitSessionState {
  enabled: boolean;
  focusedPaneId: "left" | "right";
  splitRatio: number;
  panePaths: {
    left: string | null;
    right: string | null;
  };
}

export interface DiagramConfig {
  mermaidRenderer: "local" | "kroki";
  plantumlRenderer: "local" | "kroki";
  plantumlTimeoutMs: number;
  plantumlExternalFallback: "disabled" | "on-local-failure";
  plantumlExternalBinaryPath: string | null;
  plantumlExternalTimeoutMs: number;
  plantumlExternalDotPath: string | null;
  graphvizRenderer: "local" | "kroki";
  graphvizTimeoutMs: number;
}

export interface KrokiConfig {
  mode: "disabled" | "remote" | "public";
  endpointUrl: string | null;
  outputFormat: "svg" | "png";
  timeoutMs: number;
  maxBodyBytes: number;
  cacheEnabled: boolean;
  requireRemoteConfirmation: boolean;
}

export interface NetworkConfig {
  httpProxy: HttpProxyConfig;
}

export interface HttpProxyConfig {
  mode: "disabled" | "custom";
  url: string | null;
}

export type AgentProviderConfigId =
  | "codex-app-server"
  | "claude-code-cli"
  | "github-copilot-cli";

export type CodexReasoningEffort = string;

export type CodexPersonality = "default" | "friendly" | "pragmatic" | "none";

export interface AgentProvidersConfig {
  activeProvider: AgentProviderConfigId;
  codex: CodexAgentProviderConfig;
}

export interface CodexAgentProviderConfig {
  executable: AgentExecutablePreference;
  model: string | null;
  reasoningEffort: CodexReasoningEffort;
  personality: CodexPersonality;
  permissionMode: "observe" | "agent" | "fullAccess";
  networkAccess: boolean;
  webSearch: boolean;
}

export interface RemoteProvidersConfig {
  github: RemoteProviderConfig;
  gitlab: RemoteProviderConfig;
}

export interface RemoteProviderConfig {
  enabled: boolean;
  hostUrl: string;
  tokenStored: boolean;
  lastTestStatus?: RemoteProviderTestStatus | null;
}

export interface RemoteProviderTestStatus {
  status: "untested" | "ok" | "error";
  message?: string | null;
}

export interface ProviderTokenStatus {
  stored: boolean;
  message?: string | null;
}

export interface SecurityConfig {
  allowLocalImages: boolean;
  showExternalImages: boolean;
  confirmExternalLinks: boolean;
}

export interface ExperimentalConfig {
  searchHitRuler: boolean;
  restoreAdditionalWindowsOnStartup: boolean;
  diagramPlaceholderRendering: boolean;
  diagramPlaceholderRenderingConfigured?: boolean;
  postDiffGitMarkers: boolean;
  changeReviewDisplay?: "detailed" | "subtle";
}

export interface KeybindingsConfig {
  preset: "native" | "vim" | "emacs";
  mappings?: KeybindingMappingConfig[];
}

export interface KeybindingMappingConfig {
  keys: string;
  commandId: CommandId;
  context?: "global" | "viewer" | "search" | "tabs" | "modal" | "navigation";
  builtIn?: boolean;
}

export interface MouseGesturesConfig {
  enabled: boolean;
  trigger: "rightButton";
  showTrail: boolean;
  minDistancePx: number;
  mappings: MouseGestureMappingConfig[];
}

export interface MouseGestureMappingConfig {
  pattern: string;
  commandId: CommandId;
  builtIn?: boolean;
}
