import type { CommandDispatchResult, CommandId } from "../../../core/commands";

export type DiffPreviewMouseGestureScrollAction =
  | "top"
  | "bottom"
  | "pageUp"
  | "pageDown"
  | "lineUp"
  | "lineDown";

export function dispatchDiffPreviewMouseGestureCommand({
  commandId,
  changeCount,
  moveChange,
  scrollPane,
  closePreview,
}: {
  commandId: CommandId;
  changeCount: number;
  moveChange: (offset: number) => void;
  scrollPane: (action: DiffPreviewMouseGestureScrollAction) => boolean;
  closePreview: () => void;
}): CommandDispatchResult {
  switch (commandId) {
    case "navigation.back":
    case "navigation.forward":
      if (changeCount <= 0) {
        return { commandId, status: "disabled" };
      }
      moveChange(commandId === "navigation.back" ? -1 : 1);
      return { commandId, status: "handled" };
    case "viewer.top":
      return scrollPane("top")
        ? { commandId, status: "handled" }
        : { commandId, status: "disabled" };
    case "viewer.bottom":
      return scrollPane("bottom")
        ? { commandId, status: "handled" }
        : { commandId, status: "disabled" };
    case "viewer.pageUp":
      return scrollPane("pageUp")
        ? { commandId, status: "handled" }
        : { commandId, status: "disabled" };
    case "viewer.pageDown":
      return scrollPane("pageDown")
        ? { commandId, status: "handled" }
        : { commandId, status: "disabled" };
    case "viewer.scrollUp":
      return scrollPane("lineUp")
        ? { commandId, status: "handled" }
        : { commandId, status: "disabled" };
    case "viewer.scrollDown":
      return scrollPane("lineDown")
        ? { commandId, status: "handled" }
        : { commandId, status: "disabled" };
    case "tab.close":
    case "preferences.close":
      closePreview();
      return { commandId, status: "handled" };
    default:
      return { commandId, status: "disabled" };
  }
}
