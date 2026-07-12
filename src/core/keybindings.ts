import { commandDefinitions, isCommandId, type CommandId } from "./commands";
import type { KeybindingsConfig } from "./types";

export type KeybindingPreset = KeybindingsConfig["preset"];
export type Platform = "mac" | "windows" | "linux";
export type KeybindingContext = NonNullable<Keybinding["context"]>;

export interface Keybinding {
  keys: string;
  commandId: CommandId;
  context?: "global" | "viewer" | "search" | "tabs" | "modal" | "navigation";
  builtIn?: boolean;
}

export interface KeybindingConflict {
  preset: KeybindingPreset;
  keys: string;
  commandIds: CommandId[];
}

const nativeKeybindings: Keybinding[] = [
  { keys: "Mod+N", commandId: "window.new" },
  { keys: "Control+N", commandId: "window.new" },
  { keys: "Mod+O", commandId: "file.open" },
  { keys: "Control+O", commandId: "file.open" },
  { keys: "Mod+Shift+O", commandId: "folder.open" },
  { keys: "Control+Shift+O", commandId: "folder.open" },
  { keys: "Mod+F", commandId: "search.focus" },
  { keys: "Control+F", commandId: "search.focus" },
  { keys: "Mod+G", commandId: "search.next" },
  { keys: "Control+G", commandId: "search.next" },
  { keys: "Mod+Shift+G", commandId: "search.previous" },
  { keys: "Control+Shift+G", commandId: "search.previous" },
  { keys: "Mod+W", commandId: "tab.close" },
  { keys: "Control+W", commandId: "tab.close" },
  { keys: "Mod+Shift+T", commandId: "tab.restoreClosed" },
  { keys: "Control+Shift+T", commandId: "tab.restoreClosed" },
  { keys: "Mod+Shift+A", commandId: "tab.search" },
  { keys: "Control+Shift+A", commandId: "tab.search" },
  { keys: "Control+Tab", commandId: "tab.next" },
  { keys: "Control+Shift+Tab", commandId: "tab.previous" },
  { keys: "Mod+1", commandId: "tab.activate1" },
  { keys: "Control+1", commandId: "tab.activate1" },
  { keys: "Mod+2", commandId: "tab.activate2" },
  { keys: "Control+2", commandId: "tab.activate2" },
  { keys: "Mod+3", commandId: "tab.activate3" },
  { keys: "Control+3", commandId: "tab.activate3" },
  { keys: "Mod+4", commandId: "tab.activate4" },
  { keys: "Control+4", commandId: "tab.activate4" },
  { keys: "Mod+5", commandId: "tab.activate5" },
  { keys: "Control+5", commandId: "tab.activate5" },
  { keys: "Mod+6", commandId: "tab.activate6" },
  { keys: "Control+6", commandId: "tab.activate6" },
  { keys: "Mod+7", commandId: "tab.activate7" },
  { keys: "Control+7", commandId: "tab.activate7" },
  { keys: "Mod+8", commandId: "tab.activate8" },
  { keys: "Control+8", commandId: "tab.activate8" },
  { keys: "Mod+9", commandId: "tab.activateLast" },
  { keys: "Control+9", commandId: "tab.activateLast" },
  { keys: "Mod+L", commandId: "quickOpen.focus" },
  { keys: "Control+L", commandId: "quickOpen.focus" },
  { keys: "Mod+P", commandId: "quickOpen.focus" },
  { keys: "Control+P", commandId: "quickOpen.focus" },
  { keys: "Mod+D", commandId: "bookmark.toggleActive" },
  { keys: "Mod+[", commandId: "navigation.back" },
  { keys: "Alt+ArrowLeft", commandId: "navigation.back" },
  { keys: "Mod+]", commandId: "navigation.forward" },
  { keys: "Alt+ArrowRight", commandId: "navigation.forward" },
  { keys: "Mod+B", commandId: "sidebar.toggleLeft" },
  { keys: "Control+B", commandId: "sidebar.toggleLeft" },
  { keys: "Mod+Shift+B", commandId: "sidebar.toggleRight" },
  { keys: "Control+Shift+B", commandId: "sidebar.toggleRight" },
  { keys: "Mod+\\", commandId: "view.splitRight" },
  { keys: "Control+\\", commandId: "view.splitRight" },
  { keys: "Mod+Shift+\\", commandId: "view.closeSplit" },
  { keys: "Control+Shift+\\", commandId: "view.closeSplit" },
  { keys: "Mod+K Z", commandId: "view.toggleZenMode" },
  { keys: "Mod+,", commandId: "preferences.open" },
  { keys: "Mod+R", commandId: "viewer.reload" },
  { keys: "Control+R", commandId: "viewer.reload" },
  { keys: "Mod+Shift+R", commandId: "viewer.reloadForce" },
  { keys: "Control+Shift+R", commandId: "viewer.reloadForce" },
  { keys: "Mod+Shift+C", commandId: "viewer.captureArea" },
  { keys: "Alt+ArrowDown", commandId: "viewer.contentCursor.next" },
  { keys: "Alt+ArrowUp", commandId: "viewer.contentCursor.previous" },
  { keys: "Mod+=", commandId: "zoom.in" },
  { keys: "Mod+-", commandId: "zoom.out" },
  { keys: "Mod+0", commandId: "zoom.reset" },
  { keys: "Mod+Enter", commandId: "link.openFocused" },
  { keys: "Control+Enter", commandId: "link.openFocused" },
  { keys: "Escape", commandId: "preferences.close", context: "modal" },
];

