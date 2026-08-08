import type {
  AgentEvent,
  AgentSessionSummary,
  HostAdapter,
} from "../../core/types";
import {
  restoredConversationTurn,
  type AgentRuntimeSettingsSnapshot,
} from "./agentPanelModel";
import type { useAgentSessionControllerState } from "./useAgentSessionControllerState";
import type { useAgentWorkspaceIsolation } from "./useAgentWorkspaceIsolation";

type ControllerState = ReturnType<typeof useAgentSessionControllerState>;
type WorkspaceIsolation = ReturnType<typeof useAgentWorkspaceIsolation>;
export interface AgentSessionResumeOptions {
  fullAccessConfirmed: boolean;
  reason: "closed" | "providerDisconnected";
}
interface ResumeContext {
  handleEvent(event: AgentEvent): void;
  host: HostAdapter;
  resetConversationFollow(): void;
  state: ControllerState;
  workspaceIsolation: WorkspaceIsolation;
  workspaceRoot: string | null;
}
export async function resumeClosedAgentSession(
  { fullAccessConfirmed, reason }: AgentSessionResumeOptions,
  context: ResumeContext,
) {
  const {
    handleEvent,
    host,
    resetConversationFollow,
    state,
    workspaceIsolation,
    workspaceRoot,
  } = context;
  const {
    codexDefaults,
    contextProfile,
    disconnectCleanupRef,
    dispatch,
    recoveryStateRef,
    resumeClosedSessionRef,
    sessionIdRef,
    sessionReadyRef,
    sessionSettingsRef,
    sessionStartingRef,
    setActionNotice,
    setConfirmClosedFullAccessResume,
    setOlderHistoryCursor,
    setProbeError,
    setSessionLifecycle,
    updateRecoveryState,
  } = state;

  if (!(await workspaceIsolation.ensureWorkspaceBoundary())) {
    return false;
  }
  if (disconnectCleanupRef.current) {
    if (!(await disconnectCleanupRef.current)) {
      return false;
    }
  }
  if (recoveryStateRef.current === "cleanupFailed") {
    return false;
  }
  if (
    sessionStartingRef.current ||
    !workspaceRoot ||
    !resumeClosedSessionRef.current
  ) {
    return false;
  }
  const reconnecting = reason === "providerDisconnected";
  const clientSessionId = sessionIdRef.current;
  sessionStartingRef.current = true;
  setSessionLifecycle("starting");
  if (reconnecting) updateRecoveryState("reconnecting");
  setProbeError(null);
  const operation = workspaceIsolation.createOperationToken(
    clientSessionId,
    workspaceRoot,
  );
  try {
    await host.resumeAgentSession(
      {
        clientSessionId,
        workspaceRoot,
        executablePreference:
          sessionSettingsRef.current?.executablePreference ??
          codexDefaults.executable,
        contextProfile:
          sessionSettingsRef.current?.contextProfile ?? contextProfile,
        fullAccessConfirmed,
      },
      workspaceIsolation.guardEvents(operation, handleEvent),
    );
    const history = reconnecting
      ? null
      : await host.readAgentSessionHistory({
          clientSessionId,
          limit: 50,
        });
    if (
      !workspaceIsolation.isOperationCurrent(operation) ||
      !workspaceIsolation.bindSession(operation)
    ) {
      await workspaceIsolation.cleanupSession(clientSessionId);
      return false;
    }
    if (history) {
      resetConversationFollow();
      dispatch({
        type: "hydrate",
        turns: history.turns.map(restoredConversationTurn),
      });
      setOlderHistoryCursor(history.nextCursor);
    } else {
      dispatch({ type: "connectionRestored" });
    }
    resumeClosedSessionRef.current = false;
    setConfirmClosedFullAccessResume(false);
    sessionReadyRef.current = true;
    setSessionLifecycle("ready");
    updateRecoveryState("connected");
    if (reconnecting) setActionNotice("AI Chat reconnected.");
    return true;
  } catch (error) {
    const cleanupSucceeded =
      await workspaceIsolation.cleanupSession(clientSessionId);
    if (!workspaceIsolation.isOperationCurrent(operation)) {
      return false;
    }
    sessionReadyRef.current = false;
    setSessionLifecycle("closed");
    if (reconnecting) updateRecoveryState("disconnected");
    if (cleanupSucceeded) {
      setActionNotice(
        reconnecting
          ? "AI Chat could not reconnect. Try again."
          : error instanceof Error
            ? error.message
            : "This chat could not be resumed.",
      );
    }
    return false;
  } finally {
    if (workspaceIsolation.isOperationCurrent(operation)) {
      sessionStartingRef.current = false;
    }
  }
}

