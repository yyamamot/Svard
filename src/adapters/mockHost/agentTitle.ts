import type {
  AgentExecutablePreference,
  AgentImageAttachment,
  AgentModelCatalog,
  AgentProviderId,
  AgentSessionManagementCapabilities,
  AgentSessionHistoryTurn,
  AgentSessionStartInput,
  AgentSessionSummary,
  AgentTurnInput,
  AgentSteerInput,
  AgentSteerOutcome,
} from "../../core/types";

export function mockAgentModelCatalog(
  providerId: AgentProviderId,
): AgentModelCatalog {
  return {
    providerId,
    models: [
      {
        id: "codex-balanced",
        model: "codex-balanced",
        displayName: "Codex Balanced",
        description: "Balanced model for everyday workspace work.",
        isDefault: true,
        defaultReasoningEffort: "medium",
        supportedReasoningEfforts: [
          { value: "low", description: "Faster responses." },
          { value: "medium", description: "Balanced reasoning." },
          { value: "high", description: "Deeper reasoning." },
        ],
        supportsPersonality: true,
        inputModalities: ["text", "image"],
      },
      {
        id: "codex-fast",
        model: "codex-fast",
        displayName: "Codex Fast",
        description: "Fast text-only model for focused questions.",
        isDefault: false,
        defaultReasoningEffort: "low",
        supportedReasoningEfforts: [{ value: "low" }, { value: "medium" }],
        supportsPersonality: false,
        inputModalities: ["text"],
      },
    ],
  };
}

export const mockAgentSessionManagementCapabilities: AgentSessionManagementCapabilities =
  {
    list: true,
    search: true,
    resume: true,
    rename: true,
    archive: true,
    restore: true,
    delete: true,
    fork: false,
  };

export interface MockAgentSessionRecord {
  input: AgentSessionStartInput;
  title: string;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  availability: "available" | "unavailable";
  turns: AgentSessionHistoryTurn[];
}

export function mockChangedPaths(question: string): string[] {
  return /change review/iu.test(question)
    ? [
        "src/ui/App.tsx",
        "src/ui/agent/AgentConversation.tsx",
        "src/ui/styles/codex-agent-conversation.css",
        "src-tauri/src/agent_app_server/history.rs",
        "docs/04-implementation-plan.md",
        "test/unit/agentConversationUsability.test.tsx",
      ]
    : [];
}

export function recordMockAgentSessionTurn({
  answer,
  input,
  record,
  status,
  steeringMessages,
  timestamp,
}: {
  answer: string;
  input: AgentTurnInput;
  record: MockAgentSessionRecord;
  status: AgentSessionHistoryTurn["status"];
  steeringMessages: string[];
  timestamp: number;
}) {
  record.turns.push({
    id: input.clientTurnId,
    question: input.question,
    answer,
    responseMode: input.responseMode,
    steeringMessages: [...steeringMessages],
    changedPaths: mockChangedPaths(input.question),
    activities:
      status === "completed"
        ? [
            {
              category: "read",
              title: "Inspected files",
              status: "completed",
              summary: `${Math.max(input.focusFiles.length, 1)} relevant file inspected`,
              durationMs: 80,
            },
            {
              category: "search",
              title: "Searched the workspace",
              status: "completed",
              summary: "Relevant references found",
              durationMs: 24,
            },
          ]
        : [],
    status,
    createdAt: timestamp,
    contextOmitted: Boolean(
      input.activeFile ||
      input.focusFiles.length ||
      input.attachments?.length ||
      input.imageAttachmentIds?.length ||
      input.contentParts?.length,
    ),
  });
  record.updatedAt = timestamp;
}

export function applyMockAgentSteer(
  input: AgentSteerInput,
  session:
    | {
        activeTurnId: string | null;
        images: Map<string, AgentImageAttachment>;
        steeringMessages: string[];
      }
    | undefined,
): AgentSteerOutcome {
  if (!session) {
    return {
      status: "failed",
      code: "session-not-found",
      message: "The agent chat is not running.",
    };
  }
  if (session.activeTurnId !== input.clientTurnId) {
    return {
      status: "failed",
      code: "steer-turn-mismatch",
      message: "The active response changed before steering was applied.",
    };
  }
  if (
    (input.imageAttachmentIds ?? []).some(
      (attachmentId) => !session.images.has(attachmentId),
    )
  ) {
    return {
      status: "failed",
      code: "image-not-found",
      message: "An attached image is no longer available.",
    };
  }
  session.steeringMessages.push(input.question);
  return {
    status: "accepted",
    imageAttachmentIds: [...(input.imageAttachmentIds ?? [])],
  };
}

export function mockAgentSessionSummary(
  record: MockAgentSessionRecord,
  active: boolean,
): AgentSessionSummary {
  return {
    clientSessionId: record.input.clientSessionId,
    providerId: record.input.providerId,
    title: record.title,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    archived: record.archived,
    availability: active ? "active" : record.availability,
    settings: {
      permissionMode: record.input.permissionMode,
      networkAccess: record.input.networkAccess,
      webSearch: record.input.webSearch,
      contextProfile: record.input.contextProfile ?? "providerDefaults",
      model: record.input.model ?? null,
      reasoningEffort: record.input.reasoningEffort ?? null,
      personality: record.input.personality ?? null,
    },
  };
}

export function validateMockAgentExecutablePreference(
  preference: AgentExecutablePreference,
) {
  if (
    preference.mode === "custom" &&
    (!preference.path || preference.path.trim().length === 0)
  ) {
    throw new Error("The custom agent executable path is invalid.");
  }
}

export function mockFallbackSessionTitle(
  question: string,
  hasImages: boolean,
  hasSelectedContent: boolean,
) {
  const normalized = question
    .replace(/^\s*[#>*+`-]+\s*/u, "")
    .replace(/\s+/gu, " ")
    .trim();
  const fallback = normalized
    ? normalized
    : hasImages
      ? "Image discussion"
      : hasSelectedContent
        ? "Selected content review"
        : "New chat";
  return [...fallback].slice(0, 80).join("").trimEnd();
}

export function mockGeneratedSessionTitle(question: string) {
  const normalized = question
    .replace(/^\s*[#>*+`-]+\s*/u, "")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/[.!?。！？、,;:]+$/u, "");
  if (!normalized) return null;
  if (/^[\p{ASCII}]+$/u.test(normalized)) {
    const title = normalized.split(" ").slice(0, 6).join(" ");
    return `${title.charAt(0).toUpperCase()}${title.slice(1)}`.slice(0, 80);
  }
  return [...normalized].slice(0, 30).join("").slice(0, 80);
}
