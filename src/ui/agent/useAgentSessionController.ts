import { useCallback, useEffect, useRef } from "react";
// prettier-ignore
import type { AgentEvent, AgentImageAttachment, AgentSessionSummary } from "../../core/types";
import { createAgentFullAccessActions } from "./agentFullAccessActions";
import { applyAgentSessionTitleEvent } from "./agentSessionTitleEvents";
// prettier-ignore
import { createAgentAccessSelectors, createAgentContextProfileSelector, createRestartSessionFromProviderDefaults, effectiveContextProfile, type AgentSessionAccessTransactionInput, } from "./agentSessionAccessActions";
import { createAgentSessionHistoryLoaders } from "./agentSessionHistoryLoaders";
import { createAgentSessionManagementActions } from "./agentSessionManagementActions";
import { useAgentContextPressure } from "./useAgentContextPressure";
// prettier-ignore
import { createAgentSessionStartInput, createAgentSessionSettingsSnapshot } from "./agentPanelModel";
import type { AgentPanelHostProps } from "./agentPanelTypes";
// prettier-ignore
import { providerCleanupFailedAgentNotice, workspaceChangedAgentNotice, workspaceCleanupFailedAgentNotice, } from "./useAgentActionNotice";
import { useAgentSessionContextCleanup } from "./useAgentSessionContextCleanup";
// prettier-ignore
import { useAgentSessionHistorySearchReload } from "./useAgentSessionHistorySearchState";
import { useAgentWorkspaceIsolation } from "./useAgentWorkspaceIsolation";
import { useAgentSessionControllerState } from "./useAgentSessionControllerState";
// prettier-ignore
import { resumeAgentSessionTransaction, resumeClosedAgentSession } from "./agentSessionTransactions";
import { useAgentRuntimeProbe } from "./useAgentRuntimeProbe";

