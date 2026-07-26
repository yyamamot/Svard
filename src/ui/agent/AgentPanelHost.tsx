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
  return (
    <AgentPanelView composer={composer} hostProps={props} session={session} />
  );
}
