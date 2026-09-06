import { applyAppShellAgentChatScenario } from "./appShell/agentChat.mjs";
import { applyAppQuitScenario } from "./appShell/appQuit.mjs";
import { applyMacosMenuSettingsScenario } from "./appShell/macosMenuSettings.mjs";
import { applyAppShellBasicsScenario } from "./appShell/basics.mjs";
import { applyAppShellLegacyCodexScenario } from "./appShell/legacyCodex.mjs";
import { applyAppShellNavigationCommandsScenario } from "./appShell/navigationCommands.mjs";
import { applyAppShellPreferencesScenario } from "./appShell/preferences.mjs";
import { applyAppShellWindowLifecycleScenario } from "./appShell/windowLifecycle.mjs";

const appShellScenarioHandlers = [
  applyMacosMenuSettingsScenario,
  applyAppQuitScenario,
  applyAppShellPreferencesScenario,
  applyAppShellBasicsScenario,
  applyAppShellAgentChatScenario,
  applyAppShellLegacyCodexScenario,
  applyAppShellNavigationCommandsScenario,
  applyAppShellWindowLifecycleScenario,
];

export async function applyAppShellScenario(context) {
  for (const applyScenario of appShellScenarioHandlers) {
    if (await applyScenario(context)) {
      return true;
    }
  }
  return false;
}
