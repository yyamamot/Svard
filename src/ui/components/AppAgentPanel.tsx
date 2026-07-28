import type {
  AgentQuotedContext,
  AppConfig,
  DocumentPayload,
  HostAdapter,
} from "../../core/types";
import { AgentPanelHost } from "../agent/AgentPanelHost";
import type {
  AgentPanelPlacement,
  MainAgentPanelPlacement,
} from "../agent/agentPanelTypes";

export function AppAgentPanel({
  activeDocument,
  confirmExternalLink,
  focusRequest,
  host,
  onClose,
  onOpenDocument,
  onQuotedContextsAccepted,
  onReviewChanges,
  onRemoveQuotedContext,
  onReturnToQuotedContext,
  onMainPlacementChange,
  open,
  placement,
  portalTarget,
  preferencesOpen,
  providerConfig,
  quotedContexts,
  workspaceRoot,
}: {
  activeDocument: DocumentPayload | null;
  confirmExternalLink: (url: string) => Promise<boolean>;
  focusRequest?: number;
  host: HostAdapter;
  onClose: () => void;
  onOpenDocument: (path: string) => void | Promise<void>;
  onQuotedContextsAccepted: (snapshotIds: string[]) => void;
  onReviewChanges: () => void | Promise<void>;
  onRemoveQuotedContext: (snapshotId: string) => void;
  onReturnToQuotedContext: (snapshot: AgentQuotedContext) => void;
  onMainPlacementChange: (placement: MainAgentPanelPlacement) => void;
  open: boolean;
  placement?: AgentPanelPlacement;
  portalTarget?: HTMLElement | null;
  preferencesOpen: boolean;
  providerConfig: AppConfig["agentProviders"];
  quotedContexts: AgentQuotedContext[];
  workspaceRoot: string | null;
}) {
  return (
    <AgentPanelHost
      activeDocument={activeDocument}
      confirmExternalLink={confirmExternalLink}
      focusRequest={focusRequest}
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
      onMainPlacementChange={onMainPlacementChange}
      placement={placement}
      portalTarget={portalTarget}
      terminateSession={preferencesOpen}
      workspaceRoot={workspaceRoot}
    />
  );
}
