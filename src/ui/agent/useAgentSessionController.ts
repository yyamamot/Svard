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
import { applyAgentSessionTitleEvent } from "./agentSessionTitleEvents";
import { useAgentConversationScroll } from "./useAgentConversationScroll";
import {
  createAgentSessionStartInput,
  createAgentSessionSettingsSnapshot,
  restoredConversationTurn,
  type AgentImageError,
  type AgentRuntimeSettingsSnapshot,
} from "./agentPanelModel";
import type { AgentPanelHostProps } from "./agentPanelTypes";

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmFullAccess, setConfirmFullAccess] = useState(false);
  const [responseMode, setResponseMode] = useState<AgentResponseMode>("auto");
  const [chatVisible, setChatVisible] = useState(true);
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
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyArchived, setHistoryArchived] = useState(false);
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
  const activeTurnId = state.activeTurnId;
  const selectionImageAttachmentsRef = useRef(
    new Map<string, AgentImageAttachment>(),
  );
  const submittedSelectionIdsRef = useRef<string[]>([]);

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
    }
  }, [
    codexDefaults.model,
    codexDefaults.networkAccess,
    codexDefaults.permissionMode,
    codexDefaults.personality,
    codexDefaults.reasoningEffort,
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
      }
      dispatch({ type: "event", event });
    },
    [onQuotedContextsAccepted],
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

  function clearSessionLocalContext() {
    setImages([]);
    setRestoredQuotedContexts([]);
    setImageErrors([]);
    setFocusFiles([]);
    setAttachments([]);
    setMediaModes({});
    selectionImageAttachmentsRef.current.clear();
    submittedSelectionIdsRef.current = [];
  }

  async function startIdleSession(
    fullAccessConfirmed = false,
  ): Promise<boolean> {
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
    const settings = createAgentSessionSettingsSnapshot(codexDefaults, runtime);
    sessionSettingsRef.current = settings;
    setSessionSettings(settings);
    sessionStartingRef.current = true;
    setSessionLifecycle("starting");
    setActionNotice(null);
    try {
      await host.startAgentSession(
        createAgentSessionStartInput({
          clientSessionId: sessionIdRef.current,
          networkAccess,
          permissionMode,
          settings,
          webSearch,
          workspaceRoot,
        }),
        handleEvent,
      );
      sessionReadyRef.current = true;
      setSessionLifecycle("ready");
      resumeClosedSessionRef.current = false;
      return true;
    } catch (error) {
      await host.closeAgentSession(sessionIdRef.current).catch(() => undefined);
      sessionReadyRef.current = false;
      setSessionLifecycle("idle");
      setActionNotice(
        error instanceof Error
          ? error.message
          : "Could not start the agent chat.",
      );
      return false;
    } finally {
      sessionStartingRef.current = false;
    }
  }

  async function ensureSessionReady(action: PendingSessionAction) {
    if (sessionReadyRef.current) {
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

  function cancelFullAccessStart() {
    pendingSessionActionRef.current = null;
    pendingFullAccessTransactionRef.current = null;
    setConfirmFullAccess(false);
    setConfirmClosedFullAccessResume(false);
  }

  async function confirmFullAccessStart(closedSession: boolean) {
    setConfirmFullAccess(false);
    setConfirmClosedFullAccessResume(false);
    const sessionAction = pendingSessionActionRef.current;
    const transaction = pendingFullAccessTransactionRef.current;
    pendingSessionActionRef.current = null;
    pendingFullAccessTransactionRef.current = null;
    let ready = false;
    if (closedSession) {
      ready = await resumeClosedSessionTransaction(true);
    } else if (transaction) {
      ready = await transaction();
    } else {
      ready = await startIdleSession(true);
    }
    if (ready && sessionAction) {
      await sessionAction();
    }
  }

  async function startSessionTransaction({
    nextMode,
    nextNetworkAccess = networkAccess,
    nextWebSearch = webSearch,
  }: {
    nextMode: AgentPermissionMode;
    nextNetworkAccess?: boolean;
    nextWebSearch?: boolean;
  }) {
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
    const nextSessionId = crypto.randomUUID();
    const settings = createAgentSessionSettingsSnapshot(codexDefaults, runtime);
    sessionStartingRef.current = true;
    setSessionLifecycle("starting");
    setActionNotice(null);
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
        handleEvent,
      );
      sessionIdRef.current = nextSessionId;
      sessionReadyRef.current = true;
      sessionSettingsRef.current = settings;
      setSessionSettings(settings);
      setPermissionMode(nextMode);
      setNetworkAccess(nextNetworkAccess);
      setWebSearch(nextWebSearch);
      setSessionLifecycle("ready");
      resumeClosedSessionRef.current = false;
      setOlderHistoryCursor(null);
      resetConversationFollow();
      dispatch({ type: "reset" });
      clearSessionLocalContext();
      if (previousSessionId !== nextSessionId) {
        await host.closeAgentSession(previousSessionId);
      }
      if (historyOpen) {
        await loadSessionPage(true, historyArchived);
      }
      return true;
    } catch (error) {
      await host.closeAgentSession(nextSessionId).catch(() => undefined);
      sessionReadyRef.current = previousSessionReady;
      setSessionLifecycle(previousSessionReady ? "ready" : "idle");
      setActionNotice(
        error instanceof Error ? error.message : "Could not start a new chat.",
      );
      return false;
    } finally {
      sessionStartingRef.current = false;
    }
  }

  async function restartSession(nextMode = permissionMode) {
    if (!sessionReadyRef.current && !resumeClosedSessionRef.current) {
      setPermissionMode(nextMode);
      return;
    }
    await startSessionTransaction({ nextMode });
  }

  async function selectPermissionMode(nextMode: AgentPermissionMode) {
    if (!sessionReadyRef.current && !resumeClosedSessionRef.current) {
      setPermissionMode(nextMode);
      return;
    }
    if (nextMode === "fullAccess") {
      pendingFullAccessTransactionRef.current = () =>
        startSessionTransaction({ nextMode });
      setConfirmFullAccess(true);
      return;
    }
    await startSessionTransaction({ nextMode });
  }

  async function selectNetworkAccess(nextNetworkAccess: boolean) {
    if (!sessionReadyRef.current && !resumeClosedSessionRef.current) {
      setNetworkAccess(nextNetworkAccess);
      return;
    }
    await startSessionTransaction({
      nextMode: permissionMode,
      nextNetworkAccess,
    });
  }

  async function selectWebSearch(nextWebSearch: boolean) {
    if (!sessionReadyRef.current && !resumeClosedSessionRef.current) {
      setWebSearch(nextWebSearch);
      return;
    }
    await startSessionTransaction({
      nextMode: permissionMode,
      nextWebSearch,
    });
  }

  async function restartSessionFromProviderDefaults() {
    if (!sessionReadyRef.current && !resumeClosedSessionRef.current) {
      setPermissionMode(codexDefaults.permissionMode);
      setNetworkAccess(codexDefaults.networkAccess);
      setWebSearch(codexDefaults.webSearch);
      setQuestion("");
      resetConversationFollow();
      dispatch({ type: "reset" });
      clearSessionLocalContext();
      return;
    }
    if (codexDefaults.permissionMode === "fullAccess") {
      pendingFullAccessTransactionRef.current = () =>
        startSessionTransaction({
          nextMode: "fullAccess",
          nextNetworkAccess: codexDefaults.networkAccess,
          nextWebSearch: codexDefaults.webSearch,
        });
      setConfirmFullAccess(true);
      return;
    }
    await startSessionTransaction({
      nextMode: codexDefaults.permissionMode,
      nextNetworkAccess: codexDefaults.networkAccess,
      nextWebSearch: codexDefaults.webSearch,
    });
  }

  async function loadSessionPage(reset: boolean, archived = historyArchived) {
    if (!workspaceRoot) return;
    const titleSequenceBeforeRequest = sessionTitleEventSequenceRef.current;
    setSessionListLoading(true);
    setSessionListError(null);
    try {
      const page = await host.listAgentSessions({
        providerId: "codex-app-server",
        workspaceRoot,
        archived,
        cursor: reset ? null : sessionPage?.nextCursor,
        limit: 30,
      });
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
      setSessionListError(
        error instanceof Error
          ? error.message
          : "Chat history could not be loaded.",
      );
    } finally {
      setSessionListLoading(false);
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

  async function resumeClosedSessionTransaction(fullAccessConfirmed: boolean) {
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
    try {
      await host.resumeAgentSession(
        {
          clientSessionId,
          workspaceRoot,
          executablePreference:
            sessionSettingsRef.current?.executablePreference ??
            codexDefaults.executable,
          fullAccessConfirmed,
        },
        handleEvent,
      );
      const history = await host.readAgentSessionHistory({
        clientSessionId,
        limit: 50,
      });
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
      sessionReadyRef.current = false;
      setSessionLifecycle("closed");
      setActionNotice(
        error instanceof Error
          ? error.message
          : "This chat could not be resumed.",
      );
      return false;
    } finally {
      sessionStartingRef.current = false;
    }
  }

  async function resumeSessionTransaction(
    summary: AgentSessionSummary,
    fullAccessConfirmed = false,
  ) {
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
    const nextSessionId = summary.clientSessionId;
    sessionStartingRef.current = true;
    setSessionLifecycle("starting");
    setSessionListError(null);
    try {
      await host.resumeAgentSession(
        {
          clientSessionId: nextSessionId,
          workspaceRoot,
          executablePreference: codexDefaults.executable,
          fullAccessConfirmed,
        },
        handleEvent,
      );
      const history = await host.readAgentSessionHistory({
        clientSessionId: nextSessionId,
        limit: 50,
      });
      const settings: AgentRuntimeSettingsSnapshot = {
        executablePreference: { ...codexDefaults.executable },
        model: summary.settings.model,
        modelDisplayName: summary.settings.model ?? "Codex default",
        reasoningEffort: summary.settings.reasoningEffort,
        personality: summary.settings.personality,
      };
      sessionIdRef.current = nextSessionId;
      sessionReadyRef.current = true;
      sessionSettingsRef.current = settings;
      setSessionSettings(settings);
      setPermissionMode(summary.settings.permissionMode);
      setNetworkAccess(summary.settings.networkAccess);
      setWebSearch(summary.settings.webSearch);
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
      sessionReadyRef.current = sessionReady;
      setSessionLifecycle(sessionReady ? "ready" : "idle");
      setSessionListError(
        error instanceof Error
          ? error.message
          : "This chat could not be resumed.",
      );
    } finally {
      sessionStartingRef.current = false;
    }
  }

  async function loadOlderSessionHistory() {
    if (!olderHistoryCursor || olderHistoryLoading) return;
    setOlderHistoryLoading(true);
    try {
      const page = await host.readAgentSessionHistory({
        clientSessionId: sessionIdRef.current,
        cursor: olderHistoryCursor,
        limit: 50,
      });
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
      setActionNotice(
        error instanceof Error
          ? error.message
          : "Earlier chat history could not be loaded.",
      );
    } finally {
      setOlderHistoryLoading(false);
    }
  }

  async function renameSession(summary: AgentSessionSummary, title: string) {
    try {
      await host.renameAgentSession({
        clientSessionId: summary.clientSessionId,
        title,
        executablePreference: codexDefaults.executable,
      });
      await loadSessionPage(true, historyArchived);
    } catch (error) {
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
    try {
      await host.setAgentSessionArchived({
        clientSessionId: summary.clientSessionId,
        archived,
        executablePreference: codexDefaults.executable,
      });
      await loadSessionPage(true, historyArchived);
    } catch (error) {
      setSessionListError(
        error instanceof Error
          ? error.message
          : "The chat archive could not be updated.",
      );
      throw error;
    }
  }

  async function deleteSession(summary: AgentSessionSummary) {
    try {
      await host.deleteAgentSession({
        clientSessionId: summary.clientSessionId,
        executablePreference: codexDefaults.executable,
      });
      await loadSessionPage(true, historyArchived);
    } catch (error) {
      setSessionListError(
        error instanceof Error
          ? error.message
          : "The chat could not be deleted.",
      );
      throw error;
    }
  }

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
    runtime,
    probeError,
    sessionReady,
    sessionStarting,
    sessionSettings,
    codexDefaults,
    permissionMode,
    setPermissionMode,
    networkAccess,
    setNetworkAccess,
    webSearch,
    setWebSearch,
    settingsOpen,
    setSettingsOpen,
    confirmFullAccess,
    setConfirmFullAccess,
    responseMode,
    setResponseMode,
    chatVisible,
    setChatVisible,
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
    sessionPage,
    sessionListLoading,
    sessionListError,
    olderHistoryCursor,
    olderHistoryLoading,
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
    sessionIdRef,
    sessionReadyRef,
    resumeClosedSessionRef,
    scrollRef,
    newActivityAvailable,
    followLatestConversation,
    handleConversationScroll,
    composerDockRef,
    activeTurnId,
    selectionImageAttachmentsRef,
    submittedSelectionIdsRef,
    acceptedTurnIdsRef,
    closeSessionRuntime,
    ensureSessionReady,
    cancelFullAccessStart,
    confirmFullAccessStart,
    startSessionTransaction,
    selectPermissionMode,
    selectNetworkAccess,
    selectWebSearch,
    restartSessionFromProviderDefaults,
    loadSessionPage,
    openSessionHistory,
    resumeClosedSessionTransaction,
    resumeSessionTransaction,
    loadOlderSessionHistory,
    renameSession,
    setSessionArchived,
    deleteSession,
  };
}

export type AgentSessionController = ReturnType<
  typeof useAgentSessionController
>;
