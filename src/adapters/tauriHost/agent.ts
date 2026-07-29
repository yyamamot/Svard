import { Channel } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  AgentApprovalResponseInput,
  AgentCompactionOutcome,
  AgentEvent,
  AgentExecutablePreference,
  AgentImageAttachment,
  AgentImageDiscardInput,
  AgentImageStageInput,
  AgentProviderId,
  AgentProviderRuntimeOptions,
  AgentProviderRuntimeSnapshot,
  AgentSessionArchiveInput,
  AgentSessionDeleteInput,
  AgentSessionHistoryInput,
  AgentSessionHistoryPage,
  AgentSessionInfo,
  AgentSessionListInput,
  AgentSessionPage,
  AgentSessionRenameInput,
  AgentSessionResumeInput,
  AgentSessionStartInput,
  AgentSessionSummary,
  AgentSteerInput,
  AgentSteerOutcome,
  AgentTurnInput,
  AgentTurnOutcome,
} from "../../core/types";
import { invokeCommand } from "./invoke";

function agentRuntimeKey(
  providerId: AgentProviderId,
  preference: AgentExecutablePreference,
) {
  return `${providerId}:${preference.mode}:${preference.path ?? ""}`;
}

export class TauriAgentFacade {
  private readonly agentProviderRuntime = new Map<
    string,
    AgentProviderRuntimeSnapshot
  >();
  private readonly agentProviderRuntimeRequests = new Map<
    string,
    Promise<AgentProviderRuntimeSnapshot>
  >();

  peekAgentProviderRuntime(
    providerId: AgentProviderId,
    executablePreference: AgentExecutablePreference = {
      mode: "auto",
      path: null,
    },
  ): AgentProviderRuntimeSnapshot | null {
    return (
      this.agentProviderRuntime.get(
        agentRuntimeKey(providerId, executablePreference),
      ) ?? null
    );
  }

  getAgentProviderRuntime(
    providerId: AgentProviderId,
    options: AgentProviderRuntimeOptions = {
      executablePreference: { mode: "auto", path: null },
    },
  ): Promise<AgentProviderRuntimeSnapshot> {
    const key = agentRuntimeKey(providerId, options.executablePreference);
    const pending = this.agentProviderRuntimeRequests.get(key);
    if (pending) return pending;
    if (!options.refresh) {
      const cached = this.agentProviderRuntime.get(key);
      if (cached) return Promise.resolve(cached);
    }
    const request = invokeCommand<AgentProviderRuntimeSnapshot>(
      "get_agent_provider_runtime",
      {
        providerId,
        executablePreference: options.executablePreference,
        refresh: options.refresh ?? false,
      },
    )
      .then((runtime) => {
        this.agentProviderRuntime.set(key, runtime);
        return runtime;
      })
      .finally(() => {
        if (this.agentProviderRuntimeRequests.get(key) === request) {
          this.agentProviderRuntimeRequests.delete(key);
        }
      });
    this.agentProviderRuntimeRequests.set(key, request);
    return request;
  }

  async pickAgentExecutable(
    providerId: AgentProviderId,
  ): Promise<AgentExecutablePreference | null> {
    if (providerId !== "codex-app-server") return null;
    const selected = await open({
      multiple: false,
      directory: false,
      title: "Choose Codex executable",
    });
    if (!selected || Array.isArray(selected)) return null;
    return { mode: "custom", path: selected };
  }

  startAgentSession(
    input: AgentSessionStartInput,
    onEvent: (event: AgentEvent) => void,
  ): Promise<AgentSessionInfo> {
    const onEventChannel = new Channel<AgentEvent>();
    onEventChannel.onmessage = onEvent;
    return invokeCommand("start_agent_session", {
      input,
      onEvent: onEventChannel,
    });
  }

  listAgentSessions(input: AgentSessionListInput): Promise<AgentSessionPage> {
    return invokeCommand("list_agent_sessions", {
      input: { ...input, archived: input.archived ?? false },
    });
  }

  resumeAgentSession(
    input: AgentSessionResumeInput,
    onEvent: (event: AgentEvent) => void,
  ): Promise<AgentSessionInfo> {
    const onEventChannel = new Channel<AgentEvent>();
    onEventChannel.onmessage = onEvent;
    return invokeCommand("resume_agent_session", {
      input,
      onEvent: onEventChannel,
    });
  }

  readAgentSessionHistory(
    input: AgentSessionHistoryInput,
  ): Promise<AgentSessionHistoryPage> {
    return invokeCommand("read_agent_session_history", { input });
  }

  renameAgentSession(
    input: AgentSessionRenameInput,
  ): Promise<AgentSessionSummary> {
    return invokeCommand("rename_agent_session", { input });
  }

  setAgentSessionArchived(
    input: AgentSessionArchiveInput,
  ): Promise<AgentSessionSummary> {
    return invokeCommand("set_agent_session_archived", { input });
  }

  deleteAgentSession(input: AgentSessionDeleteInput): Promise<void> {
    return invokeCommand("delete_agent_session", { input });
  }

  sendAgentTurn(input: AgentTurnInput): Promise<AgentTurnOutcome> {
    return invokeCommand("send_agent_turn", { input });
  }

  steerAgentTurn(input: AgentSteerInput): Promise<AgentSteerOutcome> {
    return invokeCommand("steer_agent_turn", { input });
  }

  stageAgentImage(input: AgentImageStageInput): Promise<AgentImageAttachment> {
    return invokeCommand("stage_agent_image", { input });
  }

  async pickAgentImages(
    clientSessionId: string,
  ): Promise<AgentImageAttachment[]> {
    const selected = await open({
      multiple: true,
      filters: [
        {
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "webp"],
        },
      ],
    });
    const paths =
      typeof selected === "string"
        ? [selected]
        : Array.isArray(selected)
          ? selected
          : [];
    const staged: AgentImageAttachment[] = [];
    try {
      for (const path of paths) {
        staged.push(
          await this.stageAgentImage({
            clientSessionId,
            source: { kind: "selectedPath", path },
          }),
        );
      }
      return staged;
    } catch (error) {
      await Promise.all(
        staged.map((image) =>
          this.discardAgentImage({
            clientSessionId,
            attachmentId: image.attachmentId,
          }),
        ),
      );
      throw error;
    }
  }

  discardAgentImage(input: AgentImageDiscardInput): Promise<void> {
    return invokeCommand("discard_agent_image", { input });
  }

  respondToAgentApproval(input: AgentApprovalResponseInput): Promise<void> {
    return invokeCommand("respond_to_agent_approval", { input });
  }

  cancelAgentTurn(
    clientSessionId: string,
    clientTurnId: string,
  ): Promise<void> {
    return invokeCommand("cancel_agent_turn", {
      clientSessionId,
      clientTurnId,
    });
  }

  compactAgentSession(
    clientSessionId: string,
  ): Promise<AgentCompactionOutcome> {
    return invokeCommand("compact_agent_session", { clientSessionId });
  }

  closeAgentSession(clientSessionId: string): Promise<void> {
    return invokeCommand("close_agent_session", { clientSessionId });
  }
}
