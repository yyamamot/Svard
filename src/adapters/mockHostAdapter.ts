import { createMockDocumentFacade } from "./mockHost/document";
import { createMockGitFacade } from "./mockHost/git";
import { createMockKrokiFacade } from "./mockHost/kroki";
import { createMockProviderTokenFacade } from "./mockHost/providerTokens";
import { createMockWatcherFacade } from "./mockHost/watchers";
import type {
  AppConfig,
  DesktopOpenRequest,
  DirectoryWatchEvent,
  DocumentLinkResolution,
  DocumentLinkResolutionInput,
  DocumentPayload,
  DocumentOrderCatalog,
  DocumentOrderLoadOptions,
  GitBranchDiff,
  GitBranchDiffPreviewBatchItem,
  GitChanges,
  GitCommitDetails,
  GitCommitGraph,
  GitCommitGraphScope,
  GitDiffPreview,
  GitDiffPreviewBatchEntry,
  GitDiffResourceSource,
  GitFileHistory,
  GitRefItem,
  GitRefKind,
  GitRefList,
  GitStatusEntry,
  GitStatusWatchEvent,
  HostAdapter,
  KrokiRequest,
  KrokiResult,
  LocalImageResult,
  ExternalPlantUmlRenderInput,
  ExternalPlantUmlTestInput,
  PlantUmlRenderResult,
  NativeFileDropEvent,
  PlantUmlSvgCacheReadInput,
  PlantUmlSvgCacheReadResult,
  PlantUmlSvgCacheWriteInput,
  PlantUmlSvgCacheWriteResult,
  OpenDocumentOptions,
  ProviderTokenStatus,
  RemoteProviderTestStatus,
  ViewerWindowOpenRequest,
  WatchHandle,
  WorkspacePathResolution,
  WorkspacePathResolutionInput,
  WorkspaceSearchInput,
  WorkspaceSearchResult,
} from "../core/types";
import { searchMockWorkspace } from "../core/workspaceSearch";

export class MockHostAdapter implements HostAdapter {
  saveSvgFile(_fileName: string, _svg: string): Promise<boolean> {
    return Promise.resolve(false);
  }

  private readonly documents = createMockDocumentFacade();
  private readonly newWindowOpenRequests: ViewerWindowOpenRequest[] = [];

  private readonly git = createMockGitFacade();

  private readonly kroki = createMockKrokiFacade();

  private readonly providerTokens = createMockProviderTokenFacade();

  private readonly watchers = createMockWatcherFacade();

  pickDocument(): Promise<string | null> {
    return this.documents.pickDocument();
  }

  pickDirectory(): Promise<string | null> {
    return this.documents.pickDirectory();
  }

  resolveDroppedDocumentPath(path: string): Promise<string> {
    return this.documents.resolveDroppedDocumentPath(path);
  }

  authorizeDirectory(path: string): Promise<void> {
    return this.documents.authorizeDirectory(path);
  }

  openDocument(
    path: string,
    options?: OpenDocumentOptions,
  ): Promise<DocumentPayload> {
    return this.documents.openDocument(path, options);
  }

  listDirectory(path: string) {
    return this.documents.listDirectory(path);
  }

  loadDocumentOrder(
    rootDirectory: string,
    options?: DocumentOrderLoadOptions,
  ): Promise<DocumentOrderCatalog> {
    return this.documents.loadDocumentOrder(rootDirectory, options);
  }

  searchWorkspace(input: WorkspaceSearchInput): Promise<WorkspaceSearchResult> {
    return Promise.resolve(searchMockWorkspace(input));
  }

  loadConfig(): Promise<AppConfig> {
    return this.documents.loadConfig();
  }

  saveConfig(config: AppConfig): Promise<void> {
    return this.documents.saveConfig(config);
  }

  setWindowTheme(): Promise<void> {
    return Promise.resolve();
  }

  watchDocument(
    path: string,
    onChange: () => void,
    onError?: (message: string) => void,
  ): Promise<WatchHandle> {
    return this.watchers.watchDocument(path, onChange, onError);
  }

  watchDirectory(
    path: string,
    onChange: (event: DirectoryWatchEvent) => void,
    onError?: (message: string) => void,
    options?: { recursive?: boolean },
  ): Promise<WatchHandle> {
    return this.watchers.watchDirectory(path, onChange, onError, options);
  }

  watchNativeFileDrop(
    onEvent: (event: NativeFileDropEvent) => void,
  ): Promise<WatchHandle> {
    return this.watchers.watchNativeFileDrop(onEvent);
  }

  watchConfigChanges(): Promise<WatchHandle> {
    return Promise.resolve({
      dispose() {
        // MockHostAdapter does not broadcast cross-window config changes.
      },
    });
  }

  resolveWorkspacePaths(
    input: WorkspacePathResolutionInput,
  ): Promise<WorkspacePathResolution> {
    return this.documents.resolveWorkspacePaths(input);
  }

