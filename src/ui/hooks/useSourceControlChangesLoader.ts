import { useCallback, useEffect } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";

import type {
  GitChanges,
  HostAdapter,
  WorkspacePerformanceMode,
} from "../../core/types";
import { perfDuration, perfNow, tracePerf } from "../lib/perfTrace";
import type { SourceControlRequests } from "./sourceControlRequests";
import {
  cancelScheduledSourceControlIdleWork,
  scheduleIdleSourceControlRefresh,
  sourceControlChangesCacheStaleMs,
  sourceControlIdleWarmDelayMs,
  type SourceControlTimerRefs,
} from "./sourceControlScheduling";
import { setSourceControlPayload } from "./sourceControlPayload";

export const sourceControlWslVisibleRetryDelayMs = 500;

export function useSourceControlChangesLoader({
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
}: {
  gitTimelineRefreshToken: number;
  host: HostAdapter;
  onGitRefresh?: (reason: string) => void;
  requestsRef: RefObject<SourceControlRequests>;
  rootDirectory: string;
  rootDirectoryRef: RefObject<string>;
  setGitChanges: Dispatch<SetStateAction<GitChanges | null>>;
  setGitChangesLoading: (value: boolean) => void;
  sourceControlAnchorPath: string;
  timers: SourceControlTimerRefs;
  workspaceSidebarTab: string;
  workspacePerformanceMode?: WorkspacePerformanceMode;
  workspaceSourceControlView: string;
}): { refreshGitChanges: (reason?: string) => void } {
  const isWslMitigated = workspacePerformanceMode === "wsl-mitigated";

  const runSilentGitChangesRefresh = useCallback(
    (anchorPath: string, reason: string) => {
      const cached = requestsRef.current.getGitChangesCache(anchorPath);
      const startedAt = perfNow();
      const ageMs = requestsRef.current.gitChangesCacheAgeMs(anchorPath);
      const { deduped, request } =
        requestsRef.current.getOrStartGitChangesRequest(anchorPath, reason);
      tracePerf("sourceControl.getGitChanges.silentRefresh.start", {
        ageMs,
        deduped,
        reason,
      });
      request
        .then((changes) => {
          tracePerf("sourceControl.getGitChanges", {
            status: changes.status,
            count: changes.items.length,
            ageMs,
            deduped,
            stale: Boolean(cached),
            reason,
            durationMs: perfDuration(startedAt),
          });
          requestsRef.current.setGitChangesCache(anchorPath, changes);
          if (anchorPath === rootDirectoryRef.current) {
            setSourceControlPayload(setGitChanges, changes);
          }
        })
        .catch((error) => {
          tracePerf("sourceControl.getGitChanges.failed", {
            ageMs,
            durationMs: perfDuration(startedAt),
            reason,
            message:
              error instanceof Error ? error.message : "Git changes failed",
          });
        });
    },
    [requestsRef, rootDirectoryRef, setGitChanges],
  );

  const scheduleSilentGitChangesRefresh = useCallback(
    (
      anchorPath: string,
      reason: string,
      options: { delayMs?: number; skipIfCached?: boolean } = {},
    ) => {
      scheduleIdleSourceControlRefresh(
        {
          refreshTimerRef: timers.refreshTimerRef,
          idleWarmDelayRef: timers.idleWarmDelayRef,
          idleWarmHandleRef: timers.idleWarmHandleRef,
          silentRefreshTimerRef: timers.silentRefreshTimerRef,
        },
        () => {
          if (
            options.skipIfCached &&
            requestsRef.current.hasGitChangesCache(anchorPath)
          ) {
            return;
          }
          runSilentGitChangesRefresh(anchorPath, reason);
        },
        { delayMs: options.delayMs },
      );
    },
    [requestsRef, runSilentGitChangesRefresh, timers],
  );

  const refreshGitChanges = useCallback(
    (reason = "manual-refresh") => {
      const anchorPath = sourceControlAnchorPath;
      if (!anchorPath) {
        return;
      }
      onGitRefresh?.(reason);
      const startedAt = perfNow();
      const { deduped, request } =
        requestsRef.current.getOrStartGitChangesRequest(anchorPath, reason);
      request
        .then((changes) => {
          tracePerf("sourceControl.getGitChanges", {
            status: changes.status,
            count: changes.items.length,
            deduped,
            reason,
            durationMs: perfDuration(startedAt),
          });
          requestsRef.current.setGitChangesCache(anchorPath, changes);
          if (anchorPath === sourceControlAnchorPath) {
            setGitChanges(changes);
          }
        })
        .catch((error) => {
          tracePerf("sourceControl.getGitChanges.failed", {
            durationMs: perfDuration(startedAt),
            reason,
            message:
              error instanceof Error ? error.message : "Git changes failed",
          });
        });
    },
    [onGitRefresh, requestsRef, setGitChanges, sourceControlAnchorPath],
  );

  useEffect(() => {
    if (
      workspaceSidebarTab !== "sourceControl" ||
      workspaceSourceControlView !== "changes" ||
      !sourceControlAnchorPath
    ) {
      return;
    }
    let cancelled = false;
    let retryTimer: number | null = null;
    const { cached, deduped, request } =
      requestsRef.current.getOrStartGitChangesRequest(
        sourceControlAnchorPath,
        "visible",
      );
    if (cached) {
      setSourceControlPayload(setGitChanges, cached);
      tracePerf("sourceControl.getGitChanges.cacheHit", {
        key: "changes",
        count: cached.items.length,
        reason: "visible",
      });
    }
    setGitChangesLoading(!cached);
    const startedAt = perfNow();

    const finishWithChanges = (
      changes: GitChanges,
      options: {
        deduped: boolean;
        reason: string;
        stale: boolean;
        startedAt: number;
      },
    ) => {
      tracePerf("sourceControl.getGitChanges", {
        status: changes.status,
        count: changes.items.length,
        deduped: options.deduped,
        stale: options.stale,
        reason: options.reason,
        durationMs: perfDuration(options.startedAt),
      });
      if (!cancelled) {
        requestsRef.current.setGitChangesCache(
          sourceControlAnchorPath,
          changes,
        );
        setSourceControlPayload(setGitChanges, changes);
      }
    };

    const finishWithError = (
      error: unknown,
      options: { reason: string; startedAt: number },
    ) => {
      tracePerf("sourceControl.getGitChanges.failed", {
        durationMs: perfDuration(options.startedAt),
        reason: options.reason,
        message: error instanceof Error ? error.message : "Git changes failed",
      });
      if (!cancelled) {
        const nextChanges: GitChanges = {
          status: "error",
          repositoryRoot: null,
          currentBranch: null,
          headCommit: null,
          items: [],
          message:
            error instanceof Error
              ? error.message
              : "Git changes failed to load.",
        };
        if (!cached) {
          setSourceControlPayload(setGitChanges, nextChanges);
        }
      }
    };

    const runWslRetry = () => {
      const retryStartedAt = perfNow();
      const retry = requestsRef.current.getOrStartGitChangesRequest(
        sourceControlAnchorPath,
        "visible-wsl-retry",
      );
      retry.request
        .then((changes) => {
          finishWithChanges(changes, {
            deduped: retry.deduped,
            reason: "visible-wsl-retry",
            stale: Boolean(cached),
            startedAt: retryStartedAt,
          });
        })
        .catch((error) => {
          finishWithError(error, {
            reason: "visible-wsl-retry",
            startedAt: retryStartedAt,
          });
        })
        .finally(() => {
          if (!cancelled) {
            setGitChangesLoading(false);
          }
        });
    };

    const scheduleWslRetry = () => {
      cancelScheduledSourceControlIdleWork({
        refreshTimerRef: timers.refreshTimerRef,
        idleWarmDelayRef: timers.idleWarmDelayRef,
        idleWarmHandleRef: timers.idleWarmHandleRef,
        silentRefreshTimerRef: timers.silentRefreshTimerRef,
      });
      tracePerf("sourceControl.getGitChanges.wslRetryScheduled", {
        delayMs: sourceControlWslVisibleRetryDelayMs,
        reason: "visible",
      });
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        runWslRetry();
      }, sourceControlWslVisibleRetryDelayMs);
    };

    request
      .then((changes) => {
        if (isWslMitigated && changes.status === "not-in-repo") {
          tracePerf("sourceControl.getGitChanges", {
            status: changes.status,
            count: changes.items.length,
            deduped,
            stale: Boolean(cached),
            reason: "visible",
            durationMs: perfDuration(startedAt),
          });
          if (!cancelled) {
            scheduleWslRetry();
          }
          return;
        }
        finishWithChanges(changes, {
          deduped,
          reason: "visible",
          stale: Boolean(cached),
          startedAt,
        });
      })
      .catch((error) => {
        if (isWslMitigated) {
          tracePerf("sourceControl.getGitChanges.failed", {
            durationMs: perfDuration(startedAt),
            reason: "visible",
            message:
              error instanceof Error ? error.message : "Git changes failed",
          });
          if (!cancelled) {
            scheduleWslRetry();
          }
          return;
        }
        finishWithError(error, { reason: "visible", startedAt });
      })
      .finally(() => {
        if (!cancelled && retryTimer === null) {
          setGitChangesLoading(false);
        }
      });
    return () => {
      cancelled = true;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
      }
    };
  }, [
    gitTimelineRefreshToken,
    isWslMitigated,
    requestsRef,
    setGitChanges,
    setGitChangesLoading,
    sourceControlAnchorPath,
    timers,
    workspaceSidebarTab,
    workspaceSourceControlView,
  ]);

  useEffect(() => {
    const warmPath = rootDirectory;
    if (!warmPath) {
      return;
    }
    if (isWslMitigated && workspaceSidebarTab !== "sourceControl") {
      tracePerf("sourceControl.getGitChanges.wslDeferred", {
        mode: "wsl-mitigated",
        reason: "idle-warm",
      });
      return;
    }
    if (requestsRef.current.hasGitChangesCache(warmPath)) {
      return;
    }
    scheduleSilentGitChangesRefresh(warmPath, "idle-warm", {
      delayMs: sourceControlIdleWarmDelayMs,
      skipIfCached: true,
    });
    return () => {
      cancelScheduledSourceControlIdleWork({
        refreshTimerRef: timers.refreshTimerRef,
        idleWarmDelayRef: timers.idleWarmDelayRef,
        idleWarmHandleRef: timers.idleWarmHandleRef,
        silentRefreshTimerRef: timers.silentRefreshTimerRef,
      });
    };
  }, [
    isWslMitigated,
    requestsRef,
    rootDirectory,
    scheduleSilentGitChangesRefresh,
    timers,
    workspaceSidebarTab,
  ]);

  useEffect(() => {
    if (!rootDirectory) {
      return;
    }
    if (isWslMitigated) {
      tracePerf("sourceControl.watchGitStatus.skipped", {
        mode: "wsl-mitigated",
        reason: "workspace-root",
      });
      return;
    }
    let disposed = false;
    let handle: { dispose(): void } | null = null;
    host
      .watchGitStatus(
        [rootDirectory],
        () => {
          if (!disposed) {
            scheduleSilentGitChangesRefresh(rootDirectory, "metadata-event");
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
  }, [
    host,
    isWslMitigated,
    rootDirectory,
    scheduleSilentGitChangesRefresh,
  ]);

  useEffect(() => {
    function refreshStaleChangesOnVisible() {
      const currentRoot = rootDirectoryRef.current;
      if (document.visibilityState !== "visible" || !currentRoot) {
        return;
      }
      if (isWslMitigated && workspaceSidebarTab !== "sourceControl") {
        tracePerf("sourceControl.getGitChanges.wslDeferred", {
          mode: "wsl-mitigated",
          reason: "visibility-restore",
        });
        return;
      }
      const ageMs = requestsRef.current.gitChangesCacheAgeMs(currentRoot);
      if (ageMs !== null && ageMs >= sourceControlChangesCacheStaleMs) {
        scheduleSilentGitChangesRefresh(currentRoot, "visibility-restore");
      }
    }
    document.addEventListener("visibilitychange", refreshStaleChangesOnVisible);
    return () => {
      document.removeEventListener(
        "visibilitychange",
        refreshStaleChangesOnVisible,
      );
    };
  }, [
    isWslMitigated,
    requestsRef,
    rootDirectoryRef,
    scheduleSilentGitChangesRefresh,
    workspaceSidebarTab,
  ]);

  return { refreshGitChanges };
}