const vimKeybindings: Keybinding[] = [
  ...nativeKeybindings,
  { keys: "/", commandId: "search.focus", context: "viewer" },
  { keys: "n", commandId: "search.next", context: "viewer" },
  { keys: "Shift+N", commandId: "search.previous", context: "viewer" },
  { keys: "j", commandId: "viewer.scrollDown", context: "viewer" },
  { keys: "k", commandId: "viewer.scrollUp", context: "viewer" },
  { keys: "Control+D", commandId: "viewer.pageDown", context: "viewer" },
  { keys: "Control+U", commandId: "viewer.pageUp", context: "viewer" },
  { keys: "g g", commandId: "viewer.top", context: "viewer" },
  { keys: "Shift+G", commandId: "viewer.bottom", context: "viewer" },
  { keys: "q", commandId: "tab.close", context: "viewer" },
  { keys: "Escape", commandId: "search.clear", context: "search" },
];

const emacsKeybindings: Keybinding[] = [
  ...nativeKeybindings,
  { keys: "Control+S", commandId: "search.focus", context: "viewer" },
  { keys: "Control+S", commandId: "search.next", context: "search" },
  { keys: "Control+N", commandId: "viewer.scrollDown", context: "viewer" },
  { keys: "Control+P", commandId: "viewer.scrollUp", context: "viewer" },
  { keys: "Control+V", commandId: "viewer.pageDown", context: "viewer" },
  { keys: "Alt+V", commandId: "viewer.pageUp", context: "viewer" },
  { keys: "Control+G", commandId: "search.clear", context: "search" },
  { keys: "Control+G", commandId: "preferences.close", context: "modal" },
];

export const keybindingPresets: Record<KeybindingPreset, Keybinding[]> = {
  native: nativeKeybindings,
  vim: vimKeybindings,
  emacs: emacsKeybindings,
};

export function getPresetKeybindings(preset: KeybindingPreset): Keybinding[] {
  return keybindingPresets[preset];
}

function keybindingIdentity(
  binding: Pick<Keybinding, "commandId" | "context">,
) {
  return `${binding.commandId}:${binding.context ?? "global"}`;
}

function isKnownContext(value: string): value is KeybindingContext {
  return ["global", "viewer", "search", "tabs", "modal", "navigation"].includes(
    value,
  );
}

