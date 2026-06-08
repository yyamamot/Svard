import { useEffect } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";

import type { AppConfig, GitBranchDiff, HostAdapter } from "../../core/types";
import { perfDuration, perfNow, tracePerf } from "../lib/perfTrace";
import type { SourceControlRequests } from "./sourceControlRequests";
import { setSourceControlPayload } from "./sourceControlPayload";

export function useSourceControlBranchDiffLoader({
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
}: {
  config: AppConfig | null;
  gitTimelineRefreshToken: number;
  host: HostAdapter;
  persistWorkspaceRef: RefObject<
    (patch: Partial<AppConfig["workspace"]>) => Promise<void>
  >;
  requestsRef: RefObject<SourceControlRequests>;
  setGitBranchDiff: Dispatch<SetStateAction<GitBranchDiff | null>>;
  setGitBranchDiffLoading: (value: boolean) => void;
  sourceControlAnchorPath: string;
  workspaceSidebarTab: AppConfig["workspace"]["sidebarTab"];
  workspaceSourceControlBranchDiffBaseRef: string | null;
  workspaceSourceControlView: AppConfig["workspace"]["sourceControlView"];
}) {
  useEffect(() => {
    if (
      workspaceSidebarTab !== "sourceControl" ||
      workspaceSourceControlView !== "branchDiff" ||
      !sourceControlAnchorPath
    ) {
      return;
    }
    let cancelled = false;
    const cacheKey = `branch:${sourceControlAnchorPath}:${workspaceSourceControlBranchDiffBaseRef ?? ""}:HEAD`;
    const cached = requestsRef.current.getBranchDiffCache(cacheKey);
    if (cached) {
      setSourceControlPayload(setGitBranchDiff, cached);
      tracePerf("sourceControl.getGitBranchDiff.cacheHit", {
        key: "branchDiff",
        count: cached.items.length,
      });
    }
    setGitBranchDiffLoading(!cached);
    const startedAt = perfNow();
    const { deduped, request } =
      requestsRef.current.getOrStartBranchDiffRequest(cacheKey, () =>
        host.getGitBranchDiff(sourceControlAnchorPath, {
          baseRef: workspaceSourceControlBranchDiffBaseRef,
          headRef: "HEAD",
          remoteProviders: config?.remoteProviders ?? null,
          network: config?.network ?? null,
        }),
      );
    request
      .then((branchDiff) => {
        tracePerf("sourceControl.getGitBranchDiff", {
          status: branchDiff.status,
          count: branchDiff.items.length,
          deduped,
          stale: Boolean(cached),
          durationMs: perfDuration(startedAt),
        });
        if (!cancelled) {
          requestsRef.current.setBranchDiffCache(cacheKey, branchDiff);
          setSourceControlPayload(setGitBranchDiff, branchDiff);
          if (
            branchDiff.status === "ok" &&
            branchDiff.baseRef &&
            branchDiff.baseRef !== workspaceSourceControlBranchDiffBaseRef
          ) {
            void persistWorkspaceRef.current({
              sourceControlBranchDiffBaseRef: branchDiff.baseRef,
            });
          }
        }
      })
      .catch((error) => {
        tracePerf("sourceControl.getGitBranchDiff.failed", {
          durationMs: perfDuration(startedAt),
          message:
            error instanceof Error ? error.message : "Branch Diff failed",
        });
        if (!cancelled) {
          const nextBranchDiff: GitBranchDiff = {
            status: "error",
            repositoryRoot: null,
            currentBranch: null,
            headCommit: null,
            baseRef: null,
            headRef: "HEAD",
            mergeBase: null,
            baseCandidates: [],
            items: [],
            message:
              error instanceof Error
                ? error.message
                : "Branch Diff failed to load.",
          };
          if (!cached) {
            setSourceControlPayload(setGitBranchDiff, nextBranchDiff);
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          setGitBranchDiffLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
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
  ]);
}
