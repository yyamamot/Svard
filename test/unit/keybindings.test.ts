import { describe, expect, it } from "vitest";

import {
  defaultKeybindingMappings,
  expandPlatformKeys,
  findKeybindingConflicts,
  formatShortcut,
  getPresetKeybindings,
  isModifierOnlyKey,
  normalizeKeyboardEvent,
  normalizeKeybindingMappings,
  resolveKeybinding,
  validateKeybindingMappings,
} from "../../src/core/keybindings";
import { commandDefinitions, isCommandId } from "../../src/core/commands";

describe("keybindings", () => {
  it.each(["mac", "windows", "linux"] as const)(
    "resolves application quit on %s with configurable binding",
    (platform) => {
      const resolve = (
        keys: string,
        mappings = defaultKeybindingMappings("native"),
      ) =>
        resolveKeybinding({
          preset: "native",
          platform,
          key: expandPlatformKeys(keys, platform),
          context: "global",
          mappings,
        }).commandId;
      expect(resolve("Mod+Q")).toBe("app.quit");
      expect(
        resolve("Mod+Q", [{ commandId: "app.quit", keys: "" }]),
      ).toBeUndefined();
      const changed = [{ commandId: "app.quit" as const, keys: "Mod+Shift+Q" }];
      expect(resolve("Mod+Q", changed)).toBeUndefined();
      expect(resolve("Mod+Shift+Q", changed)).toBe("app.quit");
    },
  );
  it("expands Mod to platform specific modifier", () => {
    expect(expandPlatformKeys("Mod+F", "mac")).toBe("Meta+F");
    expect(expandPlatformKeys("Mod+F", "windows")).toBe("Control+F");
  });

  it("formats shortcuts for macOS symbols", () => {
    expect(formatShortcut("Mod+Shift+G", "mac")).toBe("⌘⇧G");
    expect(formatShortcut("Mod+K Z", "mac")).toBe("⌘K Z");
    expect(formatShortcut("Control+S", "mac")).toBe("⌃S");
    expect(formatShortcut("g g", "mac")).toBe("g g");
  });

  it("formats shortcuts for Windows and Linux labels", () => {
    expect(formatShortcut("Mod+Shift+G", "windows")).toBe("Ctrl+Shift+G");
    expect(formatShortcut("Mod+K Z", "windows")).toBe("Ctrl+K Z");
    expect(formatShortcut("Alt+ArrowLeft", "windows")).toBe("Alt+Left");
    expect(formatShortcut("Alt+V", "linux")).toBe("Alt+V");
  });

  it("provides Capture Area as a native viewer shortcut", () => {
    expect(defaultKeybindingMappings("native")).toContainEqual(
      expect.objectContaining({
        keys: "Mod+Shift+C",
        commandId: "viewer.captureArea",
      }),
    );
  });

  it("does not reserve a default shortcut for referenced area capture", () => {
    expect(
      defaultKeybindingMappings("native").some(
        (binding) => binding.commandId === "viewer.captureAreaWithReference",
      ),
    ).toBe(false);
  });

  it("resolves native search focus", () => {
    const result = resolveKeybinding({
      preset: "native",
      platform: "windows",
      key: "Control+F",
      context: "viewer",
    });

    expect(result.commandId).toBe("search.focus");
  });

  it("resolves native New Window shortcuts", () => {
    expect(
      resolveKeybinding({
        preset: "native",
        platform: "mac",
        key: "Meta+N",
        context: "viewer",
      }).commandId,
    ).toBe("window.new");
    expect(
      resolveKeybinding({
        preset: "native",
        platform: "windows",
        key: "Control+N",
        context: "viewer",
      }).commandId,
    ).toBe("window.new");
  });

  it("resolves native content cursor shortcuts", () => {
    expect(
      resolveKeybinding({
        preset: "native",
        platform: "mac",
        key: "Alt+ArrowDown",
        context: "viewer",
      }).commandId,
    ).toBe("viewer.contentCursor.next");
    expect(
      resolveKeybinding({
        preset: "native",
        platform: "mac",
        key: "Alt+ArrowUp",
        context: "viewer",
      }).commandId,
    ).toBe("viewer.contentCursor.previous");
  });

  it("resolves VS Code style Zen Mode toggle sequence", () => {
    const pending = resolveKeybinding({
      preset: "native",
      platform: "mac",
      key: "Meta+K",
      context: "viewer",
    });
    const result = resolveKeybinding({
      preset: "native",
      platform: "mac",
      key: "z",
      context: "viewer",
      pendingKey: pending.pendingKey,
    });

    expect(pending).toEqual({ pendingKey: "Meta+K" });
    expect(result.commandId).toBe("view.toggleZenMode");
  });

  it("resolves Zen Mode toggle when the platform modifier is held for the second key", () => {
    const pending = resolveKeybinding({
      preset: "native",
      platform: "mac",
      key: "Meta+K",
      context: "viewer",
    });
    const result = resolveKeybinding({
      preset: "native",
      platform: "mac",
      key: "Meta+Z",
      context: "viewer",
      pendingKey: pending.pendingKey,
    });

    expect(result.commandId).toBe("view.toggleZenMode");
  });

  it("normalizes missing editable mappings to primary preset defaults", () => {
    const mappings = normalizeKeybindingMappings("native");
    const searchFocusRows = mappings.filter(
      (binding) => binding.commandId === "search.focus",
    );

    expect(searchFocusRows).toHaveLength(1);
    expect(searchFocusRows[0]?.keys).toBe("Mod+F");
  });

  it("dispatches a custom editable shortcut for the selected action", () => {
    const mappings = defaultKeybindingMappings("native").map((binding) =>
      binding.commandId === "search.focus"
        ? { ...binding, keys: "Control+K" }
        : binding,
    );
    const result = resolveKeybinding({
      preset: "native",
      platform: "windows",
      key: "Control+K",
      context: "viewer",
      mappings,
    });

    expect(result.commandId).toBe("search.focus");
  });

  it("keeps preset aliases for unchanged default action rows", () => {
    const result = resolveKeybinding({
      preset: "native",
      platform: "mac",
      key: "Control+F",
      context: "viewer",
      mappings: defaultKeybindingMappings("native"),
    });

    expect(result.commandId).toBe("search.focus");
  });

  it("removes preset aliases when an action shortcut is edited", () => {
    const mappings = defaultKeybindingMappings("native").map((binding) =>
      binding.commandId === "search.focus"
        ? { ...binding, keys: "Control+K" }
        : binding,
    );
    const result = resolveKeybinding({
      preset: "native",
      platform: "mac",
      key: "Control+F",
      context: "viewer",
      mappings,
    });

    expect(result.commandId).toBeUndefined();
  });

  it("does not dispatch a cleared editable shortcut", () => {
    const mappings = defaultKeybindingMappings("native").map((binding) =>
      binding.commandId === "search.focus" ? { ...binding, keys: "" } : binding,
    );
    const result = resolveKeybinding({
      preset: "native",
      platform: "windows",
      key: "Control+F",
      context: "viewer",
      mappings,
    });

    expect(result.commandId).toBeUndefined();
  });

  it("rejects duplicate shortcuts inside the same context", () => {
    const mappings = defaultKeybindingMappings("native").map((binding) =>
      binding.commandId === "search.focus" || binding.commandId === "tab.close"
        ? { ...binding, keys: "Control+K", context: "viewer" as const }
        : binding,
    );
    const errors = validateKeybindingMappings(mappings, "windows");

    expect(Object.values(errors)).toContain("Duplicate shortcut in viewer.");
  });

  it("rejects a quit shortcut that conflicts with another global action", () => {
    const mappings = defaultKeybindingMappings("native").map((binding) =>
      binding.commandId === "app.quit"
        ? { ...binding, keys: "Mod+O" }
        : binding,
    );
    for (const platform of ["mac", "windows", "linux"] as const) {
      const errors = validateKeybindingMappings(mappings, platform);
      expect(
        errors[
          mappings.findIndex((binding) => binding.commandId === "app.quit")
        ],
      ).toBe("Duplicate shortcut in global.");
      expect(
        errors[
          mappings.findIndex((binding) => binding.commandId === "file.open")
        ],
      ).toBe("Duplicate shortcut in global.");
    }
  });

  it("allows duplicate shortcuts in different contexts", () => {
    const mappings = [
      {
        keys: "Control+K",
        commandId: "search.focus" as const,
        context: "viewer" as const,
      },
      {
        keys: "Control+K",
        commandId: "search.next" as const,
        context: "search" as const,
      },
    ];

    expect(validateKeybindingMappings(mappings, "windows")).toEqual({});
  });

  it("keeps Escape reserved except for the default modal close mapping", () => {
    expect(
      validateKeybindingMappings(
        [
          {
            keys: "Escape",
            commandId: "preferences.close",
            context: "modal",
          },
        ],
        "windows",
      ),
    ).toEqual({});
    expect(
      validateKeybindingMappings(
        [
          {
            keys: "Escape",
            commandId: "search.focus",
            context: "viewer",
          },
        ],
        "windows",
      ),
    ).toEqual({ 0: "Escape is reserved for cancel and close." });
  });

  it("keeps Shift for modified letter shortcuts", () => {
    const event = new KeyboardEvent("keydown", {
      key: "T",
      code: "KeyT",
      ctrlKey: true,
      shiftKey: true,
    });

    expect(normalizeKeyboardEvent(event)).toBe("Control+Shift+T");
  });

  it("normalizes shifted punctuation shortcuts to their base key", () => {
    expect(
      normalizeKeyboardEvent(
        new KeyboardEvent("keydown", {
          key: "_",
          code: "Minus",
          metaKey: true,
          shiftKey: true,
        }),
      ),
    ).toBe("Meta+Shift+-");
    expect(
      normalizeKeyboardEvent(
        new KeyboardEvent("keydown", {
          key: "|",
          code: "Backslash",
          ctrlKey: true,
          shiftKey: true,
        }),
      ),
    ).toBe("Control+Shift+\\");
    expect(
      normalizeKeyboardEvent(
        new KeyboardEvent("keydown", {
          key: "}",
          code: "BracketRight",
          metaKey: true,
          shiftKey: true,
        }),
      ),
    ).toBe("Meta+Shift+]");
  });

  it("resolves custom shortcuts that use Shift with punctuation keys", () => {
    const mappings = defaultKeybindingMappings("native").map((binding) =>
      binding.commandId === "view.closeSplit"
        ? { ...binding, keys: "Mod+Shift+]" }
        : binding,
    );
    const key = normalizeKeyboardEvent(
      new KeyboardEvent("keydown", {
        key: "}",
        code: "BracketRight",
        metaKey: true,
        shiftKey: true,
      }),
    );

    const result = resolveKeybinding({
      preset: "native",
      platform: "mac",
      key,
      context: "viewer",
      mappings,
    });

    expect(result.commandId).toBe("view.closeSplit");
  });

  it("identifies modifier-only keys for shortcut recording", () => {
    expect(isModifierOnlyKey("Control")).toBe(true);
    expect(isModifierOnlyKey("Meta")).toBe(true);
    expect(isModifierOnlyKey("Shift")).toBe(true);
    expect(isModifierOnlyKey("Alt")).toBe(true);
    expect(isModifierOnlyKey("K")).toBe(false);
  });

  it("resolves vim two-key top command", () => {
    const pending = resolveKeybinding({
      preset: "vim",
      platform: "mac",
      key: "g",
      context: "viewer",
    });
    const result = resolveKeybinding({
      preset: "vim",
      platform: "mac",
      key: "g",
      context: "viewer",
      pendingKey: pending.pendingKey,
    });

    expect(result.commandId).toBe("viewer.top");
  });

  it("keeps preset keybindings conflict-free per context", () => {
    expect(findKeybindingConflicts("native", "windows")).toEqual([]);
    expect(findKeybindingConflicts("native", "linux")).toEqual([]);
    expect(findKeybindingConflicts("native", "mac")).toEqual([]);
    expect(findKeybindingConflicts("vim", "mac")).toEqual([]);
    expect(findKeybindingConflicts("emacs", "windows")).toEqual([]);
  });

  it("generates display rows from valid command ids", () => {
    for (const preset of ["native", "vim", "emacs"] as const) {
      expect(getPresetKeybindings(preset).length).toBeGreaterThan(0);
      expect(
        getPresetKeybindings(preset).every((binding) =>
          isCommandId(binding.commandId),
        ),
      ).toBe(true);
    }
  });

  it("includes browser-style commands in command definitions and presets", () => {
    const commandIds = new Set(commandDefinitions.map((command) => command.id));
    const nativeBindings = getPresetKeybindings("native");
    for (const commandId of [
      "tab.restoreClosed",
      "tab.togglePinned",
      "tab.search",
      "tab.activate1",
      "tab.activateLast",
      "quickOpen.focus",
      "navigation.back",
      "navigation.forward",
      "bookmark.toggleActive",
      "sidebar.showFiles",
      "sidebar.showBookmarks",
      "view.toggleZenMode",
      "viewer.reloadForce",
      "viewer.contentCursor.next",
      "viewer.contentCursor.previous",
      "link.openFocused",
      "heading.copyLink",
    ] as const) {
      expect(commandIds.has(commandId)).toBe(true);
    }
    expect(
      nativeBindings.some(
        (binding) => binding.commandId === "bookmark.toggleActive",
      ),
    ).toBe(true);
    expect(
      nativeBindings.some(
        (binding) =>
          binding.commandId === "view.toggleZenMode" &&
          binding.keys === "Mod+K Z",
      ),
    ).toBe(true);
    expect(
      nativeBindings.some(
        (binding) => binding.commandId === "view.exitZenMode",
      ),
    ).toBe(false);
  });
});
