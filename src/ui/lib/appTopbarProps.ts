import type { ComponentProps, Dispatch, SetStateAction } from "react";
import type { Topbar } from "../components/Topbar";

type TopbarProps = ComponentProps<typeof Topbar>;
type TopbarBaseProps = Omit<
  TopbarProps,
  | "onActivateTab"
  | "onCloseTab"
  | "onDispatchCommand"
  | "onOpenDocumentOrderTarget"
  | "onToggleTabMore"
>;

export function createAppTopbarProps({
  activateDocumentTab,
  base,
  closeWorkspaceTab,
  codexPanelOpen,
  dispatchCommand,
  openDocumentTab,
  openPreferencesTab,
  preferencesOpen,
  setTabMoreOpen,
}: {
  activateDocumentTab: (path: string) => void;
  base: TopbarBaseProps;
  closeWorkspaceTab: TopbarProps["onCloseTab"];
  codexPanelOpen: boolean;
  dispatchCommand: TopbarProps["onDispatchCommand"];
  openDocumentTab: (path: string) => void | Promise<void>;
  openPreferencesTab: () => void;
  preferencesOpen: boolean;
  setTabMoreOpen: Dispatch<SetStateAction<boolean>>;
}): TopbarProps {
  return {
    ...base,
    rightSidebarVisible: base.rightSidebarVisible && !codexPanelOpen,
    rightSidebarAvailable: !preferencesOpen && !codexPanelOpen,
    codexSpikeActive: codexPanelOpen,
    onActivateTab: (tab) => {
      if (tab.kind === "preferences") {
        openPreferencesTab();
      } else {
        activateDocumentTab(tab.path);
      }
    },
    onCloseTab: closeWorkspaceTab,
    onToggleTabMore: () => {
      setTabMoreOpen((current) => !current);
    },
    onOpenDocumentOrderTarget: (path) => void openDocumentTab(path),
    onDispatchCommand: dispatchCommand,
  };
}
