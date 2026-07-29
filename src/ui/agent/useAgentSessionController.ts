import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type {
  AgentEvent,
  AgentAttachment,
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
import type { AgentPanelHostProps } from "./agentPanelTypes";
import {
  useAgentActionNotice,
  workspaceChangedAgentNotice,
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
export function useAgentSessionController({
  host,
  open,
  providerConfig,
  onQuotedContextsAccepted,
  terminateSession = false,
  workspaceRoot,
}: AgentPanelHostProps) {
  const [runtime, setRuntime] = useState<AgentProviderRuntimeSnapshot | null>(
    () =>
      host.peekAgentProviderRuntime(
        "codex-app-server",
        providerConfig.codex.executable,
      ),
  );
  const [probeError, setProbeError] = useState<string | null>(null);
  const [sessionLifecycle, setSessionLifecycle] =
    useState<AgentSessionLifecycle>("idle");
  const sessionReady = sessionLifecycle === "ready";
  const sessionStarting = sessionLifecycle === "starting";
  const [sessionSettings, setSessionSettings] =
    useState<AgentRuntimeSettingsSnapshot | null>(null);
  const codexDefaults = providerConfig.codex;
  const [permissionMode, setPermissionMode] = useState<AgentPermissionMode>(
    codexDefaults.permissionMode,
  );
  const [networkAccess, setNetworkAccess] = useState(
    codexDefaults.networkAccess,
  );
  const [webSearch, setWebSearch] = useState(codexDefaults.webSearch);
  const [contextProfile, setContextProfile] = useState(
    effectiveContextProfile(codexDefaults, runtime),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmFullAccess, setConfirmFullAccess] = useState(false);
  const [responseMode, setResponseMode] = useState<AgentResponseMode>("auto");
  const [question, setQuestion] = useState("");
  const [focusFiles, setFocusFiles] = useState<AgentFocusFile[]>([]);
  const [attachments, setAttachments] = useState<AgentAttachment[]>([]);
  const [images, setImages] = useState<AgentImageAttachment[]>([]);
  const [restoredQuotedContexts, setRestoredQuotedContexts] = useState<
    AgentQuotedContext[]
  >([]);
  const [imageErrors, setImageErrors] = useState<AgentImageError[]>([]);
  const [mediaModes, setMediaModes] = useState<
    Record<string, DocumentMediaMode>
  >({});
  const [actionNotice, setActionNotice] = useAgentActionNotice();
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
  const [state, dispatch] = useReducer(reduceAgentChat, initialAgentChatState);
  const {
    followLatestConversation,
    handleConversationScroll,
    historyPrependScrollRef,
    newActivityAvailable,
    resetConversationFollow,
    scrollRef,
  } = useAgentConversationScroll(state);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const sessionReadyRef = useRef(false);
  const sessionSettingsRef = useRef<AgentRuntimeSettingsSnapshot | null>(null);
  const sessionTitleEventSequenceRef = useRef(0);
  const sessionTitleEventsRef = useRef(
    new Map<string, { sequence: number; title: string }>(),
  );
  const acceptedTurnIdsRef = useRef(new Set<string>());
  const sessionStartingRef = useRef(false);
  const resumeClosedSessionRef = useRef(false);
  const pendingSessionActionRef = useRef<PendingSessionAction | null>(null);
  const pendingFullAccessTransactionRef =
    useRef<PendingFullAccessTransaction | null>(null);
  const composerDockRef = useRef<HTMLDivElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
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
    onReset: () => {
      pendingSessionActionRef.current = null;
      pendingFullAccessTransactionRef.current = null;
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
    [handleContextEvent, onQuotedContextsAccepted],
  );
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
    await workspaceIsolation.ensureWorkspaceBoundary();
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
        await host.closeAgentSession(clientSessionId).catch(() => undefined);
        return false;
      }
      sessionReadyRef.current = true;
      setSessionLifecycle("ready");
      resumeClosedSessionRef.current = false;
      return true;
    } catch (error) {
      await host.closeAgentSession(clientSessionId).catch(() => undefined);
      if (!workspaceIsolation.isOperationCurrent(operation)) {
        return false;
      }
      sessionReadyRef.current = false;
      setSessionLifecycle("idle");
      setActionNotice(
        error instanceof Error
          ? error.message
          : "Could not start the agent chat.",
      );
      return false;
    } finally {
      if (workspaceIsolation.isOperationCurrent(operation)) {
        sessionStartingRef.current = false;
      }
    }
  }
  async function ensureSessionReady(action: PendingSessionAction) {
    await workspaceIsolation.ensureWorkspaceBoundary();
    if (workspaceIsolation.isSessionCurrent()) {
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
      if (await resumeClosedSessionTransaction(false)) {
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
  async function startSessionTransaction({
    nextMode,
    nextNetworkAccess = networkAccess,
    nextWebSearch = webSearch,
    nextContextProfile = contextProfile,
    preserveComposerContext = false,
  }: AgentSessionAccessTransactionInput) {
    await workspaceIsolation.ensureWorkspaceBoundary();
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
        await host.closeAgentSession(nextSessionId).catch(() => undefined);
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
      await host.closeAgentSession(nextSessionId).catch(() => undefined);
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
  async function resumeClosedSessionTransaction(fullAccessConfirmed: boolean) {
    await workspaceIsolation.ensureWorkspaceBoundary();
    if (
      sessionStartingRef.current ||
      !workspaceRoot ||
      !resumeClosedSessionRef.current
    ) {
      return false;
    }
    const clientSessionId = sessionIdRef.current;
    sessionStartingRef.current = true;
    setSessionLifecycle("starting");
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
      const history = await host.readAgentSessionHistory({
        clientSessionId,
        limit: 50,
      });
      if (
        !workspaceIsolation.isOperationCurrent(operation) ||
        !workspaceIsolation.bindSession(operation)
      ) {
        await host.closeAgentSession(clientSessionId).catch(() => undefined);
        return false;
      }
      resetConversationFollow();
      dispatch({
        type: "hydrate",
        turns: history.turns.map(restoredConversationTurn),
      });
      setOlderHistoryCursor(history.nextCursor);
      resumeClosedSessionRef.current = false;
      setConfirmClosedFullAccessResume(false);
      sessionReadyRef.current = true;
      setSessionLifecycle("ready");
      return true;
    } catch (error) {
      await host.closeAgentSession(clientSessionId).catch(() => undefined);
      if (!workspaceIsolation.isOperationCurrent(operation)) {
        return false;
      }
      sessionReadyRef.current = false;
      setSessionLifecycle("closed");
      setActionNotice(
        error instanceof Error
          ? error.message
          : "This chat could not be resumed.",
      );
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
      resumeClosedSessionTransaction,
      setConfirmClosedFullAccessResume,
      setConfirmFullAccess,
      startIdleSession,
    });

  async function resumeSessionTransaction(
    summary: AgentSessionSummary,
    fullAccessConfirmed = false,
  ) {
    await workspaceIsolation.ensureWorkspaceBoundary();
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
        await host.closeAgentSession(nextSessionId).catch(() => undefined);
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
      await host.closeAgentSession(nextSessionId).catch(() => undefined);
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
    if (activeTurnId) {
      await host.cancelAgentTurn(sessionIdRef.current, activeTurnId);
    }
    if (sessionReadyRef.current) {
      resumeClosedSessionRef.current = true;
      await host.closeAgentSession(sessionIdRef.current);
      sessionReadyRef.current = false;
      setSessionLifecycle("closed");
    }
    clearSessionLocalContext();
  }

  return {
    ...{ runtime, probeError, sessionReady, sessionStarting, sessionSettings },
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
    ensureSessionReady,
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
