import type {
  AgentQuotedContext,
  AgentChatHandoffSnapshot,
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
  onDetach,
  handoffSnapshot,
  handoffMoving,
  lastMainPlacement,
  detached,
  onReattach,
  onHandoffSnapshotChange,
  onHandoffReady,
  onHandoffFailure,
  open,
  placement,
  portalTarget,
  preferencesOpen,
  providerConfig,
  theme,
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
  onDetach?: (snapshot: AgentChatHandoffSnapshot) => void | Promise<void>;
  handoffSnapshot?: AgentChatHandoffSnapshot | null;
  handoffMoving?: boolean;
  lastMainPlacement?: MainAgentPanelPlacement;
  detached?: boolean;
  onReattach?: (snapshot: AgentChatHandoffSnapshot) => void | Promise<void>;
  onHandoffSnapshotChange?: (snapshot: AgentChatHandoffSnapshot) => void;
  onHandoffReady?: () => void;
  onHandoffFailure?: (message: string) => void;
  open: boolean;
  placement?: AgentPanelPlacement;
  portalTarget?: HTMLElement | null;
  preferencesOpen: boolean;
  providerConfig: AppConfig["agentProviders"];
  theme: AppConfig["theme"];
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
      theme={theme}
      quotedContexts={quotedContexts}
      onRemoveQuotedContext={onRemoveQuotedContext}
      onQuotedContextsAccepted={onQuotedContextsAccepted}
      onReviewChanges={onReviewChanges}
      onReturnToQuotedContext={onReturnToQuotedContext}
      onMainPlacementChange={onMainPlacementChange}
      onDetach={onDetach}
      handoffSnapshot={handoffSnapshot}
      handoffMoving={handoffMoving}
      lastMainPlacement={lastMainPlacement}
      detached={detached}
      onReattach={onReattach}
      onHandoffSnapshotChange={onHandoffSnapshotChange}
      onHandoffReady={onHandoffReady}
      onHandoffFailure={onHandoffFailure}
      placement={placement}
      portalTarget={portalTarget}
      terminateSession={preferencesOpen}
      workspaceRoot={workspaceRoot}
    />
  );
}
