import { useEffect } from "react";
import type { AgentProviderRuntimeSnapshot } from "../../core/types";
import type { AgentPanelHostProps } from "./agentPanelTypes";

interface AgentRuntimeProbeInput {
  codexDefaults: AgentPanelHostProps["providerConfig"]["codex"];
  host: AgentPanelHostProps["host"];
  open: boolean;
  setProbeError: (value: string | null) => void;
  setRuntime: (value: AgentProviderRuntimeSnapshot) => void;
  workspaceRoot?: string | null;
}

export function useAgentRuntimeProbe({
  codexDefaults,
  host,
  open,
  setProbeError,
  setRuntime,
  workspaceRoot,
}: AgentRuntimeProbeInput) {
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
        if (!cancelled) {
          setProbeError(
            error instanceof Error ? error.message : "Codex probe failed.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    codexDefaults.executable.mode,
    codexDefaults.executable.path,
    host,
    open,
    setProbeError,
    setRuntime,
    workspaceRoot,
  ]);
}