export function defaultKeybindingMappings(
  preset: KeybindingPreset,
): Keybinding[] {
  const seen = new Set<string>();
  const mappings: Keybinding[] = [];
  for (const binding of keybindingPresets[preset]) {
    const identity = keybindingIdentity(binding);
    if (seen.has(identity)) {
      continue;
    }
    seen.add(identity);
    mappings.push({
      keys: binding.keys,
      commandId: binding.commandId,
      ...(binding.context ? { context: binding.context } : {}),
      builtIn: true,
    });
  }
  return mappings;
}

export function normalizeKeybindingMappings(
  preset: KeybindingPreset,
  mappings?: Keybinding[],
): Keybinding[] {
  if (!mappings?.length) {
    return defaultKeybindingMappings(preset);
  }

  const defaultRows = defaultKeybindingMappings(preset);
  const byIdentity = new Map(
    mappings
      .filter(
        (mapping) =>
          isCommandId(mapping.commandId) &&
          (!mapping.context || isKnownContext(mapping.context)),
      )
      .map((mapping) => [
        keybindingIdentity(mapping),
        {
          keys: mapping.keys.trim(),
          commandId: mapping.commandId,
          ...(mapping.context ? { context: mapping.context } : {}),
          builtIn: mapping.builtIn ?? true,
        },
      ]),
  );

  return defaultRows.map((row) => {
    const saved = byIdentity.get(keybindingIdentity(row));
    if (!saved) {
      return row;
    }
    return {
      ...row,
      keys: saved.keys,
    };
  });
}

function keybindingsWithPresetAliases(
  preset: KeybindingPreset,
  mappings?: Keybinding[],
): Keybinding[] {
  const normalized = normalizeKeybindingMappings(preset, mappings);
  const rows = [...normalized];
  const normalizedByIdentity = new Map(
    normalized.map((binding) => [keybindingIdentity(binding), binding]),
  );
  const defaultByIdentity = new Map(
    defaultKeybindingMappings(preset).map((binding) => [
      keybindingIdentity(binding),
      binding,
    ]),
  );
  const existing = new Set(
    rows.map((binding) => `${keybindingIdentity(binding)}:${binding.keys}`),
  );

  for (const binding of keybindingPresets[preset]) {
    const identity = keybindingIdentity(binding);
    const row = normalizedByIdentity.get(identity);
    const defaultRow = defaultByIdentity.get(identity);
    if (!row || !defaultRow || row.keys !== defaultRow.keys) {
      continue;
    }
    const key = `${identity}:${binding.keys}`;
    if (existing.has(key)) {
      continue;
    }
    rows.push({
      ...binding,
      builtIn: true,
    });
    existing.add(key);
  }

  return rows;
}

export function duplicateKeybindingMappings(
  mappings: Keybinding[],
  platform: Platform,
): Array<{ indexes: number[]; keys: string; context: KeybindingContext }> {
  const seen = new Map<string, number[]>();
  mappings.forEach((mapping, index) => {
    const keys = mapping.keys.trim();
    if (!keys) {
      return;
    }
    const expandedKeys = expandPlatformKeys(keys, platform);
    const context = mapping.context ?? "global";
    const duplicateKey = `${context}:${expandedKeys}`;
    seen.set(duplicateKey, [...(seen.get(duplicateKey) ?? []), index]);
  });

  return [...seen.entries()]
    .filter(([, indexes]) => indexes.length > 1)
    .map(([key, indexes]) => {
      const [context, ...keyParts] = key.split(":");
      return {
        indexes,
        keys: keyParts.join(":"),
        context: context as KeybindingContext,
      };
    });
}

