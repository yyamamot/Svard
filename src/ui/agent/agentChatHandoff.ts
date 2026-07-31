import type {
  AgentAttachment,
  AgentChatHandoffSnapshot,
  AgentContextProfile,
  AgentFocusFile,
  AgentImageAttachment,
  AgentPermissionMode,
  AgentProviderRuntimeSnapshot,
  AgentQuotedContext,
  AgentResponseMode,
  AppConfig,
  DocumentMediaMode,
  DocumentPayload,
} from "../../core/types";
import type { AgentChatState } from "./agentChatState";
import type { AgentRuntimeSettingsSnapshot } from "./agentPanelModel";
import type { ContextPressureSnapshot } from "./useAgentContextPressure";
import type { AgentConversationScrollSnapshot } from "./useAgentConversationScroll";
import type { PreparedAgentTurn } from "./useAgentRunningTurnControl";

export type AgentSessionRecoveryState =
  | "connected"
  | "cleaning"
  | "cleanupFailed"
  | "disconnected"
  | "reconnecting";

export interface AgentChatHandoffPayload {
  activeDocument: DocumentPayload | null;
  providerConfig: AppConfig["agentProviders"];
  theme: AppConfig["theme"];
  state: AgentChatState;
  sessionId: string;
  sessionReady: boolean;
  sessionLifecycle: "idle" | "starting" | "ready" | "closed";
  recoveryState: AgentSessionRecoveryState;
  sessionSettings: AgentRuntimeSettingsSnapshot | null;
  runtime: AgentProviderRuntimeSnapshot | null;
  permissionMode: AgentPermissionMode;
  networkAccess: boolean;
  webSearch: boolean;
  contextProfile: AgentContextProfile;
  responseMode: AgentResponseMode;
  question: string;
  focusFiles: AgentFocusFile[];
  attachments: AgentAttachment[];
  images: AgentImageAttachment[];
  quotedContexts: AgentQuotedContext[];
  mediaModes: Record<string, DocumentMediaMode>;
  actionNotice: string | null;
  contextPressure: ContextPressureSnapshot;
  scroll: AgentConversationScrollSnapshot;
  pendingTurn: PreparedAgentTurn | null;
  runningAction: "queue" | "steer" | "stopAndSend" | null;
}

export function agentChatHandoffPayload(
  snapshot: AgentChatHandoffSnapshot | null | undefined,
): AgentChatHandoffPayload | null {
  if (!snapshot || snapshot.version !== 1 || !snapshot.payload) return null;
  return snapshot.payload as AgentChatHandoffPayload;
}
