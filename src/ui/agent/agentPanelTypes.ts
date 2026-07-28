import type {
  AgentQuotedContext,
  AppConfig,
  DocumentPayload,
  HostAdapter,
} from "../../core/types";

export type MainAgentPanelPlacement = "right" | "bottom";
export type AgentPanelPlacement = "mainRight" | "mainBottom" | "diffDock";

export function panelPlacement(
  placement: MainAgentPanelPlacement,
  diffTarget: HTMLElement | null,
): AgentPanelPlacement {
  if (diffTarget) return "diffDock";
  return placement === "bottom" ? "mainBottom" : "mainRight";
}

export interface AgentPanelHostProps {
  activeDocument: DocumentPayload | null;
  confirmExternalLink?: (url: string) => Promise<boolean>;
  focusRequest?: number;
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
  onMainPlacementChange?: (placement: MainAgentPanelPlacement) => void;
  placement?: AgentPanelPlacement;
  portalTarget?: HTMLElement | null;
}
