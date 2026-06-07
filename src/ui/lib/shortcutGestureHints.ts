import { getCommandTitle, type CommandId } from "../../core/commands";
import {
  detectPlatform,
  formatShortcut,
  normalizeKeybindingMappings,
  type Platform,
} from "../../core/keybindings";
import {
  defaultMouseGestureConfig,
  normalizeMouseGestureMappings,
} from "../../core/mouseGestures";
import type { AppConfig } from "../../core/types";

export type ShortcutGestureHintContext = "viewer" | "diffPreview";

export interface ShortcutGestureHintRow {
  commandId?: CommandId;
  label: string;
  value: string;
}

export interface ShortcutGestureHintModel {
  keyboard: ShortcutGestureHintRow[];
  mouseGestures: ShortcutGestureHintRow[];
  mouseGesturesEnabled: boolean;
  mouseActions: ShortcutGestureHintRow[];
}

interface HintAction {
  commandId: CommandId;
  label?: string;
}

const diffPreviewKeyboardActions: HintAction[] = [
  { commandId: "viewer.contentCursor.previous", label: "Previous change" },
  { commandId: "viewer.contentCursor.next", label: "Next change" },
  { commandId: "preferences.close", label: "Close Diff Preview" },
];

const viewerKeyboardActions: HintAction[] = [
  { commandId: "quickOpen.focus" },
  { commandId: "search.focus" },
  { commandId: "search.next" },
  { commandId: "search.previous" },
  { commandId: "viewer.contentCursor.next" },
  { commandId: "viewer.contentCursor.previous" },
  { commandId: "navigation.back" },
  { commandId: "navigation.forward" },
  { commandId: "view.toggleZenMode" },
  { commandId: "view.splitRight" },
  { commandId: "view.closeSplit" },
  { commandId: "git.showDiff" },
  { commandId: "file.compareWithActive" },
  { commandId: "file.compareFiles" },
];

const diffPreviewGestureActions: HintAction[] = [
  { commandId: "navigation.back", label: "Previous change" },
  { commandId: "navigation.forward", label: "Next change" },
  { commandId: "viewer.top", label: "Scroll active pane to top" },
  { commandId: "viewer.bottom", label: "Scroll active pane to bottom" },
  { commandId: "viewer.pageUp", label: "Page up active pane" },
  { commandId: "viewer.pageDown", label: "Page down active pane" },
  { commandId: "viewer.scrollUp", label: "Scroll active pane up" },
  { commandId: "viewer.scrollDown", label: "Scroll active pane down" },
  { commandId: "tab.close", label: "Close Diff Preview" },
  { commandId: "preferences.close", label: "Close Diff Preview" },
];

const viewerGestureActions: HintAction[] = [
  { commandId: "navigation.back" },
  { commandId: "navigation.forward" },
  { commandId: "viewer.top" },
  { commandId: "viewer.bottom" },
  { commandId: "viewer.pageUp" },
  { commandId: "viewer.pageDown" },
  { commandId: "viewer.scrollUp" },
  { commandId: "viewer.scrollDown" },
  { commandId: "quickOpen.focus" },
];

export function buildShortcutGestureHintModel({
  config,
  context,
  platform = detectPlatform(),
}: {
  config: AppConfig | null;
  context: ShortcutGestureHintContext;
  platform?: Platform;
}): ShortcutGestureHintModel {
  const preset = config?.keybindings?.preset ?? "native";
  const keybindings = normalizeKeybindingMappings(
    preset,
    config?.keybindings?.mappings,
  );
  const mouseGestures = config?.mouseGestures ?? defaultMouseGestureConfig;
  const gestureMappings = normalizeMouseGestureMappings(mouseGestures.mappings);
  const keyboardActions =
    context === "diffPreview"
      ? diffPreviewKeyboardActions
      : viewerKeyboardActions;
  const gestureActions =
    context === "diffPreview"
      ? diffPreviewGestureActions
      : viewerGestureActions;

  return {
    keyboard: keyboardActions.flatMap((action) => {
      const binding = keybindings.find(
        (candidate) =>
          candidate.commandId === action.commandId && candidate.keys.trim(),
      );
      if (!binding) {
        return [];
      }
      return [
        {
          commandId: action.commandId,
          label: labelForAction(action),
          value: formatShortcut(binding.keys, platform),
        },
      ];
    }),
    mouseGestures: mouseGestures.enabled
      ? gestureActions.flatMap((action) => {
          const mapping = gestureMappings.find(
            (candidate) =>
              candidate.commandId === action.commandId &&
              candidate.pattern.trim(),
          );
          if (!mapping) {
            return [];
          }
          return [
            {
              commandId: action.commandId,
              label: labelForAction(action),
              value: mapping.pattern,
            },
          ];
        })
      : [],
    mouseGesturesEnabled: mouseGestures.enabled,
    mouseActions:
      context === "diffPreview"
        ? [{ label: "Context menu", value: "Right click" }]
        : [],
  };
}

function labelForAction(action: HintAction) {
  return action.label ?? getCommandTitle(action.commandId);
}
