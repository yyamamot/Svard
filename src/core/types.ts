import type { CommandId } from "./commands";

export type DocumentFormat = "asciidoc" | "markdown";

export interface DocumentPayload {
  path: string;
  basePath: string;
  format: DocumentFormat;
  source: string;
  updatedAt: string;
  includeFiles?: AsciiDocIncludeFile[];
  asciidocContext?: AsciiDocRenderContext | null;
}

export interface AsciiDocIncludeFile {
  path: string;
  source: string;
}

export interface AsciiDocRenderContext {
  baseDir: string;
  workspaceRoot: string;
  documentDir: string;
  attributes: Record<string, string>;
  resourceRoots: string[];
}

export interface DirectoryEntry {
  name: string;
  path: string;
  kind: "file" | "directory";
}

export interface WorkspaceSearchInput {
  rootPath: string;
  query: string;
  maxFiles: number;
  maxMatches: number;
  maxBytesPerFile: number;
}

export interface WorkspaceSearchResultItem {
  path: string;
  displayPath: string;
  line: number;
  heading?: string | null;
  snippet: string;
  matchCount: number;
  sourceReference: string;
}

export interface WorkspaceSearchResult {
  status: "ok" | "empty" | "error";
  rootPath: string;
  query: string;
  results: WorkspaceSearchResultItem[];
  totalMatches: number;
  searchedFiles: number;
  skippedFiles: number;
  capped: boolean;
  message?: string | null;
}

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

export interface KrokiRequest {
  diagramType: string;
  source: string;
  config: KrokiConfig;
  confirmedRemoteSend?: boolean;
}

export interface KrokiResult {
  status: "disabled" | "rendered" | "error";
  message?: string;
  artifactUrl?: string;
  mediaType?: string;
  content?: string;
  cacheStatus?: "disabled" | "hit" | "miss" | "not-written";
}

export interface LocalImageResult {
  status: "resolved" | "blocked" | "error";
  mediaType?: string;
  content?: string;
  encoding?: "base64" | "utf8";
  placeholderText?: string;
}

export interface WorkspacePathResolutionInput {
  documentPath?: string | null;
  basePath?: string | null;
  lastDirectory?: string | null;
  recentDirectories: string[];
  expandedDirectories: string[];
}

export type WorkspaceLocationKind =
  | "local"
  | "wsl-unc"
  | "network-unc"
  | "unknown";

export type WorkspacePerformanceMode = "normal" | "wsl-mitigated";

export interface WorkspaceEnvironment {
  locationKind: WorkspaceLocationKind;
  performanceMode: WorkspacePerformanceMode;
}

export interface WorkspacePathResolution {
  initialDirectory?: string | null;
  expandedDirectories: string[];
  environment?: WorkspaceEnvironment | null;
}

export interface DocumentLinkResolutionInput {
  documentPath: string;
  href: string;
  kind?: "local" | "wikilink";
  target?: string | null;
  label?: string | null;
}

export type DocumentLinkResolutionStatus =
  | "resolved"
  | "anchor"
  | "external"
  | "blocked";

export interface DocumentLinkResolutionMetrics {
  kind: string;
  status: string;
  cacheStatus?: string | null;
  noteCount?: number | null;
  scannedDirs?: number | null;
  durationMs?: number | null;
  performanceMode?: WorkspacePerformanceMode | null;
  reason?: string | null;
}

export interface DocumentLinkResolution {
  status: DocumentLinkResolutionStatus;
  path?: string | null;
  href?: string | null;
  hash?: string | null;
  message?: string | null;
  metrics?: DocumentLinkResolutionMetrics | null;
}

export interface SourceLocation {
  line?: number;
  column?: number;
  sourcePath?: string;
  sourceId?: string;
}

export interface Heading {
  id: string;
  level: number;
  text: string;
  sourceLocation?: SourceLocation;
}

export interface RenderResult {
  html: string;
  headings: Heading[];
  sourceBlocks: SourceBlock[];
  diagnostics: RenderDiagnostic[];
  diagramSlots: DiagramSlot[];
  mermaidDiagrams: MermaidDiagram[];
  plantUmlDiagrams: PlantUmlDiagram[];
  graphvizDiagrams: GraphvizDiagram[];
  krokiDiagrams: KrokiDiagram[];
  perf?: RenderPerfStage[];
}

