import { useCallback, useReducer, useRef, useState } from "react";
import type {
  AgentAttachment,
  AgentChatHandoffSnapshot,
  AgentFocusFile,
  AgentImageAttachment,
  AgentPermissionMode,
  AgentProviderRuntimeSnapshot,
  AgentQuotedContext,
  AgentResponseMode,
  AgentSessionPage,
  AgentSessionSummary,
  DocumentMediaMode,
} from "../../core/types";
import { initialAgentChatState, reduceAgentChat } from "./agentChatState";
import { effectiveContextProfile } from "./agentSessionAccessActions";
import {
  agentChatHandoffPayload,
  type AgentSessionRecoveryState,
} from "./agentChatHandoff";
import type { AgentPanelHostProps } from "./agentPanelTypes";
import type {
  AgentImageError,
  AgentRuntimeSettingsSnapshot,
} from "./agentPanelModel";
import {
  providerCleanupFailedAgentNotice,
  useAgentActionNotice,
} from "./useAgentActionNotice";
import { useAgentConversationScroll } from "./useAgentConversationScroll";
import { useAgentSessionHistorySearchState } from "./useAgentSessionHistorySearchState";

type AgentSessionLifecycle = "idle" | "starting" | "ready" | "closed";
type PendingSessionAction = () => void | Promise<void>;
type PendingFullAccessTransaction = () => Promise<boolean>;

