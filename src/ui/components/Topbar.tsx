import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns2,
  FileText,
  Focus,
  PanelLeft,
  PanelRight,
  Bot,
  Settings,
  X,
} from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { fileName, isMiddleMouseButton } from "../lib/path";
import { preferencesTabId } from "../lib/workspaceTabs";
import type { CommandId } from "../../core/commands";
import type { DocumentOrderNavigationState } from "../lib/fileTreeDocuments";
import type { WorkspaceTab } from "../types";
import { AgentChatDisplayMenu } from "../agent/AgentChatDisplayMenu";
import type {
  AgentChatDisplayAction,
  AgentChatDisplayMenuItem,
} from "../agent/agentChatDisplay";

interface TopbarProps {
  sidebarVisible: boolean;
  activeTitle: string;
  activeTabId?: string;
  tabs: WorkspaceTab[];
  visibleTabs: WorkspaceTab[];
  overflowTabs: WorkspaceTab[];
  tabMoreOpen: boolean;
  splitEnabled: boolean;
  rightSidebarVisible: boolean;
  rightSidebarAvailable?: boolean;
  zenModeActive: boolean;
  hideTabs?: boolean;
  documentOrderNavigation?: DocumentOrderNavigationState | null;
  codexSpikeAvailable?: boolean;
  codexSpikeActive?: boolean;
  codexSpikeDetached?: boolean;
  agentChatDisplayItems?: AgentChatDisplayMenuItem[];
  onSelectAgentChatDisplay?: (
    action: AgentChatDisplayAction,
  ) => void | Promise<void>;
  onActivateTab: (tab: WorkspaceTab) => void;
  onCloseTab: (tab: WorkspaceTab) => void;
  onToggleTabMore: () => void;
  onOpenDocumentOrderTarget?: (path: string) => void;
  onDispatchCommand: (commandId: CommandId) => void;
}

