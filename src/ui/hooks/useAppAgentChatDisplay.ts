import { useEffect, useRef, useState } from "react";
import type {
  AgentChatHandoffSnapshot,
  AgentExecutablePreference,
  HostAdapter,
} from "../../core/types";
import {
  agentChatEntryStateFromRuntime,
  type AgentChatEntryState,
} from "../agent/agentChatEntry";
import { useDetachedAgentChat } from "./useDetachedAgentChat";

export function useAppAgentChatDisplayState({
  executablePreference,
  host,
  onError,
  onOpenChange,
  workspaceRoot,
}: {
  executablePreference: AgentExecutablePreference;
  host: HostAdapter;
  onError(message: string): void;
  onOpenChange(open: boolean): void;
  workspaceRoot: string | null;
}) {
  const detachedAgentChat = useDetachedAgentChat({
    host,
    onError,
    onOpenChange,
  });
  const latestMainAgentSnapshotRef = useRef<AgentChatHandoffSnapshot | null>(
    null,
  );
  const [mainAgentSnapshotReady, setMainAgentSnapshotReady] = useState(false);
  const [mainAgentSnapshotMovable, setMainAgentSnapshotMovable] =
    useState(true);
  const [agentChatEntryState, setAgentChatEntryState] =
    useState<AgentChatEntryState>("unknown");
  const agentChatEntryProbeRef = useRef(false);

  useEffect(() => {
    if (!workspaceRoot) {
      setAgentChatEntryState("unknown");
      return;
    }
    setAgentChatEntryState(
      agentChatEntryStateFromRuntime(
        host.peekAgentProviderRuntime("codex-app-server", executablePreference),
      ),
    );
  }, [
    executablePreference.mode,
    executablePreference.path,
    host,
    workspaceRoot,
  ]);

  return {
    agentChatEntryProbeRef,
    agentChatEntryState,
    detachedAgentChat,
    latestMainAgentSnapshotRef,
    mainAgentSnapshotMovable,
    mainAgentSnapshotReady,
    setAgentChatEntryState,
    setMainAgentSnapshotMovable,
    setMainAgentSnapshotReady,
  };
}
