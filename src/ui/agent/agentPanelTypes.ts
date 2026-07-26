import type {
  AgentQuotedContext,
  AppConfig,
  DocumentPayload,
  HostAdapter,
} from "../../core/types";

export interface AgentPanelHostProps {
  activeDocument: DocumentPayload | null;
  confirmExternalLink?: (url: string) => Promise<boolean>;
  host: HostAdapter;
  open: boolean;
  onClose: () => void;
  onOpenDocument?: (path: string) => void | Promise<void>;
  onReviewChanges?: () => void | Promise<void>;
  terminateSession?: boolean;
  workspaceRoot: string | null;
  providerConfig: AppConfig["agentProviders"];
  quotedContexts?: AgentQuotedContext[];
  onRemoveQuotedContext?: (snapshotId: string) => void;
  onQuotedContextsAccepted?: (snapshotIds: string[]) => void;
  onReturnToQuotedContext?: (snapshot: AgentQuotedContext) => void;
}
