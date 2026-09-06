import { getCommandTitle, type CommandId } from "../../core/commands";
import { detectPlatform, type Platform } from "../../core/keybindings";

export function settingsLabel(platform: Platform = detectPlatform()): string {
  return platform === "mac" ? "Settings" : "Preferences";
}

export function getUiCommandTitle(
  commandId: CommandId,
  platform: Platform = detectPlatform(),
): string {
  if (commandId === "preferences.open")
    return `Open ${settingsLabel(platform)}`;
  if (commandId === "preferences.close")
    return `Close ${settingsLabel(platform)}`;
  return getCommandTitle(commandId);
}
