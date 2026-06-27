export const commandIds = [
  "file.open",
  "folder.open",
  "window.new",
  "window.duplicate",
  "search.focus",
  "search.next",
  "search.previous",
  "search.clear",
  "tab.next",
  "tab.previous",
  "tab.close",
  "tab.closeOthers",
  "tab.closeAll",
  "tab.restoreClosed",
  "tab.switchToRecent",
  "tab.togglePinned",
  "tab.moveToNewWindow",
  "tab.search",
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
  "bookmark.addCurrentFolder",
  "documents.revealCurrent",
  "sidebar.showFiles",
  "sidebar.showBookmarks",
  "sidebar.toggleLeft",
  "sidebar.toggleRight",
  "view.splitRight",
  "view.closeSplit",
  "view.focusLeftPane",
  "view.focusRightPane",
  "view.toggleZenMode",
  "view.exitZenMode",
  "preferences.open",
  "preferences.close",
  "help.openWebsite",
  "theme.toggle",
  "viewer.reload",
  "viewer.reloadForce",
  "viewer.showShortcuts",
  "git.showDiff",
  "git.showFileHistory",
  "git.compareWithBranch",
  "git.compareWithTag",
  "git.compareWithCommit",
  "file.compareWithActive",
  "file.compareFiles",
  "file.openCurrentInNewWindow",
  "viewer.scrollDown",
  "viewer.scrollUp",
  "viewer.contentCursor.next",
  "viewer.contentCursor.previous",
  "viewer.pageDown",
  "viewer.pageUp",
  "viewer.top",
  "viewer.bottom",
  "zoom.in",
  "zoom.out",
  "zoom.reset",
  "link.openFocused",
  "heading.copyLink",
] as const;

export type CommandId = (typeof commandIds)[number];

export interface CommandDefinition {
  id: CommandId;
  title: string;
  context: "global" | "viewer" | "search" | "tabs" | "modal" | "navigation";
}

export type CommandDispatchStatus = "handled" | "disabled" | "unknown";

export interface CommandDispatchResult {
  status: CommandDispatchStatus;
  commandId: CommandId | string;
}

