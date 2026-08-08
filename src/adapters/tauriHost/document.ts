import { Channel, invoke } from "@tauri-apps/api/core";
import { setTheme as setAppTheme } from "@tauri-apps/api/app";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  AgentChatOriginAction,
  AgentChatOwnerSync,
  AgentChatWindowOpenRequest,
  AppConfig,
  CodexCliProbe,
  CodexContextFile,
  CodexContextFileLoadInput,
  CodexContextSearchInput,
  CodexContextSearchItem,
  CodexTurnEvent,
  CodexTurnInput,
  CodexTurnOutcome,
  DirectoryEntry,
  DocumentLinkResolution,
  DocumentLinkResolutionInput,
  DocumentOrderCatalog,
  DocumentOrderLoadOptions,
  DocumentPayload,
  OpenDocumentOptions,
  WatchHandle,
  WorkspacePathResolution,
  WorkspacePathResolutionInput,
  WorkspaceSearchInput,
  WorkspaceSearchResult,
} from "../../core/types";
import { TauriAgentFacade } from "./agent";
import { invokeCommand } from "./invoke";

function workspaceRootForSelectedPath(
  path: string,
  workspaceRoot?: string | null,
): string | null {
  if (!workspaceRoot) return null;
  const normalizedPath = path.replaceAll("\\", "/");
  const normalizedRoot = workspaceRoot
    .replaceAll("\\", "/")
    .replace(/\/+$/u, "");
  return normalizedPath.startsWith(`${normalizedRoot}/`) ? workspaceRoot : null;
}

export class TauriDocumentHostFacade extends TauriAgentFacade {
  openAgentChatWindow(request: AgentChatWindowOpenRequest): Promise<string> {
    return invokeCommand("open_agent_chat_window", { request });
  }

  takeCurrentAgentChatWindowRequest(): Promise<AgentChatWindowOpenRequest | null> {
    return invokeCommand("take_current_agent_chat_window_request");
  }

  focusAgentChatWindow(originWindowLabel?: string): Promise<boolean> {
    return invokeCommand("focus_agent_chat_window", { originWindowLabel });
  }

  closeAgentChatWindow(originWindowLabel?: string): Promise<void> {
    return invokeCommand("close_agent_chat_window", { originWindowLabel });
  }

  async watchAgentChatReattach(
    onSnapshot: (snapshot: AgentChatWindowOpenRequest["snapshot"]) => void,
  ): Promise<WatchHandle> {
    const unlisten = await listen<AgentChatWindowOpenRequest["snapshot"]>(
      "agent-chat-reattach",
      (event) => onSnapshot(event.payload),
    );
    return { dispose: unlisten };
  }

  requestAgentChatReattach(): Promise<void> {
    return invokeCommand("request_agent_chat_reattach");
  }

  async watchAgentChatReattachRequest(
    onRequest: () => void,
  ): Promise<WatchHandle> {
    const unlisten = await listen("agent-chat-reattach-request", onRequest);
    return { dispose: unlisten };
  }

  async watchAgentChatReattachReady(onReady: () => void): Promise<WatchHandle> {
    const unlisten = await listen("agent-chat-reattach-ready", onReady);
    return { dispose: unlisten };
  }

  acknowledgeAgentChatReattach(): Promise<void> {
    return invokeCommand("acknowledge_agent_chat_reattach");
  }

  async watchAgentChatReady(
    onReady: (handoffId: string) => void,
  ): Promise<WatchHandle> {
    const unlisten = await listen<string>("agent-chat-ready", (event) =>
      onReady(event.payload),
    );
    return { dispose: unlisten };
  }

  emitAgentChatReady(
    originWindowLabel: string,
    handoffId: string,
  ): Promise<void> {
    return getCurrentWebviewWindow().emitTo(
      originWindowLabel,
      "agent-chat-ready",
      handoffId,
    );
  }

  async watchAgentChatClosed(onClosed: () => void): Promise<WatchHandle> {
    const unlisten = await listen("agent-chat-closed", onClosed);
    return { dispose: unlisten };
  }

  emitAgentChatClosed(originWindowLabel: string): Promise<void> {
    return getCurrentWebviewWindow().emitTo(
      originWindowLabel,
      "agent-chat-closed",
    );
  }

  async watchAgentChatOriginAction(
    onAction: (action: AgentChatOriginAction) => void,
  ): Promise<WatchHandle> {
    const unlisten = await listen<AgentChatOriginAction>(
      "agent-chat-origin-action",
      (event) => onAction(event.payload),
    );
    return { dispose: unlisten };
  }

  routeAgentChatOriginAction(action: AgentChatOriginAction): Promise<void> {
    return invokeCommand("route_agent_chat_origin_action", { action });
  }

  async watchAgentChatOwnerSync(
    onSync: (sync: AgentChatOwnerSync) => void,
  ): Promise<WatchHandle> {
    const unlisten = await listen<AgentChatOwnerSync>(
      "agent-chat-owner-sync",
      (event) => onSync(event.payload),
    );
    return { dispose: unlisten };
  }

