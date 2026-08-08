import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openUrl } from "@tauri-apps/plugin-opener";
import { buildFileDocumentDiffPreview } from "../core/documentDiff";
import { isSafeExternalUrlToOpen } from "../ui/lib/path";
import { TauriDocumentHostFacade } from "./tauriHost/document";
import { invokeCommand } from "./tauriHost/invoke";
import type {
  AppConfig,
  DirectoryWatchEvent,
  DesktopOpenRequest,
  DocumentPayload,
  GitBranchDiff,
  GitBranchDiffPreviewBatchItem,
  GitChanges,
  GitCommitGraph,
  GitCommitGraphScope,
  GitCommitDetails,
  GitFileHistory,
  GitDiffPreview,
  GitDiffPreviewBatchEntry,
  GitDiffResourceSource,
  GitRefItem,
  GitRefKind,
  GitRefList,
  GitStatusWatchEvent,
  GitStatusEntry,
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
  ProviderTokenStatus,
  RemoteProviderTestStatus,
  ViewerWindowOpenRequest,
  WatchHandle,
} from "../core/types";

const desktopOpenRequestEvent = "desktop-open-request";
const configChangedEvent = "config-changed";
const documentWatchEvent = "document-watch-event";
const directoryWatchEvent = "directory-watch-event";
const gitStatusWatchEvent = "git-status-watch-event";
const documentWatchDebounceMs = 200;
const directoryWatchDebounceMs = 250;
const gitStatusWatchDebounceMs = 500;

interface DocumentWatchRegistration {
  watchId: string;
  path: string;
}

interface DocumentWatchEventPayload {
  watchId: string;
  path: string;
  kind: string;
}

interface DirectoryWatchRegistration {
  watchId: string;
  path: string;
}

interface DirectoryWatchEventPayload {
  watchId: string;
  path: string;
  changedPath?: string;
  kind: string;
}

interface GitStatusWatchRegistration {
  watchId: string;
}

interface GitStatusWatchEventPayload {
  watchId: string;
  kind: string;
}

