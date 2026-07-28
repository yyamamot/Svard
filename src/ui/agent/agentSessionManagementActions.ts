import type {
  AgentExecutablePreference,
  AgentSessionSummary,
  HostAdapter,
} from "../../core/types";
import type { MutableRefObject } from "react";
import type { useAgentWorkspaceIsolation } from "./useAgentWorkspaceIsolation";

export function createAgentSessionManagementActions({
  executablePreference,
  historyArchived,
  host,
  loadSessionPage,
  sessionIdRef,
  setSessionListError,
  workspaceIsolation,
  workspaceRoot,
}: {
  executablePreference: AgentExecutablePreference;
  historyArchived: boolean;
  host: HostAdapter;
  loadSessionPage: (reset: boolean, archived?: boolean) => Promise<void>;
  sessionIdRef: MutableRefObject<string>;
  setSessionListError: (message: string | null) => void;
  workspaceIsolation: ReturnType<typeof useAgentWorkspaceIsolation>;
  workspaceRoot: string | null;
}) {
  function operation() {
    return workspaceRoot
      ? workspaceIsolation.createOperationToken(
          sessionIdRef.current,
          workspaceRoot,
        )
      : null;
  }

  async function renameSession(summary: AgentSessionSummary, title: string) {
    const token = operation();
    try {
      await host.renameAgentSession({
        clientSessionId: summary.clientSessionId,
        title,
        executablePreference,
      });
      if (token && workspaceIsolation.isOperationCurrent(token)) {
        await loadSessionPage(true, historyArchived);
      }
    } catch (error) {
      if (!token || !workspaceIsolation.isOperationCurrent(token)) return;
      setSessionListError(
        error instanceof Error
          ? error.message
          : "The chat could not be renamed.",
      );
      throw error;
    }
  }

  async function setSessionArchived(
    summary: AgentSessionSummary,
    archived: boolean,
  ) {
    const token = operation();
    try {
      await host.setAgentSessionArchived({
        clientSessionId: summary.clientSessionId,
        archived,
        executablePreference,
      });
      if (token && workspaceIsolation.isOperationCurrent(token)) {
        await loadSessionPage(true, historyArchived);
      }
    } catch (error) {
      if (!token || !workspaceIsolation.isOperationCurrent(token)) return;
      setSessionListError(
        error instanceof Error
          ? error.message
          : "The chat archive could not be updated.",
      );
      throw error;
    }
  }

  async function deleteSession(summary: AgentSessionSummary) {
    const token = operation();
    try {
      await host.deleteAgentSession({
        clientSessionId: summary.clientSessionId,
        executablePreference,
      });
      if (token && workspaceIsolation.isOperationCurrent(token)) {
        await loadSessionPage(true, historyArchived);
      }
    } catch (error) {
      if (!token || !workspaceIsolation.isOperationCurrent(token)) return;
      setSessionListError(
        error instanceof Error
          ? error.message
          : "The chat could not be deleted.",
      );
      throw error;
    }
  }

  return { deleteSession, renameSession, setSessionArchived };
}
