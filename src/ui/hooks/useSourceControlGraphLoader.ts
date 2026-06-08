import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";

import type {
  GitCommitGraph,
  GitCommitGraphScope,
  HostAdapter,
} from "../../core/types";
import { perfDuration, perfNow, tracePerf } from "../lib/perfTrace";
import { sourceControlInitialHistoryLimit } from "./sourceControlRequests";
import { setSourceControlPayload } from "./sourceControlPayload";

export function useSourceControlGraphLoader({
  gitTimelineRefreshToken,
  host,
  isRepoGraphView,
  setGitCommitGraph,
  setGitCommitGraphLoading,
  sourceControlAnchorPath,
  workspaceSourceControlGraphScope,
}: {
  gitTimelineRefreshToken: number;
  host: HostAdapter;
  isRepoGraphView: boolean;
  setGitCommitGraph: Dispatch<SetStateAction<GitCommitGraph | null>>;
  setGitCommitGraphLoading: (value: boolean) => void;
  sourceControlAnchorPath: string;
  workspaceSourceControlGraphScope: GitCommitGraphScope;
}) {
  useEffect(() => {
    if (!isRepoGraphView || !sourceControlAnchorPath) {
      return;
    }
    let cancelled = false;
    setGitCommitGraphLoading(true);
    setGitCommitGraph(null);
    const startedAt = perfNow();
    host
      .getGitCommitGraph(sourceControlAnchorPath, {
        scope: "repository",
        path: null,
        limit: sourceControlInitialHistoryLimit,
      })
      .then((graph) => {
        tracePerf("sourceControl.getGitCommitGraph.initial", {
          status: graph.status,
          scope: graph.scope,
          limit: sourceControlInitialHistoryLimit,
          count: graph.items.length,
          hasMore: graph.hasMore,
          walkedCommits: graph.metrics?.walkedCommits,
          cacheStatus: graph.metrics?.cacheStatus,
          durationMs: perfDuration(startedAt),
        });
        tracePerf("sourceControl.getGitCommitGraph", {
          status: graph.status,
          scope: graph.scope,
          count: graph.items.length,
          durationMs: perfDuration(startedAt),
        });
        if (!cancelled) {
          setSourceControlPayload(setGitCommitGraph, graph);
        }
      })
      .catch((error) => {
        tracePerf("sourceControl.getGitCommitGraph.failed", {
          scope: workspaceSourceControlGraphScope,
          durationMs: perfDuration(startedAt),
          message: error instanceof Error ? error.message : "Git graph failed",
        });
        if (!cancelled) {
          setSourceControlPayload(setGitCommitGraph, {
            status: "error",
            scope: workspaceSourceControlGraphScope,
            repositoryRoot: null,
            relativePath: null,
            currentBranch: null,
            headCommit: null,
            items: [],
            message:
              error instanceof Error
                ? error.message
                : "Git graph failed to load.",
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setGitCommitGraphLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    gitTimelineRefreshToken,
    host,
    isRepoGraphView,
    setGitCommitGraph,
    setGitCommitGraphLoading,
    sourceControlAnchorPath,
    workspaceSourceControlGraphScope,
  ]);
}
