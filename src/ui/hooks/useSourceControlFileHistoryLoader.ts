import { useEffect } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";

import { isSupportedDocumentPath } from "../../core/documentFormat";
import type {
  GitChanges,
  GitFileHistory,
  HostAdapter,
  WorkspacePerformanceMode,
} from "../../core/types";
import { perfDuration, perfNow, tracePerf } from "../lib/perfTrace";
import type { SourceControlRequests } from "./sourceControlRequests";
import { sourceControlInitialHistoryLimit } from "./sourceControlRequests";
import {
  scheduleAfterDocumentPaint,
  scheduleDebouncedSourceControlRefresh,
  type SourceControlTimerRefs,
} from "./sourceControlScheduling";
import { setSourceControlPayload } from "./sourceControlPayload";
import type { GitFileHistoryGitStateEntry } from "./sourceControlState";

export function useSourceControlFileHistoryLoader({
  effectiveGitTimelinePath,
  gitTimelineRefreshToken,
  host,
  isFileHistoryView,
  requestsRef,
  setGitTimelineHistory,
  setGitFileHistoryGitState,
  setGitTimelineLoading,
  setGitTimelineRefreshToken,
  sourceControlAnchorPath,
  timers,
  workspaceSidebarTab,
  workspacePerformanceMode,
}: {
  effectiveGitTimelinePath: string | null;
  gitTimelineRefreshToken: number;
  host: HostAdapter;
  isFileHistoryView: boolean;
  requestsRef: RefObject<SourceControlRequests>;
  setGitTimelineHistory: Dispatch<SetStateAction<GitFileHistory | null>>;
  setGitFileHistoryGitState: Dispatch<
    SetStateAction<GitFileHistoryGitStateEntry | null>
  >;
  setGitTimelineLoading: (value: boolean) => void;
  setGitTimelineRefreshToken: Dispatch<SetStateAction<number>>;
  sourceControlAnchorPath: string;
  timers: SourceControlTimerRefs;
  workspaceSidebarTab: string;
  workspacePerformanceMode?: WorkspacePerformanceMode;
}) {
  const isWslMitigated = workspacePerformanceMode === "wsl-mitigated";

  function scheduleSourceControlRefresh() {
    scheduleDebouncedSourceControlRefresh(timers.refreshTimerRef, () =>
      setGitTimelineRefreshToken((token) => token + 1),
    );
  }

  useEffect(() => {
    if (!isFileHistoryView) {
      return;
    }
    if (
      !effectiveGitTimelinePath ||
      !isSupportedDocumentPath(effectiveGitTimelinePath)
    ) {
      setGitFileHistoryGitState(null);
      setGitTimelineHistory(
        effectiveGitTimelinePath
          ? {
              status: "unsupported",
              relativePath: null,
              items: [],
              message: "File History is available for markup documents only.",
            }
          : null,
      );
      setGitTimelineLoading(false);
      return;
    }
    let cancelled = false;
    const path = effectiveGitTimelinePath;
    const gitStateRequest = requestsRef.current.getOrStartGitChangesRequest(
      path,
      "file-history-header",
    );
    if (gitStateRequest.cached) {
      setGitFileHistoryGitState({
        path,
        changes: gitStateRequest.cached,
      });
    } else {
      setGitFileHistoryGitState(null);
    }
    gitStateRequest.request
      .then((changes: GitChanges) => {
        requestsRef.current.setGitChangesCache(path, changes);
        if (!cancelled) {
          setGitFileHistoryGitState({ path, changes });
        }
      })
      .catch(() => {
        if (!cancelled && !gitStateRequest.cached) {
          setGitFileHistoryGitState(null);
        }
      });
    const cached = requestsRef.current.getGitFileHistoryCache(path);
    if (cached) {
      setSourceControlPayload(setGitTimelineHistory, cached);
      tracePerf("sourceControl.getGitFileHistory.cacheHit", {
        key: "fileHistory",
        count: cached.items.length,
      });
    } else {
      setGitTimelineHistory(null);
    }
    setGitTimelineLoading(!cached);
    tracePerf("sourceControl.getGitFileHistory.deferred", {
      key: "fileHistory",
      cached: Boolean(cached),
    });
    const cancelScheduled = scheduleAfterDocumentPaint(() => {
      if (cancelled) {
        return;
      }
      const startedAt = perfNow();
      const { deduped, request } =
        requestsRef.current.getOrStartGitFileHistoryRequest(
          path,
          sourceControlInitialHistoryLimit,
        );
      request
        .then((history) => {
          tracePerf("sourceControl.getGitFileHistory.initial", {
            status: history.status,
            limit: sourceControlInitialHistoryLimit,
            count: history.items.length,
            hasMore: history.hasMore,
            cacheStatus: history.metrics?.cacheStatus,
            walkedCommits: history.metrics?.walkedCommits,
            durationMs: perfDuration(startedAt),
          });
          tracePerf("sourceControl.getGitFileHistory", {
            status: history.status,
            count: history.items.length,
            cacheStatus: history.metrics?.cacheStatus,
            walkedCommits: history.metrics?.walkedCommits,
            matchedCommits: history.metrics?.matchedCommits,
            backendDurationMs: history.metrics?.durationMs,
            backendWalkMs: history.metrics?.walkMs,
            backendBlobLookupMs: history.metrics?.blobLookupMs,
            deduped,
            stale: Boolean(cached),
            durationMs: perfDuration(startedAt),
          });
          requestsRef.current.setGitFileHistoryCache(path, history);
          if (!cancelled) {
            setSourceControlPayload(setGitTimelineHistory, history);
          }
        })
        .catch((error) => {
          tracePerf("sourceControl.getGitFileHistory.failed", {
            deduped,
            stale: Boolean(cached),
            durationMs: perfDuration(startedAt),
            message:
              error instanceof Error ? error.message : "File history failed",
          });
          if (!cancelled) {
            const nextHistory: GitFileHistory = {
              status: "error",
              relativePath: null,
              items: [],
              message:
                error instanceof Error
                  ? error.message
                  : "File history failed to load.",
            };
            if (!cached) {
              setSourceControlPayload(setGitTimelineHistory, nextHistory);
            }
          }
        })
        .finally(() => {
          if (!cancelled) {
            setGitTimelineLoading(false);
          }
        });
    });
    return () => {
      cancelled = true;
      cancelScheduled();
    };
  }, [
    effectiveGitTimelinePath,
    gitTimelineRefreshToken,
    host,
    isFileHistoryView,
    requestsRef,
    setGitFileHistoryGitState,
    setGitTimelineHistory,
    setGitTimelineLoading,
  ]);

  useEffect(() => {
    if (
      !isFileHistoryView ||
      !effectiveGitTimelinePath ||
      !isSupportedDocumentPath(effectiveGitTimelinePath)
    ) {
      return;
    }
    if (isWslMitigated) {
      tracePerf("sourceControl.watchGitStatus.skipped", {
        mode: "wsl-mitigated",
        reason: "file-history",
      });
      return;
    }
    let disposed = false;
    let handle: { dispose(): void } | null = null;
    host
      .watchGitStatus(
        [effectiveGitTimelinePath],
        () => {
          if (!disposed) {
            scheduleSourceControlRefresh();
          }
        },
        () => {},
      )
      .then((watchHandle) => {
        if (disposed) {
          watchHandle.dispose();
          return;
        }
        handle = watchHandle;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      handle?.dispose();
    };
  }, [effectiveGitTimelinePath, host, isFileHistoryView, isWslMitigated]);

  useEffect(() => {
    if (workspaceSidebarTab !== "sourceControl" || !sourceControlAnchorPath) {
      return;
    }
    if (isWslMitigated) {
      tracePerf("sourceControl.watchGitStatus.skipped", {
        mode: "wsl-mitigated",
        reason: "source-control-visible",
      });
      return;
    }
    let disposed = false;
    let handle: { dispose(): void } | null = null;
    host
      .watchGitStatus(
        [sourceControlAnchorPath],
        () => {
          if (!disposed) {
            scheduleSourceControlRefresh();
          }
        },
        () => {},
      )
      .then((watchHandle) => {
        if (disposed) {
          watchHandle.dispose();
          return;
        }
        handle = watchHandle;
      })
      .catch(() => {});
    return () => {
      disposed = true;
      handle?.dispose();
    };
  }, [host, isWslMitigated, sourceControlAnchorPath, workspaceSidebarTab]);
}
