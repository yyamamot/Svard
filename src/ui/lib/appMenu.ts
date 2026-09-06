import {
  commandDefinitions,
  isCommandId,
  type CommandId,
} from "../../core/commands";
import { bookmarkName } from "../../core/bookmarks";
import {
  detectPlatform,
  formatShortcut,
  normalizeKeybindingMappings,
  type Keybinding,
  type Platform,
} from "../../core/keybindings";
import type {
  AppConfig,
  BookmarkEntry,
  DocumentPayload,
} from "../../core/types";
import type { RecentlyVisitedLocation, WorkspaceTab } from "../types";
import { fileName } from "./path";
import { settingsLabel } from "./appLabels";

export const appMenuTopLevelOrder = [
  "File",
  "Edit",
  "View",
  "History",
  "Bookmarks",
  "Source Control",
  "Window",
  "Help",
] as const;

export type AppMenuTopLevelLabel =
  | "Svard"
  | (typeof appMenuTopLevelOrder)[number];

export interface AppMenuCommandItem {
  type: "command";
  label: string;
  commandId: CommandId;
  enabled: boolean;
  shortcutDisplay?: string;
  accelerator?: string;
}

export interface AppMenuNativeItem {
  type: "native";
  label: string;
  nativeId:
    | "undo"
    | "redo"
    | "cut"
    | "copy"
    | "paste"
    | "selectAll"
    | "separator"
    | "services"
    | "hide"
    | "hideOthers"
    | "showAll"
    | "about";
  enabled?: boolean;
}

export interface AppMenuRecentItem {
  type: "recentDocument" | "recentDirectory" | "recentlyClosed";
  label: string;
  path: string;
  enabled: boolean;
}

export interface AppMenuRecentlyVisitedItem {
  type: "recentlyVisited";
  label: string;
  path: string;
  visitedAt: string;
  enabled: boolean;
}

export interface AppMenuBookmarkItem {
  type: "bookmark";
  kind: BookmarkEntry["kind"];
  label: string;
  path: string;
  enabled: boolean;
}

export interface AppMenuSubmenu {
  type: "submenu";
  label: string;
  enabled: boolean;
  items: AppMenuItem[];
}

export interface AppMenuSeparator {
  type: "separator";
}

export type AppMenuItem =
  | AppMenuCommandItem
  | AppMenuNativeItem
  | AppMenuRecentItem
  | AppMenuRecentlyVisitedItem
  | AppMenuBookmarkItem
  | AppMenuSubmenu
  | AppMenuSeparator;

export interface AppMenuTopLevel {
  label: AppMenuTopLevelLabel;
  items: AppMenuItem[];
}

interface BuildAppMenuModelOptions {
  config: AppConfig;
  platform?: Platform;
  lastClosedTabs?: DocumentPayload[];
  recentlyVisitedLocations?: RecentlyVisitedLocation[];
  workspaceTabs?: WorkspaceTab[];
  activeTabId?: string;
  isCommandEnabled: (commandId: CommandId) => boolean;
}

const commandIdsWithNativeAccelerators = new Set<CommandId>([
  "app.quit",
  "file.open",
  "folder.open",
  "window.new",
  "search.focus",
  "search.next",
  "search.previous",
  "tab.close",
  "tab.closeAll",
  "tab.restoreClosed",
  "tab.next",
  "tab.previous",
  "tab.activate1",
  "tab.activate2",
  "tab.activate3",
  "tab.activate4",
  "tab.activate5",
  "tab.activate6",
  "tab.activate7",
  "tab.activate8",
  "tab.activateLast",
  "quickOpen.focus",
  "navigation.back",
  "navigation.forward",
  "bookmark.toggleActive",
  "sidebar.toggleLeft",
  "sidebar.toggleRight",
  "view.splitRight",
  "view.closeSplit",
  "preferences.open",
  "viewer.reload",
  "viewer.reloadForce",
  "viewer.captureArea",
  "viewer.captureAreaWithReference",
  "zoom.in",
  "zoom.out",
  "zoom.reset",
]);

