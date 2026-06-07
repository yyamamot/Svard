import { describe, expect, it } from "vitest";
import { commandDefinitions } from "../../src/core/commands";
import { defaultConfig } from "../../src/core/defaultConfig";
import {
  appMenuCommandIds,
  appMenuShortcutResolver,
  appMenuTopLevelOrder,
  buildAppMenuModel,
  commandTitleExistsForAppMenu,
  validateAppMenuCommandIds,
  type AppMenuItem,
} from "../../src/ui/lib/appMenu";

function allLabels(items: AppMenuItem[]): string[] {
  return items.flatMap((item) => {
    if (item.type === "submenu") {
      return [item.label, ...allLabels(item.items)];
    }
    if (item.type === "separator") {
      return [];
    }
    return [item.label];
  });
}

describe("app menu model", () => {
  it("uses the Chrome-like top-level menu order", () => {
    const model = buildAppMenuModel({
      config: defaultConfig,
      platform: "mac",
      isCommandEnabled: () => true,
    });

    expect(model.map((menu) => menu.label)).toEqual([...appMenuTopLevelOrder]);
  });

  it("maps menu commands to known command definitions", () => {
    const model = buildAppMenuModel({
      config: defaultConfig,
      platform: "mac",
      isCommandEnabled: () => true,
    });
    const definitions = new Set(
      commandDefinitions.map((command) => command.id),
    );

    expect(validateAppMenuCommandIds(model)).toEqual([]);
    expect(appMenuCommandIds(model).every((id) => definitions.has(id))).toBe(
      true,
    );
    expect(appMenuCommandIds(model).every(commandTitleExistsForAppMenu)).toBe(
      true,
    );
  });

  it("does not expose editor-style file commands", () => {
    const model = buildAppMenuModel({
      config: defaultConfig,
      platform: "mac",
      isCommandEnabled: () => true,
    });
    const labels = model.flatMap((menu) => allLabels(menu.items));

    expect(labels).not.toContain("Save");
    expect(labels).not.toContain("Save As...");
    expect(labels).not.toContain("New File");
  });

  it("keeps Quick Open and Preferences in the native File menu", () => {
    const model = buildAppMenuModel({
      config: defaultConfig,
      platform: "mac",
      isCommandEnabled: () => true,
    });
    const file = model.find((menu) => menu.label === "File");

    expect(file?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "command",
          label: "Quick Open...",
          commandId: "quickOpen.focus",
        }),
        expect.objectContaining({
          type: "command",
          label: "Preferences...",
          commandId: "preferences.open",
        }),
      ]),
    );
  });

  it("keeps New Window, Duplicate Window, and Switch to Recent Tab in the Window menu", () => {
    const model = buildAppMenuModel({
      config: defaultConfig,
      platform: "mac",
      isCommandEnabled: () => true,
    });
    const file = model.find((menu) => menu.label === "File");
    const window = model.find((menu) => menu.label === "Window");

    expect(window?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "command",
          label: "New Window",
          commandId: "window.new",
          enabled: true,
        }),
        expect.objectContaining({
          type: "command",
          label: "Duplicate Window",
          commandId: "window.duplicate",
          enabled: true,
        }),
        expect.objectContaining({
          type: "command",
          label: "Switch to Recent Tab",
          commandId: "tab.switchToRecent",
          enabled: true,
        }),
      ]),
    );
    expect(file?.items).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          commandId: "window.new",
        }),
        expect.objectContaining({
          commandId: "window.duplicate",
        }),
        expect.objectContaining({
          commandId: "tab.switchToRecent",
        }),
        expect.objectContaining({
          commandId: "file.openCurrentInNewWindow",
        }),
      ]),
    );
  });


  it("keeps native text editing actions in the Edit menu", () => {
    const model = buildAppMenuModel({
      config: defaultConfig,
      platform: "mac",
      isCommandEnabled: () => true,
    });
    const edit = model.find((menu) => menu.label === "Edit");

    expect(edit?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "native", nativeId: "undo" }),
        expect.objectContaining({ type: "native", nativeId: "redo" }),
        expect.objectContaining({ type: "native", nativeId: "cut" }),
        expect.objectContaining({ type: "native", nativeId: "copy" }),
        expect.objectContaining({ type: "native", nativeId: "paste" }),
        expect.objectContaining({ type: "native", nativeId: "selectAll" }),
      ]),
    );
  });

  it("keeps layout mode and sidebar toggles in the native Layout submenu", () => {
    const model = buildAppMenuModel({
      config: defaultConfig,
      platform: "mac",
      isCommandEnabled: () => true,
    });
    const view = model.find((menu) => menu.label === "View");
    const layout = view?.items.find(
      (item) => item.type === "submenu" && item.label === "Layout",
    );
    const layoutLabels =
      layout?.type === "submenu" ? allLabels(layout.items) : [];

    expect(layoutLabels).toEqual(
      expect.arrayContaining([
        "Zen Mode",
        "Split View",
        "Close Split View",
        "Left Sidebar",
        "Right Sidebar",
      ]),
    );
  });

  it("keeps Shortcuts and Gestures only in the native Help menu", () => {
    const model = buildAppMenuModel({
      config: defaultConfig,
      platform: "mac",
      isCommandEnabled: () => true,
    });
    const view = model.find((menu) => menu.label === "View");
    const help = model.find((menu) => menu.label === "Help");

    expect(allLabels(view?.items ?? [])).not.toContain(
      "Shortcuts and Gestures",
    );
    expect(help?.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "command",
          label: "Shortcuts and Gestures",
          commandId: "viewer.showShortcuts",
        }),
      ]),
    );
  });

  it("keeps browser history actions in the native History menu", () => {
    const model = buildAppMenuModel({
      config: defaultConfig,
      platform: "mac",
      recentlyVisitedLocations: [
        {
          path: "/workspace/docs/visited.md",
          headingId: "intro",
          label: "Introduction",
          scrollTop: 120,
          visitedAt: "2026-06-01T00:00:01.000Z",
        },
      ],
      lastClosedTabs: [
        {
          path: "/workspace/docs/closed.md",
          basePath: "/workspace/docs",
          format: "markdown",
          source: "# Closed",
          updatedAt: "2026-06-01T00:00:00.000Z",
        },
      ],
      isCommandEnabled: (commandId) =>
        commandId === "navigation.back" ||
        commandId === "navigation.forward" ||
        commandId === "tab.restoreClosed",
    });
    const history = model.find((menu) => menu.label === "History");

    expect(history?.items).toMatchObject([
      { type: "command", commandId: "navigation.back", enabled: true },
      { type: "command", commandId: "navigation.forward", enabled: true },
      { type: "submenu", label: "Recently Visited", enabled: true },
      { type: "submenu", label: "Recently Closed", enabled: true },
      { type: "command", commandId: "tab.restoreClosed", enabled: true },
    ]);
    expect(allLabels(history?.items ?? [])).toContain(
      "visited.md - Introduction",
    );
    expect(allLabels(history?.items ?? [])).toContain("closed.md");
  });

  it("shows persistent bookmarks as quick-open entries in the native Bookmarks menu", () => {
    const config = {
      ...defaultConfig,
      workspace: {
        ...defaultConfig.workspace,
        bookmarks: [
          {
            kind: "directory" as const,
            path: "/workspace/docs",
            name: "Docs",
          },
          {
            kind: "file" as const,
            path: "/workspace/docs/guide.md",
            name: "Guide",
          },
        ],
      },
    };
    const model = buildAppMenuModel({
      config,
      platform: "mac",
      isCommandEnabled: () => true,
    });
    const bookmarks = model.find((menu) => menu.label === "Bookmarks");

    expect(bookmarks?.items).toMatchObject([
      { type: "command", commandId: "bookmark.toggleActive" },
      { type: "command", commandId: "bookmark.addCurrentFolder" },
      { type: "separator" },
      { type: "submenu", label: "Folders", enabled: true },
      { type: "submenu", label: "Files", enabled: true },
      { type: "separator" },
      {
        type: "command",
        label: "Manage Bookmarks",
        commandId: "sidebar.showBookmarks",
      },
    ]);
    const foldersSubmenu = bookmarks?.items.find(
      (item) => item.type === "submenu" && item.label === "Folders",
    );
    const filesSubmenu = bookmarks?.items.find(
      (item) => item.type === "submenu" && item.label === "Files",
    );
    const folders =
      foldersSubmenu?.type === "submenu" ? foldersSubmenu.items : [];
    const files = filesSubmenu?.type === "submenu" ? filesSubmenu.items : [];

    expect(folders).toMatchObject([
      {
        type: "bookmark",
        kind: "directory",
        label: "Docs",
        path: "/workspace/docs",
        enabled: true,
      },
    ]);
    expect(files).toMatchObject([
      {
        type: "bookmark",
        kind: "file",
        label: "Guide",
        path: "/workspace/docs/guide.md",
        enabled: true,
      },
    ]);
  });

  it("shows an empty native Bookmarks menu state when no bookmarks exist", () => {
    const model = buildAppMenuModel({
      config: defaultConfig,
      platform: "mac",
      isCommandEnabled: () => true,
    });
    const bookmarks = model.find((menu) => menu.label === "Bookmarks");

    expect(bookmarks?.items).toMatchObject([
      { type: "command", commandId: "bookmark.toggleActive" },
      { type: "command", commandId: "bookmark.addCurrentFolder" },
      { type: "separator" },
      {
        type: "bookmark",
        label: "No Bookmarks",
        enabled: false,
      },
      { type: "separator" },
      {
        type: "command",
        label: "Manage Bookmarks",
        commandId: "sidebar.showBookmarks",
      },
    ]);
  });

  it("uses open tab titles in the native Window menu", () => {
    const model = buildAppMenuModel({
      config: defaultConfig,
      platform: "mac",
      workspaceTabs: [
        {
          kind: "document",
          id: "/workspace/docs/01-specification.md",
          path: "/workspace/docs/01-specification.md",
          document: {
            path: "/workspace/docs/01-specification.md",
            basePath: "/workspace/docs",
            format: "markdown",
            source: "# Specification",
            updatedAt: "2026-06-01T00:00:00.000Z",
          },
        },
        { kind: "preferences", id: "app://preferences" },
      ],
      activeTabId: "app://preferences",
      isCommandEnabled: () => true,
    });
    const windowMenu = model.find((menu) => menu.label === "Window");

    expect(allLabels(windowMenu?.items ?? [])).not.toContain("Activate Tab 1");
    expect(windowMenu?.items).toMatchObject([
      { type: "command", commandId: "window.new" },
      { type: "command", commandId: "window.duplicate" },
      { type: "separator" },
      { type: "command", commandId: "tab.next" },
      { type: "command", commandId: "tab.previous" },
      { type: "command", commandId: "tab.switchToRecent" },
      { type: "separator" },
      {
        type: "command",
        commandId: "tab.activate1",
        label: "1  01-specification.md",
        shortcutDisplay: "⌘1",
      },
      {
        type: "command",
        commandId: "tab.activate2",
        label: "✓ 2  Preferences",
        shortcutDisplay: "⌘2",
      },
    ]);
  });

  it("disambiguates duplicate Window menu basenames with parent folder names", () => {
    const model = buildAppMenuModel({
      config: defaultConfig,
      platform: "mac",
      workspaceTabs: [
        {
          kind: "document",
          id: "/workspace/docs/README.md",
          path: "/workspace/docs/README.md",
          document: {
            path: "/workspace/docs/README.md",
            basePath: "/workspace/docs",
            format: "markdown",
            source: "# Docs",
            updatedAt: "2026-06-01T00:00:00.000Z",
          },
        },
        {
          kind: "document",
          id: "/workspace/test/README.md",
          path: "/workspace/test/README.md",
          document: {
            path: "/workspace/test/README.md",
            basePath: "/workspace/test",
            format: "markdown",
            source: "# Test",
            updatedAt: "2026-06-01T00:00:00.000Z",
          },
        },
      ],
      activeTabId: "/workspace/docs/README.md",
      isCommandEnabled: () => true,
    });
    const windowMenu = model.find((menu) => menu.label === "Window");

    expect(allLabels(windowMenu?.items ?? [])).toEqual(
      expect.arrayContaining(["✓ 1  README.md — docs", "2  README.md — test"]),
    );
  });

  it("uses the last tab title for the ninth Window menu target", () => {
    const workspaceTabs = Array.from({ length: 10 }, (_, index) => {
      const number = index + 1;
      return {
        kind: "document" as const,
        id: `/workspace/docs/file-${number}.md`,
        path: `/workspace/docs/file-${number}.md`,
        document: {
          path: `/workspace/docs/file-${number}.md`,
          basePath: "/workspace/docs",
          format: "markdown" as const,
          source: `# File ${number}`,
          updatedAt: "2026-06-01T00:00:00.000Z",
        },
      };
    });
    const model = buildAppMenuModel({
      config: defaultConfig,
      platform: "mac",
      workspaceTabs,
      activeTabId: "/workspace/docs/file-10.md",
      isCommandEnabled: () => true,
    });
    const windowMenu = model.find((menu) => menu.label === "Window");

    expect(windowMenu?.items).toContainEqual(
      expect.objectContaining({
        type: "command",
        commandId: "tab.activateLast",
        label: "✓ 9  file-10.md",
        shortcutDisplay: "⌘9",
      }),
    );
    expect(allLabels(windowMenu?.items ?? [])).not.toContain(
      "Activate Last Tab",
    );
  });

  it("shows current effective shortcuts and keeps multi-step shortcuts display-only", () => {
    const shortcut = appMenuShortcutResolver(defaultConfig, "mac");

    expect(shortcut("file.open")).toEqual({
      display: "⌘O",
      accelerator: "CmdOrCtrl+O",
    });
    expect(shortcut("view.toggleZenMode")).toEqual({
      display: "⌘K Z",
    });
  });

  it("hides cleared shortcuts", () => {
    const config = {
      ...defaultConfig,
      keybindings: {
        ...defaultConfig.keybindings,
        mappings: defaultConfig.keybindings.mappings?.map((mapping) =>
          mapping.commandId === "view.toggleZenMode"
            ? { ...mapping, keys: "" }
            : mapping,
        ),
      },
    };
    const shortcut = appMenuShortcutResolver(config, "mac");

    expect(shortcut("view.toggleZenMode")).toEqual({});
  });

  it("uses command enabled state in menu items", () => {
    const model = buildAppMenuModel({
      config: defaultConfig,
      platform: "mac",
      isCommandEnabled: (commandId) => commandId !== "git.showDiff",
    });
    const sourceControl = model.find((menu) => menu.label === "Source Control");
    const showGitDiff = sourceControl?.items.find(
      (item) => item.type === "command" && item.commandId === "git.showDiff",
    );

    expect(showGitDiff).toMatchObject({ enabled: false });
  });
});
