import { describe, expect, it } from "vitest";

import { defaultConfig } from "../../src/core/defaultConfig";
import { buildShortcutGestureHintModel } from "../../src/ui/lib/shortcutGestureHints";

describe("shortcut and gesture hints", () => {
  it("uses viewer context labels for navigation gestures", () => {
    const config = {
      ...defaultConfig,
      mouseGestures: {
        ...defaultConfig.mouseGestures,
        enabled: true,
      },
    };

    const model = buildShortcutGestureHintModel({
      config,
      context: "viewer",
      platform: "windows",
    });

    expect(model.keyboard).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          commandId: "quickOpen.focus",
          label: "Quick Open",
          value: "Ctrl+L",
        }),
        expect.objectContaining({
          commandId: "search.focus",
          label: "Focus Search",
          value: "Ctrl+F",
        }),
        expect.objectContaining({
          commandId: "viewer.contentCursor.next",
          label: "Next Content Block",
          value: "Alt+ArrowDown",
        }),
        expect.objectContaining({
          commandId: "view.toggleZenMode",
          label: "Toggle Zen Mode",
          value: "Ctrl+K Z",
        }),
      ]),
    );
    expect(model.mouseGestures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          commandId: "navigation.back",
          label: "Navigate Back",
          value: "Left",
        }),
        expect.objectContaining({
          commandId: "navigation.forward",
          label: "Navigate Forward",
          value: "Right",
        }),
      ]),
    );
  });

  it("uses diff preview context labels for navigation gestures", () => {
    const config = {
      ...defaultConfig,
      mouseGestures: {
        ...defaultConfig.mouseGestures,
        enabled: true,
      },
    };

    const model = buildShortcutGestureHintModel({
      config,
      context: "diffPreview",
      platform: "windows",
    });

    expect(model.mouseGestures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          commandId: "navigation.back",
          label: "Previous change",
          value: "Left",
        }),
        expect.objectContaining({
          commandId: "navigation.forward",
          label: "Next change",
          value: "Right",
        }),
        expect.objectContaining({
          commandId: "viewer.bottom",
          label: "Scroll active pane to bottom",
          value: "Down",
        }),
        expect.objectContaining({
          commandId: "tab.close",
          label: "Close Diff Preview",
          value: "Down Right",
        }),
      ]),
    );
  });

  it("omits unassigned shortcuts and empty gesture patterns", () => {
    const config = {
      ...defaultConfig,
      keybindings: {
        ...defaultConfig.keybindings,
        mappings: defaultConfig.keybindings.mappings!.map((mapping) =>
          mapping.commandId === "viewer.contentCursor.next"
            ? { ...mapping, keys: "" }
            : mapping,
        ),
      },
      mouseGestures: {
        ...defaultConfig.mouseGestures,
        enabled: true,
        mappings: defaultConfig.mouseGestures.mappings.map((mapping) =>
          mapping.commandId === "navigation.back"
            ? { ...mapping, pattern: "" }
            : mapping,
        ),
      },
    };

    const model = buildShortcutGestureHintModel({
      config,
      context: "diffPreview",
      platform: "windows",
    });

    expect(model.keyboard).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ commandId: "viewer.contentCursor.next" }),
      ]),
    );
    expect(model.mouseGestures).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ commandId: "navigation.back" }),
      ]),
    );
  });

  it("uses macOS display for the Zen Mode sequence shortcut", () => {
    const model = buildShortcutGestureHintModel({
      config: defaultConfig,
      context: "viewer",
      platform: "mac",
    });

    expect(model.keyboard).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          commandId: "view.toggleZenMode",
          label: "Toggle Zen Mode",
          value: "⌘K Z",
        }),
      ]),
    );
  });

  it("omits cleared Zen Mode shortcut from viewer hints", () => {
    const config = {
      ...defaultConfig,
      keybindings: {
        ...defaultConfig.keybindings,
        mappings: defaultConfig.keybindings.mappings!.map((mapping) =>
          mapping.commandId === "view.toggleZenMode"
            ? { ...mapping, keys: "" }
            : mapping,
        ),
      },
    };

    const model = buildShortcutGestureHintModel({
      config,
      context: "viewer",
      platform: "windows",
    });

    expect(model.keyboard).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ commandId: "view.toggleZenMode" }),
      ]),
    );
  });

  it("does not include Zen Mode in diff preview hints", () => {
    const model = buildShortcutGestureHintModel({
      config: defaultConfig,
      context: "diffPreview",
      platform: "windows",
    });

    expect(model.keyboard).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ commandId: "view.toggleZenMode" }),
      ]),
    );
  });

  it("returns disabled gesture notice state when gestures are off", () => {
    const model = buildShortcutGestureHintModel({
      config: defaultConfig,
      context: "diffPreview",
      platform: "windows",
    });

    expect(model.mouseGesturesEnabled).toBe(false);
    expect(model.mouseGestures).toHaveLength(0);
  });
});