export function buildAppMenuModel({
  config,
  platform = detectPlatform(),
  lastClosedTabs = [],
  recentlyVisitedLocations = [],
  workspaceTabs = [],
  activeTabId,
  isCommandEnabled,
}: BuildAppMenuModelOptions): AppMenuTopLevel[] {
  const shortcut = appMenuShortcutResolver(config, platform);
  const command = (label: string, commandId: CommandId): AppMenuCommandItem => {
    const shortcutInfo = shortcut(commandId);
    return {
      type: "command",
      label,
      commandId,
      enabled: isCommandEnabled(commandId),
      ...(shortcutInfo.display
        ? { shortcutDisplay: shortcutInfo.display }
        : {}),
      ...(shortcutInfo.accelerator
        ? { accelerator: shortcutInfo.accelerator }
        : {}),
    };
  };
  const separator = (): AppMenuSeparator => ({ type: "separator" });
  const submenu = (label: string, items: AppMenuItem[]): AppMenuSubmenu => ({
    type: "submenu",
    label,
    enabled: items.some(
      (item) => item.type !== "separator" && item.enabled !== false,
    ),
    items,
  });

  const recentDocumentItems: AppMenuItem[] =
    config.workspace.recentDocuments.length > 0
      ? config.workspace.recentDocuments.slice(0, 8).map((entry) => ({
          type: "recentDocument",
          label: entry.name ?? fileName(entry.path),
          path: entry.path,
          enabled: true,
        }))
      : [
          {
            type: "recentDocument",
            label: "No Recent Documents",
            path: "",
            enabled: false,
          },
        ];
  const recentDirectoryItems: AppMenuItem[] =
    config.workspace.recentDirectories.length > 0
      ? config.workspace.recentDirectories.slice(0, 8).map((entry) => ({
          type: "recentDirectory",
          label: entry.name ?? fileName(entry.path),
          path: entry.path,
          enabled: true,
        }))
      : [
          {
            type: "recentDirectory",
            label: "No Recent Folders",
            path: "",
            enabled: false,
          },
        ];
  const recentlyClosedItems: AppMenuItem[] =
    lastClosedTabs.length > 0
      ? lastClosedTabs
          .slice(-8)
          .reverse()
          .map((entry) => ({
            type: "recentlyClosed",
            label: fileName(entry.path),
            path: entry.path,
            enabled: true,
          }))
      : [
          {
            type: "recentlyClosed",
            label: "No Recently Closed Files",
            path: "",
            enabled: false,
          },
        ];
  const recentlyVisitedItems: AppMenuItem[] =
    recentlyVisitedLocations.length > 0
      ? recentlyVisitedLocations.slice(0, 8).map((location) => ({
          type: "recentlyVisited",
          label: visitedLocationLabel(location),
          path: location.path,
          visitedAt: location.visitedAt,
          enabled: true,
        }))
      : [
          {
            type: "recentlyVisited",
            label: "No Recently Visited Locations",
            path: "",
            visitedAt: "",
            enabled: false,
          },
        ];
  const folderBookmarkItems = bookmarkMenuItems(
    config.workspace.bookmarks,
    "directory",
  );
  const fileBookmarkItems = bookmarkMenuItems(
    config.workspace.bookmarks,
    "file",
  );
  const bookmarkItems: AppMenuItem[] =
    config.workspace.bookmarks.length > 0
      ? [
          submenu("Folders", folderBookmarkItems),
          submenu("Files", fileBookmarkItems),
        ]
      : [
          {
            type: "bookmark",
            kind: "file",
            label: "No Bookmarks",
            path: "",
            enabled: false,
          },
        ];
  const windowTabItems = windowMenuTabItems({
    platform,
    command,
    workspaceTabs,
    activeTabId,
  });

  return [
    ...(platform === "mac"
      ? [
          {
            label: "Svard" as const,
            items: [
              {
                type: "native" as const,
                label: "About Svard",
                nativeId: "about" as const,
              },
              separator(),
              command("Settings…", "preferences.open"),
              separator(),
              {
                type: "native" as const,
                label: "Services",
                nativeId: "services" as const,
              },
              separator(),
              {
                type: "native" as const,
                label: "Hide Svard",
                nativeId: "hide" as const,
              },
              {
                type: "native" as const,
                label: "Hide Others",
                nativeId: "hideOthers" as const,
              },
              {
                type: "native" as const,
                label: "Show All",
                nativeId: "showAll" as const,
              },
              separator(),
              command("Quit Svard", "app.quit"),
            ],
          },
        ]
      : []),
    {
      label: "File",
      items: [
        ...(platform === "mac"
          ? [command("New Window", "window.new"), separator()]
          : []),
        command("Open File...", "file.open"),
        command("Open Folder...", "folder.open"),
        submenu("Open Recent", [
          ...recentDocumentItems,
          separator(),
          ...recentDirectoryItems,
        ]),
        separator(),
        command("Quick Open...", "quickOpen.focus"),
        ...(platform === "mac"
          ? []
          : [command("Preferences...", "preferences.open")]),
        separator(),
        command("Compare Files...", "file.compareFiles"),
        command("Compare with Active File", "file.compareWithActive"),
        separator(),
        command("Close File", "tab.close"),
        command("Close Other Files", "tab.closeOthers"),
        command("Close All Files", "tab.closeAll"),
        ...(platform === "mac"
          ? []
          : [separator(), command("Exit", "app.quit")]),
      ],
    },
    {
      label: "Edit",
      items: [
        { type: "native", label: "Undo", nativeId: "undo", enabled: true },
        { type: "native", label: "Redo", nativeId: "redo", enabled: true },
        separator(),
        { type: "native", label: "Cut", nativeId: "cut", enabled: true },
        { type: "native", label: "Copy", nativeId: "copy", enabled: true },
        { type: "native", label: "Paste", nativeId: "paste", enabled: true },
        {
          type: "native",
          label: "Select All",
          nativeId: "selectAll",
          enabled: true,
        },
        separator(),
        command("Capture Area…", "viewer.captureArea"),
        command(
          "Capture Area with Reference…",
          "viewer.captureAreaWithReference",
        ),
        separator(),
        command("Find in Page...", "search.focus"),
        command("Next Match", "search.next"),
        command("Previous Match", "search.previous"),
        command("Clear Search", "search.clear"),
        separator(),
        command("Copy Heading Link", "heading.copyLink"),
      ],
    },
    {
      label: "View",
      items: [
        command("Reload", "viewer.reload"),
        command("Force Reload", "viewer.reloadForce"),
        separator(),
        command("Zoom In", "zoom.in"),
        command("Zoom Out", "zoom.out"),
        command("Reset Zoom", "zoom.reset"),
        separator(),
        submenu("Layout", [
          command("Zen Mode", "view.toggleZenMode"),
          command("Split View", "view.splitRight"),
          command("Close Split View", "view.closeSplit"),
          command("Left Sidebar", "sidebar.toggleLeft"),
          command("Right Sidebar", "sidebar.toggleRight"),
        ]),
      ],
    },
    {
      label: "History",
      items: [
        command("Back", "navigation.back"),
        command("Forward", "navigation.forward"),
        submenu("Recently Visited", recentlyVisitedItems),
        submenu("Recently Closed", recentlyClosedItems),
        command("Restore Last Closed File", "tab.restoreClosed"),
      ],
    },
    {
      label: "Bookmarks",
      items: [
        command("Add Current File", "bookmark.toggleActive"),
        command("Add Current Folder", "bookmark.addCurrentFolder"),
        separator(),
        ...bookmarkItems,
        separator(),
        command("Manage Bookmarks", "sidebar.showBookmarks"),
      ],
    },
    {
      label: "Source Control",
      items: [
        command("Show Git Diff", "git.showDiff"),
        command("Show File History", "git.showFileHistory"),
        separator(),
        command("Compare with Branch...", "git.compareWithBranch"),
        command("Compare with Tag...", "git.compareWithTag"),
        command("Compare with Commit...", "git.compareWithCommit"),
      ],
    },
    {
      label: "Window",
      items: [
        ...(platform === "mac" ? [] : [command("New Window", "window.new")]),
        command("Duplicate Window", "window.duplicate"),
        separator(),
        command("Next Tab", "tab.next"),
        command("Previous Tab", "tab.previous"),
        command("Switch to Recent Tab", "tab.switchToRecent"),
        ...(windowTabItems.length > 0 ? [separator(), ...windowTabItems] : []),
      ],
    },
    {
      label: "Help",
      items: [
        ...(platform === "mac"
          ? []
          : [
              {
                type: "native" as const,
                label: "About Svard",
                nativeId: "about" as const,
                enabled: true,
              },
            ]),
        command("Website", "help.openWebsite"),
        command("Shortcuts and Gestures", "viewer.showShortcuts"),
      ],
    },
  ];
}