export function Topbar({
  sidebarVisible,
  activeTitle,
  activeTabId,
  tabs,
  visibleTabs,
  overflowTabs,
  tabMoreOpen,
  splitEnabled,
  rightSidebarVisible,
  rightSidebarAvailable = true,
  zenModeActive,
  hideTabs = false,
  documentOrderNavigation = null,
  codexSpikeAvailable = false,
  codexSpikeActive = false,
  codexSpikeDetached = false,
  agentChatDisplayItems = [],
  onSelectAgentChatDisplay,
  onActivateTab,
  onCloseTab,
  onToggleTabMore,
  onOpenDocumentOrderTarget,
  onDispatchCommand,
}: TopbarProps) {
  function preventMiddleClick(event: ReactMouseEvent) {
    if (isMiddleMouseButton(event)) {
      event.preventDefault();
    }
  }

  function closeOnMiddleClick(tab: WorkspaceTab, event: ReactMouseEvent) {
    if (isMiddleMouseButton(event)) {
      event.preventDefault();
      onCloseTab(tab);
    }
  }

  function tabLabel(tab: WorkspaceTab) {
    return tab.kind === "preferences" ? "Preferences" : fileName(tab.path);
  }

  function tabTitle(tab: WorkspaceTab) {
    return tab.kind === "preferences" ? "Preferences" : tab.path;
  }

  function dispatchFromTopbar(commandId: CommandId) {
    onDispatchCommand(commandId);
  }

  function openDocumentOrderTarget(path: string | undefined) {
    if (!path) {
      return;
    }
    onOpenDocumentOrderTarget?.(path);
  }

  return (
    <header className="topbar">
      <button
        type="button"
        className="icon-button sidebar-toggle"
        data-review-id="left-sidebar-toggle"
        aria-label="Toggle left sidebar"
        title="Toggle left sidebar"
        aria-pressed={sidebarVisible}
        onClick={() => dispatchFromTopbar("sidebar.toggleLeft")}
      >
        <PanelLeft size={17} />
      </button>
      {sidebarVisible || hideTabs ? (
        <div
          className="active-document-title"
          data-review-id="active-document-title"
          title={activeTitle}
        >
          {activeTabId === preferencesTabId ? (
            <Settings size={15} />
          ) : (
            <FileText size={15} />
          )}
          <span>{activeTitle}</span>
        </div>
      ) : (
        <div className="tabbar" data-review-id="tab-bar">
          {tabs.length > 0 ? (
            <>
              {visibleTabs.map((tab) => (
                <button
                  type="button"
                  key={tab.id}
                  className={`tab ${activeTabId === tab.id ? "active" : ""}`}
                  title={tabTitle(tab)}
                  data-review-id={activeTabId === tab.id ? "active-tab" : "tab"}
                  data-context-menu-kind={
                    tab.kind === "document" ? "tab" : undefined
                  }
                  data-path={tab.kind === "document" ? tab.path : undefined}
                  data-tab-kind={tab.kind}
                  onClick={() => onActivateTab(tab)}
                  onMouseDown={preventMiddleClick}
                  onAuxClick={(event) => closeOnMiddleClick(tab, event)}
                >
                  {tab.kind === "preferences" ? (
                    <Settings size={14} />
                  ) : (
                    <FileText size={14} />
                  )}
                  <span>{tabLabel(tab)}</span>
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Close ${tabLabel(tab)}`}
                    className="tab-close"
                    data-review-id="tab-close"
                    onClick={(event) => {
                      event.stopPropagation();
                      onCloseTab(tab);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        onCloseTab(tab);
                      }
                    }}
                  >
                    <X size={13} />
                  </span>
                </button>
              ))}
              {overflowTabs.length > 0 && (
                <div className="tab-more">
                  <button
                    type="button"
                    className="tab"
                    aria-label={`More open files: ${overflowTabs.length}`}
                    data-review-id="tab-more"
                    onClick={onToggleTabMore}
                  >
                    More ({overflowTabs.length})
                    <ChevronDown size={14} />
                  </button>
                  {tabMoreOpen && (
                    <div className="tab-more-menu">
                      {overflowTabs.map((tab) => (
                        <button
                          type="button"
                          key={tab.id}
                          className="tab-more-item"
                          title={tabTitle(tab)}
                          data-context-menu-kind={
                            tab.kind === "document" ? "tab" : undefined
                          }
                          data-path={
                            tab.kind === "document" ? tab.path : undefined
                          }
                          data-tab-kind={tab.kind}
                          onClick={() => onActivateTab(tab)}
                          onMouseDown={preventMiddleClick}
                          onAuxClick={(event) => closeOnMiddleClick(tab, event)}
                        >
                          {tabLabel(tab)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="tab active" data-review-id="active-tab">
              Loading
            </div>
          )}
        </div>
      )}
      <div className="toolbar">
        {codexSpikeAvailable ? (
          <AgentChatDisplayMenu
            active={codexSpikeActive || codexSpikeDetached}
            items={agentChatDisplayItems}
            onSelect={(action) => onSelectAgentChatDisplay?.(action)}
            reviewId="codex-spike-toggle"
            triggerClassName="icon-button topbar-mode-toggle"
            triggerIcon={<Bot size={22} />}
          />
        ) : null}
        {documentOrderNavigation ? (
          <div
            className="document-order-navigation"
            aria-label={`${documentOrderNavigation.sourceLabel} document navigation`}
          >
            <button
              type="button"
              className="icon-button topbar-mode-toggle"
              data-review-id="document-order-previous"
              aria-label={`Previous document in ${documentOrderNavigation.sourceLabel} order`}
              title={`Previous document in ${documentOrderNavigation.sourceLabel} order${
                documentOrderNavigation.previous
                  ? `: ${documentOrderNavigation.previous.title}`
                  : ""
              }`}
              disabled={!documentOrderNavigation.previous}
              onClick={() =>
                openDocumentOrderTarget(documentOrderNavigation.previous?.path)
              }
            >
              <ChevronLeft size={17} />
            </button>
            <button
              type="button"
              className="icon-button topbar-mode-toggle"
              data-review-id="document-order-next"
              aria-label={`Next document in ${documentOrderNavigation.sourceLabel} order`}
              title={`Next document in ${documentOrderNavigation.sourceLabel} order${
                documentOrderNavigation.next
                  ? `: ${documentOrderNavigation.next.title}`
                  : ""
              }`}
              disabled={!documentOrderNavigation.next}
              onClick={() =>
                openDocumentOrderTarget(documentOrderNavigation.next?.path)
              }
            >
              <ChevronRight size={17} />
            </button>
          </div>
        ) : null}
        <button
          type="button"
          className={`icon-button topbar-mode-toggle ${
            zenModeActive ? "active" : ""
          }`}
          data-review-id="zen-mode-toggle"
          aria-label={zenModeActive ? "Exit Zen Mode" : "Enter Zen Mode"}
          title={zenModeActive ? "Exit Zen Mode" : "Enter Zen Mode"}
          aria-pressed={zenModeActive}
          onClick={() => dispatchFromTopbar("view.toggleZenMode")}
        >
          <Focus size={17} />
        </button>
        <button
          type="button"
          className={`icon-button topbar-mode-toggle ${
            splitEnabled ? "active" : ""
          }`}
          data-review-id="split-view-toggle"
          aria-label={splitEnabled ? "Close Split View" : "Split View"}
          title={splitEnabled ? "Close Split View" : "Split View"}
          aria-pressed={splitEnabled}
          onClick={() =>
            dispatchFromTopbar(
              splitEnabled ? "view.closeSplit" : "view.splitRight",
            )
          }
        >
          <Columns2 size={17} />
        </button>
        <button
          type="button"
          className="icon-button sidebar-toggle"
          data-review-id="right-sidebar-toggle"
          aria-label="Toggle right sidebar"
          title={
            rightSidebarAvailable
              ? "Toggle right sidebar"
              : "Right sidebar is unavailable while Preferences is open"
          }
          aria-pressed={rightSidebarVisible}
          aria-disabled={!rightSidebarAvailable}
          disabled={!rightSidebarAvailable}
          onClick={() => {
            if (!rightSidebarAvailable) {
              return;
            }
            dispatchFromTopbar("sidebar.toggleRight");
          }}
        >
          <PanelRight size={17} />
        </button>
      </div>
    </header>
  );
}
