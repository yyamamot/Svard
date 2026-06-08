import type {
  AppConfig,
  BookmarkEntry,
  LayoutConfig,
  NetworkConfig,
  RemoteProvidersConfig,
  RemoteProviderTestStatus,
  ProviderTokenStatus,
  SplitSessionState,
  WorkspaceState,
} from "./config";
import type {
  AsciiDocRenderContext,
  DirectoryEntry,
  DocumentLinkResolution,
  DocumentLinkResolutionInput,
  DocumentPayload,
  WorkspacePathResolution,
  WorkspacePathResolutionInput,
  WorkspaceSearchInput,
  WorkspaceSearchResult,
} from "./document";
import type {
  DocumentDiffPreview,
  GitBranchDiff,
  GitChanges,
  GitCommitDetails,
  GitCommitGraph,
  GitCommitGraphScope,
  GitDiffPreview,
  GitFileHistory,
  GitRefItem,
  GitRefKind,
  GitRefList,
  GitStatusEntry,
  GitStatusWatchEvent,
} from "./git";
import type { KrokiRequest, KrokiResult, LocalImageResult } from "./render";

export interface WatchHandle {
  dispose(): void;
}

export interface DirectoryWatchEvent {
  path: string;
  changedPath?: string;
  kind: string;
}

export interface DesktopOpenRequest {
  paths: string[];
  cwd?: string;
  source: "initial" | "single-instance";
  diagnostics?: string[];
}

export interface NativeFileDropEvent {
  type: "enter" | "over" | "drop" | "leave";
  paths?: string[];
  position?: {
    x: number;
    y: number;
  };
}

export interface ViewerWindowOpenRequest {
  sessionId?: string;
  path?: string | null;
  activePath?: string | null;
  openTabs?: string[];
  pinnedTabs?: string[];
  scrollPositions?: Record<string, number>;
  activeHeadingByPath?: Record<string, string>;
  recentTabs?: string[];
  splitSession?: SplitSessionState | null;
  rootDirectory: string | null;
  expandedDirectories: string[];
  sidebarTab: WorkspaceState["sidebarTab"];
  sidebarVisible?: boolean;
  rightSidebarVisible?: boolean;
  layout?: LayoutConfig;
  pinned?: boolean;
  bookmarks: BookmarkEntry[];
}