type PendingSessionAction = () => void | Promise<void>;
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
  const sessionControllerState = useAgentSessionControllerState({
    activeDocument,
    handoffSnapshot,
    host,
    providerConfig,
    quotedContexts: providedQuotedContexts,
    theme,
    workspaceRoot,
  });
  // prettier-ignore
  const { handoff, runtime, setRuntime, probeError, setProbeError, sessionLifecycle, setSessionLifecycle, recoveryState, sessionReady, sessionStarting, sessionSettings, setSessionSettings, codexDefaults, permissionMode, setPermissionMode, networkAccess, setNetworkAccess, webSearch, setWebSearch, contextProfile, setContextProfile, settingsOpen, setSettingsOpen, confirmFullAccess, setConfirmFullAccess, responseMode, setResponseMode, question, setQuestion, focusFiles, setFocusFiles, attachments, setAttachments, images, setImages, restoredQuotedContexts, setRestoredQuotedContexts, imageErrors, setImageErrors, mediaModes, setMediaModes, actionNotice, setActionNotice, historyOpen, setHistoryOpen, historyArchived, setHistoryArchived, historySearch, sessionPage, setSessionPage, sessionListLoading, setSessionListLoading, sessionListError, setSessionListError, olderHistoryCursor, setOlderHistoryCursor, olderHistoryLoading, setOlderHistoryLoading, pendingFullAccessResume, setPendingFullAccessResume, confirmClosedFullAccessResume, setConfirmClosedFullAccessResume, addMenuOpen, setAddMenuOpen, dropActive, setDropActive, state, dispatch, followLatestConversation, handleConversationScroll, historyPrependScrollRef, newActivityAvailable, resetConversationFollow, scrollRef, sessionIdRef, sessionReadyRef, sessionSettingsRef, sessionTitleEventSequenceRef, sessionTitleEventsRef, acceptedTurnIdsRef, handoffAttachedRef, handoffReadyReportedRef, sessionStartingRef, resumeClosedSessionRef, recoveryStateRef, disconnectCleanupRef, pendingSessionActionRef, pendingFullAccessTransactionRef, composerDockRef, composerInputRef, closeSessionRuntimeFromState, createHandoffSnapshotFromState, runDisconnectCleanup, updateRecoveryState } = sessionControllerState;
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
  useAgentRuntimeProbe({
    codexDefaults,
    host,
    open,
    setProbeError,
    setRuntime,
    workspaceRoot,
  });
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
        void runDisconnectCleanup(disconnectedSessionId);
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
    [handleContextEvent, onQuotedContextsAccepted, runDisconnectCleanup],
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
    if (recoveryStateRef.current === "cleanupFailed") {
      setActionNotice(providerCleanupFailedAgentNotice);
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
    if (recoveryStateRef.current === "cleanupFailed") {
      await runDisconnectCleanup(sessionIdRef.current);
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
  async function resumeClosedSessionTransaction(
    options: AgentSessionResumeOptions,
  ) {
    return resumeClosedAgentSession(options, {
      handleEvent,
      host,
      resetConversationFollow,
      state: sessionControllerState,
      workspaceIsolation,
      workspaceRoot,
    });
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
    return resumeAgentSessionTransaction(summary, fullAccessConfirmed, {
      activeTurnId,
      captureContextPressure,
      clearSessionLocalContext,
      handleEvent,
      host,
      resetContextPressure,
      resetConversationFollow,
      restoreContextPressure,
      state: sessionControllerState,
      workspaceIsolation,
      workspaceRoot,
    });
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

  const closeSessionRuntime = () =>
    closeSessionRuntimeFromState(activeTurnId, clearSessionLocalContext);

  const createHandoffSnapshot = (lastMainPlacement: "right" | "bottom") =>
    createHandoffSnapshotFromState(lastMainPlacement, captureContextPressure());

  // prettier-ignore
  return { ...{ runtime, probeError, sessionReady, sessionStarting, sessionLifecycle, recoveryState, sessionSettings, }, ...{ codexDefaults, permissionMode, setPermissionMode }, ...{ networkAccess, setNetworkAccess, webSearch, setWebSearch, contextProfile, setContextProfile, }, ...{ settingsOpen, setSettingsOpen, confirmFullAccess, setConfirmFullAccess, }, ...{ responseMode, setResponseMode, question, setQuestion }, ...{ focusFiles, setFocusFiles, attachments, setAttachments }, ...{ images, setImages, restoredQuotedContexts, setRestoredQuotedContexts }, ...{ imageErrors, setImageErrors, mediaModes, setMediaModes }, ...{ actionNotice, setActionNotice, historyOpen, setHistoryOpen }, ...{ historyArchived, setHistoryArchived, sessionPage, }, ...historySearch.controller, ...{ sessionListLoading, sessionListError, olderHistoryCursor }, ...{ olderHistoryLoading, pendingFullAccessResume }, ...{ setPendingFullAccessResume, confirmClosedFullAccessResume }, ...{ setConfirmClosedFullAccessResume, addMenuOpen, setAddMenuOpen }, ...{ dropActive, setDropActive, contextUsage, contextCompactionStatus }, tokenUsageDiagnostics, ...{ lastCompaction, state, dispatch, sessionIdRef, sessionReadyRef }, ...{ resumeClosedSessionRef, scrollRef, newActivityAvailable }, ...{ followLatestConversation, handleConversationScroll }, ...{ composerDockRef, composerInputRef, activeTurnId }, ...{ selectionImageAttachmentsRef, submittedSelectionIdsRef }, ...{ acceptedTurnIdsRef }, workspaceGeneration: workspaceIsolation.generation, isSessionWorkspaceCurrent: workspaceIsolation.isSessionCurrent, closeSessionRuntime, createHandoffSnapshot, ensureSessionReady, reconnectSession, cancelFullAccessStart, confirmFullAccessStart, startSessionTransaction, selectPermissionMode, selectNetworkAccess, selectWebSearch, selectContextProfile, restartSessionFromProviderDefaults, loadSessionPage, openSessionHistory, resumeClosedSessionTransaction, resumeSessionTransaction, loadOlderSessionHistory, renameSession, setSessionArchived, deleteSession, compactContext, };
}
export type AgentSessionController = ReturnType<
  typeof useAgentSessionController
>;