export const commandDefinitions: CommandDefinition[] = [
  { id: "file.open", title: "Open File", context: "global" },
  { id: "folder.open", title: "Open Folder", context: "global" },
  { id: "window.new", title: "New Window", context: "global" },
  { id: "window.duplicate", title: "Duplicate Window", context: "global" },
  { id: "search.focus", title: "Focus Search", context: "global" },
  { id: "search.next", title: "Next Search Match", context: "search" },
  { id: "search.previous", title: "Previous Search Match", context: "search" },
  { id: "search.clear", title: "Clear Search", context: "search" },
  { id: "tab.next", title: "Next Tab", context: "tabs" },
  { id: "tab.previous", title: "Previous Tab", context: "tabs" },
  { id: "tab.close", title: "Close Current Tab", context: "tabs" },
  { id: "tab.closeOthers", title: "Close Other Files", context: "tabs" },
  { id: "tab.closeAll", title: "Close All Files", context: "tabs" },
  { id: "tab.restoreClosed", title: "Restore Closed Tab", context: "tabs" },
  { id: "tab.switchToRecent", title: "Switch to Recent Tab", context: "tabs" },
  { id: "tab.togglePinned", title: "Toggle Pinned Tab", context: "tabs" },
  { id: "tab.search", title: "Search Open Files", context: "tabs" },
  { id: "tab.activate1", title: "Activate Tab 1", context: "tabs" },
  { id: "tab.activate2", title: "Activate Tab 2", context: "tabs" },
  { id: "tab.activate3", title: "Activate Tab 3", context: "tabs" },
  { id: "tab.activate4", title: "Activate Tab 4", context: "tabs" },
  { id: "tab.activate5", title: "Activate Tab 5", context: "tabs" },
  { id: "tab.activate6", title: "Activate Tab 6", context: "tabs" },
  { id: "tab.activate7", title: "Activate Tab 7", context: "tabs" },
  { id: "tab.activate8", title: "Activate Tab 8", context: "tabs" },
  { id: "tab.activateLast", title: "Activate Last Tab", context: "tabs" },
  { id: "quickOpen.focus", title: "Quick Open", context: "global" },
  { id: "navigation.back", title: "Navigate Back", context: "navigation" },
  {
    id: "navigation.forward",
    title: "Navigate Forward",
    context: "navigation",
  },
  {
    id: "bookmark.toggleActive",
    title: "Toggle Active Bookmark",
    context: "global",
  },
  {
    id: "bookmark.addCurrentFolder",
    title: "Add Current Folder Bookmark",
    context: "global",
  },
  {
    id: "documents.revealCurrent",
    title: "Reveal Current Document in Docs Order",
    context: "navigation",
  },
  { id: "sidebar.showFiles", title: "Show Files", context: "global" },
  {
    id: "sidebar.showBookmarks",
    title: "Show Bookmarks",
    context: "global",
  },
  { id: "sidebar.toggleLeft", title: "Toggle Left Sidebar", context: "global" },
  {
    id: "sidebar.toggleRight",
    title: "Toggle Right Sidebar",
    context: "global",
  },
  { id: "view.splitRight", title: "Split View Right", context: "viewer" },
  { id: "view.closeSplit", title: "Close Split View", context: "viewer" },
  { id: "view.focusLeftPane", title: "Focus Left Pane", context: "viewer" },
  { id: "view.focusRightPane", title: "Focus Right Pane", context: "viewer" },
  { id: "view.toggleZenMode", title: "Toggle Zen Mode", context: "global" },
  { id: "view.exitZenMode", title: "Exit Zen Mode", context: "global" },
  { id: "preferences.open", title: "Open Preferences", context: "global" },
  { id: "preferences.close", title: "Close Preferences", context: "modal" },
  { id: "help.openWebsite", title: "Website", context: "global" },
  { id: "theme.toggle", title: "Toggle Theme", context: "global" },
  { id: "viewer.reload", title: "Reload Document", context: "viewer" },
  {
    id: "viewer.reloadForce",
    title: "Force Reload Document",
    context: "viewer",
  },
  {
    id: "viewer.showShortcuts",
    title: "Shortcuts and Gestures",
    context: "viewer",
  },
  { id: "git.showDiff", title: "Show Git Diff", context: "viewer" },
  { id: "git.showFileHistory", title: "Show File History", context: "viewer" },
  {
    id: "git.compareWithBranch",
    title: "Compare with Branch...",
    context: "viewer",
  },
  {
    id: "git.compareWithTag",
    title: "Compare with Tag...",
    context: "viewer",
  },
  {
    id: "git.compareWithCommit",
    title: "Compare with Commit...",
    context: "viewer",
  },
  {
    id: "file.compareWithActive",
    title: "Compare Active File With...",
    context: "viewer",
  },
  { id: "file.compareFiles", title: "Compare Files...", context: "global" },
  { id: "viewer.scrollDown", title: "Scroll Down", context: "viewer" },
  { id: "viewer.scrollUp", title: "Scroll Up", context: "viewer" },
  {
    id: "viewer.contentCursor.next",
    title: "Next Content Block",
    context: "viewer",
  },
  {
    id: "viewer.contentCursor.previous",
    title: "Previous Content Block",
    context: "viewer",
  },
  { id: "viewer.pageDown", title: "Page Down", context: "viewer" },
  { id: "viewer.pageUp", title: "Page Up", context: "viewer" },
  { id: "viewer.top", title: "Scroll To Top", context: "viewer" },
  { id: "viewer.bottom", title: "Scroll To Bottom", context: "viewer" },
  { id: "zoom.in", title: "Zoom In", context: "global" },
  { id: "zoom.out", title: "Zoom Out", context: "global" },
  { id: "zoom.reset", title: "Reset Zoom", context: "global" },
  { id: "link.openFocused", title: "Open Focused Link", context: "viewer" },
  { id: "heading.copyLink", title: "Copy Heading Link", context: "viewer" },
];

export function isCommandId(value: string): value is CommandId {
  return commandIds.includes(value as CommandId);
}

export function getCommandTitle(commandId: CommandId): string {
  return (
    commandDefinitions.find((command) => command.id === commandId)?.title ??
    commandId
  );
}