export interface RenderPerfStage {
  event: string;
  durationMs: number;
  bytes?: number;
  count?: number;
}

export interface SourceBlock {
  id: string;
  language?: string;
  sourceLocation?: SourceLocation;
}

export interface RenderDiagnostic {
  id: string;
  severity: "info" | "warning" | "error";
  message: string;
  sourceLocation?: SourceLocation;
}

export interface DiagramSlot {
  id: string;
  diagramType: string;
  renderer: "mermaid" | "plantuml" | "graphviz" | "kroki";
  sourceLocation?: SourceLocation;
}

export interface MermaidDiagram {
  id: string;
  source: string;
  sourceLocation?: SourceLocation;
}

export interface PlantUmlDiagram {
  id: string;
  source: string;
  sourceLocation?: SourceLocation;
}

export interface PlantUmlRenderInput {
  source: string;
  theme: "light" | "dark";
  timeoutMs: number;
  probeMode?: "normal" | "skip-diagnostic" | "dummy-svg";
}

export interface PlantUmlRenderResult {
  status: "rendered" | "error" | "timeout";
  svg?: string;
  diagnostics: string[];
  metrics?: {
    initMs?: number;
    renderMs: number;
    queueWaitMs?: number;
    parentRoundTripMs?: number;
    workerTotalMs?: number;
    renderCoreMs?: number;
    diagnosticMs?: number;
    encodeMs?: number;
    postMessageMs?: number;
    svgBytes?: number;
    mode?: "renderToString" | "dom" | "dummy";
  };
}

export interface GraphvizDiagram {
  id: string;
  diagramType: "graphviz" | "dot";
  source: string;
  sourceLocation?: SourceLocation;
}

export interface GraphvizRenderInput {
  source: string;
  timeoutMs: number;
}

export interface GraphvizRenderResult {
  status: "rendered" | "error" | "timeout";
  svg?: string;
  diagnostics: string[];
  metrics?: {
    renderMs: number;
    queueWaitMs?: number;
    parentRoundTripMs?: number;
    workerTotalMs?: number;
    svgBytes?: number;
  };
}

export interface KrokiDiagram {
  id: string;
  diagramType: string;
  source: string;
  sourceLocation?: SourceLocation;
}

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

export type GitDiffStatus =
  | "clean"
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "untracked"
  | "binary"
  | "not-in-repo"
  | "error";

export interface GitStatusEntry {
  path: string;
  status: GitDiffStatus;
}

export interface GitStatusWatchEvent {
  kind: string;
}

export type GitFileHistoryStatus =
  | "ok"
  | "not-in-repo"
  | "untracked"
  | "no-history"
  | "unsupported"
  | "error";

export interface GitFileHistoryItem {
  revision: string;
  shortHash: string;
  parentRevision?: string | null;
  parentShortHash?: string | null;
  summary: string;
  author: string;
  date: string;
  fileStatus: GitDiffStatus;
}

export interface GitFileHistory {
  status: GitFileHistoryStatus;
  relativePath?: string | null;
  items: GitFileHistoryItem[];
  message?: string | null;
  hasMore?: boolean | null;
  nextCursor?: string | null;
  metrics?: GitFileHistoryMetrics | null;
}

export type GitFileHistoryCacheStatus =
  | "miss"
  | "hit"
  | "incremental"
  | "fallback";

export interface GitFileHistoryMetrics {
  cacheStatus: GitFileHistoryCacheStatus;
  durationMs: number;
  discoveryMs: number;
  statusMs: number;
  headMs: number;
  walkMs: number;
  blobLookupMs: number;
  walkedCommits: number;
  matchedCommits: number;
  returnedCommits?: number | null;
  hasMore?: boolean | null;
  staleCursor?: boolean | null;
}

export type GitRefKind = "branch" | "tag" | "commit";

export type GitRefListStatus =
  | "ok"
  | "not-in-repo"
  | "untracked"
  | "unsupported"
  | "error";

export interface GitRefItem {
  kind: GitRefKind;
  name: string;
  revision: string;
  shortRevision: string;
  summary?: string | null;
}