function windowMenuTabItems({
  platform,
  command,
  workspaceTabs,
  activeTabId,
}: {
  platform: Platform;
  command: (label: string, commandId: CommandId) => AppMenuCommandItem;
  workspaceTabs: WorkspaceTab[];
  activeTabId?: string;
}): AppMenuItem[] {
  const numberedCommands: CommandId[] = [
    "tab.activate1",
    "tab.activate2",
    "tab.activate3",
    "tab.activate4",
    "tab.activate5",
    "tab.activate6",
    "tab.activate7",
    "tab.activate8",
  ];
  const primaryTabs = workspaceTabs.slice(0, numberedCommands.length);
  const items = primaryTabs.map((tab, index) =>
    command(
      windowMenuTabLabel(tab, index + 1, activeTabId, workspaceTabs, platform),
      numberedCommands[index]!,
    ),
  );

  if (workspaceTabs.length > numberedCommands.length) {
    const lastTab = workspaceTabs.at(-1);
    if (lastTab && !primaryTabs.some((tab) => tab.id === lastTab.id)) {
      items.push(
        command(
          windowMenuTabLabel(lastTab, 9, activeTabId, workspaceTabs, platform),
          "tab.activateLast",
        ),
      );
    }
  }

  return items;
}

function windowMenuTabLabel(
  tab: WorkspaceTab,
  index: number,
  activeTabId: string | undefined,
  workspaceTabs: WorkspaceTab[],
  platform: Platform,
): string {
  const title = tabTitle(tab, workspaceTabs, platform);
  const prefix = tab.id === activeTabId ? `✓ ${index}` : `${index}`;
  return `${prefix}  ${title}`;
}