  routeAgentChatOwnerSync(sync: AgentChatOwnerSync): Promise<void> {
    return invokeCommand("route_agent_chat_owner_sync", { sync });
  }

  emitAgentChatReattach(
    originWindowLabel: string,
    snapshot: AgentChatWindowOpenRequest["snapshot"],
  ): Promise<void> {
    return getCurrentWebviewWindow().emitTo(
      originWindowLabel,
      "agent-chat-reattach",
      snapshot,
    );
  }

  probeCodex(): Promise<CodexCliProbe> {
    return invokeCommand("probe_codex");
  }

  loadCodexContextFile(
    input: CodexContextFileLoadInput,
  ): Promise<CodexContextFile> {
    return invokeCommand("load_codex_context_file", { input });
  }

  async pickCodexContextFiles(
    workspaceRoot?: string | null,
  ): Promise<CodexContextFile[]> {
    const selected = await open({ multiple: true });
    const paths =
      typeof selected === "string"
        ? [selected]
        : Array.isArray(selected)
          ? selected
          : [];
    return Promise.all(
      paths.map(async (path) => {
        const selectedWorkspaceRoot = workspaceRootForSelectedPath(
          path,
          workspaceRoot,
        );
        const resolvedPath = selectedWorkspaceRoot
          ? path
          : await this.resolveDroppedCodexContextPath(path);
        return this.loadCodexContextFile({
          path: resolvedPath,
          workspaceRoot: selectedWorkspaceRoot,
          contextId: globalThis.crypto.randomUUID(),
        });
      }),
    );
  }

  searchCodexContextFiles(
    input: CodexContextSearchInput,
  ): Promise<CodexContextSearchItem[]> {
    return invokeCommand("search_codex_context_files", { input });
  }

  resolveDroppedCodexContextPath(path: string): Promise<string> {
    return invokeCommand("resolve_dropped_codex_context_path", { path });
  }

  runCodexTurn(
    input: CodexTurnInput,
    onEvent: (event: CodexTurnEvent) => void,
  ): Promise<CodexTurnOutcome> {
    const onEventChannel = new Channel<CodexTurnEvent>();
    onEventChannel.onmessage = onEvent;
    return invokeCommand("run_codex_turn", {
      input,
      onEvent: onEventChannel,
    });
  }

  cancelCodexTurn(runId: string): Promise<void> {
    return invokeCommand("cancel_codex_turn", { runId });
  }

  closeCodexSession(clientSessionId: string): Promise<void> {
    return invokeCommand("close_codex_session", { clientSessionId });
  }

  saveSvgFile(fileName: string, svg: string): Promise<boolean> {
    return invokeCommand("save_svg_file", { fileName, svg });
  }

  async pickDocument(): Promise<string | null> {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Markup documents",
          extensions: ["adoc", "asciidoc", "asc", "md", "markdown"],
        },
      ],
    });

    return typeof selected === "string" ? selected : null;
  }

  async pickDirectory(): Promise<string | null> {
    const selected = await open({
      directory: true,
      multiple: false,
    });

    return typeof selected === "string" ? selected : null;
  }

  openDocument(
    path: string,
    options?: OpenDocumentOptions,
  ): Promise<DocumentPayload> {
    return invokeCommand("open_document", { path, options });
  }

  listDirectory(path: string): Promise<DirectoryEntry[]> {
    return invokeCommand("list_directory", { path });
  }

  loadDocumentOrder(
    rootDirectory: string,
    options?: DocumentOrderLoadOptions,
  ): Promise<DocumentOrderCatalog> {
    return invokeCommand("load_document_order", { rootDirectory, options });
  }

  searchWorkspace(input: WorkspaceSearchInput): Promise<WorkspaceSearchResult> {
    return invokeCommand("search_workspace", { input });
  }

  resolveDroppedDocumentPath(path: string): Promise<string> {
    return invokeCommand("resolve_dropped_document_path", { path });
  }

  authorizeDirectory(path: string): Promise<void> {
    return invokeCommand("authorize_directory", { path });
  }

  resolveWorkspacePaths(
    input: WorkspacePathResolutionInput,
  ): Promise<WorkspacePathResolution> {
    return invoke("resolve_workspace_paths", { input });
  }

  resolveDocumentLink(
    input: DocumentLinkResolutionInput,
  ): Promise<DocumentLinkResolution> {
    return invoke("resolve_document_link", { input });
  }

  clearDocumentLinkCache(path: string): Promise<void> {
    return invoke("clear_obsidian_vault_cache", { path });
  }

  loadConfig(): Promise<AppConfig> {
    return invokeCommand("load_config");
  }

  saveConfig(config: AppConfig): Promise<void> {
    return invokeCommand("save_config", { config });
  }

  async setWindowTheme(theme: AppConfig["theme"]): Promise<void> {
    await setAppTheme(theme);
    await invoke("set_window_theme", { theme });
  }
}
