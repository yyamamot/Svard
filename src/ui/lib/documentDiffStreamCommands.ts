import type { CommandId } from "../../core/commands";

export interface DocumentDiffStreamCommandBridge {
  dispatch(commandId: CommandId): boolean;
  isEnabled(commandId: CommandId): boolean;
}
