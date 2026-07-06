import type { ComponentProps } from "react";

import type { AppConfig } from "../../core/types";
import type { LeftSidebar } from "../components/LeftSidebar";

type LeftSidebarProps = ComponentProps<typeof LeftSidebar>;

export function buildLeftSidebarSourceControlProps({
  effectiveGitTimelinePath,
  gitBranchDiff,
  gitBranchDiffLoading,
  gitChanges,
  gitChangesLoading,
  gitCommitGraph,
  gitCommitGraphLoading,
  gitCommitGraphLoadingMore,
  gitTimelineCompareBase,
  gitTimelineHistory,
  gitTimelineLoading,
  gitTimelineLoadingMore,
  loadMoreGitCommitGraph,
  loadMoreGitFileHistory,
  openGitBranchDiffItem,
  openSourceControlBranchDiffContextMenu,
  openSourceControlChange,
  openSourceControlChangeContextMenu,
  openSourceControlAllDiffs,
  openSourceControlGraphContextMenu,
  openSourceControlGraphItem,
  openTimelineChanges,
  openTimelineItemContextMenu,
  setSourceControlBranchDiffBaseRef,
  setSourceControlGraphScope,
  setSourceControlView,
  showGitDiff,
  config,
}: {
  config: AppConfig | null;
  effectiveGitTimelinePath: LeftSidebarProps["gitTimelinePath"];
  gitBranchDiff: LeftSidebarProps["gitBranchDiff"];
  gitBranchDiffLoading: LeftSidebarProps["gitBranchDiffLoading"];
  gitChanges: LeftSidebarProps["gitChanges"];
  gitChangesLoading: LeftSidebarProps["gitChangesLoading"];
  gitCommitGraph: LeftSidebarProps["gitCommitGraph"];
  gitCommitGraphLoading: LeftSidebarProps["gitCommitGraphLoading"];
  gitCommitGraphLoadingMore: LeftSidebarProps["gitCommitGraphLoadingMore"];
  gitTimelineCompareBase: { revision: string } | null;
  gitTimelineHistory: LeftSidebarProps["gitTimelineHistory"];
  gitTimelineLoading: LeftSidebarProps["gitTimelineLoading"];
  gitTimelineLoadingMore: LeftSidebarProps["gitTimelineLoadingMore"];
  loadMoreGitCommitGraph: () => Promise<void>;
  loadMoreGitFileHistory: () => Promise<void>;
  openGitBranchDiffItem: LeftSidebarProps["onOpenBranchDiffItem"];
  openSourceControlBranchDiffContextMenu: LeftSidebarProps["onSourceControlBranchDiffContextMenu"];
  openSourceControlChange: LeftSidebarProps["onOpenSourceControlChange"];
  openSourceControlChangeContextMenu: LeftSidebarProps["onSourceControlChangeContextMenu"];
  openSourceControlAllDiffs: LeftSidebarProps["onOpenAllDiffs"];
  openSourceControlGraphContextMenu: LeftSidebarProps["onSourceControlGraphContextMenu"];
  openSourceControlGraphItem: LeftSidebarProps["onOpenSourceControlGraphItem"];
  openTimelineChanges: LeftSidebarProps["onOpenTimelineChanges"];
  openTimelineItemContextMenu: LeftSidebarProps["onTimelineItemContextMenu"];
  setSourceControlBranchDiffBaseRef: (
    baseRef: Parameters<
      LeftSidebarProps["onSelectSourceControlBranchDiffBase"]
    >[0],
  ) => Promise<void>;
  setSourceControlGraphScope: (
    scope: Parameters<LeftSidebarProps["onSelectSourceControlGraphScope"]>[0],
  ) => Promise<void>;
  setSourceControlView: (
    view: Parameters<LeftSidebarProps["onSelectSourceControlView"]>[0],
  ) => Promise<void>;
  showGitDiff: LeftSidebarProps["onOpenGitDiff"];
}) {
  const sourceControlView = config?.workspace.sourceControlView ?? "changes";
  const sourceControlGraphScope =
    config?.workspace.sourceControlGraphScope ?? "repository";
  return {
    gitChanges,
    gitChangesLoading,
    gitBranchDiff,
    gitBranchDiffLoading,
    gitCommitGraph,
    gitCommitGraphLoading,
    gitCommitGraphLoadingMore,
    gitTimelineHistory,
    gitTimelineLoading,
    gitTimelineLoadingMore,
    gitTimelinePath: effectiveGitTimelinePath,
    selectedTimelineRevision: gitTimelineCompareBase?.revision ?? null,
    sourceControlView,
    sourceControlGraphScope,
    onLoadMoreGitCommitGraph: () => void loadMoreGitCommitGraph(),
    onLoadMoreGitFileHistory: () => void loadMoreGitFileHistory(),
    onOpenBranchDiffItem: openGitBranchDiffItem,
    onOpenGitDiff: showGitDiff,
    onSelectSourceControlView: (view) => void setSourceControlView(view),
    onSelectSourceControlBranchDiffBase: (baseRef) =>
      void setSourceControlBranchDiffBaseRef(baseRef),
    onSelectSourceControlGraphScope: (scope) =>
      void setSourceControlGraphScope(scope),
    onOpenTimelineChanges: openTimelineChanges,
    onOpenSourceControlChange: openSourceControlChange,
    onOpenAllDiffs: openSourceControlAllDiffs,
    onOpenSourceControlGraphItem: openSourceControlGraphItem,
    onSourceControlChangeContextMenu: openSourceControlChangeContextMenu,
    onSourceControlBranchDiffContextMenu:
      openSourceControlBranchDiffContextMenu,
    onSourceControlGraphContextMenu: openSourceControlGraphContextMenu,
    onTimelineItemContextMenu: openTimelineItemContextMenu,
  } satisfies Partial<LeftSidebarProps>;
}
