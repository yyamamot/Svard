import type { CommandId } from "../../core/commands";

export interface DocumentDiffStreamCommandBridge {
  dispatch(commandId: CommandId): boolean;
}