  resolveDocumentLink(
    input: DocumentLinkResolutionInput,
  ): Promise<DocumentLinkResolution> {
    return this.documents.resolveDocumentLink(input);
  }

  clearDocumentLinkCache(path: string): Promise<void> {
    return this.documents.clearDocumentLinkCache?.(path) ?? Promise.resolve();
  }

  resolveLocalImage(
    source: string,
    documentPath: string,
    context?:
      | DocumentPayload["asciidocContext"]
      | DocumentPayload["resourceContext"],
  ): Promise<LocalImageResult> {
    return this.documents.resolveLocalImage(source, documentPath, context);
  }

  resolveGitDiffLocalImage(input: {
    source: string;
    documentPath: string;
    repositoryRoot: string;
    resourceSource: GitDiffResourceSource;
    context?:
      | DocumentPayload["asciidocContext"]
      | DocumentPayload["resourceContext"];
  }): Promise<LocalImageResult> {
    return this.documents.resolveGitDiffLocalImage(input);
  }

  renderDiagram(input: KrokiRequest): Promise<KrokiResult> {
    return this.kroki.renderDiagram(input);
  }

  renderExternalPlantUml(
    _input: ExternalPlantUmlRenderInput,
  ): Promise<PlantUmlRenderResult> {
    return Promise.resolve({
      status: "error",
      diagnostics: [
        "External PlantUML fallback is not available in browser preview.",
      ],
      metrics: { renderMs: 0, cacheStatus: "disabled" },
    });
  }

  testExternalPlantUml(
    _input: ExternalPlantUmlTestInput,
  ): Promise<PlantUmlRenderResult> {
    return Promise.resolve({
      status: "error",
      diagnostics: [
        "External PlantUML test is only available in the desktop app.",
      ],
      metrics: { renderMs: 0, cacheStatus: "disabled" },
    });
  }

  clearKrokiCache(): Promise<void> {
    return this.kroki.clearKrokiCache();
  }

  readPlantUmlSvgCache(
    input: PlantUmlSvgCacheReadInput,
  ): Promise<PlantUmlSvgCacheReadResult> {
    return this.kroki.readPlantUmlSvgCache(input);
  }

  writePlantUmlSvgCache(
    input: PlantUmlSvgCacheWriteInput,
  ): Promise<PlantUmlSvgCacheWriteResult> {
    return this.kroki.writePlantUmlSvgCache(input);
  }

  clearPlantUmlSvgCache(): Promise<void> {
    return this.kroki.clearPlantUmlSvgCache();
  }

  openExternalUrl(url: string): Promise<void> {
    return this.documents.openExternalUrl(url);
  }

  openPathInEditor(path: string): Promise<void> {
    return this.documents.openPathInEditor(path);
  }

  openNewWindow(request: ViewerWindowOpenRequest): Promise<void> {
    this.newWindowOpenRequests.push(structuredClone(request));
    recordNewWindowOpenRequest(request);
    return Promise.resolve();
  }

  openDocumentInNewWindow(request: ViewerWindowOpenRequest): Promise<void> {
    this.newWindowOpenRequests.push(structuredClone(request));
    recordNewWindowOpenRequest(request);
    return Promise.resolve();
  }

  openCurrentDocumentInNewWindow(
    request: ViewerWindowOpenRequest,
  ): Promise<void> {
    return this.openDocumentInNewWindow(request);
  }

  takeCurrentViewerWindowOpenRequest(): Promise<ViewerWindowOpenRequest | null> {
    return Promise.resolve(null);
  }

  getNewWindowOpenRequests(): ViewerWindowOpenRequest[] {
    return structuredClone(this.newWindowOpenRequests);
  }

  getNewWindowOpenPaths(): string[] {
    return this.newWindowOpenRequests
      .map((request) => request.path)
      .filter((path): path is string => Boolean(path));
  }

  getGitStatusSummary(paths: string[]): Promise<GitStatusEntry[]> {
    return this.git.getGitStatusSummary(paths);
  }

  getGitChanges(pathOrRoot: string): Promise<GitChanges> {
    return this.git.getGitChanges(pathOrRoot);
  }

  getGitBranchDiff(
    pathOrRoot: string,
    options?: {
      baseRef?: string | null;
      headRef?: string | null;
      remoteProviders?: AppConfig["remoteProviders"] | null;
      network?: AppConfig["network"] | null;
    },
  ): Promise<GitBranchDiff> {
    return this.git.getGitBranchDiff(pathOrRoot, options);
  }

  saveProviderToken(
    provider: "github" | "gitlab",
    hostUrl: string,
    token: string,
  ): Promise<ProviderTokenStatus> {
    return this.providerTokens.saveProviderToken(provider, hostUrl, token);
  }

  deleteProviderToken(
    provider: "github" | "gitlab",
    hostUrl: string,
  ): Promise<ProviderTokenStatus> {
    return this.providerTokens.deleteProviderToken(provider, hostUrl);
  }

