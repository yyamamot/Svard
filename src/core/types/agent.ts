import type { AgentTurnContentPart } from "./selection";

export type AgentProviderId =
  | "codex-app-server"
  | "claude-code-cli"
  | "github-copilot-cli";

export type AgentProviderState =
  | "notFound"
  | "broken"
  | "authenticationRequired"
  | "ready"
  | "unsupportedVersion";

export type AgentPermissionMode = "observe" | "agent" | "fullAccess";

export type AgentResponseMode = "auto" | "visualize";

export interface AgentExecutablePreference {
  mode: "auto" | "custom";
  path: string | null;
}

export type AgentInstallationSource =
  | "custom"
  | "path"
  | "standalone"
  | "common"
  | "chatgptApp";

export interface AgentInstallationDescriptor {
  source: AgentInstallationSource;
  displayName: string;
  version: string;
}

export interface AgentCapabilities {
  reasoningSummary: boolean;
  plan: boolean;
  toolActivity: boolean;
  approvals: boolean;
  workspaceWrite: boolean;
  fullAccess: boolean;
  networkAccess: boolean;
  webSearch: boolean;
  structuredFinalAnswer: boolean;
  imageInput: boolean;
  orderedMixedInput?: boolean;
  turnSteering: boolean;
}

export interface AgentProbe {
  providerId: AgentProviderId;
  state: AgentProviderState;
  source: AgentInstallationSource | null;
  version?: string;
  capabilities: AgentCapabilities;
}

export interface AgentReasoningEffortDescriptor {
  value: string;
  description?: string;
}

export interface AgentModelDescriptor {
  id: string;
  model: string;
  displayName: string;
  description: string;
  isDefault: boolean;
  defaultReasoningEffort: string | null;
  supportedReasoningEfforts: AgentReasoningEffortDescriptor[];
  supportsPersonality: boolean;
  inputModalities: Array<"text" | "image">;
}

export interface AgentModelCatalog {
  providerId: AgentProviderId;
  models: AgentModelDescriptor[];
}

export type AgentProviderRuntimeIssueCode =
  | "catalogUnavailable"
  | "providerUnavailable"
  | "unsupported";

export interface AgentProviderRuntimeIssue {
  code: AgentProviderRuntimeIssueCode;
  message: string;
}

export interface AgentProviderRuntimeSnapshot {
  providerId: AgentProviderId;
  probe: AgentProbe;
  installation: AgentInstallationDescriptor | null;
  catalog: AgentModelCatalog | null;
  issue: AgentProviderRuntimeIssue | null;
}

export interface AgentProviderRuntimeOptions {
  refresh?: boolean;
  executablePreference: AgentExecutablePreference;
}

export interface AgentSessionStartInput {
  providerId: AgentProviderId;
  executablePreference: AgentExecutablePreference;
  clientSessionId: string;
  workspaceRoot: string;
  permissionMode: AgentPermissionMode;
  networkAccess: boolean;
  webSearch: boolean;
  model?: string | null;
  reasoningEffort?: string | null;
  personality?: "friendly" | "pragmatic" | "none" | null;
}

export interface AgentSessionInfo {
  clientSessionId: string;
  providerId: AgentProviderId;
  capabilities: AgentCapabilities;
}

export interface AgentSessionManagementCapabilities {
  list: boolean;
  resume: boolean;
  rename: boolean;
  archive: boolean;
  restore: boolean;
  delete: boolean;
  fork: boolean;
}

export type AgentSessionAvailability = "available" | "active" | "unavailable";

export interface AgentSessionSettingsSnapshot {
  permissionMode: AgentPermissionMode;
  networkAccess: boolean;
  webSearch: boolean;
  model: string | null;
  reasoningEffort: string | null;
  personality: "friendly" | "pragmatic" | "none" | null;
}

export interface AgentSessionSummary {
  clientSessionId: string;
  providerId: AgentProviderId;
  title: string;
  createdAt: number;
  updatedAt: number;
  archived: boolean;
  availability: AgentSessionAvailability;
  settings: AgentSessionSettingsSnapshot;
}

export interface AgentSessionListInput {
  providerId: AgentProviderId;
  workspaceRoot: string;
  archived?: boolean;
  cursor?: string | null;
  limit?: number;
}

export interface AgentSessionPage {
  sessions: AgentSessionSummary[];
  nextCursor: string | null;
  managementCapabilities: AgentSessionManagementCapabilities;
}

export interface AgentSessionResumeInput {
  clientSessionId: string;
  workspaceRoot: string;
  executablePreference: AgentExecutablePreference;
  fullAccessConfirmed: boolean;
}

export interface AgentSessionHistoryActivity {
  category: AgentActivityCategory;
  title: string;
  status: Exclude<AgentToolStatus, "running" | "waitingForApproval">;
  summary?: string;
  durationMs?: number;
}

export interface AgentSessionHistoryTurn {
  id: string;
  question: string;
  answer: string;
  responseMode: AgentResponseMode;
  steeringMessages: string[];
  changedPaths: string[];
  activities: AgentSessionHistoryActivity[];
  status: "completed" | "failed" | "cancelled";
  createdAt: number;
  contextOmitted: boolean;
}

export interface AgentSessionHistoryInput {
  clientSessionId: string;
  cursor?: string | null;
  limit?: number;
}

export interface AgentSessionHistoryPage {
  turns: AgentSessionHistoryTurn[];
  nextCursor: string | null;
}