export interface HostAdapter {
  pickDocument(): Promise<string | null>;
  pickDirectory(): Promise<string | null>;
  resolveDroppedDocumentPath(path: string): Promise<string>;
  authorizeDirectory(path: string): Promise<void>;
  openDocument(path: string): Promise<DocumentPayload>;
  listDirectory(path: string): Promise<DirectoryEntry[]>;
  searchWorkspace(input: WorkspaceSearchInput): Promise<WorkspaceSearchResult>;
  loadConfig(): Promise<AppConfig>;
  saveConfig(config: AppConfig): Promise<void>;
  setWindowTheme(theme: AppConfig["theme"]): Promise<void>;
  watchDocument(
    path: string,
    onChange: () => void,
    onError?: (message: string) => void,
  ): Promise<WatchHandle>;
  watchDirectory(
    path: string,
    onChange: (event: DirectoryWatchEvent) => void,
    onError?: (message: string) => void,
    options?: { recursive?: boolean },
  ): Promise<WatchHandle>;
  watchNativeFileDrop(
    onEvent: (event: NativeFileDropEvent) => void,
  ): Promise<WatchHandle>;
  watchConfigChanges?(onChange: () => void): Promise<WatchHandle>;
  resolveWorkspacePaths(
    input: WorkspacePathResolutionInput,
  ): Promise<WorkspacePathResolution>;
  resolveDocumentLink(
    input: DocumentLinkResolutionInput,
  ): Promise<DocumentLinkResolution>;
  clearDocumentLinkCache?(path: string): Promise<void>;
  resolveLocalImage(
    source: string,
    documentPath: string,
    context?: AsciiDocRenderContext | null,
  ): Promise<LocalImageResult>;
  renderDiagram(input: KrokiRequest): Promise<KrokiResult>;
  clearKrokiCache(): Promise<void>;
  openExternalUrl(url: string): Promise<void>;
  openPathInEditor(path: string): Promise<void>;
  openNewWindow(request: ViewerWindowOpenRequest): Promise<void>;
  openDocumentInNewWindow(request: ViewerWindowOpenRequest): Promise<void>;
  openCurrentDocumentInNewWindow(
    request: ViewerWindowOpenRequest,
  ): Promise<void>;
  takeCurrentViewerWindowOpenRequest?(): Promise<
    ViewerWindowOpenRequest | null
  >;
  getGitStatusSummary(paths: string[]): Promise<GitStatusEntry[]>;
  getGitChanges(pathOrRoot: string): Promise<GitChanges>;
  getGitBranchDiff(
    pathOrRoot: string,
    options?: {
      baseRef?: string | null;
      headRef?: string | null;
      remoteProviders?: RemoteProvidersConfig | null;
      network?: NetworkConfig | null;
    },
  ): Promise<GitBranchDiff>;
  saveProviderToken(
    provider: "github" | "gitlab",
    hostUrl: string,
    token: string,
  ): Promise<ProviderTokenStatus>;
  deleteProviderToken(
    provider: "github" | "gitlab",
    hostUrl: string,
  ): Promise<ProviderTokenStatus>;
  getProviderTokenStatus(
    provider: "github" | "gitlab",
    hostUrl: string,
  ): Promise<ProviderTokenStatus>;
  testProviderConnection(
    provider: "github" | "gitlab",
    hostUrl: string,
    network?: NetworkConfig | null,
  ): Promise<RemoteProviderTestStatus>;
  getGitBranchFileDiff(
    pathOrRoot: string,
    options: {
      baseRef: string;
      headRef?: string | null;
      path: string;
      oldPath?: string | null;
    },
  ): Promise<GitDiffPreview>;
  getGitCommitGraph(
    pathOrRoot: string,
    options?: {
      scope?: GitCommitGraphScope;
      path?: string | null;
      limit?: number;
      cursor?: string | null;
    },
  ): Promise<GitCommitGraph>;
  watchGitStatus(
    paths: string[],
    onChange: (event: GitStatusWatchEvent) => void,
    onError?: (message: string) => void,
  ): Promise<WatchHandle>;
  getGitDiffPreview(path: string): Promise<GitDiffPreview>;
  getGitFileHistory(
    path: string,
    options?: {
      limit?: number;
      cursor?: string | null;
    },
  ): Promise<GitFileHistory>;
  getGitFileRevisionDiff(
    path: string,
    revision: string,
  ): Promise<DocumentDiffPreview>;
  getGitFileCommitDiff(
    path: string,
    revision: string,
  ): Promise<DocumentDiffPreview>;
  getGitFileRevisionPairDiff(
    path: string,
    leftRevision: string,
    rightRevision: string,
  ): Promise<DocumentDiffPreview>;
  getGitCommitDetails(
    path: string,
    revision: string,
  ): Promise<GitCommitDetails>;
  listGitRefs(
    path: string,
    kind: GitRefKind,
    options?: {
      limit?: number;
      cursor?: string | null;
      query?: string | null;
    },
  ): Promise<GitRefList>;
  getGitFileRefDiff(
    path: string,
    ref: GitRefItem,
  ): Promise<DocumentDiffPreview>;
  compareDocuments(
    leftPath: string,
    rightPath: string,
  ): Promise<DocumentDiffPreview>;
  takePendingOpenRequests(): Promise<DesktopOpenRequest[]>;
  watchOpenRequests(
    handler: (request: DesktopOpenRequest) => void,
  ): Promise<WatchHandle>;
}
