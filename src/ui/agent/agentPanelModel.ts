import type {
  AgentActiveFile,
  AgentContextProfile,
  AgentExecutablePreference,
  AgentPermissionMode,
  AgentProbe,
  AgentProviderRuntimeSnapshot,
  AgentSessionHistoryTurn,
  AgentSessionStartInput,
  AppConfig,
  DocumentChangeSnapshot,
  DocumentPayload,
  DocumentSelectionSnapshot,
} from "../../core/types";
import type { AgentConversationTurn } from "./agentChatState";

export interface AgentImageError {
  id: string;
  displayLabel: string;
  message: string;
}

export interface AgentInternalDragPreview {
  clientX: number;
  clientY: number;
  inside: boolean;
  path: string;
}

export interface AgentRuntimeSettingsSnapshot {
  executablePreference: AgentExecutablePreference;
  model: string | null;
  modelDisplayName: string;
  reasoningEffort: string | null;
  personality: "friendly" | "pragmatic" | "none" | null;
  contextProfile: AgentContextProfile;
}

export function activeFileForTurn(
  activeDocument: Pick<DocumentPayload, "path"> | null,
): AgentActiveFile | null {
  return activeDocument ? { path: activeDocument.path } : null;
}

export function createAgentSessionSettingsSnapshot(
  codex: AppConfig["agentProviders"]["codex"],
  runtime: AgentProviderRuntimeSnapshot | null,
): AgentRuntimeSettingsSnapshot {
  const selected = codex.model
    ? runtime?.catalog?.models.find((model) => model.model === codex.model)
    : runtime?.catalog?.models.find((model) => model.isDefault);
  return {
    executablePreference: { ...codex.executable },
    model: codex.model,
    modelDisplayName:
      selected?.displayName ?? (codex.model ? codex.model : "Codex default"),
    reasoningEffort:
      codex.reasoningEffort === "default" ? null : codex.reasoningEffort,
    personality: codex.personality === "default" ? null : codex.personality,
    contextProfile:
      runtime?.probe.capabilities.focusedContext === true
        ? codex.contextProfile
        : "providerDefaults",
  };
}

export function createAgentSessionStartInput({
  clientSessionId,
  networkAccess,
  permissionMode,
  settings,
  webSearch,
  workspaceRoot,
}: {
  clientSessionId: string;
  networkAccess: boolean;
  permissionMode: AgentPermissionMode;
  settings: AgentRuntimeSettingsSnapshot;
  webSearch: boolean;
  workspaceRoot: string;
}): AgentSessionStartInput {
  return {
    providerId: "codex-app-server",
    executablePreference: settings.executablePreference,
    clientSessionId,
    workspaceRoot,
    permissionMode,
    networkAccess,
    webSearch,
    contextProfile: settings.contextProfile,
    model: settings.model,
    reasoningEffort: settings.reasoningEffort,
    personality: settings.personality,
  };
}

export function restoredConversationTurn(
  turn: AgentSessionHistoryTurn,
): AgentConversationTurn {
  return {
    id: turn.id,
    question: turn.question,
    images: [],
    quotedContexts: [],
    responseMode: turn.responseMode,
    steeringMessages: turn.steeringMessages,
    changedPaths: turn.changedPaths,
    inputAccepted: true,
    restoreEligible: false,
    commentary: "",
    commentaryBuffer: "",
    commentaryClassification: "plain",
    reasoningSummary: "",
    plan: [],
    tools: turn.activities.map((activity, index) => ({
      id: `${turn.id}:activity:${index}`,
      kind: activity.category === "list" ? "read" : activity.category,
      category: activity.category,
      title: activity.title,
      status: activity.status,
      visibility: "user",
      summary: activity.summary,
      durationMs: activity.durationMs,
    })),
    approval: null,
    answer: turn.answer,
    status: turn.status,
    restored: true,
    restoredContextOmitted: turn.contextOmitted,
  };
}

export const supportedImagePath = /\.(?:jpe?g|png|webp)$/iu;

export function fileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("This image could not be read."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const comma = result.indexOf(",");
      if (comma < 0) {
        reject(new Error("This image could not be read."));
        return;
      }
      resolve(result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}

export function resolveAgentWorkspacePath(
  workspaceRoot: string | null,
  relativePath: string,
) {
  if (!workspaceRoot) return null;
  const normalized = relativePath.replaceAll("\\", "/").trim();
  if (
    !normalized ||
    normalized.startsWith("/") ||
    /^[a-z]:\//iu.test(normalized) ||
    /^[a-z][a-z0-9+.-]*:/iu.test(normalized) ||
    normalized.split("/").some((segment) => segment === "..")
  ) {
    return null;
  }
  return `${workspaceRoot.replace(/[\\/]+$/u, "")}/${normalized}`;
}

export function permissionLabel(mode: AgentPermissionMode) {
  switch (mode) {
    case "observe":
      return "Observe";
    case "agent":
      return "Agent";
    case "fullAccess":
      return "Full Access";
  }
}

export function probeLabel(probe: AgentProbe | null) {
  if (!probe) return "Checking Codex…";
  switch (probe.state) {
    case "ready":
      return probe.version ? `Codex ready · ${probe.version}` : "Codex ready";
    case "notFound":
      return "Codex CLI was not found.";
    case "broken":
      return "Codex app-server could not start.";
    case "authenticationRequired":
      return "Codex authentication is required.";
    case "unsupportedVersion":
      return "This Codex app-server is missing required capabilities.";
  }
}

export function selectionDisplayLabel(selection: DocumentSelectionSnapshot) {
  if (selection.diffContext) {
    const side = selection.diffContext.side === "left" ? "Before" : "After";
    return `${selection.diffContext.displayPath} · ${side} · ${selection.diffContext.revisionLabel}`;
  }
  return (
    selection.sectionLabel ??
    selection.documentPath.split(/[\\/]/u).pop() ??
    "Document selection"
  );
}

export function changeDisplayLabel(change: DocumentChangeSnapshot) {
  const kind =
    change.changeKind === "added"
      ? "Added"
      : change.changeKind === "removed"
        ? "Removed"
        : "Changed";
  return `${change.documentPath} · ${kind} · ${change.comparisonLabel}`;
}