export interface AgentSessionRenameInput {
  clientSessionId: string;
  title: string;
  executablePreference: AgentExecutablePreference;
}

export interface AgentSessionArchiveInput {
  clientSessionId: string;
  archived: boolean;
  executablePreference: AgentExecutablePreference;
}

export interface AgentSessionDeleteInput {
  clientSessionId: string;
  executablePreference: AgentExecutablePreference;
}

export interface AgentFocusFile {
  path: string;
  displayLabel: string;
}

export interface AgentActiveFile {
  path: string;
}

export interface AgentAttachment {
  attachmentId: string;
  displayLabel: string;
  sourcePath: string;
  source: string;
}

export interface AgentImageAttachment {
  attachmentId: string;
  displayLabel: string;
  mediaType: "image/png" | "image/jpeg";
  width: number;
  height: number;
  byteLength: number;
  thumbnailDataUrl: string;
}

export type AgentImageStageSource =
  | {
      kind: "clipboardBytes";
      displayLabel: string;
      mediaType: string;
      base64: string;
    }
  | {
      kind: "selectedPath";
      path: string;
    };

export interface AgentImageStageInput {
  clientSessionId: string;
  source: AgentImageStageSource;
}

export interface AgentImageDiscardInput {
  clientSessionId: string;
  attachmentId: string;
}

export interface AgentTurnInput {
  clientSessionId: string;
  clientTurnId: string;
  question: string;
  responseMode: AgentResponseMode;
  activeFile?: AgentActiveFile | null;
  focusFiles: AgentFocusFile[];
  attachments?: AgentAttachment[];
  imageAttachmentIds?: string[];
  contentParts?: AgentTurnContentPart[];
  visualizationInstructions?: string;
}

export interface AgentSteerInput {
  clientSessionId: string;
  clientTurnId: string;
  clientSteerId: string;
  question: string;
  responseMode: AgentResponseMode;
  activeFile?: AgentActiveFile | null;
  focusFiles: AgentFocusFile[];
  attachments?: AgentAttachment[];
  imageAttachmentIds?: string[];
  contentParts?: AgentTurnContentPart[];
}

export type AgentSteerOutcome =
  | { status: "accepted"; imageAttachmentIds: string[] }
  | { status: "failed"; code: string; message: string };

export type AgentToolKind =
  | "read"
  | "search"
  | "command"
  | "fileChange"
  | "mcp"
  | "webSearch"
  | "other";

export type AgentActivityCategory =
  | "read"
  | "list"
  | "search"
  | "command"
  | "fileChange"
  | "mcp"
  | "webSearch"
  | "other";

export type AgentToolStatus =
  | "running"
  | "waitingForApproval"
  | "completed"
  | "failed"
  | "denied";

export type AgentActivityVisibility = "user" | "internal";

export interface AgentPlanStep {
  id: string;
  title: string;
  status: "pending" | "inProgress" | "completed";
}

export interface AgentApprovalRequest {
  requestId: string;
  kind: "command" | "fileChange" | "permissions";
  title: string;
  detail?: string;
  impact: string;
}

export type AgentApprovalDecision = "allowOnce" | "deny";

export interface AgentApprovalResponseInput {
  clientSessionId: string;
  requestId: string;
  decision: AgentApprovalDecision;
}

export type AgentEvent =
  | {
      type: "sessionReady";
      clientSessionId: string;
      capabilities: AgentCapabilities;
    }
  | {
      type: "providerDisconnected";
      code: string;
      message: string;
    }
  | { type: "turnStarted"; clientTurnId: string }
  | {
      type: "turnInputAccepted";
      clientTurnId: string;
      imageAttachmentIds: string[];
    }
  | {
      type: "sessionTitleUpdated";
      clientSessionId: string;
      title: string;
    }
  | { type: "reasoningSummaryDelta"; delta: string }
  | { type: "assistantCommentaryDelta"; delta: string }
  | { type: "planUpdated"; steps: AgentPlanStep[] }
  | {
      type: "toolStarted";
      toolId: string;
      kind: AgentToolKind;
      category: AgentActivityCategory;
      title: string;
      visibility: AgentActivityVisibility;
      target?: string;
      detail?: string;
    }
  | {
      type: "toolUpdated";
      toolId: string;
      status: AgentToolStatus;
      detail?: string;
    }
  | {
      type: "toolCompleted";
      toolId: string;
      status: Exclude<AgentToolStatus, "running" | "waitingForApproval">;
      summary?: string;
      detail?: string;
      durationMs?: number;
    }
  | { type: "permissionRequested"; request: AgentApprovalRequest }
  | {
      type: "permissionResolved";
      requestId: string;
      decision: AgentApprovalDecision;
    }
  | { type: "filesChanged"; paths: string[] }
  | { type: "finalAnswerDelta"; delta: string }
  | { type: "turnCompleted"; clientTurnId: string }
  | {
      type: "turnFailed";
      clientTurnId: string;
      code: string;
      message: string;
    }
  | { type: "turnCancelled"; clientTurnId: string };

export type AgentTurnOutcome =
  | { status: "completed" }
  | { status: "cancelled" }
  | { status: "failed"; code: string; message: string };

export const codexAppServerCapabilities: AgentCapabilities = {
  reasoningSummary: true,
  plan: true,
  toolActivity: true,
  approvals: true,
  workspaceWrite: true,
  fullAccess: true,
  networkAccess: true,
  webSearch: true,
  structuredFinalAnswer: true,
  imageInput: true,
  orderedMixedInput: true,
  turnSteering: true,
};
