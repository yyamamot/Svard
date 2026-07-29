import type { AgentCompactionOutcome, AgentEvent } from "../../core/types";

export interface MockAgentContextSession {
  activeTurnId: string | null;
  compacting: boolean;
  onEvent: (event: AgentEvent) => void;
}

export function emitMockContextUsage(
  session: MockAgentContextSession | undefined,
  fallbackUsedTokens = 187_500,
  fallbackContextWindowTokens = 250_000,
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
