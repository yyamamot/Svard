import type {
  AgentExecutablePreference,
  AgentProviderRuntimeSnapshot,
  HostAdapter,
} from "../../core/types";

export type AgentChatEntryState =
  | "unknown"
  | "checking"
  | "ready"
  | "setupRequired";

export function agentChatEntryStateFromRuntime(
  runtime: AgentProviderRuntimeSnapshot | null,
): Exclude<AgentChatEntryState, "checking"> {
  if (!runtime) return "unknown";
  return runtime.probe.state === "ready" ? "ready" : "setupRequired";
}

export async function resolveAgentChatEntry(
  host: HostAdapter,
  executablePreference: AgentExecutablePreference,
): Promise<"ready" | "setupRequired"> {
  const cached = host.peekAgentProviderRuntime(
    "codex-app-server",
    executablePreference,
  );
  if (cached) {
    return cached.probe.state === "ready" ? "ready" : "setupRequired";
  }
  try {
    const runtime = await host.getAgentProviderRuntime("codex-app-server", {
      executablePreference,
    });
    return runtime.probe.state === "ready" ? "ready" : "setupRequired";
  } catch {
    return "setupRequired";
  }
}