function tabTitle(
  tab: WorkspaceTab,
  workspaceTabs: WorkspaceTab[],
  platform: Platform,
): string {
  if (tab.kind === "preferences") {
    return settingsLabel(platform);
  }
  const basename = fileName(tab.path);
  const duplicateCount = workspaceTabs.filter(
    (current) =>
      current.kind === "document" && fileName(current.path) === basename,
  ).length;
  if (duplicateCount <= 1) {
    return basename;
  }
  const parent = parentFolderName(tab.path);
  return parent ? `${basename} — ${parent}` : basename;
}

function parentFolderName(path: string): string | null {
  const parts = path
    .replace(/[\\/]+$/u, "")
    .split(/[\\/]+/u)
    .filter(Boolean);
  return parts.length >= 2 ? parts.at(-2)! : null;
}

function visitedLocationLabel(location: RecentlyVisitedLocation): string {
  const base = fileName(location.path);
  if (location.headingId || location.label) {
    return `${base} - ${location.label ?? location.headingId}`;
  }
  return base;
}

function bookmarkMenuItems(
  bookmarks: BookmarkEntry[],
  kind: BookmarkEntry["kind"],
): AppMenuItem[] {
  const items = bookmarks.filter((bookmark) => bookmark.kind === kind);
  if (items.length === 0) {
    return [
      {
        type: "bookmark",
        kind,
        label:
          kind === "directory" ? "No Bookmark Folders" : "No Bookmark Files",
        path: "",
        enabled: false,
      },
    ];
  }
  return items.map((bookmark) => ({
    type: "bookmark",
    kind: bookmark.kind,
    label: bookmarkName(bookmark),
    path: bookmark.path,
    enabled: true,
  }));
}

export function appMenuShortcutResolver(config: AppConfig, platform: Platform) {
  const shortcuts = new Map<CommandId, string>();
  for (const mapping of normalizeKeybindingMappings(
    config.keybindings.preset,
    config.keybindings.mappings,
  )) {
    if (!mapping.keys.trim() || shortcuts.has(mapping.commandId)) {
      continue;
    }
    shortcuts.set(mapping.commandId, mapping.keys.trim());
  }

  return (commandId: CommandId): { display?: string; accelerator?: string } => {
    const keys = shortcuts.get(commandId);
    if (!keys) {
      return {};
    }
    const display = formatShortcut(keys, platform);
    const accelerator =
      commandIdsWithNativeAccelerators.has(commandId) && isSingleChord(keys)
        ? toTauriAccelerator(keys)
        : undefined;
    return {
      display,
      ...(accelerator ? { accelerator } : {}),
    };
  };
}

export function appMenuCommandIds(model: AppMenuTopLevel[]): CommandId[] {
  const ids: CommandId[] = [];
  const visit = (items: AppMenuItem[]) => {
    for (const item of items) {
      if (item.type === "command") {
        ids.push(item.commandId);
      } else if (item.type === "submenu") {
        visit(item.items);
      }
    }
  };
  for (const menu of model) {
    visit(menu.items);
  }
  return ids;
}

export function validateAppMenuCommandIds(model: AppMenuTopLevel[]): string[] {
  return appMenuCommandIds(model).filter((id) => !isCommandId(id));
}

export function commandTitleExistsForAppMenu(commandId: CommandId): boolean {
  return commandDefinitions.some((command) => command.id === commandId);
}

function isSingleChord(keys: string): boolean {
  return !keys.trim().includes(" ");
}

function toTauriAccelerator(keys: string): string | undefined {
  if (!isSingleChord(keys)) {
    return undefined;
  }
  const parts = keys.split("+");
  return parts
    .map((part) => {
      const labels: Record<string, string> = {
        Mod: "CmdOrCtrl",
        Meta: "Cmd",
        Control: "Ctrl",
        Alt: "Alt",
        Shift: "Shift",
        ArrowLeft: "Left",
        ArrowRight: "Right",
        ArrowUp: "Up",
        ArrowDown: "Down",
      };
      return labels[part] ?? part;
    })
    .join("+");
}

export function keybindingRowsForAppMenu(
  config: AppConfig,
  commandId: CommandId,
): Keybinding[] {
  return normalizeKeybindingMappings(
    config.keybindings.preset,
    config.keybindings.mappings,
  ).filter((mapping) => mapping.commandId === commandId);
}
