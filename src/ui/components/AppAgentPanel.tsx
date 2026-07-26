import type {
  AgentQuotedContext,
  AppConfig,
  DocumentPayload,
  HostAdapter,
} from "../../core/types";
import { AgentPanelHost } from "../agent/AgentPanelHost";

export function AppAgentPanel({
  activeDocument,
  confirmExternalLink,
  host,
  onClose,
  onOpenDocument,
  onQuotedContextsAccepted,
  onReviewChanges,
  onRemoveQuotedContext,
  onReturnToQuotedContext,
  open,
  preferencesOpen,
  providerConfig,
  quotedContexts,
  workspaceRoot,
}: {
  activeDocument: DocumentPayload | null;
  confirmExternalLink: (url: string) => Promise<boolean>;
  host: HostAdapter;
  onClose: () => void;
  onOpenDocument: (path: string) => void | Promise<void>;
  onQuotedContextsAccepted: (snapshotIds: string[]) => void;
  onReviewChanges: () => void | Promise<void>;
  onRemoveQuotedContext: (snapshotId: string) => void;
  onReturnToQuotedContext: (snapshot: AgentQuotedContext) => void;
  open: boolean;
  preferencesOpen: boolean;
  providerConfig: AppConfig["agentProviders"];
  quotedContexts: AgentQuotedContext[];
  workspaceRoot: string | null;
}) {
  return (
    <AgentPanelHost
      activeDocument={activeDocument}
      confirmExternalLink={confirmExternalLink}
      host={host}
      open={open}
      onClose={onClose}
      onOpenDocument={onOpenDocument}
      providerConfig={providerConfig}
      quotedContexts={quotedContexts}
      onRemoveQuotedContext={onRemoveQuotedContext}
      onQuotedContextsAccepted={onQuotedContextsAccepted}
      onReviewChanges={onReviewChanges}
      onReturnToQuotedContext={onReturnToQuotedContext}
      terminateSession={preferencesOpen}
      workspaceRoot={workspaceRoot}
    />
  );
}
