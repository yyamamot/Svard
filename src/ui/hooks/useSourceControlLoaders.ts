import { useEffect } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";

import type {
  AppConfig,
  GitBranchDiff,
  GitChanges,
  GitCommitDetails,
  GitCommitGraph,
  GitCommitGraphScope,
  GitFileHistory,
  GitFileHistoryItem,
  HostAdapter,
  WorkspacePerformanceMode,
} from "../../core/types";
import { SourceControlRequests } from "./sourceControlRequests";
import {
  cancelAllSourceControlTimers,
  type SourceControlTimerRefs,
} from "./sourceControlScheduling";
import { useSourceControlBranchDiffLoader } from "./useSourceControlBranchDiffLoader";
import {
  sourceControlWslVisibleRetryDelayMs,
  useSourceControlChangesLoader,
} from "./useSourceControlChangesLoader";
import { useSourceControlFileHistoryLoader } from "./useSourceControlFileHistoryLoader";
import { useSourceControlGraphLoader } from "./useSourceControlGraphLoader";

export { sourceControlWslVisibleRetryDelayMs };
export {
  sourceControlPayloadEqual,
  sourceControlPayloadSignature,
} from "./sourceControlPayload";

export function useSourceControlLoaders({
  config,
  effectiveGitTimelinePath,
  gitTimelineRefreshToken,
  host,
  isFileHistoryView,
  isRepoGraphView,
  onGitRefresh,
  persistWorkspaceRef,
  requestsRef,
  rootDirectory,
  rootDirectoryRef,
  setGitBranchDiff,
  setGitBranchDiffLoading,
  setGitChanges,
  setGitChangesLoading,
  setGitCommitDetails,
  setGitCommitGraph,
  setGitCommitGraphLoading,
  setGitTimelineCompareBase,
  setGitTimelineHistory,
  setGitTimelineLoading,
  setGitTimelineRefreshToken,
  setWorkspaceSidebarTab,
  setWorkspaceSourceControlBranchDiffBaseRef,
  setWorkspaceSourceControlGraphScope,
  setWorkspaceSourceControlView,
  sourceControlAnchorPath,
  timers,
  workspaceSidebarTab,
  workspacePerformanceMode,
  workspaceSourceControlBranchDiffBaseRef,
  workspaceSourceControlGraphScope,
  workspaceSourceControlView,
}: {
  config: AppConfig | null;
  effectiveGitTimelinePath: string | null;
  gitTimelineRefreshToken: number;
  host: HostAdapter;
  isFileHistoryView: boolean;
  isRepoGraphView: boolean;
  onGitRefresh?: (reason: string) => void;
  persistWorkspaceRef: RefObject<
    (patch: Partial<AppConfig["workspace"]>) => Promise<void>
  >;
  requestsRef: RefObject<SourceControlRequests>;
  rootDirectory: string;
  rootDirectoryRef: RefObject<string>;
  setGitBranchDiff: Dispatch<SetStateAction<GitBranchDiff | null>>;
  setGitBranchDiffLoading: (value: boolean) => void;
  setGitChanges: Dispatch<SetStateAction<GitChanges | null>>;
  setGitChangesLoading: (value: boolean) => void;
  setGitCommitDetails: (value: GitCommitDetails | null) => void;
  setGitCommitGraph: Dispatch<SetStateAction<GitCommitGraph | null>>;
  setGitCommitGraphLoading: (value: boolean) => void;
  setGitTimelineCompareBase: (value: GitFileHistoryItem | null) => void;
  setGitTimelineHistory: Dispatch<SetStateAction<GitFileHistory | null>>;
  setGitTimelineLoading: (value: boolean) => void;
  setGitTimelineRefreshToken: Dispatch<SetStateAction<number>>;
  setWorkspaceSidebarTab: (value: AppConfig["workspace"]["sidebarTab"]) => void;
  setWorkspaceSourceControlBranchDiffBaseRef: (value: string | null) => void;
  setWorkspaceSourceControlGraphScope: (value: GitCommitGraphScope) => void;
  setWorkspaceSourceControlView: (
    value: AppConfig["workspace"]["sourceControlView"],
  ) => void;
  sourceControlAnchorPath: string;
  timers: SourceControlTimerRefs;
  workspaceSidebarTab: AppConfig["workspace"]["sidebarTab"];
  workspacePerformanceMode?: WorkspacePerformanceMode;
  workspaceSourceControlBranchDiffBaseRef: string | null;
  workspaceSourceControlGraphScope: GitCommitGraphScope;
  workspaceSourceControlView: AppConfig["workspace"]["sourceControlView"];
}): { refreshGitChanges: (reason?: string) => void } {
  useEffect(() => {
    requestsRef.current = new SourceControlRequests(host);
  }, [host, requestsRef]);

  useEffect(() => {
    rootDirectoryRef.current = rootDirectory;
  }, [rootDirectory, rootDirectoryRef]);

  useEffect(() => {
    return () => {
      cancelAllSourceControlTimers({
        refreshTimerRef: timers.refreshTimerRef,
        idleWarmDelayRef: timers.idleWarmDelayRef,
        idleWarmHandleRef: timers.idleWarmHandleRef,
        silentRefreshTimerRef: timers.silentRefreshTimerRef,
      });
    };
  }, [timers]);

  useEffect(() => {
    setWorkspaceSidebarTab(config?.workspace.sidebarTab ?? "files");
    setWorkspaceSourceControlView(
      config?.workspace.sourceControlView ?? "changes",
    );
    setWorkspaceSourceControlGraphScope(
      config?.workspace.sourceControlGraphScope ?? "repository",
    );
    setWorkspaceSourceControlBranchDiffBaseRef(
      config?.workspace.sourceControlBranchDiffBaseRef ?? null,
    );
  }, [
    config,
    setWorkspaceSidebarTab,
    setWorkspaceSourceControlBranchDiffBaseRef,
    setWorkspaceSourceControlGraphScope,
    setWorkspaceSourceControlView,
  ]);

  useEffect(() => {
    setGitChanges(null);
    setGitBranchDiff(null);
    setGitCommitGraph(null);
    setGitTimelineHistory(null);
    setGitCommitDetails(null);
  }, [
    setGitBranchDiff,
    setGitChanges,
    setGitCommitDetails,
    setGitCommitGraph,
    setGitTimelineHistory,
    sourceControlAnchorPath,
  ]);

  useEffect(() => {
    setGitTimelineCompareBase(null);
    setGitCommitDetails(null);
  }, [
    effectiveGitTimelinePath,
    setGitCommitDetails,
    setGitTimelineCompareBase,
  ]);

  const { refreshGitChanges } = useSourceControlChangesLoader({
    gitTimelineRefreshToken,
    host,
    onGitRefresh,
    requestsRef,
    rootDirectory,
    rootDirectoryRef,
    setGitChanges,
    setGitChangesLoading,
    sourceControlAnchorPath,
    timers,
    workspaceSidebarTab,
    workspacePerformanceMode,
    workspaceSourceControlView,
  });

  useSourceControlBranchDiffLoader({
    config,
    gitTimelineRefreshToken,
    host,
    persistWorkspaceRef,
    requestsRef,
    setGitBranchDiff,
    setGitBranchDiffLoading,
    sourceControlAnchorPath,
    workspaceSidebarTab,
    workspaceSourceControlBranchDiffBaseRef,
    workspaceSourceControlView,
  });

  useSourceControlGraphLoader({
    gitTimelineRefreshToken,
    host,
    isRepoGraphView,
    setGitCommitGraph,
    setGitCommitGraphLoading,
    sourceControlAnchorPath,
    workspaceSourceControlGraphScope,
  });

  useSourceControlFileHistoryLoader({
    effectiveGitTimelinePath,
    gitTimelineRefreshToken,
    host,
    isFileHistoryView,
    requestsRef,
    setGitTimelineHistory,
    setGitTimelineLoading,
    setGitTimelineRefreshToken,
    sourceControlAnchorPath,
    timers,
    workspaceSidebarTab,
    workspacePerformanceMode,
  });

  return { refreshGitChanges };
}