interface ResumeSavedContext extends ResumeContext {
  activeTurnId: string | null;
  captureContextPressure(): unknown;
  clearSessionLocalContext(): void;
  resetContextPressure(): void;
  restoreContextPressure(snapshot: unknown): void;
}
export async function resumeAgentSessionTransaction(
  summary: AgentSessionSummary,
  fullAccessConfirmed: boolean,
  context: ResumeSavedContext,
) {
  const {
    activeTurnId,
    captureContextPressure,
    clearSessionLocalContext,
    handleEvent,
    host,
    resetContextPressure,
    resetConversationFollow,
    restoreContextPressure,
    state,
    workspaceIsolation,
    workspaceRoot,
  } = context;
  const {
    codexDefaults,
    dispatch,
    resumeClosedSessionRef,
    sessionIdRef,
    sessionReadyRef,
    sessionSettingsRef,
    sessionStartingRef,
    setContextProfile,
    setHistoryOpen,
    setNetworkAccess,
    setOlderHistoryCursor,
    setPendingFullAccessResume,
    setPermissionMode,
    setSessionLifecycle,
    setSessionListError,
    setSessionSettings,
    setWebSearch,
  } = state;

  if (!(await workspaceIsolation.ensureWorkspaceBoundary())) {
    return;
  }
  if (
    activeTurnId ||
    sessionStartingRef.current ||
    !workspaceRoot ||
    summary.clientSessionId === sessionIdRef.current
  ) {
    return;
  }
  if (
    summary.settings.permissionMode === "fullAccess" &&
    !fullAccessConfirmed
  ) {
    setPendingFullAccessResume(summary);
    return;
  }
  const previousSessionId = sessionIdRef.current;
  const previousSessionReady = sessionReadyRef.current;
  const previousSessionWorkspaceRoot =
    workspaceIsolation.sessionWorkspaceRootRef.current;
  const previousContextPressure = captureContextPressure();
  const nextSessionId = summary.clientSessionId;
  sessionStartingRef.current = true;
  sessionReadyRef.current = false;
  sessionIdRef.current = nextSessionId;
  resetContextPressure();
  setSessionLifecycle("starting");
  setSessionListError(null);
  const operation = workspaceIsolation.createOperationToken(
    nextSessionId,
    workspaceRoot,
  );
  try {
    await host.resumeAgentSession(
      {
        clientSessionId: nextSessionId,
        workspaceRoot,
        executablePreference: codexDefaults.executable,
        contextProfile: summary.settings.contextProfile,
        fullAccessConfirmed,
      },
      workspaceIsolation.guardEvents(operation, handleEvent),
    );
    const history = await host.readAgentSessionHistory({
      clientSessionId: nextSessionId,
      limit: 50,
    });
    if (
      !workspaceIsolation.isOperationCurrent(operation) ||
      !workspaceIsolation.bindSession(operation)
    ) {
      await workspaceIsolation.cleanupSession(nextSessionId);
      return;
    }
    const settings: AgentRuntimeSettingsSnapshot = {
      executablePreference: { ...codexDefaults.executable },
      model: summary.settings.model,
      modelDisplayName: summary.settings.model ?? "Codex default",
      reasoningEffort: summary.settings.reasoningEffort,
      personality: summary.settings.personality,
      contextProfile: summary.settings.contextProfile,
    };
    sessionReadyRef.current = true;
    sessionSettingsRef.current = settings;
    setSessionSettings(settings);
    setPermissionMode(summary.settings.permissionMode);
    setNetworkAccess(summary.settings.networkAccess);
    setWebSearch(summary.settings.webSearch);
    setContextProfile(summary.settings.contextProfile);
    setOlderHistoryCursor(history.nextCursor);
    setSessionLifecycle("ready");
    resumeClosedSessionRef.current = false;
    resetConversationFollow();
    dispatch({
      type: "hydrate",
      turns: history.turns.map(restoredConversationTurn),
    });
    clearSessionLocalContext();
    setHistoryOpen(false);
    setPendingFullAccessResume(null);
    await host.closeAgentSession(previousSessionId);
  } catch (error) {
    await workspaceIsolation.cleanupSession(nextSessionId);
    if (!workspaceIsolation.isOperationCurrent(operation)) {
      return;
    }
    sessionStartingRef.current = false;
    sessionIdRef.current = previousSessionId;
    sessionReadyRef.current = previousSessionReady;
    workspaceIsolation.sessionWorkspaceRootRef.current =
      previousSessionWorkspaceRoot;
    setSessionLifecycle(previousSessionReady ? "ready" : "idle");
    restoreContextPressure(previousContextPressure);
    setSessionListError(
      error instanceof Error
        ? error.message
        : "This chat could not be resumed.",
    );
  } finally {
    if (workspaceIsolation.isOperationCurrent(operation)) {
      sessionStartingRef.current = false;
    }
  }
}
