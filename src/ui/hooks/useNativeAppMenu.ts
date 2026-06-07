import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { CommandId } from "../../core/commands";
import type { AppConfig, DocumentPayload } from "../../core/types";
import type {
  NavigationLocation,
  RecentlyVisitedLocation,
  WorkspaceTab,
} from "../types";
import {
  buildAppMenuModel,
  type AppMenuItem,
  type AppMenuTopLevel,
} from "../lib/appMenu";

type TauriMenuApi = typeof import("@tauri-apps/api/menu");

interface UseNativeAppMenuOptions {
  config: AppConfig | null;
  disabled?: boolean;
  lastClosedTabs: DocumentPayload[];
  recentlyVisitedLocations: RecentlyVisitedLocation[];
  workspaceTabs: WorkspaceTab[];
  activeTabId?: string;
  menuStateKey: string;
  dispatchCommand: (commandId: CommandId) => Promise<unknown> | unknown;
  isCommandEnabled: (commandId: CommandId) => boolean;
  openDocument: (path: string) => Promise<void> | void;
  openDirectory: (path: string) => Promise<void> | void;
  openRecentlyVisitedLocation: (
    location: NavigationLocation,
  ) => Promise<void> | void;
  restoreClosedTabAt: (index: number) => void;
}

export function useNativeAppMenu({
  config,
  disabled = false,
  lastClosedTabs,
  recentlyVisitedLocations,
  workspaceTabs,
  activeTabId,
  menuStateKey,
  dispatchCommand,
  isCommandEnabled,
  openDocument,
  openDirectory,
  openRecentlyVisitedLocation,
  restoreClosedTabAt,
}: UseNativeAppMenuOptions) {
  const handlersRef = useRef({
    dispatchCommand,
    openDocument,
    openDirectory,
    openRecentlyVisitedLocation,
    restoreClosedTabAt,
    lastClosedTabs,
    recentlyVisitedLocations,
  });
  const lastInstalledMenuKeyRef = useRef<string | null>(null);
  const [focusedMenuInstallEpoch, setFocusedMenuInstallEpoch] = useState(0);
  handlersRef.current = {
    dispatchCommand,
    openDocument,
    openDirectory,
    openRecentlyVisitedLocation,
    restoreClosedTabAt,
    lastClosedTabs,
    recentlyVisitedLocations,
  };

  const model = useMemo(
    () =>
      config
        ? buildAppMenuModel({
            config,
            lastClosedTabs,
            recentlyVisitedLocations,
            workspaceTabs,
            activeTabId,
            isCommandEnabled,
          })
        : null,
    [
      config,
      isCommandEnabled,
      lastClosedTabs,
      menuStateKey,
      recentlyVisitedLocations,
      workspaceTabs,
      activeTabId,
    ],
  );

  useEffect(() => {
    if (
      disabled ||
      typeof window === "undefined" ||
      !("__TAURI_INTERNALS__" in window)
    ) {
      return;
    }
    let disposed = false;
    let unlisten: (() => void) | null = null;

    async function watchWindowFocus() {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      unlisten = await getCurrentWindow().onFocusChanged(({ payload }) => {
        if (!disposed && payload) {
          setFocusedMenuInstallEpoch((current) => current + 1);
        }
      });
    }

    void watchWindowFocus().catch(() => {
      // Focus-driven reinstall is a native-only safety net; state-driven menu updates remain authoritative.
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [disabled]);

  useEffect(() => {
    if (
      disabled ||
      !model ||
      typeof window === "undefined" ||
      !("__TAURI_INTERNALS__" in window)
    ) {
      return;
    }
    const installKey = `${menuStateKey}:${focusedMenuInstallEpoch}`;
    if (lastInstalledMenuKeyRef.current === installKey) {
      return;
    }
    const currentModel = model;
    let cancelled = false;

    async function installMenu() {
      const menuApi = await import("@tauri-apps/api/menu");
      const menu = await createNativeMenu(menuApi, currentModel, handlersRef);
      if (!cancelled) {
        await menu.setAsAppMenu();
        lastInstalledMenuKeyRef.current = installKey;
      }
    }

    void installMenu().catch(() => {
      // Native menu is a discoverability layer; command dispatch remains available.
    });

    return () => {
      cancelled = true;
    };
  }, [disabled, focusedMenuInstallEpoch, menuStateKey, model]);
}

async function createNativeMenu(
  menuApi: TauriMenuApi,
  model: AppMenuTopLevel[],
  handlersRef: MutableRefObject<{
    dispatchCommand: (commandId: CommandId) => Promise<unknown> | unknown;
    openDocument: (path: string) => Promise<void> | void;
    openDirectory: (path: string) => Promise<void> | void;
    openRecentlyVisitedLocation: (
      location: NavigationLocation,
    ) => Promise<void> | void;
    restoreClosedTabAt: (index: number) => void;
    lastClosedTabs: DocumentPayload[];
    recentlyVisitedLocations: RecentlyVisitedLocation[];
  }>,
) {
  const items = await Promise.all(
    model.map((menu) =>
      menuApi.Submenu.new({
        text: menu.label,
        items: menu.items.map((item) =>
          nativeMenuItemOptions(menuApi, item, handlersRef),
        ),
      }),
    ),
  );
  return menuApi.Menu.new({ items });
}

function nativeMenuItemOptions(
  menuApi: TauriMenuApi,
  item: AppMenuItem,
  handlersRef: MutableRefObject<{
    dispatchCommand: (commandId: CommandId) => Promise<unknown> | unknown;
    openDocument: (path: string) => Promise<void> | void;
    openDirectory: (path: string) => Promise<void> | void;
    openRecentlyVisitedLocation: (
      location: NavigationLocation,
    ) => Promise<void> | void;
    restoreClosedTabAt: (index: number) => void;
    lastClosedTabs: DocumentPayload[];
    recentlyVisitedLocations: RecentlyVisitedLocation[];
  }>,
):
  | import("@tauri-apps/api/menu").MenuItemOptions
  | import("@tauri-apps/api/menu").SubmenuOptions
  | import("@tauri-apps/api/menu").PredefinedMenuItemOptions {
  if (item.type === "separator") {
    return { item: "Separator" };
  }
  if (item.type === "native") {
    if (item.nativeId === "undo") {
      return { item: "Undo", text: item.label };
    }
    if (item.nativeId === "redo") {
      return { item: "Redo", text: item.label };
    }
    if (item.nativeId === "cut") {
      return { item: "Cut", text: item.label };
    }
    if (item.nativeId === "copy") {
      return { item: "Copy", text: item.label };
    }
    if (item.nativeId === "paste") {
      return { item: "Paste", text: item.label };
    }
    if (item.nativeId === "selectAll") {
      return { item: "SelectAll", text: item.label };
    }
    if (item.nativeId === "about") {
      return { item: { About: { name: "Svard" } }, text: item.label };
    }
    return { item: "Separator" };
  }
  if (item.type === "submenu") {
    return {
      text: item.label,
      enabled: item.enabled,
      items: item.items.map((child) =>
        nativeMenuItemOptions(menuApi, child, handlersRef),
      ),
    };
  }
  if (item.type === "command") {
    const text =
      item.shortcutDisplay && !item.accelerator
        ? `${item.label}    ${item.shortcutDisplay}`
        : item.label;
    return {
      id: `app-menu:${item.commandId}`,
      text,
      enabled: item.enabled,
      ...(item.accelerator ? { accelerator: item.accelerator } : {}),
      action: () => {
        const registry = window.__SVARD_COMMANDS__;
        if (registry) {
          void registry.dispatch(item.commandId);
          return;
        }
        void handlersRef.current.dispatchCommand(item.commandId);
      },
    };
  }
  if (item.type === "recentDocument") {
    return {
      text: item.label,
      enabled: item.enabled,
      action: () => {
        if (item.path) {
          void handlersRef.current.openDocument(item.path);
        }
      },
    };
  }
  if (item.type === "recentDirectory") {
    return {
      text: item.label,
      enabled: item.enabled,
      action: () => {
        if (item.path) {
          void handlersRef.current.openDirectory(item.path);
        }
      },
    };
  }
  if (item.type === "recentlyVisited") {
    return {
      text: item.label,
      enabled: item.enabled,
      action: () => {
        const location = handlersRef.current.recentlyVisitedLocations.find(
          (visited) => visited.visitedAt === item.visitedAt,
        );
        if (location) {
          void handlersRef.current.openRecentlyVisitedLocation(location);
        }
      },
    };
  }
  if (item.type === "bookmark") {
    return {
      text: item.label,
      enabled: item.enabled,
      action: () => {
        if (!item.path) {
          return;
        }
        if (item.kind === "directory") {
          void handlersRef.current.openDirectory(item.path);
          return;
        }
        void handlersRef.current.openDocument(item.path);
      },
    };
  }
  return {
    text: item.label,
    enabled: item.enabled,
    action: () => {
      const index = handlersRef.current.lastClosedTabs.findIndex(
        (tab) => tab.path === item.path,
      );
      if (index >= 0) {
        handlersRef.current.restoreClosedTabAt(index);
      }
    },
  };
}
