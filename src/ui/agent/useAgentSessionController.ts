import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type {
  AgentEvent,
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
import { createAgentFullAccessActions } from "./agentFullAccessActions";
import { applyAgentSessionTitleEvent } from "./agentSessionTitleEvents";
import {
  createAgentAccessSelectors,
  createAgentContextProfileSelector,
  createRestartSessionFromProviderDefaults,
  effectiveContextProfile,
  type AgentSessionAccessTransactionInput,
} from "./agentSessionAccessActions";
import { createAgentSessionHistoryLoaders } from "./agentSessionHistoryLoaders";
import { createAgentSessionManagementActions } from "./agentSessionManagementActions";
import { useAgentConversationScroll } from "./useAgentConversationScroll";
import { useAgentContextPressure } from "./useAgentContextPressure";
import {
  createAgentSessionStartInput,
  createAgentSessionSettingsSnapshot,
  restoredConversationTurn,
  type AgentImageError,
  type AgentRuntimeSettingsSnapshot,
} from "./agentPanelModel";
import {
  agentChatHandoffPayload,
  type AgentSessionRecoveryState,
} from "./agentChatHandoff";
import type { AgentPanelHostProps } from "./agentPanelTypes";
import {
  useAgentActionNotice,
  workspaceChangedAgentNotice,
  workspaceCleanupFailedAgentNotice,
} from "./useAgentActionNotice";
import { useAgentSessionContextCleanup } from "./useAgentSessionContextCleanup";
import {
  useAgentSessionHistorySearchReload,
  useAgentSessionHistorySearchState,
} from "./useAgentSessionHistorySearchState";
import { useAgentWorkspaceIsolation } from "./useAgentWorkspaceIsolation";

type AgentSessionLifecycle = "idle" | "starting" | "ready" | "closed";
type PendingSessionAction = () => void | Promise<void>;
type PendingFullAccessTransaction = () => Promise<boolean>;
type AgentSessionResumeReason = "closed" | "providerDisconnected";

interface AgentSessionResumeOptions {
  fullAccessConfirmed: boolean;
  reason: AgentSessionResumeReason;
}

export function useAgentSessionController({
  activeDocument,
  host,
  open,
  providerConfig,
  theme = "light",
  onHandoffReady,
  onHandoffFailure,
  onQuotedContextsAccepted,
  terminateSession = false,
  workspaceRoot,
  handoffSnapshot,
  quotedContexts: providedQuotedContexts = [],
}: AgentPanelHostProps) {
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
  const disconnectCleanupRef = useRef<Promise<void> | null>(null);
  const pendingSessionActionRef = useRef<PendingSessionAction | null>(null);
  const pendingFullAccessTransactionRef =
    useRef<PendingFullAccessTransaction | null>(null);
  const composerDockRef = useRef<HTMLDivElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const updateRecoveryState = useCallback((next: AgentSessionRecoveryState) => {
    recoveryStateRef.current = next;
    setRecoveryState(next);
  }, []);
  useEffect(() => {
    if (handoffSnapshot) return;
    handoffAttachedRef.current = false;
    handoffReadyReportedRef.current = false;
  }, [handoffSnapshot]);
  const activeTurnId = state.activeTurnId;
  const {
    captureContextPressure,
    compactContext,
    contextCompactionStatus,
    contextUsage,
    handleContextEvent,
    lastCompaction,
    resetContextPressure,
    restoreContextPressure,
    tokenUsageDiagnostics,
  } = useAgentContextPressure({
    activeTurnId,
    hasHistory: state.turns.length > 0,
    host,
    manualCompactionSupported:
      runtime?.probe.capabilities.manualCompaction ?? false,
    sessionIdRef,
    sessionReadyRef,
    setActionNotice,
    initialSnapshot: handoff?.contextPressure,
  });
  const selectionImageAttachmentsRef = useRef(
    new Map<string, AgentImageAttachment>(),
  );
  const submittedSelectionIdsRef = useRef<string[]>([]);
  const { clearSessionLocalContext, preserveContextForAccessChange } =
    useAgentSessionContextCleanup({
      selectionImages: selectionImageAttachmentsRef,
      submittedSelectionIds: submittedSelectionIdsRef,
      setAttachments,
      setFocusFiles,
      setImageErrors,
      setImages,
      setMediaModes,
      setRestoredQuotedContexts,
    });
  const workspaceIsolation = useAgentWorkspaceIsolation({
    activeTurnId,
    host,
    onCleanupFailure: () => setActionNotice(workspaceCleanupFailedAgentNotice),
    onReset: () => {
      pendingSessionActionRef.current = null;
      pendingFullAccessTransactionRef.current = null;
      disconnectCleanupRef.current = null;
      updateRecoveryState("connected");
      sessionSettingsRef.current = null;
      sessionTitleEventsRef.current.clear();
      acceptedTurnIdsRef.current.clear();
      submittedSelectionIdsRef.current = [];
      setSessionSettings(null);
      setPermissionMode(codexDefaults.permissionMode);
      setNetworkAccess(codexDefaults.networkAccess);
      setWebSearch(codexDefaults.webSearch);
      setContextProfile(effectiveContextProfile(codexDefaults, runtime));
      setQuestion("");
      setActionNotice(workspaceRoot ? workspaceChangedAgentNotice : null);
      setHistoryOpen(false);
      historySearch.resetHistorySearch();
      setSessionPage(null);
      setSessionListLoading(false);
      setSessionListError(null);
      setOlderHistoryCursor(null);
      setOlderHistoryLoading(false);
      setPendingFullAccessResume(null);
      setConfirmFullAccess(false);
      setConfirmClosedFullAccessResume(false);
      setAddMenuOpen(false);
      setDropActive(false);
      resetContextPressure();
      resetConversationFollow();
      dispatch({ type: "reset" });
      clearSessionLocalContext();
    },
    resumeClosedSessionRef,
    sessionIdRef,
    sessionReadyRef,
    sessionStartingRef,
    setSessionLifecycle,
    workspaceRoot,
  });
  useEffect(() => {
    if (!open || !workspaceRoot) return;
    let cancelled = false;
    setProbeError(null);
    void host
      .getAgentProviderRuntime("codex-app-server", {
        executablePreference: codexDefaults.executable,
      })
      .then((result) => {
        if (!cancelled) setRuntime(result);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setProbeError(
            error instanceof Error ? error.message : "Codex probe failed.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [
    codexDefaults.executable.mode,
    codexDefaults.executable.path,
    host,
    open,
    workspaceRoot,
  ]);
  useEffect(() => {
    if (
      sessionReady ||
      resumeClosedSessionRef.current ||
      sessionStartingRef.current
    ) {
      return;
    }
    setPermissionMode(codexDefaults.permissionMode);
    setNetworkAccess(codexDefaults.networkAccess);
    setWebSearch(codexDefaults.webSearch);
    if (runtime?.probe.state === "ready") {
      const settings = createAgentSessionSettingsSnapshot(
        codexDefaults,
        runtime,
      );
      sessionSettingsRef.current = settings;
      setSessionSettings(settings);
      setContextProfile(settings.contextProfile);
    }
  }, [
    codexDefaults.model,
    codexDefaults.networkAccess,
    codexDefaults.permissionMode,
    codexDefaults.personality,
    codexDefaults.reasoningEffort,
    codexDefaults.contextProfile,
    codexDefaults.webSearch,
    runtime,
    sessionReady,
  ]);
  const handleEvent = useCallback(
    (event: AgentEvent) => {
      if (event.type === "sessionReady") {
        sessionReadyRef.current = true;
        setSessionLifecycle("ready");
      }
      if (event.type === "providerDisconnected") {
        const disconnectedSessionId = sessionIdRef.current;
        sessionReadyRef.current = false;
        resumeClosedSessionRef.current = true;
        setSessionLifecycle("closed");
        updateRecoveryState("cleaning");
        if (!disconnectCleanupRef.current) {
          disconnectCleanupRef.current = host
            .closeAgentSession(disconnectedSessionId)
            .catch(() => undefined)
            .then(() => {
              if (sessionIdRef.current === disconnectedSessionId) {
                updateRecoveryState("disconnected");
              }
            })
            .finally(() => {
              disconnectCleanupRef.current = null;
            });
        }
      }
      if (event.type === "turnInputAccepted") {
        acceptedTurnIdsRef.current.add(event.clientTurnId);
        const acceptedImageIds = Array.isArray(event.imageAttachmentIds)
          ? event.imageAttachmentIds
          : [];
        setImages((current) =>
          current.filter(
            (image) => !acceptedImageIds.includes(image.attachmentId),
          ),
        );
        for (const [imageId, image] of selectionImageAttachmentsRef.current) {
          if (acceptedImageIds.includes(image.attachmentId)) {
            selectionImageAttachmentsRef.current.delete(imageId);
          }
        }
        const acceptedSelections = submittedSelectionIdsRef.current;
        submittedSelectionIdsRef.current = [];
        if (acceptedSelections.length > 0) {
          setRestoredQuotedContexts((current) =>
            current.filter(
              (context) => !acceptedSelections.includes(context.snapshotId),
            ),
          );
          onQuotedContextsAccepted?.(acceptedSelections);
        }
      }
      if (event.type === "sessionTitleUpdated") {
        applyAgentSessionTitleEvent(
          event,
          sessionTitleEventSequenceRef,
          sessionTitleEventsRef,
          setSessionPage,
        );
        historySearch.reloadRef.current();
      }
      handleContextEvent(event);
      dispatch({ type: "event", event });
    },
    [handleContextEvent, host, onQuotedContextsAccepted, updateRecoveryState],
  );
  useEffect(() => {
    if (
      !handoffSnapshot ||
      handoff?.sessionReady ||
      handoffReadyReportedRef.current
    ) {
      return;
    }
    handoffReadyReportedRef.current = true;
    onHandoffReady?.();
  }, [handoff?.sessionReady, handoffSnapshot, onHandoffReady]);
  useEffect(() => {
    if (
      !handoffSnapshot ||
      !handoff?.sessionReady ||
      handoffAttachedRef.current
    ) {
      return;
    }
    handoffAttachedRef.current = true;
    void host
      .attachAgentSession(
        handoff.sessionId,
        handoffSnapshot.lastEventSequence,
        handleEvent,
      )
      .then(() => {
        handoffReadyReportedRef.current = true;
        onHandoffReady?.();
      })
      .catch((error: unknown) => {
        handoffAttachedRef.current = false;
        const message =
          error instanceof Error
            ? error.message
            : "AI Chat could not move to this window.";
        setActionNotice(message);
        onHandoffFailure?.(message);
      });
  }, [
    handoff,
    handoffSnapshot,
    handleEvent,
    host,
    onHandoffReady,
    onHandoffFailure,
    setActionNotice,
  ]);
  useEffect(() => {
    if (!terminateSession) return;
    if (sessionReady) {
      void host.closeAgentSession(sessionIdRef.current);
      resumeClosedSessionRef.current = true;
      sessionReadyRef.current = false;
      setSessionLifecycle("closed");
    }
    sessionStartingRef.current = false;
    pendingSessionActionRef.current = null;
    pendingFullAccessTransactionRef.current = null;
    setImages([]);
    setRestoredQuotedContexts([]);
    setImageErrors([]);
    selectionImageAttachmentsRef.current.clear();
    submittedSelectionIdsRef.current = [];
    acceptedTurnIdsRef.current.clear();
  }, [host, sessionReady, terminateSession]);
  async function startIdleSession(
    fullAccessConfirmed = false,
  ): Promise<boolean> {
    if (!(await workspaceIsolation.ensureWorkspaceBoundary())) {
      return false;
    }
    if (
      sessionReadyRef.current ||
      sessionStartingRef.current ||
      !workspaceRoot ||
      runtime?.probe.state !== "ready"
    ) {
      if (runtime?.probe.state !== "ready") {
        setActionNotice(
          probeError ??
            "Codex is still being prepared. Try again after the provider is ready.",
        );
      }
      return sessionReadyRef.current;
    }
    if (permissionMode === "fullAccess" && !fullAccessConfirmed) {
      setConfirmFullAccess(true);
      return false;
    }
    const settings = {
      ...createAgentSessionSettingsSnapshot(codexDefaults, runtime),
      contextProfile,
    };
    sessionSettingsRef.current = settings;
    setSessionSettings(settings);
    sessionStartingRef.current = true;
    setSessionLifecycle("starting");
    setActionNotice(null);
    const clientSessionId = sessionIdRef.current;
    const operation = workspaceIsolation.createOperationToken(
      clientSessionId,
      workspaceRoot,
    );
    try {
      await host.startAgentSession(
        createAgentSessionStartInput({
          clientSessionId,
          networkAccess,
          permissionMode,
          settings,
          webSearch,
          workspaceRoot,
        }),
        workspaceIsolation.guardEvents(operation, handleEvent),
      );
      if (
        !workspaceIsolation.isOperationCurrent(operation) ||
        !workspaceIsolation.bindSession(operation)
      ) {
        await workspaceIsolation.cleanupSession(clientSessionId);
        return false;
      }
      sessionReadyRef.current = true;
      setSessionLifecycle("ready");
      resumeClosedSessionRef.current = false;
      return true;
    } catch (error) {
      const cleanupSucceeded =
        await workspaceIsolation.cleanupSession(clientSessionId);
      if (!workspaceIsolation.isOperationCurrent(operation)) {
        return false;
      }
      sessionReadyRef.current = false;
      setSessionLifecycle("idle");
      if (cleanupSucceeded) {
        setActionNotice(
          error instanceof Error
            ? error.message
            : "Could not start the agent chat.",
        );
      }
      return false;
    } finally {
      if (workspaceIsolation.isOperationCurrent(operation)) {
        sessionStartingRef.current = false;
      }
    }
  }
  async function ensureSessionReady(action: PendingSessionAction) {
    if (!(await workspaceIsolation.ensureWorkspaceBoundary())) {
      return;
    }
    if (
      workspaceIsolation.isSessionCurrent() &&
      sessionReadyRef.current &&
      recoveryStateRef.current === "connected"
    ) {
      await action();
      return;
    }
    if (sessionStartingRef.current) return;
    if (resumeClosedSessionRef.current) {
      if (permissionMode === "fullAccess") {
        pendingSessionActionRef.current = action;
        setConfirmClosedFullAccessResume(true);
        return;
      }
      if (
        await resumeClosedSessionTransaction({
          fullAccessConfirmed: false,
          reason:
            recoveryStateRef.current === "connected"
              ? "closed"
              : "providerDisconnected",
        })
      ) {
        await action();
      }
      return;
    }
    if (permissionMode === "fullAccess") {
      pendingSessionActionRef.current = action;
      setConfirmFullAccess(true);
      return;
    }
    if (await startIdleSession()) {
      await action();
    }
  }
  async function reconnectSession() {
    if (
      recoveryStateRef.current === "connected" ||
      recoveryStateRef.current === "cleaning" ||
      recoveryStateRef.current === "reconnecting" ||
      sessionStartingRef.current
    ) {
      return;
    }
    if (permissionMode === "fullAccess") {
      setConfirmClosedFullAccessResume(true);
      return;
    }
    await resumeClosedSessionTransaction({
      fullAccessConfirmed: false,
      reason: "providerDisconnected",
    });
  }
  async function startSessionTransaction({
    nextMode,
    nextNetworkAccess = networkAccess,
    nextWebSearch = webSearch,
    nextContextProfile = contextProfile,
    preserveComposerContext = false,
  }: AgentSessionAccessTransactionInput) {
    if (!(await workspaceIsolation.ensureWorkspaceBoundary())) {
      return false;
    }
    if (
      activeTurnId ||
      sessionStartingRef.current ||
      runtime?.probe.state !== "ready" ||
      !workspaceRoot
    ) {
      return false;
    }
    const previousSessionReady = sessionReadyRef.current;
    const previousSessionId = sessionIdRef.current;
    const previousSessionWorkspaceRoot =
      workspaceIsolation.sessionWorkspaceRootRef.current;
    const nextSessionId = crypto.randomUUID();
    const settings = {
      ...createAgentSessionSettingsSnapshot(codexDefaults, runtime),
      contextProfile: nextContextProfile,
    };
    sessionStartingRef.current = true;
    sessionReadyRef.current = false;
    sessionIdRef.current = nextSessionId;
    setSessionLifecycle("starting");
    setActionNotice(null);
    const operation = workspaceIsolation.createOperationToken(
      nextSessionId,
      workspaceRoot,
    );
    try {
      await host.startAgentSession(
        createAgentSessionStartInput({
          clientSessionId: nextSessionId,
          networkAccess: nextNetworkAccess,
          permissionMode: nextMode,
          settings,
          webSearch: nextWebSearch,
          workspaceRoot,
        }),
        workspaceIsolation.guardEvents(operation, handleEvent),
      );
      if (
        !workspaceIsolation.isOperationCurrent(operation) ||
        !workspaceIsolation.bindSession(operation)
      ) {
        await workspaceIsolation.cleanupSession(nextSessionId);
        return false;
      }
      sessionReadyRef.current = true;
      sessionSettingsRef.current = settings;
      setSessionSettings(settings);
      setPermissionMode(nextMode);
      setNetworkAccess(nextNetworkAccess);
      setWebSearch(nextWebSearch);
      setContextProfile(nextContextProfile);
      setSessionLifecycle("ready");
      resumeClosedSessionRef.current = false;
      setOlderHistoryCursor(null);
      resetConversationFollow();
      dispatch({ type: "reset" });
      resetContextPressure();
      if (preserveComposerContext) {
        if (preserveContextForAccessChange(images.length)) {
          setActionNotice(
            "Access changed. Reattach direct images before sending this question.",
          );
        }
      } else {
        clearSessionLocalContext();
      }
      if (previousSessionId !== nextSessionId) {
        await host.closeAgentSession(previousSessionId);
      }
      if (historyOpen) {
        await loadSessionPage(true, historyArchived);
      }
      return true;
    } catch (error) {
      await workspaceIsolation.cleanupSession(nextSessionId);
      if (!workspaceIsolation.isOperationCurrent(operation)) {
        return false;
      }
      sessionStartingRef.current = false;
      sessionIdRef.current = previousSessionId;
      sessionReadyRef.current = previousSessionReady;
      workspaceIsolation.sessionWorkspaceRootRef.current =
        previousSessionWorkspaceRoot;
      setSessionLifecycle(previousSessionReady ? "ready" : "idle");
      setActionNotice(
        error instanceof Error ? error.message : "Could not start a new chat.",
      );
      return false;
    } finally {
      if (workspaceIsolation.isOperationCurrent(operation)) {
        sessionStartingRef.current = false;
      }
    }
  }
  const sessionOpen = () =>
    sessionReadyRef.current || resumeClosedSessionRef.current;
  const requestFullAccessConfirmation = (
    transaction: () => Promise<boolean>,
  ) => {
    pendingFullAccessTransactionRef.current = transaction;
    setConfirmFullAccess(true);
  };
  const { selectNetworkAccess, selectPermissionMode, selectWebSearch } =
    createAgentAccessSelectors({
      permissionMode,
      requestFullAccessConfirmation,
      sessionOpen,
      setNetworkAccess,
      setPermissionMode,
      setWebSearch,
      startSessionTransaction,
    });
  const selectContextProfile = createAgentContextProfileSelector({
    permissionMode,
    runtime,
    sessionOpen,
    setContextProfile,
    startSessionTransaction,
  });
  const defaultContextProfile = effectiveContextProfile(codexDefaults, runtime);
  const restartSessionFromProviderDefaults =
    createRestartSessionFromProviderDefaults({
      codexDefaults,
      contextProfile: defaultContextProfile,
      sessionOpen,
      clearIdleSession: () => {
        setPermissionMode(codexDefaults.permissionMode);
        setNetworkAccess(codexDefaults.networkAccess);
        setWebSearch(codexDefaults.webSearch);
        setContextProfile(defaultContextProfile);
        setQuestion("");
        resetConversationFollow();
        dispatch({ type: "reset" });
        resetContextPressure();
        clearSessionLocalContext();
      },
      requestFullAccessConfirmation,
      startSessionTransaction,
    });
  const { loadOlderSessionHistory, loadSessionPage, openSessionHistory } =
    createAgentSessionHistoryLoaders({
      ...{ dispatch, historyArchived, historyPrependScrollRef, historyOpen },
      historyDateRange: historySearch.historyDateRange,
      historyQuery: historySearch.debouncedHistoryQuery,
      ...{ host, olderHistoryCursor, olderHistoryLoading, scrollRef },
      ...{ sessionIdRef, sessionPage },
      sessionListRequestSequenceRef: historySearch.requestSequenceRef,
      ...{ sessionTitleEventSequenceRef, sessionTitleEventsRef },
      ...{ setActionNotice, setOlderHistoryCursor, setOlderHistoryLoading },
      ...{ setHistoryOpen, setSessionListError, setSessionListLoading },
      ...{ setSessionPage, setSettingsOpen, state },
      ...{ workspaceIsolation, workspaceRoot },
    });
  useAgentSessionHistorySearchReload({
    historyArchived,
    historyOpen,
    loadSessionPage,
    search: historySearch,
    sessionPage,
  });
  async function resumeClosedSessionTransaction({
    fullAccessConfirmed,
    reason,
  }: AgentSessionResumeOptions) {
    if (!(await workspaceIsolation.ensureWorkspaceBoundary())) {
      return false;
    }
    if (disconnectCleanupRef.current) {
      await disconnectCleanupRef.current;
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
  const { cancelFullAccessStart, confirmFullAccessStart } =
    createAgentFullAccessActions({
      pendingFullAccessTransactionRef,
      pendingSessionActionRef,
      resumeClosedSessionTransaction: (fullAccessConfirmed) =>
        resumeClosedSessionTransaction({
          fullAccessConfirmed,
          reason:
            recoveryStateRef.current === "connected"
              ? "closed"
              : "providerDisconnected",
        }),
      setConfirmClosedFullAccessResume,
      setConfirmFullAccess,
      startIdleSession,
    });

  async function resumeSessionTransaction(
    summary: AgentSessionSummary,
    fullAccessConfirmed = false,
  ) {
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

  const { deleteSession, renameSession, setSessionArchived } =
    createAgentSessionManagementActions({
      executablePreference: codexDefaults.executable,
      historyArchived,
      host,
      loadSessionPage,
      sessionIdRef,
      setSessionListError,
      workspaceIsolation,
      workspaceRoot,
    });

  async function closeSessionRuntime() {
    pendingSessionActionRef.current = null;
    pendingFullAccessTransactionRef.current = null;
    setConfirmFullAccess(false);
    setConfirmClosedFullAccessResume(false);
    if (activeTurnId && recoveryStateRef.current === "connected") {
      await host.cancelAgentTurn(sessionIdRef.current, activeTurnId);
    }
    if (disconnectCleanupRef.current) {
      await disconnectCleanupRef.current;
    }
    if (sessionReadyRef.current) {
      resumeClosedSessionRef.current = true;
      await host.closeAgentSession(sessionIdRef.current);
      sessionReadyRef.current = false;
      setSessionLifecycle("closed");
    }
    if (recoveryStateRef.current !== "connected") {
      dispatch({ type: "connectionRestored" });
      updateRecoveryState("connected");
    }
    clearSessionLocalContext();
  }

  function createHandoffSnapshot(
    lastMainPlacement: "right" | "bottom",
  ): AgentChatHandoffSnapshot {
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
        contextPressure: captureContextPressure(),
        scroll: captureConversationScroll(),
        pendingTurn: handoff?.pendingTurn ?? null,
        runningAction: handoff?.runningAction ?? null,
      },
    };
  }

  return {
    ...{
      runtime,
      probeError,
      sessionReady,
      sessionStarting,
      sessionLifecycle,
      recoveryState,
      sessionSettings,
    },
    ...{ codexDefaults, permissionMode, setPermissionMode },
    ...{
      networkAccess,
      setNetworkAccess,
      webSearch,
      setWebSearch,
      contextProfile,
      setContextProfile,
    },
    ...{
      settingsOpen,
      setSettingsOpen,
      confirmFullAccess,
      setConfirmFullAccess,
    },
    ...{ responseMode, setResponseMode, question, setQuestion },
    ...{ focusFiles, setFocusFiles, attachments, setAttachments },
    ...{ images, setImages, restoredQuotedContexts, setRestoredQuotedContexts },
    ...{ imageErrors, setImageErrors, mediaModes, setMediaModes },
    ...{ actionNotice, setActionNotice, historyOpen, setHistoryOpen },
    ...{
      historyArchived,
      setHistoryArchived,
      sessionPage,
    },
    ...historySearch.controller,
    ...{ sessionListLoading, sessionListError, olderHistoryCursor },
    ...{ olderHistoryLoading, pendingFullAccessResume },
    ...{ setPendingFullAccessResume, confirmClosedFullAccessResume },
    ...{ setConfirmClosedFullAccessResume, addMenuOpen, setAddMenuOpen },
    ...{ dropActive, setDropActive, contextUsage, contextCompactionStatus },
    tokenUsageDiagnostics,
    ...{ lastCompaction, state, dispatch, sessionIdRef, sessionReadyRef },
    ...{ resumeClosedSessionRef, scrollRef, newActivityAvailable },
    ...{ followLatestConversation, handleConversationScroll },
    ...{ composerDockRef, composerInputRef, activeTurnId },
    ...{ selectionImageAttachmentsRef, submittedSelectionIdsRef },
    ...{ acceptedTurnIdsRef },
    workspaceGeneration: workspaceIsolation.generation,
    isSessionWorkspaceCurrent: workspaceIsolation.isSessionCurrent,
    closeSessionRuntime,
    createHandoffSnapshot,
    ensureSessionReady,
    reconnectSession,
    cancelFullAccessStart,
    confirmFullAccessStart,
    startSessionTransaction,
    selectPermissionMode,
    selectNetworkAccess,
    selectWebSearch,
    selectContextProfile,
    restartSessionFromProviderDefaults,
    loadSessionPage,
    openSessionHistory,
    resumeClosedSessionTransaction,
    resumeSessionTransaction,
    loadOlderSessionHistory,
    renameSession,
    setSessionArchived,
    deleteSession,
    compactContext,
  };
}
export type AgentSessionController = ReturnType<
  typeof useAgentSessionController
>;
