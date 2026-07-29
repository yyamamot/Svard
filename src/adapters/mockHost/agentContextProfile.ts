import type {
  AgentCapabilities,
  AgentContextProfile,
  AgentExecutablePreference,
  AgentProviderId,
  AgentProviderRuntimeSnapshot,
  AgentSessionResumeInput,
  AgentSessionStartInput,
} from "../../core/types";
import { codexAppServerCapabilities } from "../../core/types";
import type { MockAgentSessionRecord } from "./agentTitle";

type FocusedContextGlobals = typeof globalThis & {
  __SVARD_AGENT_FOCUSED_CONTEXT__?: boolean;
  __SVARD_AGENT_FOCUSED_CONTEXT_START_FAILURE__?: boolean;
};

export function mockAgentRuntimeKey(
  providerId: AgentProviderId,
  preference: AgentExecutablePreference,
) {
  return `${providerId}:${preference.mode}:${preference.path ?? ""}`;
}

export function parseMockAgentSessionCursor(cursor?: string | null): number {
  if (cursor == null) return 0;
  if (!/^\d+$/u.test(cursor)) {
    throw new Error("The agent session cursor is invalid.");
  }
  return Number(cursor);
}

export function mockAgentCapabilities(): AgentCapabilities {
  return {
    ...codexAppServerCapabilities,
    focusedContext:
      (globalThis as FocusedContextGlobals).__SVARD_AGENT_FOCUSED_CONTEXT__ !==
      false,
  };
}

export function validateMockFocusedContextStart(
  input: AgentSessionStartInput,
  runtime: AgentProviderRuntimeSnapshot,
): AgentContextProfile {
  const contextProfile = input.contextProfile ?? "focused";
  if (
    contextProfile === "focused" &&
    !runtime.probe.capabilities.focusedContext
  ) {
    throw new Error("Focused context is unavailable.");
  }
  if (
    contextProfile === "focused" &&
    (globalThis as FocusedContextGlobals)
      .__SVARD_AGENT_FOCUSED_CONTEXT_START_FAILURE__
  ) {
    throw new Error("Focused context could not be applied.");
  }
  return contextProfile;
}

export function validateMockFocusedContextResume(
  record: MockAgentSessionRecord,
  input: AgentSessionResumeInput,
  runtime: AgentProviderRuntimeSnapshot,
): AgentContextProfile {
  const contextProfile = record.input.contextProfile ?? "providerDefaults";
  if (
    input.contextProfile !== undefined &&
    contextProfile !== input.contextProfile
  ) {
    throw new Error(
      "The saved agent context profile does not match this chat.",
    );
  }
  if (
    contextProfile === "focused" &&
    !runtime.probe.capabilities.focusedContext
  ) {
    throw new Error("Focused context is unavailable.");
  }
  return contextProfile;
}
