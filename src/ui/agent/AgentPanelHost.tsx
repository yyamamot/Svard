import { useEffect } from "react";
import { createPortal } from "react-dom";
import { AgentPanelView } from "./AgentPanelView";
import type { AgentPanelHostProps } from "./agentPanelTypes";
import { useAgentSessionController } from "./useAgentSessionController";
import { useAgentTurnComposer } from "./useAgentTurnComposer";

export {
  activeFileForTurn,
  createAgentSessionSettingsSnapshot,
  resolveAgentWorkspacePath,
} from "./agentPanelModel";

export function AgentPanelHost(props: AgentPanelHostProps) {
  const session = useAgentSessionController(props);
  const composer = useAgentTurnComposer(props, session);
  useEffect(() => {
    if (!props.open || !props.focusRequest) return;
    const frame = window.requestAnimationFrame(() => {
      session.composerInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    props.focusRequest,
    props.open,
    props.portalTarget,
    session.composerInputRef,
  ]);
  const panel = (
    <AgentPanelView composer={composer} hostProps={props} session={session} />
  );
  return props.portalTarget ? createPortal(panel, props.portalTarget) : panel;
}
