import type { AgentExecutablePreference, HostAdapter } from "../../core/types";
import {
  buildAgentChatDisplayMenu,
  type AgentChatDisplayAction,
} from "../agent/agentChatDisplay";
import {
  agentChatEntryStateFromRuntime,
  resolveAgentChatEntry,
  type AgentChatEntryState,
} from "../agent/agentChatEntry";
import type { useAppAgentChatDisplayState } from "./useAppAgentChatDisplay";

type DisplayState = ReturnType<typeof useAppAgentChatDisplayState>;

export function createAppAgentChatDisplayActions({
  codexPanelOpen,
  diffAgentSurfaceOpen,
  executablePreference,
  host,
  mainPlacement,
  openAgentProviders,
  requestComposerFocus,
  setCodexPanelOpen,
  setMainPlacement,
  showFeedback,
  state,
}: {
  codexPanelOpen: boolean;
  diffAgentSurfaceOpen: boolean;
  executablePreference: AgentExecutablePreference;
  host: HostAdapter;
  mainPlacement: "right" | "bottom";
  openAgentProviders(): void;
  requestComposerFocus(): void;
  setCodexPanelOpen(open: boolean): void;
  setMainPlacement(placement: "right" | "bottom"): void;
  showFeedback(message: string): void;
  state: DisplayState;
}) {
  const { detachedAgentChat } = state;
  const agentChatDisplayItems = buildAgentChatDisplayMenu({
    detached: detachedAgentChat.detached,
    diffOpen: diffAgentSurfaceOpen,
    mainOpen: codexPanelOpen && !detachedAgentChat.detached,
    mainPlacement,
    moving: detachedAgentChat.moving,
    snapshotAvailable:
      state.mainAgentSnapshotReady && state.mainAgentSnapshotMovable,
  });

  async function selectAgentChatDisplay(action: AgentChatDisplayAction) {
    if (action === "showRight" || action === "showBottom") {
      setMainPlacement(action === "showRight" ? "right" : "bottom");
      setCodexPanelOpen(true);
      requestComposerFocus();
    } else if (action === "showDiff") {
      setCodexPanelOpen(true);
      requestComposerFocus();
    } else if (action === "openDetached") {
      const snapshot = state.latestMainAgentSnapshotRef.current;
      if (!snapshot) return showFeedback("AI Chat is still preparing.");
      if ((await detachedAgentChat.detach(snapshot)) && diffAgentSurfaceOpen) {
        setCodexPanelOpen(false);
      }
    } else if (action === "focusDetached") {
      await detachedAgentChat.focus();
    } else if (action === "attachMain") {
      try {
        await host.requestAgentChatReattach();
      } catch (reason) {
        showFeedback(
          reason instanceof Error
            ? reason.message
            : "AI Chat could not return to Main.",
        );
      }
    } else if (action === "hide") {
      setCodexPanelOpen(false);
    }
  }

  async function prepareAgentChatDisplayMenu(): Promise<boolean> {
    if (
      codexPanelOpen ||
      detachedAgentChat.detached ||
      detachedAgentChat.moving
    ) {
      state.setAgentChatEntryState("ready");
      return true;
    }
    const cached = host.peekAgentProviderRuntime(
      "codex-app-server",
      executablePreference,
    );
    if (cached) {
      const nextState = agentChatEntryStateFromRuntime(cached);
      state.setAgentChatEntryState(nextState);
      if (nextState === "ready") return true;
      openAgentProviders();
      return false;
    }
    if (state.agentChatEntryProbeRef.current) return false;
    state.agentChatEntryProbeRef.current = true;
    state.setAgentChatEntryState("checking");
    try {
      const nextState: AgentChatEntryState = await resolveAgentChatEntry(
        host,
        executablePreference,
      );
      state.setAgentChatEntryState(nextState);
      if (nextState === "ready") return true;
      openAgentProviders();
      return false;
    } finally {
      state.agentChatEntryProbeRef.current = false;
    }
  }

  return {
    agentChatDisplayItems,
    prepareAgentChatDisplayMenu,
    selectAgentChatDisplay,
  };
}
