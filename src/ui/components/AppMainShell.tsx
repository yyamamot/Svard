import type {
  ComponentProps,
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import { AppOverlays } from "./AppOverlays";
import { LeftSidebar } from "./LeftSidebar";
import { LinkPreviewPopover } from "./LinkPreviewPopover";
import { PreferencesPanel } from "./PreferencesPanel";
import { RightSidebar } from "./RightSidebar";
import { Topbar } from "./Topbar";
import { ViewerPane } from "./ViewerPane";
import { CodexMainSplit } from "./CodexMainSplit";
import type { LinkPreviewState } from "../lib/linkPreview";
import type { PaneId, ViewerPaneSnapshot } from "../types";
import type { MainAgentPanelPlacement } from "../agent/agentPanelTypes";

type ViewerPaneSharedProps = Omit<
  ComponentProps<typeof ViewerPane>,
  "paneId" | "snapshot"
>;

interface AppMainShellProps {
  appShellStyle: CSSProperties;
  className: string;
  effectiveRightSidebarVisible: boolean;
  effectiveSidebarVisible: boolean;
  linkHoverDestination: string | null;
  linkPreview: LinkPreviewState | null;
  preferencesOpen: boolean;
  showLinkHoverStatus: boolean;
  showZenModeExitControl: boolean;
  splitEnabled: boolean;
  codexPanel: ReactNode | null;
  codexPanelOpen: boolean;
  agentPanelPlacement: MainAgentPanelPlacement;
  splitResizeState: unknown;
  topbarHidden: boolean;
  leftSidebarProps: ComponentProps<typeof LeftSidebar>;
  topbarProps: ComponentProps<typeof Topbar>;
  preferencesPanelProps: ComponentProps<typeof PreferencesPanel> | null;
  rightSidebarProps: ComponentProps<typeof RightSidebar> | null;
  rightSidebarResizeActive: boolean;
  overlaysProps: ComponentProps<typeof AppOverlays>;
  viewerPaneProps: ViewerPaneSharedProps;
  paneSnapshots: Record<PaneId, ViewerPaneSnapshot>;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onShellContextMenu: ComponentProps<"div">["onContextMenu"];
  onBeginViewerSplitResize: ComponentProps<"div">["onPointerDown"];
  onUpdateViewerSplitResize: ComponentProps<"div">["onPointerMove"];
  onEndViewerSplitResize: ComponentProps<"div">["onPointerUp"];
  onBeginRightSidebarResize: ComponentProps<"div">["onPointerDown"];
  onResetRightSidebarWidth: () => void;
  onExitZenMode: () => void;
}

export function AppMainShell({
  appShellStyle,
  className,
  effectiveRightSidebarVisible,
  effectiveSidebarVisible,
  linkHoverDestination,
  linkPreview,
  preferencesOpen,
  showLinkHoverStatus,
  showZenModeExitControl,
  splitEnabled,
  codexPanel,
  codexPanelOpen,
  agentPanelPlacement,
  splitResizeState,
  topbarHidden,
  leftSidebarProps,
  topbarProps,
  preferencesPanelProps,
  rightSidebarProps,
  rightSidebarResizeActive,
  overlaysProps,
  viewerPaneProps,
  paneSnapshots,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onShellContextMenu,
  onBeginViewerSplitResize,
  onUpdateViewerSplitResize,
  onEndViewerSplitResize,
  onBeginRightSidebarResize,
  onResetRightSidebarWidth,
  onExitZenMode,
}: AppMainShellProps) {
  function renderViewerPane(paneId: PaneId, snapshot: ViewerPaneSnapshot) {
    return (
      <ViewerPane {...viewerPaneProps} paneId={paneId} snapshot={snapshot} />
    );
  }

  function renderViewerSurface() {
    if (!splitEnabled) {
      return renderViewerPane("left", paneSnapshots.left);
    }
    return (
      <div className="viewer-split" data-review-id="viewer-split">
        {renderViewerPane("left", paneSnapshots.left)}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize split panes"
          className={`viewer-split-resizer ${splitResizeState ? "active" : ""}`}
          data-review-id="viewer-split-resizer"
          onPointerDown={onBeginViewerSplitResize}
          onPointerMove={onUpdateViewerSplitResize}
          onPointerUp={onEndViewerSplitResize}
          onPointerCancel={onEndViewerSplitResize}
        />
        {renderViewerPane("right", paneSnapshots.right)}
      </div>
    );
  }

  return (
    <div
      className={className}
      data-zen-mode-active={
        className.includes("zen-mode-active") ? "true" : undefined
      }
      data-review-id="shell"
      style={appShellStyle}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={onShellContextMenu}
    >
      {effectiveSidebarVisible && <LeftSidebar {...leftSidebarProps} />}

      <main className={`main-column ${topbarHidden ? "topbar-hidden" : ""}`}>
        {!topbarHidden && <Topbar {...topbarProps} />}

        {preferencesPanelProps ? (
          <PreferencesPanel {...preferencesPanelProps} />
        ) : codexPanel ? (
          <CodexMainSplit
            open={codexPanelOpen}
            panel={codexPanel}
            placement={agentPanelPlacement}
            viewer={renderViewerSurface()}
          />
        ) : (
          renderViewerSurface()
        )}
      </main>

      {showZenModeExitControl && (
        <button
          type="button"
          className="zen-mode-exit-control"
          data-review-id="zen-mode-exit-control"
          aria-label="Exit Zen Mode"
          title="Exit Zen Mode"
          onClick={onExitZenMode}
        >
          ×
        </button>
      )}

      {effectiveRightSidebarVisible && preferencesOpen ? (
        <aside
          className="sidebar right preferences-right-sidebar-placeholder"
          data-review-id="preferences-right-sidebar-placeholder"
          aria-hidden="true"
        />
      ) : effectiveRightSidebarVisible && rightSidebarProps ? (
        <aside className="sidebar right" data-review-id="right-sidebar">
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize right sidebar"
            className={`sidebar-resizer right-resizer ${rightSidebarResizeActive ? "active" : ""}`}
            data-review-id="right-sidebar-resizer"
            onPointerDown={onBeginRightSidebarResize}
            onDoubleClick={onResetRightSidebarWidth}
          />
          <RightSidebar {...rightSidebarProps} />
        </aside>
      ) : null}

      <AppOverlays {...overlaysProps} />
      {linkHoverDestination && showLinkHoverStatus && (
        <div className="link-hover-status" data-review-id="link-hover-status">
          {linkHoverDestination}
        </div>
      )}
      <LinkPreviewPopover preview={linkPreview} />
    </div>
  );
}
