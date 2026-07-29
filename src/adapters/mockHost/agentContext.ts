import type {
  AgentCompactionOutcome,
  AgentEvent,
  AgentTokenUsageDiagnostics,
} from "../../core/types";

export interface MockAgentContextSession {
  activeTurnId: string | null;
  compacting: boolean;
  onEvent: (event: AgentEvent) => void;
}

export function emitMockContextUsage(
  session: MockAgentContextSession | undefined,
  fallbackUsedTokens = 187_500,
  fallbackContextWindowTokens = 250_000,
  options: { diagnostics?: boolean } = {},
): void {
  if (!session) return;
  const override = (
    globalThis as typeof globalThis & {
      __SVARD_AGENT_CONTEXT_USAGE__?: {
        usedTokens: number;
        contextWindowTokens: number;
      };
    }
  ).__SVARD_AGENT_CONTEXT_USAGE__;
  const contextWindowTokens = Math.max(
    1,
    override?.contextWindowTokens ?? fallbackContextWindowTokens,
  );
  const usedTokens = Math.max(
    0,
    Math.min(override?.usedTokens ?? fallbackUsedTokens, contextWindowTokens),
  );
  session.onEvent({
    type: "contextUsageUpdated",
    usage: {
      usedTokens,
      contextWindowTokens,
      remainingPercent: Math.max(
        0,
        Math.min(
          100,
          Math.round(
            ((contextWindowTokens - usedTokens) / contextWindowTokens) * 100,
          ),
        ),
      ),
    },
  });
  if (options.diagnostics === false) return;
  const diagnosticsOverride = (
    globalThis as typeof globalThis & {
      __SVARD_AGENT_TOKEN_USAGE_DIAGNOSTICS__?:
        | AgentTokenUsageDiagnostics
        | "invalid";
    }
  ).__SVARD_AGENT_TOKEN_USAGE_DIAGNOSTICS__;
  if (diagnosticsOverride === "invalid") return;
  session.onEvent({
    type: "tokenUsageDiagnosticsUpdated",
    diagnostics: diagnosticsOverride ?? {
      latestRequest: {
        provenance: "providerReported",
        usage: {
          inputTokens: 187_000,
          cachedInputTokens: 180_000,
          outputTokens: 500,
          reasoningOutputTokens: 300,
          totalTokens: 187_500,
        },
      },
      turn: {
        provenance: "aggregatedProviderReports",
        usage: {
          inputTokens: 199_000,
          cachedInputTokens: 190_000,
          outputTokens: 900,
          reasoningOutputTokens: 500,
          totalTokens: 199_900,
        },
      },
      conversation: {
        provenance: "providerReported",
        usage: {
          inputTokens: 487_000,
          cachedInputTokens: 450_000,
          outputTokens: 4_500,
          reasoningOutputTokens: 2_100,
          totalTokens: 491_500,
        },
      },
    },
  });
}

export async function compactMockAgentSession(
  session: MockAgentContextSession | undefined,
): Promise<AgentCompactionOutcome> {
  if (!session) {
    return {
      status: "failed",
      code: "session-not-found",
      message: "The agent chat is not running.",
    };
  }
  if (session.activeTurnId) {
    return {
      status: "failed",
      code: "turn-active",
      message:
        "Wait for the active response to finish before compacting context.",
    };
  }
  if (session.compacting) {
    return {
      status: "failed",
      code: "compaction-active",
      message: "Context compaction is already running.",
    };
  }
  session.compacting = true;
  session.onEvent({ type: "contextCompactionStarted", source: "manual" });
  await new Promise((resolve) => globalThis.setTimeout(resolve, 80));
  const failure = (
    globalThis as typeof globalThis & {
      __SVARD_AGENT_COMPACTION_FAILURE__?: boolean;
    }
  ).__SVARD_AGENT_COMPACTION_FAILURE__;
  if (failure) {
    session.compacting = false;
    return {
      status: "failed",
      code: "compaction-failed",
      message: "Codex could not complete context compaction.",
    };
  }
  session.onEvent({ type: "contextCompactionCompleted", source: "manual" });
  emitMockContextUsage(session, 50_000, 250_000);
  session.compacting = false;
  return { status: "completed" };
}
