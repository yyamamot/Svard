import { MockAgentFacade } from "./mockHost/agent";
import { createMockDocumentFacade } from "./mockHost/document";
import { createMockCodexContextFacade } from "./mockHost/codex";
import { createMockGitFacade } from "./mockHost/git";
import { createMockKrokiFacade } from "./mockHost/kroki";
import { createMockProviderTokenFacade } from "./mockHost/providerTokens";
import { createMockWatcherFacade } from "./mockHost/watchers";
import type {
  AppConfig,
  AgentChatOriginAction,
  AgentChatOwnerSync,
  AgentChatWindowOpenRequest,
  CodexCliProbe,
  CodexContextFile,
  CodexContextFileLoadInput,
  CodexContextSearchInput,
  CodexContextSearchItem,
  CodexTurnEvent,
  CodexTurnInput,
  CodexTurnOutcome,
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

export class MockHostAdapter extends MockAgentFacade implements HostAdapter {
  private agentChatWindowRequest: AgentChatWindowOpenRequest | null = null;

  openAgentChatWindow(request: AgentChatWindowOpenRequest): Promise<string> {
    const handoffId = request.handoffId ?? crypto.randomUUID();
    this.agentChatWindowRequest = structuredClone({
      ...request,
      handoffId,
      originWindowLabel: request.originWindowLabel ?? "main",
    });
    (
      globalThis as typeof globalThis & {
        __SVARD_MOCK_AGENT_REATTACH__?: () => void;
      }
    ).__SVARD_MOCK_AGENT_REATTACH__ = () => {
      const current = this.agentChatWindowRequest;
      if (!current) return;
      globalThis.dispatchEvent(
        new CustomEvent("svard-agent-chat-reattach", {
          detail: structuredClone(current.snapshot),
        }),
      );
    };
    queueMicrotask(() => {
      globalThis.dispatchEvent(
        new CustomEvent("svard-agent-chat-ready", { detail: handoffId }),
      );
    });
    return Promise.resolve(handoffId);
  }

  takeCurrentAgentChatWindowRequest(): Promise<AgentChatWindowOpenRequest | null> {
    const request = this.agentChatWindowRequest;
    this.agentChatWindowRequest = null;
    return Promise.resolve(request ? structuredClone(request) : null);
  }

  focusAgentChatWindow(): Promise<boolean> {
    return Promise.resolve(Boolean(this.agentChatWindowRequest));
  }

  closeAgentChatWindow(): Promise<void> {
    this.agentChatWindowRequest = null;
    delete (
      globalThis as typeof globalThis & {
        __SVARD_MOCK_AGENT_REATTACH__?: () => void;
      }
    ).__SVARD_MOCK_AGENT_REATTACH__;
    return Promise.resolve();
  }

  watchAgentChatReattach(
    onSnapshot: (snapshot: AgentChatWindowOpenRequest["snapshot"]) => void,
  ): Promise<WatchHandle> {
    const handler = (event: Event) =>
      onSnapshot(
        (event as CustomEvent<AgentChatWindowOpenRequest["snapshot"]>).detail,
      );
    globalThis.addEventListener("svard-agent-chat-reattach", handler);
    return Promise.resolve({
      dispose: () =>
        globalThis.removeEventListener("svard-agent-chat-reattach", handler),
    });
  }

  requestAgentChatReattach(): Promise<void> {
    globalThis.dispatchEvent(
      new CustomEvent("svard-agent-chat-reattach-request"),
    );
    return Promise.resolve();
  }

  watchAgentChatReattachRequest(onRequest: () => void): Promise<WatchHandle> {
    globalThis.addEventListener("svard-agent-chat-reattach-request", onRequest);
    return Promise.resolve({
      dispose: () =>
        globalThis.removeEventListener(
          "svard-agent-chat-reattach-request",
          onRequest,
        ),
    });
  }

  watchAgentChatReattachReady(onReady: () => void): Promise<WatchHandle> {
    globalThis.addEventListener("svard-agent-chat-reattach-ready", onReady);
    return Promise.resolve({
      dispose: () =>
        globalThis.removeEventListener(
          "svard-agent-chat-reattach-ready",
          onReady,
        ),
    });
  }

  acknowledgeAgentChatReattach(): Promise<void> {
    globalThis.dispatchEvent(
      new CustomEvent("svard-agent-chat-reattach-ready"),
    );
    this.agentChatWindowRequest = null;
    delete (
      globalThis as typeof globalThis & {
        __SVARD_MOCK_AGENT_REATTACH__?: () => void;
      }
    ).__SVARD_MOCK_AGENT_REATTACH__;
    return Promise.resolve();
  }

  emitAgentChatReattach(
    _originWindowLabel: string,
    snapshot: AgentChatWindowOpenRequest["snapshot"],
  ): Promise<void> {
    globalThis.dispatchEvent(
      new CustomEvent("svard-agent-chat-reattach", { detail: snapshot }),
    );
    return Promise.resolve();
  }

  watchAgentChatReady(
    onReady: (handoffId: string) => void,
  ): Promise<WatchHandle> {
    const handler = (event: Event) =>
      onReady((event as CustomEvent<string>).detail);
    globalThis.addEventListener("svard-agent-chat-ready", handler);
    return Promise.resolve({
      dispose: () =>
        globalThis.removeEventListener("svard-agent-chat-ready", handler),
    });
  }

  emitAgentChatReady(
    _originWindowLabel: string,
    handoffId: string,
  ): Promise<void> {
    globalThis.dispatchEvent(
      new CustomEvent("svard-agent-chat-ready", { detail: handoffId }),
    );
    return Promise.resolve();
  }

  watchAgentChatClosed(onClosed: () => void): Promise<WatchHandle> {
    globalThis.addEventListener("svard-agent-chat-closed", onClosed);
    return Promise.resolve({
      dispose: () =>
        globalThis.removeEventListener("svard-agent-chat-closed", onClosed),
    });
  }

  emitAgentChatClosed(_originWindowLabel: string): Promise<void> {
    globalThis.dispatchEvent(new CustomEvent("svard-agent-chat-closed"));
    return Promise.resolve();
  }

  watchAgentChatOriginAction(
    onAction: (action: AgentChatOriginAction) => void,
  ): Promise<WatchHandle> {
    const handler = (event: Event) =>
      onAction((event as CustomEvent<AgentChatOriginAction>).detail);
    globalThis.addEventListener("svard-agent-chat-origin-action", handler);
    return Promise.resolve({
      dispose: () =>
        globalThis.removeEventListener(
          "svard-agent-chat-origin-action",
          handler,
        ),
    });
  }

  routeAgentChatOriginAction(action: AgentChatOriginAction): Promise<void> {
    globalThis.dispatchEvent(
      new CustomEvent("svard-agent-chat-origin-action", { detail: action }),
    );
    return Promise.resolve();
  }

  watchAgentChatOwnerSync(
    onSync: (sync: AgentChatOwnerSync) => void,
  ): Promise<WatchHandle> {
    const handler = (event: Event) =>
      onSync((event as CustomEvent<AgentChatOwnerSync>).detail);
    globalThis.addEventListener("svard-agent-chat-owner-sync", handler);
    return Promise.resolve({
      dispose: () =>
        globalThis.removeEventListener("svard-agent-chat-owner-sync", handler),
    });
  }

  routeAgentChatOwnerSync(sync: AgentChatOwnerSync): Promise<void> {
    globalThis.dispatchEvent(
      new CustomEvent("svard-agent-chat-owner-sync", { detail: sync }),
    );
    return Promise.resolve();
  }

  private readonly cancelledCodexRuns = new Set<string>();
  private readonly codexSessions = new Set<string>();
  private readonly codexContexts = createMockCodexContextFacade();

  probeCodex(): Promise<CodexCliProbe> {
    return Promise.resolve({
      state: "ready",
      source: "path",
      version: "codex-cli mock",
    });
  }

  loadCodexContextFile(
    input: CodexContextFileLoadInput,
  ): Promise<CodexContextFile> {
    return this.codexContexts.loadCodexContextFile(input);
  }

  pickCodexContextFiles(
    workspaceRoot?: string | null,
  ): Promise<CodexContextFile[]> {
    return this.codexContexts.pickCodexContextFiles(workspaceRoot);
  }

  searchCodexContextFiles(
    input: CodexContextSearchInput,
  ): Promise<CodexContextSearchItem[]> {
    return this.codexContexts.searchCodexContextFiles(input);
  }

  resolveDroppedCodexContextPath(path: string): Promise<string> {
    return this.codexContexts.resolveDroppedCodexContextPath(path);
  }

  async runCodexTurn(
    input: CodexTurnInput,
    onEvent: (event: CodexTurnEvent) => void,
  ): Promise<CodexTurnOutcome> {
    if (typeof window !== "undefined") {
      (
        window as typeof window & {
          __SVARD_LAST_CODEX_TURN_INPUT__?: CodexTurnInput;
        }
      ).__SVARD_LAST_CODEX_TURN_INPUT__ = structuredClone(input);
    }
    this.cancelledCodexRuns.delete(input.runId);
    if (input.openUiPrompt && !this.codexSessions.has(input.clientSessionId)) {
      this.codexSessions.add(input.clientSessionId);
      onEvent({ type: "sessionStarted" });
    }
    if (input.contextAdditions.length > 0) {
      onEvent({
        type: "contextAccepted",
        contextIds: input.contextAdditions.map((context) => context.contextId),
      });
    }
    onEvent({ type: "turnStarted" });
    const delay = input.question.toLowerCase().includes("cancel") ? 800 : 180;
    await new Promise((resolve) => globalThis.setTimeout(resolve, delay));

    if (this.cancelledCodexRuns.delete(input.runId)) {
      onEvent({ type: "cancelled" });
      return { status: "cancelled" };
    }

    const text = input.question.toLowerCase().includes("invalid openui")
      ? "<UnknownComponent value='blocked' />"
      : input.responseMode === "visualize"
        ? 'root = DocumentAnswer("Document comparison", "The synthetic document separates safe local rendering from optional remote behavior.", ["Local rendering remains the default", "Remote behavior requires explicit consent", "Codex receives a text snapshot only"], [])'
        : [
            "This is a deterministic Mock Codex response.",
            "",
            "The document is treated as reference data, and no file path or workspace metadata was sent.",
          ].join("\n");
    onEvent({ type: "assistantCompleted", text });
    onEvent({ type: "completed" });
    return { status: "completed" };
  }

  cancelCodexTurn(runId: string): Promise<void> {
    this.cancelledCodexRuns.add(runId);
    return Promise.resolve();
  }

  closeCodexSession(_clientSessionId: string): Promise<void> {
    this.codexSessions.delete(_clientSessionId);
    return Promise.resolve();
  }

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
