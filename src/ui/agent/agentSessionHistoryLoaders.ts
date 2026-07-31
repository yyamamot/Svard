import type {
  Dispatch,
  MutableRefObject,
  RefObject,
  SetStateAction,
} from "react";
import type { AgentSessionPage, HostAdapter } from "../../core/types";
import type { AgentChatAction, AgentChatState } from "./agentChatState";
import { restoredConversationTurn } from "./agentPanelModel";
import {
  agentSessionHistoryDateBounds,
  type AgentSessionHistoryDateRange,
} from "./agentSessionHistorySearch";
import type { useAgentWorkspaceIsolation } from "./useAgentWorkspaceIsolation";

export function createAgentSessionHistoryLoaders({
  dispatch,
  historyArchived,
  historyDateRange,
  historyQuery,
  historyPrependScrollRef,
  host,
  olderHistoryCursor,
  olderHistoryLoading,
  historyOpen,
  scrollRef,
  sessionIdRef,
  sessionPage,
  sessionListRequestSequenceRef,
  sessionTitleEventSequenceRef,
  sessionTitleEventsRef,
  setActionNotice,
  setOlderHistoryCursor,
  setOlderHistoryLoading,
  setHistoryOpen,
  setSettingsOpen,
  setSessionListError,
  setSessionListLoading,
  setSessionPage,
  state,
  workspaceIsolation,
  workspaceRoot,
}: {
  dispatch: Dispatch<AgentChatAction>;
  historyArchived: boolean;
  historyDateRange: AgentSessionHistoryDateRange;
  historyQuery: string;
  historyPrependScrollRef: MutableRefObject<{
    height: number;
    top: number;
  } | null>;
  host: HostAdapter;
  olderHistoryCursor: string | null;
  olderHistoryLoading: boolean;
  historyOpen: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  sessionIdRef: MutableRefObject<string>;
  sessionPage: AgentSessionPage | null;
  sessionListRequestSequenceRef: MutableRefObject<number>;
  sessionTitleEventSequenceRef: MutableRefObject<number>;
  sessionTitleEventsRef: MutableRefObject<
    Map<string, { sequence: number; title: string }>
  >;
  setActionNotice: (message: string | null) => void;
  setOlderHistoryCursor: (cursor: string | null) => void;
  setOlderHistoryLoading: (loading: boolean) => void;
  setHistoryOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setSessionListError: (message: string | null) => void;
  setSessionListLoading: (loading: boolean) => void;
  setSessionPage: Dispatch<SetStateAction<AgentSessionPage | null>>;
  state: AgentChatState;
  workspaceIsolation: ReturnType<typeof useAgentWorkspaceIsolation>;
  workspaceRoot: string | null;
}) {
  async function loadSessionPage(reset: boolean, archived = historyArchived) {
    if (!workspaceRoot) return;
    if (!(await workspaceIsolation.ensureWorkspaceBoundary())) return;
    const sessionId = sessionIdRef.current;
    const operation = workspaceIsolation.createOperationToken(
      sessionId,
      workspaceRoot,
    );
    const titleSequenceBeforeRequest = sessionTitleEventSequenceRef.current;
    const requestSequence = ++sessionListRequestSequenceRef.current;
    const dateBounds = agentSessionHistoryDateBounds(historyDateRange);
    setSessionListLoading(true);
    setSessionListError(null);
    try {
      const page = await host.listAgentSessions({
        providerId: "codex-app-server",
        workspaceRoot,
        archived,
        query: historyQuery.trim() || null,
        ...dateBounds,
        cursor: reset ? null : sessionPage?.nextCursor,
        limit: 30,
      });
      if (
        !workspaceIsolation.isOperationCurrent(operation) ||
        requestSequence !== sessionListRequestSequenceRef.current
      ) {
        return;
      }
      const sessions = page.sessions.map((session) => {
        const titleEvent = sessionTitleEventsRef.current.get(
          session.clientSessionId,
        );
        return titleEvent && titleEvent.sequence > titleSequenceBeforeRequest
          ? { ...session, title: titleEvent.title }
          : session;
      });
      const currentPage = { ...page, sessions };
      setSessionPage((current) => {
        if (reset || !current) return currentPage;
        const known = new Set(
          current.sessions.map((session) => session.clientSessionId),
        );
        return {
          ...currentPage,
          sessions: [
            ...current.sessions,
            ...currentPage.sessions.filter(
              (session) => !known.has(session.clientSessionId),
            ),
          ],
        };
      });
    } catch (error) {
      if (
        !workspaceIsolation.isOperationCurrent(operation) ||
        requestSequence !== sessionListRequestSequenceRef.current
      ) {
        return;
      }
      setSessionListError(
        error instanceof Error
          ? error.message
          : "Chat history could not be loaded.",
      );
    } finally {
      if (
        workspaceIsolation.isOperationCurrent(operation) &&
        requestSequence === sessionListRequestSequenceRef.current
      ) {
        setSessionListLoading(false);
      }
    }
  }

  async function loadOlderSessionHistory() {
    if (!workspaceRoot || !olderHistoryCursor || olderHistoryLoading) {
      return;
    }
    const sessionId = sessionIdRef.current;
    const operation = workspaceIsolation.createOperationToken(
      sessionId,
      workspaceRoot,
    );
    setOlderHistoryLoading(true);
    try {
      const page = await host.readAgentSessionHistory({
        clientSessionId: sessionId,
        cursor: olderHistoryCursor,
        limit: 50,
      });
      if (!workspaceIsolation.isOperationCurrent(operation)) return;
      const known = new Set(state.turns.map((turn) => turn.id));
      if (scrollRef.current) {
        historyPrependScrollRef.current = {
          height: scrollRef.current.scrollHeight,
          top: scrollRef.current.scrollTop,
        };
      }
      dispatch({
        type: "hydrate",
        turns: [
          ...page.turns
            .filter((turn) => !known.has(turn.id))
            .map(restoredConversationTurn),
          ...state.turns,
        ],
      });
      setOlderHistoryCursor(page.nextCursor);
    } catch (error) {
      if (!workspaceIsolation.isOperationCurrent(operation)) return;
      setActionNotice(
        error instanceof Error
          ? error.message
          : "Earlier chat history could not be loaded.",
      );
    } finally {
      if (workspaceIsolation.isOperationCurrent(operation)) {
        setOlderHistoryLoading(false);
      }
    }
  }

  async function openSessionHistory() {
    const nextOpen = !historyOpen;
    setHistoryOpen(nextOpen);
    setSettingsOpen(false);
    if (nextOpen) {
      await loadSessionPage(true, historyArchived);
    }
  }

  return { loadOlderSessionHistory, loadSessionPage, openSessionHistory };
}