export function useAgentSessionControllerState({
  activeDocument,
  handoffSnapshot,
  host,
  providerConfig,
  quotedContexts: providedQuotedContexts = [],
  theme = "light",
  workspaceRoot,
}: Pick<
  AgentPanelHostProps,
  | "activeDocument"
  | "handoffSnapshot"
  | "host"
  | "providerConfig"
  | "quotedContexts"
  | "theme"
  | "workspaceRoot"
>) {
  const handoff = agentChatHandoffPayload(handoffSnapshot);
  const [runtime, setRuntime] = useState<AgentProviderRuntimeSnapshot | null>(
    () =>
      handoff?.runtime ??
      host.peekAgentProviderRuntime(
        "codex-app-server",
        providerConfig.codex.executable,
      ),
  );
  const [probeError, setProbeError] = useState<string | null>(null);
  const [sessionLifecycle, setSessionLifecycle] =
    useState<AgentSessionLifecycle>(handoff?.sessionLifecycle ?? "idle");
  const [recoveryState, setRecoveryState] = useState<AgentSessionRecoveryState>(
    handoff?.recoveryState ??
      (handoff?.state.disconnectedMessage ? "disconnected" : "connected"),
  );
  const sessionReady = sessionLifecycle === "ready";
  const sessionStarting = sessionLifecycle === "starting";
  const [sessionSettings, setSessionSettings] =
    useState<AgentRuntimeSettingsSnapshot | null>(
      handoff?.sessionSettings ?? null,
    );
  const codexDefaults = providerConfig.codex;
  const [permissionMode, setPermissionMode] = useState<AgentPermissionMode>(
    handoff?.permissionMode ?? codexDefaults.permissionMode,
  );
  const [networkAccess, setNetworkAccess] = useState(
    handoff?.networkAccess ?? codexDefaults.networkAccess,
  );
  const [webSearch, setWebSearch] = useState(
    handoff?.webSearch ?? codexDefaults.webSearch,
  );
  const [contextProfile, setContextProfile] = useState(
    handoff?.contextProfile ?? effectiveContextProfile(codexDefaults, runtime),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmFullAccess, setConfirmFullAccess] = useState(false);
  const [responseMode, setResponseMode] = useState<AgentResponseMode>(
    handoff?.responseMode ?? "auto",
  );
  const [question, setQuestion] = useState(handoff?.question ?? "");
  const [focusFiles, setFocusFiles] = useState<AgentFocusFile[]>(
    handoff?.focusFiles ?? [],
  );
  const [attachments, setAttachments] = useState<AgentAttachment[]>(
    handoff?.attachments ?? [],
  );
  const [images, setImages] = useState<AgentImageAttachment[]>(
    handoff?.images ?? [],
  );
  const [restoredQuotedContexts, setRestoredQuotedContexts] = useState<
    AgentQuotedContext[]
  >(handoff?.quotedContexts ?? []);
  const [imageErrors, setImageErrors] = useState<AgentImageError[]>([]);
  const [mediaModes, setMediaModes] = useState<
    Record<string, DocumentMediaMode>
  >(handoff?.mediaModes ?? {});
  const [actionNotice, setActionNotice] = useAgentActionNotice(
    handoff?.actionNotice ?? null,
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyArchived, setHistoryArchived] = useState(false);
  const historySearch = useAgentSessionHistorySearchState();
  const [sessionPage, setSessionPage] = useState<AgentSessionPage | null>(null);
  const [sessionListLoading, setSessionListLoading] = useState(false);
  const [sessionListError, setSessionListError] = useState<string | null>(null);
  const [olderHistoryCursor, setOlderHistoryCursor] = useState<string | null>(
    null,
  );
  const [olderHistoryLoading, setOlderHistoryLoading] = useState(false);
  const [pendingFullAccessResume, setPendingFullAccessResume] =
    useState<AgentSessionSummary | null>(null);
  const [confirmClosedFullAccessResume, setConfirmClosedFullAccessResume] =
    useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const [state, dispatch] = useReducer(
    reduceAgentChat,
    handoff?.state ?? initialAgentChatState,
  );
  const {
    captureConversationScroll,
    followLatestConversation,
    handleConversationScroll,
    historyPrependScrollRef,
    newActivityAvailable,
    resetConversationFollow,
    scrollRef,
  } = useAgentConversationScroll(state, handoff?.scroll);
  const sessionIdRef = useRef<string>(
    handoff?.sessionId ?? crypto.randomUUID(),
  );
  const sessionReadyRef = useRef(handoff?.sessionReady ?? false);
  const sessionSettingsRef = useRef<AgentRuntimeSettingsSnapshot | null>(
    handoff?.sessionSettings ?? null,
  );
  const sessionTitleEventSequenceRef = useRef(0);
  const sessionTitleEventsRef = useRef(
    new Map<string, { sequence: number; title: string }>(),
  );
  const acceptedTurnIdsRef = useRef(new Set<string>());
  const handoffAttachedRef = useRef(false);
  const handoffReadyReportedRef = useRef(false);
  const sessionStartingRef = useRef(false);
  const resumeClosedSessionRef = useRef(handoff?.sessionLifecycle === "closed");
  const recoveryStateRef = useRef(recoveryState);
  const disconnectCleanupRef = useRef<Promise<boolean> | null>(null);
  const pendingSessionActionRef = useRef<PendingSessionAction | null>(null);
  const pendingFullAccessTransactionRef =
    useRef<PendingFullAccessTransaction | null>(null);
  const composerDockRef = useRef<HTMLDivElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const updateRecoveryState = useCallback((next: AgentSessionRecoveryState) => {
    recoveryStateRef.current = next;
    setRecoveryState(next);
  }, []);
  const runDisconnectCleanup = useCallback(
    (clientSessionId: string): Promise<boolean> => {
      if (disconnectCleanupRef.current) return disconnectCleanupRef.current;
      updateRecoveryState("cleaning");
      const cleanup = host
        .closeAgentSession(clientSessionId)
        .then(() => {
          if (sessionIdRef.current === clientSessionId) {
            setActionNotice(null);
            updateRecoveryState("disconnected");
          }
          return true;
        })
        .catch(() => {
          if (sessionIdRef.current === clientSessionId) {
            setActionNotice(providerCleanupFailedAgentNotice);
            updateRecoveryState("cleanupFailed");
          }
          return false;
        })
        .finally(() => {
          if (disconnectCleanupRef.current === cleanup) {
            disconnectCleanupRef.current = null;
          }
        });
      disconnectCleanupRef.current = cleanup;
      return cleanup;
    },
    [host, setActionNotice, updateRecoveryState],
  );
  const createHandoffSnapshotFromState = (
    lastMainPlacement: "right" | "bottom",
    contextPressure: unknown,
  ): AgentChatHandoffSnapshot => {
    const clientSessionId = sessionIdRef.current;
    const quotedContexts = [
      ...providedQuotedContexts,
      ...restoredQuotedContexts,
    ].filter(
      (context, index, all) =>
        all.findIndex((item) => item.snapshotId === context.snapshotId) ===
        index,
    );
    return {
      version: 1,
      clientSessionId,
      workspaceRoot: workspaceRoot ?? "",
      lastEventSequence: host.getAgentEventSequence(clientSessionId),
      lastMainPlacement,
      payload: {
        activeDocument,
        providerConfig,
        theme,
        state,
        sessionId: clientSessionId,
        sessionReady: sessionReadyRef.current,
        sessionLifecycle,
        recoveryState,
        sessionSettings,
        runtime,
        permissionMode,
        networkAccess,
        webSearch,
        contextProfile,
        responseMode,
        question,
        focusFiles,
        attachments,
        images,
        quotedContexts,
        mediaModes,
        actionNotice,
        contextPressure,
        scroll: captureConversationScroll(),
        pendingTurn: handoff?.pendingTurn ?? null,
        runningAction: handoff?.runningAction ?? null,
      },
    };
  };
  const closeSessionRuntimeFromState = async (
    activeTurnId: string | null,
    clearSessionLocalContext: () => void,
  ): Promise<boolean> => {
    pendingSessionActionRef.current = null;
    pendingFullAccessTransactionRef.current = null;
    setConfirmFullAccess(false);
    setConfirmClosedFullAccessResume(false);
    if (activeTurnId && recoveryStateRef.current === "connected") {
      await host.cancelAgentTurn(sessionIdRef.current, activeTurnId);
    }
    if (disconnectCleanupRef.current && !(await disconnectCleanupRef.current)) {
      return false;
    }
    if (
      sessionReadyRef.current ||
      resumeClosedSessionRef.current ||
      recoveryStateRef.current !== "connected"
    ) {
      if (!(await runDisconnectCleanup(sessionIdRef.current))) return false;
      resumeClosedSessionRef.current = true;
      sessionReadyRef.current = false;
      setSessionLifecycle("closed");
    }
    if (recoveryStateRef.current !== "connected") {
      dispatch({ type: "connectionRestored" });
      updateRecoveryState("connected");
    }
    clearSessionLocalContext();
    return true;
  };
  return {
    handoff,
    runtime,
    setRuntime,
    probeError,
    setProbeError,
    sessionLifecycle,
    setSessionLifecycle,
    recoveryState,
    setRecoveryState,
    sessionReady,
    sessionStarting,
    sessionSettings,
    setSessionSettings,
    codexDefaults,
    permissionMode,
    setPermissionMode,
    networkAccess,
    setNetworkAccess,
    webSearch,
    setWebSearch,
    contextProfile,
    setContextProfile,
    settingsOpen,
    setSettingsOpen,
    confirmFullAccess,
    setConfirmFullAccess,
    responseMode,
    setResponseMode,
    question,
    setQuestion,
    focusFiles,
    setFocusFiles,
    attachments,
    setAttachments,
    images,
    setImages,
    restoredQuotedContexts,
    setRestoredQuotedContexts,
    imageErrors,
    setImageErrors,
    mediaModes,
    setMediaModes,
    actionNotice,
    setActionNotice,
    historyOpen,
    setHistoryOpen,
    historyArchived,
    setHistoryArchived,
    historySearch,
    sessionPage,
    setSessionPage,
    sessionListLoading,
    setSessionListLoading,
    sessionListError,
    setSessionListError,
    olderHistoryCursor,
    setOlderHistoryCursor,
    olderHistoryLoading,
    setOlderHistoryLoading,
    pendingFullAccessResume,
    setPendingFullAccessResume,
    confirmClosedFullAccessResume,
    setConfirmClosedFullAccessResume,
    addMenuOpen,
    setAddMenuOpen,
    dropActive,
    setDropActive,
    state,
    dispatch,
    captureConversationScroll,
    followLatestConversation,
    handleConversationScroll,
    historyPrependScrollRef,
    newActivityAvailable,
    resetConversationFollow,
    scrollRef,
    sessionIdRef,
    sessionReadyRef,
    sessionSettingsRef,
    sessionTitleEventSequenceRef,
    sessionTitleEventsRef,
    acceptedTurnIdsRef,
    handoffAttachedRef,
    handoffReadyReportedRef,
    sessionStartingRef,
    resumeClosedSessionRef,
    recoveryStateRef,
    disconnectCleanupRef,
    pendingSessionActionRef,
    pendingFullAccessTransactionRef,
    composerDockRef,
    composerInputRef,
    closeSessionRuntimeFromState,
    createHandoffSnapshotFromState,
    runDisconnectCleanup,
    updateRecoveryState,
  };
}
