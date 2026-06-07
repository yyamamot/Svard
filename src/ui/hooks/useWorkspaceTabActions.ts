import type { WorkspaceTab } from "../types";

interface UseWorkspaceTabActionsOptions {
  activateRelativeTab: (delta: number) => void;
  activateTab: (path: string) => Promise<void> | void;
  activateTabByIndex: (index: number) => void;
  closeAllTabs: () => void;
  closeTab: (path: string) => void;
  openDocument: (path: string) => Promise<void> | void;
  openPreferencesTab: () => void;
  restoreClosedTab: () => void;
  setActiveWorkspaceTabKind: (kind: "document" | "preferences") => void;
  setPreferencesTabOpen: (open: boolean) => void;
  setTabMoreOpen: (open: boolean) => void;
}

export function useWorkspaceTabActions({
  activateRelativeTab,
  activateTab,
  activateTabByIndex,
  closeAllTabs,
  closeTab,
  openDocument,
  openPreferencesTab,
  restoreClosedTab,
  setActiveWorkspaceTabKind,
  setPreferencesTabOpen,
  setTabMoreOpen,
}: UseWorkspaceTabActionsOptions) {
  function closePreferencesTab() {
    setPreferencesTabOpen(false);
    setActiveWorkspaceTabKind("document");
    setTabMoreOpen(false);
  }

  function setPreferencesTabVisible(open: boolean) {
    if (open) {
      openPreferencesTab();
    } else {
      closePreferencesTab();
    }
  }

  function activateDocumentWorkspaceTab(path: string) {
    setActiveWorkspaceTabKind("document");
    void activateTab(path);
  }

  async function openDocumentWorkspaceTab(path: string) {
    setActiveWorkspaceTabKind("document");
    await openDocument(path);
  }

  function closeWorkspaceTab(tab: WorkspaceTab) {
    if (tab.kind === "preferences") {
      closePreferencesTab();
      return;
    }
    closeTab(tab.path);
  }

  function closeAllWorkspaceTabs() {
    closeAllTabs();
    closePreferencesTab();
  }

  function activateRelativeDocumentTab(delta: number) {
    setActiveWorkspaceTabKind("document");
    activateRelativeTab(delta);
  }

  function activateDocumentTabByIndex(index: number) {
    setActiveWorkspaceTabKind("document");
    activateTabByIndex(index);
  }

  function restoreClosedDocumentTab() {
    setActiveWorkspaceTabKind("document");
    restoreClosedTab();
  }

  return {
    activateDocumentTabByIndex,
    activateDocumentWorkspaceTab,
    activateRelativeDocumentTab,
    closeAllWorkspaceTabs,
    closePreferencesTab,
    closeWorkspaceTab,
    openDocumentWorkspaceTab,
    openPreferencesTab,
    restoreClosedDocumentTab,
    setPreferencesTabVisible,
  };
}
