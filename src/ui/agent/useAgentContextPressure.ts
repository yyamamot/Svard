import { useCallback, useRef, useState, type MutableRefObject } from "react";
import type {
  AgentContextUsage,
  AgentEvent,
  HostAdapter,
} from "../../core/types";

export type AgentContextCompactionStatus = "idle" | "running" | "updating";
type LastCompaction = "automatic" | "manual" | null;

interface ContextPressureSnapshot {
  usage: AgentContextUsage | null;
  status: AgentContextCompactionStatus;
  lastCompaction: LastCompaction;
}

interface UseAgentContextPressureInput {
  activeTurnId: string | null;
  hasHistory: boolean;
  host: HostAdapter;
  manualCompactionSupported: boolean;
  sessionIdRef: MutableRefObject<string>;
  sessionReadyRef: MutableRefObject<boolean>;
  setActionNotice: (notice: string | null) => void;
}

export function useAgentContextPressure({
  activeTurnId,
  hasHistory,
  host,
  manualCompactionSupported,
  sessionIdRef,
  sessionReadyRef,
  setActionNotice,
}: UseAgentContextPressureInput) {
  const [contextUsage, setContextUsage] = useState<AgentContextUsage | null>(
    null,
  );
  const [contextCompactionStatus, setContextCompactionStatus] =
    useState<AgentContextCompactionStatus>("idle");
  const [lastCompaction, setLastCompaction] = useState<LastCompaction>(null);
  const contextUsageRef = useRef<AgentContextUsage | null>(null);
  const contextCompactionStatusRef =
    useRef<AgentContextCompactionStatus>("idle");

  const resetContextPressure = useCallback(() => {
    contextUsageRef.current = null;
    contextCompactionStatusRef.current = "idle";
    setContextUsage(null);
    setContextCompactionStatus("idle");
    setLastCompaction(null);
  }, []);

  const handleContextEvent = useCallback(
    (event: AgentEvent) => {
      if (event.type === "contextUsageUpdated") {
        contextUsageRef.current = event.usage;
        setContextUsage(event.usage);
        if (contextCompactionStatusRef.current === "updating") {
          contextCompactionStatusRef.current = "idle";
          setContextCompactionStatus("idle");
        }
      } else if (event.type === "contextCompactionStarted") {
        contextUsageRef.current = null;
        setContextUsage(null);
        contextCompactionStatusRef.current = "running";
        setContextCompactionStatus("running");
      } else if (event.type === "contextCompactionCompleted") {
        setLastCompaction(event.source);
        const nextStatus = contextUsageRef.current ? "idle" : "updating";
        contextCompactionStatusRef.current = nextStatus;
        setContextCompactionStatus(nextStatus);
        if (event.source === "automatic") {
          setActionNotice("Context compacted automatically.");
        }
      }
    },
    [setActionNotice],
  );

  const captureContextPressure = useCallback(
    (): ContextPressureSnapshot => ({
      usage: contextUsageRef.current,
      status: contextCompactionStatusRef.current,
      lastCompaction,
    }),
    [lastCompaction],
  );

  const restoreContextPressure = useCallback(
    (snapshot: ContextPressureSnapshot) => {
      contextUsageRef.current = snapshot.usage;
      contextCompactionStatusRef.current = snapshot.status;
      setContextUsage(snapshot.usage);
      setContextCompactionStatus(snapshot.status);
      setLastCompaction(snapshot.lastCompaction);
    },
    [],
  );

  const compactContext = useCallback(async () => {
    if (
      !sessionReadyRef.current ||
      activeTurnId ||
      contextCompactionStatusRef.current !== "idle" ||
      !hasHistory ||
      !manualCompactionSupported
    ) {
      return;
    }
    setActionNotice(null);
    try {
      const outcome = await host.compactAgentSession(sessionIdRef.current);
      if (outcome.status === "failed") {
        contextCompactionStatusRef.current = "idle";
        setContextCompactionStatus("idle");
        setActionNotice(outcome.message);
      }
    } catch (error) {
      contextCompactionStatusRef.current = "idle";
      setContextCompactionStatus("idle");
      setActionNotice(
        error instanceof Error
          ? error.message
          : "Context compaction could not be started.",
      );
    }
  }, [
    activeTurnId,
    hasHistory,
    host,
    manualCompactionSupported,
    sessionIdRef,
    sessionReadyRef,
    setActionNotice,
  ]);

  return {
    captureContextPressure,
    compactContext,
    contextCompactionStatus,
    contextUsage,
    handleContextEvent,
    lastCompaction,
    resetContextPressure,
    restoreContextPressure,
  };
}
