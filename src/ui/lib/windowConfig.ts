import type { AppConfig } from "../../core/types";
import {
  MAIN_WINDOW_SESSION_ID,
  workspaceSessionFromWorkspace,
  workspaceWithWindowSession,
} from "./config";
import type { WorkspaceWindowSession } from "../../core/types";

function hasRestorableWindowState(session: WorkspaceWindowSession): boolean {
  return Boolean(
    session.activePath || session.openTabs.length > 0 || session.lastDirectory,
  );
}

function restorableWindowSessionIdsForSave({
  persistedConfig,
  windowSessionId,
  windowSession,
}: {
  persistedConfig: AppConfig;
  windowSessionId: string;
  windowSession: WorkspaceWindowSession;
}): string[] {
  const persistedIds =
    persistedConfig.workspace.restorableWindowSessionIds ?? [];
  if (windowSessionId === MAIN_WINDOW_SESSION_ID) {
    return persistedIds.filter(
      (sessionId) => sessionId !== MAIN_WINDOW_SESSION_ID,
    );
  }
  const withoutCurrent = persistedIds.filter(
    (sessionId) => sessionId !== windowSessionId,
  );
  if (!hasRestorableWindowState(windowSession)) {
    return withoutCurrent;
  }
  return [...withoutCurrent, windowSessionId];
}

export function mergePersistedSharedConfigIntoWindow({
  persistedConfig,
  windowConfig,
}: {
  persistedConfig: AppConfig;
  windowConfig: AppConfig;
}): AppConfig {
  return {
    ...windowConfig,
    theme: persistedConfig.theme,
    zoom: persistedConfig.zoom,
    zoomWithMouseWheel: persistedConfig.zoomWithMouseWheel,
    reader: persistedConfig.reader,
    zenMode: persistedConfig.zenMode,
    diagram: persistedConfig.diagram,
    kroki: persistedConfig.kroki,
    network: persistedConfig.network,
    agentProviders: persistedConfig.agentProviders,
    remoteProviders: persistedConfig.remoteProviders,
    security: persistedConfig.security,
    experimental: persistedConfig.experimental,
    keybindings: persistedConfig.keybindings,
    mouseGestures: persistedConfig.mouseGestures,
    workspace: {
      ...windowConfig.workspace,
      bookmarks: persistedConfig.workspace.bookmarks,
      recentDocuments: persistedConfig.workspace.recentDocuments,
    },
  };
}

export function mergeWindowConfigForSave({
  persistedConfig,
  windowConfig,
  windowSessionId,
}: {
  persistedConfig: AppConfig;
  windowConfig: AppConfig;
  windowSessionId: string;
}): AppConfig {
  const windowSession = workspaceSessionFromWorkspace(windowConfig.workspace);
  const workspace = workspaceWithWindowSession(
    {
      ...windowConfig.workspace,
      windowSessions: persistedConfig.workspace.windowSessions,
    },
    windowSessionId,
    windowSession,
  );
  const restorableWindowSessionIds = restorableWindowSessionIdsForSave({
    persistedConfig,
    windowSessionId,
    windowSession,
  });
  const savesTopLevelWindowChrome = windowSessionId === MAIN_WINDOW_SESSION_ID;
  return {
    ...persistedConfig,
    theme: windowConfig.theme,
    sidebarVisible: savesTopLevelWindowChrome
      ? windowConfig.sidebarVisible
      : persistedConfig.sidebarVisible,
    rightSidebarVisible: savesTopLevelWindowChrome
      ? windowConfig.rightSidebarVisible
      : persistedConfig.rightSidebarVisible,
    zoom: windowConfig.zoom,
    zoomWithMouseWheel: windowConfig.zoomWithMouseWheel,
    reader: windowConfig.reader,
    zenMode: windowConfig.zenMode,
    layout: savesTopLevelWindowChrome
      ? windowConfig.layout
      : persistedConfig.layout,
    diagram: windowConfig.diagram,
    kroki: windowConfig.kroki,
    network: windowConfig.network,
    agentProviders: windowConfig.agentProviders,
    remoteProviders: windowConfig.remoteProviders,
    security: windowConfig.security,
    experimental: windowConfig.experimental,
    keybindings: windowConfig.keybindings,
    mouseGestures: windowConfig.mouseGestures,
    workspace: {
      ...workspace,
      bookmarks: windowConfig.workspace.bookmarks,
      recentDocuments: windowConfig.workspace.recentDocuments,
      restorableWindowSessionIds,
    },
  };
}

export function mergeWorkspaceConfigForSave({
  persistedConfig,
  windowConfig,
  windowSessionId,
}: {
  persistedConfig: AppConfig;
  windowConfig: AppConfig;
  windowSessionId: string;
}): AppConfig {
  const windowSession = workspaceSessionFromWorkspace(windowConfig.workspace);
  const workspace = workspaceWithWindowSession(
    {
      ...windowConfig.workspace,
      windowSessions: persistedConfig.workspace.windowSessions,
    },
    windowSessionId,
    windowSession,
  );
  const restorableWindowSessionIds = restorableWindowSessionIdsForSave({
    persistedConfig,
    windowSessionId,
    windowSession,
  });
  return {
    ...persistedConfig,
    workspace: {
      ...workspace,
      bookmarks: windowConfig.workspace.bookmarks,
      recentDocuments: windowConfig.workspace.recentDocuments,
      restorableWindowSessionIds,
    },
  };
}