export class TauriHostAdapter
  extends TauriDocumentHostFacade
  implements HostAdapter
{
  async watchDocument(
    path: string,
    onChange: () => void,
    onError?: (message: string) => void,
  ): Promise<{ dispose(): void }> {
    let disposed = false;
    let debounceTimer: number | null = null;
    const registration = await invoke<DocumentWatchRegistration>(
      "watch_document",
      { path },
    );
    let unlisten: () => void;
    try {
      unlisten = await listen<DocumentWatchEventPayload>(
        documentWatchEvent,
        (event) => {
          if (disposed || event.payload.watchId !== registration.watchId) {
            return;
          }
          if (event.payload.kind === "error") {
            onError?.("Native file watch failed");
            return;
          }
          if (debounceTimer !== null) {
            window.clearTimeout(debounceTimer);
          }
          debounceTimer = window.setTimeout(() => {
            debounceTimer = null;
            if (!disposed) {
              onChange();
            }
          }, documentWatchDebounceMs);
        },
      );
    } catch (error) {
      void invoke("unwatch_document", { watchId: registration.watchId });
      throw error;
    }

    return {
      dispose() {
        disposed = true;
        if (debounceTimer !== null) {
          window.clearTimeout(debounceTimer);
        }
        unlisten();
        void invoke("unwatch_document", { watchId: registration.watchId });
      },
    };
  }

  async watchDirectory(
    path: string,
    onChange: (event: DirectoryWatchEvent) => void,
    onError?: (message: string) => void,
    options?: { recursive?: boolean },
  ): Promise<WatchHandle> {
    let disposed = false;
    let debounceTimer: number | null = null;
    let pendingEvent: DirectoryWatchEvent | null = null;
    const registration = await invoke<DirectoryWatchRegistration>(
      "watch_directory",
      { path, recursive: Boolean(options?.recursive) },
    );
    let unlisten: () => void;
    try {
      unlisten = await listen<DirectoryWatchEventPayload>(
        directoryWatchEvent,
        (event) => {
          if (disposed || event.payload.watchId !== registration.watchId) {
            return;
          }
          if (event.payload.kind === "error") {
            onError?.("Native directory watch failed");
            return;
          }
          const nextChangedPath = event.payload.changedPath;
          const previousChangedPath = pendingEvent?.changedPath;
          pendingEvent = {
            path: event.payload.path,
            changedPath:
              nextChangedPath && nextChangedPath !== event.payload.path
                ? nextChangedPath
                : previousChangedPath,
            kind: event.payload.kind,
          };
          if (debounceTimer !== null) {
            window.clearTimeout(debounceTimer);
          }
          debounceTimer = window.setTimeout(() => {
            debounceTimer = null;
            if (!disposed && pendingEvent) {
              onChange(pendingEvent);
              pendingEvent = null;
            }
          }, directoryWatchDebounceMs);
        },
      );
    } catch (error) {
      void invoke("unwatch_directory", { watchId: registration.watchId });
      throw error;
    }

    return {
      dispose() {
        disposed = true;
        if (debounceTimer !== null) {
          window.clearTimeout(debounceTimer);
        }
        unlisten();
        void invoke("unwatch_directory", { watchId: registration.watchId });
      },
    };
  }

  async watchNativeFileDrop(
    onEvent: (event: NativeFileDropEvent) => void,
  ): Promise<WatchHandle> {
    let disposed = false;
    const currentWindow = getCurrentWindow();
    const unlisten = await currentWindow.onDragDropEvent(async (event) => {
      if (disposed) {
        return;
      }
      const payload = event.payload;
      if (payload.type === "leave") {
        onEvent({ type: "leave" });
        return;
      }

      const scaleFactor = await currentWindow.scaleFactor();
      if (disposed) {
        return;
      }
      const logicalPosition = payload.position.toLogical(scaleFactor);
      onEvent({
        type: payload.type,
        paths: "paths" in payload ? payload.paths : undefined,
        position: {
          x: logicalPosition.x,
          y: logicalPosition.y,
        },
      });
    });

    return {
      dispose() {
        disposed = true;
        unlisten();
      },
    };
  }

  async watchConfigChanges(onChange: () => void): Promise<WatchHandle> {
    const unlisten = await listen(configChangedEvent, () => {
      onChange();
    });
    return {
      dispose() {
        unlisten();
      },
    };
  }

  renderDiagram(input: KrokiRequest): Promise<KrokiResult> {
    return invoke("render_diagram", { input });
  }

  renderExternalPlantUml(
    input: ExternalPlantUmlRenderInput,
  ): Promise<PlantUmlRenderResult> {
    return invoke("render_external_plantuml", { input });
  }

  testExternalPlantUml(
    input: ExternalPlantUmlTestInput,
  ): Promise<PlantUmlRenderResult> {
    return invoke("test_external_plantuml", { input });
  }

  clearKrokiCache(): Promise<void> {
    return invoke("clear_kroki_cache");
  }

  readPlantUmlSvgCache(
    input: PlantUmlSvgCacheReadInput,
  ): Promise<PlantUmlSvgCacheReadResult> {
    return invoke("read_plantuml_svg_cache", { input });
  }

  writePlantUmlSvgCache(
    input: PlantUmlSvgCacheWriteInput,
  ): Promise<PlantUmlSvgCacheWriteResult> {
    return invoke("write_plantuml_svg_cache", { input });
  }

  clearPlantUmlSvgCache(): Promise<void> {
    return invoke("clear_plantuml_svg_cache");
  }

  openExternalUrl(url: string): Promise<void> {
    if (!isSafeExternalUrlToOpen(url)) {
      return Promise.reject(new Error("Unsafe external URL blocked"));
    }
    return openUrl(url);
  }

  openPathInEditor(path: string): Promise<void> {
    return invokeCommand("open_path_in_editor", { path });
  }

  openNewWindow(request: ViewerWindowOpenRequest): Promise<void> {
    return invokeCommand("open_new_window", { request });
  }

  openDocumentInNewWindow(request: ViewerWindowOpenRequest): Promise<void> {
    return invokeCommand("open_current_document_in_new_window", { request });
  }

  openCurrentDocumentInNewWindow(
    request: ViewerWindowOpenRequest,
  ): Promise<void> {
    return this.openDocumentInNewWindow(request);
  }

  takeCurrentViewerWindowOpenRequest(): Promise<ViewerWindowOpenRequest | null> {
    return invokeCommand("take_current_viewer_window_open_request");
  }

  resolveLocalImage(
    source: string,
    documentPath: string,
    context?:
      | DocumentPayload["asciidocContext"]
      | DocumentPayload["resourceContext"],
  ): Promise<LocalImageResult> {
    return invoke("resolve_local_image", {
      path: source,
      documentPath,
      context,
    });
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
    return invoke("resolve_git_diff_local_image", {
      path: input.source,
      documentPath: input.documentPath,
      repositoryRoot: input.repositoryRoot,
      resourceSource: input.resourceSource,
      ...(input.context ? { context: input.context } : {}),
    });
  }

  getGitStatusSummary(paths: string[]): Promise<GitStatusEntry[]> {
    return invoke("get_git_status_summary", { paths });
  }

  getGitChanges(pathOrRoot: string): Promise<GitChanges> {
    return invoke("get_git_changes", { path: pathOrRoot });
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
    return invoke("get_git_branch_diff", {
      path: pathOrRoot,
      baseRef: options?.baseRef ?? null,
      headRef: options?.headRef ?? null,
      remoteProviders: options?.remoteProviders ?? null,
      network: options?.network ?? null,
    });
  }

  saveProviderToken(
    provider: "github" | "gitlab",
    hostUrl: string,
    token: string,
  ): Promise<ProviderTokenStatus> {
    return invoke("save_provider_token", { provider, hostUrl, token });
  }

  deleteProviderToken(
    provider: "github" | "gitlab",
    hostUrl: string,
  ): Promise<ProviderTokenStatus> {
    return invoke("delete_provider_token", { provider, hostUrl });
  }

  getProviderTokenStatus(
    provider: "github" | "gitlab",
    hostUrl: string,
  ): Promise<ProviderTokenStatus> {
    return invoke("get_provider_token_status", { provider, hostUrl });
  }

  testProviderConnection(
    provider: "github" | "gitlab",
    hostUrl: string,
    network?: AppConfig["network"] | null,
  ): Promise<RemoteProviderTestStatus> {
    return invoke("test_provider_connection", {
      provider,
      hostUrl,
      network: network ?? null,
    });
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
    return invoke("get_git_branch_file_diff", {
      path: pathOrRoot,
      baseRef: options.baseRef,
      headRef: options.headRef ?? null,
      relativePath: options.path,
      oldPath: options.oldPath ?? null,
    });
  }

  getGitBranchFileDiffs(
    repositoryRoot: string,
    options: {
      baseRef: string;
      headRef?: string | null;
      items: GitBranchDiffPreviewBatchItem[];
    },
  ): Promise<GitDiffPreviewBatchEntry[]> {
    return invoke("get_git_branch_file_diffs", {
      repositoryRoot,
      baseRef: options.baseRef,
      headRef: options.headRef ?? null,
      items: options.items,
    });
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
    return invoke("get_git_commit_graph", {
      path: pathOrRoot,
      scope: options?.scope ?? "repository",
      filePath: options?.path ?? null,
      limit: options?.limit ?? null,
      cursor: options?.cursor ?? null,
    });
  }

  async watchGitStatus(
    paths: string[],
    onChange: (event: GitStatusWatchEvent) => void,
    onError?: (message: string) => void,
  ): Promise<WatchHandle> {
    let disposed = false;
    let debounceTimer: number | null = null;
    const registration = await invoke<GitStatusWatchRegistration>(
      "watch_git_status",
      { paths },
    );
    let unlisten: () => void;
    try {
      unlisten = await listen<GitStatusWatchEventPayload>(
        gitStatusWatchEvent,
        (event) => {
          if (disposed || event.payload.watchId !== registration.watchId) {
            return;
          }
          if (event.payload.kind === "error") {
            onError?.("Native Git status watch failed");
            return;
          }
          if (debounceTimer !== null) {
            window.clearTimeout(debounceTimer);
          }
          debounceTimer = window.setTimeout(() => {
            debounceTimer = null;
            if (!disposed) {
              onChange({ kind: event.payload.kind });
            }
          }, gitStatusWatchDebounceMs);
        },
      );
    } catch (error) {
      void invoke("unwatch_git_status", { watchId: registration.watchId });
      throw error;
    }

    return {
      dispose() {
        disposed = true;
        if (debounceTimer !== null) {
          window.clearTimeout(debounceTimer);
        }
        unlisten();
        void invoke("unwatch_git_status", { watchId: registration.watchId });
      },
    };
  }

  getGitDiffPreview(path: string): Promise<GitDiffPreview> {
    return invoke("get_git_diff_preview", { path });
  }

  getGitDiffPreviews(
    repositoryRoot: string,
    relativePaths: string[],
  ): Promise<GitDiffPreviewBatchEntry[]> {
    return invoke("get_git_diff_previews", { repositoryRoot, relativePaths });
  }

  getGitFileHistory(
    path: string,
    options?: {
      limit?: number;
      cursor?: string | null;
    },
  ): Promise<GitFileHistory> {
    return invoke("get_git_file_history", {
      path,
      limit: options?.limit ?? null,
      cursor: options?.cursor ?? null,
    });
  }

  getGitFileRevisionDiff(
    path: string,
    revision: string,
  ): Promise<GitDiffPreview> {
    return invoke("get_git_file_revision_diff", { path, revision });
  }

  getGitFileCommitDiff(
    path: string,
    revision: string,
  ): Promise<GitDiffPreview> {
    return invoke("get_git_file_commit_diff", { path, revision });
  }

  getGitFileCommitDiffs(
    repositoryRoot: string,
    revision: string,
    relativePaths: string[],
  ): Promise<GitDiffPreviewBatchEntry[]> {
    return invoke("get_git_file_commit_diffs", {
      repositoryRoot,
      revision,
      relativePaths,
    });
  }

  getGitFileRevisionPairDiff(
    path: string,
    leftRevision: string,
    rightRevision: string,
  ): Promise<GitDiffPreview> {
    return invoke("get_git_file_revision_pair_diff", {
      path,
      leftRevision,
      rightRevision,
    });
  }

  getGitCommitDetails(
    path: string,
    revision: string,
  ): Promise<GitCommitDetails> {
    return invoke("get_git_commit_details", { path, revision });
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
    return invoke("list_git_refs", {
      path,
      kind,
      limit: options?.limit ?? null,
      cursor: options?.cursor ?? null,
      query: options?.query ?? null,
    });
  }

  getGitFileRefDiff(path: string, ref: GitRefItem): Promise<GitDiffPreview> {
    return invoke("get_git_file_ref_diff", { path, refItem: ref });
  }

  async compareDocuments(
    leftPath: string,
    rightPath: string,
  ): Promise<GitDiffPreview> {
    const [leftDocument, rightDocument] = await Promise.all([
      this.openDocument(leftPath),
      this.openDocument(rightPath),
    ]);
    return buildFileDocumentDiffPreview({
      leftPath: leftDocument.path,
      leftText: leftDocument.source,
      rightPath: rightDocument.path,
      rightText: rightDocument.source,
    });
  }

  takePendingOpenRequests(): Promise<DesktopOpenRequest[]> {
    return invoke("take_pending_open_requests");
  }

  async watchOpenRequests(
    handler: (request: DesktopOpenRequest) => void,
  ): Promise<WatchHandle> {
    const unlisten = await listen<DesktopOpenRequest>(
      desktopOpenRequestEvent,
      (event) => handler(event.payload),
    );

    return {
      dispose() {
        unlisten();
      },
    };
  }
}