export function validateKeybindingMappings(
  mappings: Keybinding[],
  platform: Platform,
): Record<number, string> {
  const errors: Record<number, string> = {};
  mappings.forEach((mapping, index) => {
    const isDefaultModalClose =
      mapping.commandId === "preferences.close" &&
      (mapping.context ?? "global") === "modal";
    if (mapping.keys.trim() === "Escape" && !isDefaultModalClose) {
      errors[index] = "Escape is reserved for cancel and close.";
    }
  });
  for (const duplicate of duplicateKeybindingMappings(mappings, platform)) {
    for (const index of duplicate.indexes) {
      errors[index] = `Duplicate shortcut in ${duplicate.context}.`;
    }
  }
  return errors;
}

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") {
    return "linux";
  }

  const platform =
    "userAgentData" in navigator
      ? // userAgentData is not yet typed consistently across browser targets.
        ((navigator as Navigator & { userAgentData?: { platform?: string } })
          .userAgentData?.platform ?? navigator.platform)
      : navigator.platform;
  const value = platform.toLowerCase();

  if (value.includes("mac")) {
    return "mac";
  }
  if (value.includes("win")) {
    return "windows";
  }
  return "linux";
}

export function platformModifier(platform: Platform): "Meta" | "Control" {
  return platform === "mac" ? "Meta" : "Control";
}

export function expandPlatformKeys(keys: string, platform: Platform): string {
  return keys.replace(/\bMod\b/g, platformModifier(platform));
}

export function formatShortcut(keys: string, platform: Platform): string {
  return expandPlatformKeys(keys, platform)
    .split(" ")
    .map((sequencePart) =>
      sequencePart
        .split("+")
        .map((part) => formatShortcutPart(part, platform))
        .join(platform === "mac" ? "" : "+"),
    )
    .join(" ");
}

export function normalizeKeyboardEvent(event: KeyboardEvent): string {
  const key = normalizeKeyboardEventKey(event);
  const parts: string[] = [];

  if (event.metaKey) {
    parts.push("Meta");
  }
  if (event.ctrlKey) {
    parts.push("Control");
  }
  if (event.altKey) {
    parts.push("Alt");
  }
  if (event.shiftKey && key !== "Shift") {
    parts.push("Shift");
  }

  if (!parts.includes(key)) {
    parts.push(parts.length > 0 && key.length === 1 ? key.toUpperCase() : key);
  }
  return parts.join("+");
}

export function isModifierOnlyKey(key: string): boolean {
  return ["Control", "Meta", "Shift", "Alt", "AltGraph"].includes(key);
}

export function resolveKeybinding({
  preset,
  platform,
  key,
  context,
  pendingKey,
  mappings,
}: {
  preset: KeybindingPreset;
  platform: Platform;
  key: string;
  context: string;
  pendingKey?: string | null;
  mappings?: Keybinding[];
}): { commandId?: CommandId; pendingKey?: string | null } {
  const bindings = keybindingsWithPresetAliases(preset, mappings);
  const sequenceKey = pendingKey ? `${pendingKey} ${key}` : key;
  const match = findBinding(bindings, sequenceKey, platform, context);
  if (match) {
    return { commandId: match.commandId, pendingKey: null };
  }

  if (pendingKey) {
    const continuationKey = normalizeSequenceContinuationKey(
      pendingKey,
      key,
      platform,
    );
    if (continuationKey !== key) {
      const continuationMatch = findBinding(
        bindings,
        `${pendingKey} ${continuationKey}`,
        platform,
        context,
      );
      if (continuationMatch) {
        return { commandId: continuationMatch.commandId, pendingKey: null };
      }
    }
  }

  const canonicalPrefix = `${canonicalizeKeySequenceForMatching(key)} `;
  const hasSequence = bindings.some((binding) =>
    canonicalizeKeySequenceForMatching(
      expandPlatformKeys(binding.keys, platform),
    ).startsWith(canonicalPrefix),
  );
  if (hasSequence) {
    return { pendingKey: key };
  }

  return { pendingKey: null };
}