  getProviderTokenStatus(
    provider: "github" | "gitlab",
    hostUrl: string,
  ): Promise<ProviderTokenStatus> {
    return this.providerTokens.getProviderTokenStatus(provider, hostUrl);
  }

  testProviderConnection(
    provider: "github" | "gitlab",
    hostUrl: string,
  ): Promise<RemoteProviderTestStatus> {
    return this.providerTokens.testProviderConnection(provider, hostUrl);
  }

  getGitBranchFileDiff(
    pathOrRoot: string,
    options: {
      baseRef: string;
      headRef?: string | null;
      path: string;
      oldPath?: string | null;
    },
  ): Promise<GitDiffPreview> {
    return this.git.getGitBranchFileDiff(pathOrRoot, options);
  }

  getGitBranchFileDiffs(
    repositoryRoot: string,
    options: {
      baseRef: string;
      headRef?: string | null;
      items: GitBranchDiffPreviewBatchItem[];
    },
  ): Promise<GitDiffPreviewBatchEntry[]> {
    return this.git.getGitBranchFileDiffs(repositoryRoot, options);
  }

  getGitCommitGraph(
    pathOrRoot: string,
    options?: {
      scope?: GitCommitGraphScope;
      path?: string | null;
      limit?: number;
      cursor?: string | null;
    },
  ): Promise<GitCommitGraph> {
    return this.git.getGitCommitGraph(pathOrRoot, options);
  }

  watchGitStatus(
    paths: string[],
    onChange: (event: GitStatusWatchEvent) => void,
    onError?: (message: string) => void,
  ): Promise<WatchHandle> {
    return this.watchers.watchGitStatus(paths, onChange, onError);
  }

  getGitDiffPreview(path: string): Promise<GitDiffPreview> {
    return this.git.getGitDiffPreview(path);
  }

  getGitDiffPreviews(
    repositoryRoot: string,
    relativePaths: string[],
  ): Promise<GitDiffPreviewBatchEntry[]> {
    return this.git.getGitDiffPreviews(repositoryRoot, relativePaths);
  }

  getGitFileHistory(
    path: string,
    options?: {
      limit?: number;
      cursor?: string | null;
    },
  ): Promise<GitFileHistory> {
    return this.git.getGitFileHistory(path, options);
  }

  getGitFileRevisionDiff(
    path: string,
    revision: string,
  ): Promise<GitDiffPreview> {
    return this.git.getGitFileRevisionDiff(path, revision);
  }

  getGitFileCommitDiff(
    path: string,
    revision: string,
  ): Promise<GitDiffPreview> {
    return this.git.getGitFileCommitDiff(path, revision);
  }

  getGitFileCommitDiffs(
    repositoryRoot: string,
    revision: string,
    relativePaths: string[],
  ): Promise<GitDiffPreviewBatchEntry[]> {
    return this.git.getGitFileCommitDiffs(
      repositoryRoot,
      revision,
      relativePaths,
    );
  }

  getGitFileRevisionPairDiff(
    path: string,
    leftRevision: string,
    rightRevision: string,
  ): Promise<GitDiffPreview> {
    return this.git.getGitFileRevisionPairDiff(
      path,
      leftRevision,
      rightRevision,
    );
  }

  getGitCommitDetails(
    path: string,
    revision: string,
  ): Promise<GitCommitDetails> {
    return this.git.getGitCommitDetails(path, revision);
  }

  listGitRefs(
    path: string,
    kind: GitRefKind,
    options?: {
      limit?: number;
      cursor?: string | null;
      query?: string | null;
    },
  ): Promise<GitRefList> {
    return this.git.listGitRefs(path, kind, options);
  }

  getGitFileRefDiff(path: string, ref: GitRefItem): Promise<GitDiffPreview> {
    return this.git.getGitFileRefDiff(path, ref);
  }

  compareDocuments(
    leftPath: string,
    rightPath: string,
  ): Promise<GitDiffPreview> {
    return this.documents.compareDocuments(leftPath, rightPath);
  }

  takePendingOpenRequests(): Promise<DesktopOpenRequest[]> {
    return this.watchers.takePendingOpenRequests();
  }

  watchOpenRequests(
    handler: (request: DesktopOpenRequest) => void,
  ): Promise<WatchHandle> {
    return this.watchers.watchOpenRequests(handler);
  }
}

function recordNewWindowOpenRequest(request: ViewerWindowOpenRequest): void {
  const target = globalThis as typeof globalThis & {
    __SVARD_NEW_WINDOW_OPEN_REQUESTS__?: ViewerWindowOpenRequest[];
  };
  target.__SVARD_NEW_WINDOW_OPEN_REQUESTS__ = [
    ...(target.__SVARD_NEW_WINDOW_OPEN_REQUESTS__ ?? []),
    structuredClone(request),
  ];
}