export interface GitRefList {
  status: GitRefListStatus;
  relativePath?: string | null;
  items: GitRefItem[];
  message?: string | null;
  hasMore?: boolean | null;
  nextCursor?: string | null;
  metrics?: GitRefListMetrics | null;
}

export interface GitRefListMetrics {
  kind: GitRefKind;
  durationMs: number;
  returnedRefs: number;
  walkedCommits: number;
  hasMore: boolean;
  cursorPresent?: boolean | null;
  staleCursor?: boolean | null;
}

export type DocumentDiffSource = "git" | "file";

export type GitDiffLineKind = "context" | "added" | "removed";

export interface GitDiffLine {
  kind: GitDiffLineKind;
  oldLine?: number | null;
  newLine?: number | null;
  text: string;
}

export interface GitDiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: GitDiffLine[];
}

export interface GitDiffPreview {
  source?: DocumentDiffSource;
  repositoryRoot?: string | null;
  relativePath?: string | null;
  leftPath?: string | null;
  rightPath?: string | null;
  status: GitDiffStatus;
  leftLabel: string;
  rightLabel: string;
  hunks: GitDiffHunk[];
  message?: string | null;
  leftText?: string | null;
  rightText?: string | null;
}

export type DocumentDiffPreview = GitDiffPreview;

export interface GitCommitChangedFile {
  path: string;
  status: GitDiffStatus;
  documentPath?: string | null;
}

export type GitChangesStatus = "ok" | "not-in-repo" | "no-history" | "error";

export interface GitChangeEntry {
  path: string;
  status: GitDiffStatus;
  documentPath?: string | null;
}

export interface GitChanges {
  status: GitChangesStatus;
  repositoryRoot?: string | null;
  currentBranch?: string | null;
  headCommit?: GitHeadCommit | null;
  items: GitChangeEntry[];
  message?: string | null;
}

export type GitBranchDiffStatus = "ok" | "not-in-repo" | "no-history" | "error";

export interface GitBranchDiffEntry {
  path: string;
  oldPath?: string | null;
  status: GitDiffStatus;
  documentPath?: string | null;
}

export interface GitBranchDiff {
  status: GitBranchDiffStatus;
  repositoryRoot?: string | null;
  currentBranch?: string | null;
  headCommit?: GitHeadCommit | null;
  baseRef?: string | null;
  headRef?: string | null;
  mergeBase?: string | null;
  baseCandidates: string[];
  providerBaseCandidates?: GitBranchDiffProviderBaseCandidate[];
  items: GitBranchDiffEntry[];
  message?: string | null;
}

export interface GitBranchDiffProviderBaseCandidate {
  provider: "github" | "gitlab";
  label: string;
  baseRef: string;
  sourceBranch: string;
  targetBranch: string;
  available: boolean;
  message?: string | null;
}

export type GitCommitGraphStatus =
  | "ok"
  | "not-in-repo"
  | "untracked"
  | "no-history"
  | "unsupported"
  | "error";

export type GitCommitGraphScope = "repository" | "file";

export interface GitCommitGraphItem {
  revision: string;
  shortHash: string;
  parentRevision?: string | null;
  parentShortHash?: string | null;
  parentRevisions: string[];
  parentShortHashes: string[];
  summary: string;
  author: string;
  date: string;
  fileStatus: GitDiffStatus;
}

export interface GitHeadCommit {
  revision: string;
  shortHash: string;
  summary: string;
}

export interface GitCommitGraph {
  status: GitCommitGraphStatus;
  scope: GitCommitGraphScope;
  repositoryRoot?: string | null;
  relativePath?: string | null;
  currentBranch?: string | null;
  headCommit?: GitHeadCommit | null;
  items: GitCommitGraphItem[];
  message?: string | null;
  hasMore?: boolean | null;
  nextCursor?: string | null;
  metrics?: GitCommitGraphMetrics | null;
}

export interface GitCommitGraphMetrics {
  cacheStatus: GitFileHistoryCacheStatus;
  durationMs: number;
  walkedCommits: number;
  returnedCommits: number;
  hasMore: boolean;
  staleCursor?: boolean | null;
}

export interface GitCommitDetails {
  revision: string;
  shortHash: string;
  summary: string;
  author: string;
  date: string;
  files: GitCommitChangedFile[];
  message?: string | null;
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