function normalizeSequenceContinuationKey(
  pendingKey: string,
  key: string,
  platform: Platform,
): string {
  const modifier = platformModifier(platform);
  const modifierPrefix = `${modifier}+`;
  if (
    !pendingKey.startsWith(modifierPrefix) ||
    !key.startsWith(modifierPrefix)
  ) {
    return key;
  }
  return key.slice(modifierPrefix.length);
}

export function findKeybindingConflicts(
  preset: KeybindingPreset,
  platform: Platform,
): KeybindingConflict[] {
  const seen = new Map<string, CommandId[]>();
  for (const binding of normalizeKeybindingMappings(preset)) {
    const key = `${binding.context ?? "global"}:${expandPlatformKeys(
      binding.keys,
      platform,
    )}`;
    const commandIds = seen.get(key) ?? [];
    commandIds.push(binding.commandId);
    seen.set(key, commandIds);
  }

  return [...seen.entries()]
    .filter(([, commandIds]) => new Set(commandIds).size > 1)
    .map(([key, commandIds]) => ({
      preset,
      keys: key,
      commandIds: [...new Set(commandIds)],
    }));
}

function findBinding(
  bindings: Keybinding[],
  key: string,
  platform: Platform,
  context: string,
): Keybinding | undefined {
  const canonicalKey = canonicalizeKeySequenceForMatching(key);
  const candidates = bindings.filter(
    (binding) =>
      canonicalizeKeySequenceForMatching(
        expandPlatformKeys(binding.keys, platform),
      ) === canonicalKey,
  );
  return (
    candidates.find((binding) => binding.context === context) ??
    candidates.find(
      (binding) => !binding.context || binding.context === "global",
    )
  );
}

function canonicalizeKeySequenceForMatching(keys: string): string {
  return keys
    .split(" ")
    .map((part) => {
      if (part.length === 1 && /[a-z]/i.test(part)) {
        return part.toLowerCase();
      }
      return part;
    })
    .join(" ");
}

function normalizeKey(key: string): string {
  if (key === " ") {
    return "Space";
  }
  if (key === "Esc") {
    return "Escape";
  }
  if (key === "ArrowDown") {
    return "ArrowDown";
  }
  if (key === "ArrowUp") {
    return "ArrowUp";
  }
  if (key.length === 1) {
    return key.toLowerCase();
  }
  return key;
}

function normalizeKeyboardEventKey(event: KeyboardEvent): string {
  const codeKey = keyFromKeyboardCode(event.code);
  if (codeKey) {
    return codeKey;
  }
  return normalizeKey(event.key);
}

function keyFromKeyboardCode(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) {
    return code.slice("Key".length).toLowerCase();
  }
  if (/^Digit[0-9]$/.test(code)) {
    return code.slice("Digit".length);
  }

  const printableKeys: Record<string, string> = {
    Backquote: "`",
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Backslash: "\\",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
  };
  return printableKeys[code] ?? null;
}

export function keybindingDisplayRows(preset: KeybindingPreset): Keybinding[] {
  const commandContexts = new Map(
    commandDefinitions.map((command) => [command.id, command.context]),
  );
  return defaultKeybindingMappings(preset).map((binding) => ({
    ...binding,
    context: binding.context ?? commandContexts.get(binding.commandId),
  }));
}

function formatShortcutPart(part: string, platform: Platform): string {
  const keyLabels: Record<string, string> = {
    ArrowLeft: "Left",
    ArrowRight: "Right",
  };
  const keyLabel = keyLabels[part] ?? part;

  if (platform === "mac") {
    const macSymbols: Record<string, string> = {
      Meta: "⌘",
      Control: "⌃",
      Shift: "⇧",
      Alt: "⌥",
    };
    return macSymbols[part] ?? keyLabel;
  }

  const labels: Record<string, string> = {
    Meta: "Win",
    Control: "Ctrl",
    Shift: "Shift",
    Alt: "Alt",
  };
  return labels[part] ?? keyLabel;
}
