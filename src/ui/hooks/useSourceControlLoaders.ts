import { useEffect } from "react";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { isSupportedDocumentPath } from "../../core/documentFormat";
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
import { perfDuration, perfNow, tracePerf } from "../lib/perfTrace";
import {
  SourceControlRequests,
  sourceControlInitialHistoryLimit,
} from "./sourceControlRequests";
import {
  cancelAllSourceControlTimers,
  cancelScheduledSourceControlIdleWork,
  scheduleAfterDocumentPaint,
  scheduleDebouncedSourceControlRefresh,
  scheduleIdleSourceControlRefresh,
  sourceControlChangesCacheStaleMs,
  sourceControlIdleWarmDelayMs,
} from "./sourceControlScheduling";

export const sourceControlWslVisibleRetryDelayMs = 500;

interface SourceControlTimerRefs {
  refreshTimerRef: RefObject<number | null>;
  idleWarmDelayRef: RefObject<number | null>;
  idleWarmHandleRef: RefObject<number | null>;
  silentRefreshTimerRef: RefObject<number | null>;
}

function setSourceControlPayload<T>(
  setter: Dispatch<SetStateAction<T | null>>,
  next: T | null,
) {
  setter((current) =>
    sourceControlPayloadEqual(current, next) ? current : next,
  );
}

export function sourceControlPayloadEqual<T>(
  current: T | null,
  next: T | null,
) {
  if (current === next) {
    return true;
  }
  if (!current || !next) {
    return false;
  }
  const currentSignature = sourceControlPayloadSignature(current);
  const nextSignature = sourceControlPayloadSignature(next);
  if (currentSignature === null || nextSignature === null) {
    return false;
  }
  return currentSignature === nextSignature;
}

export function sourceControlPayloadSignature(payload: unknown): string | null {
  if (!isRecord(payload) || typeof payload.status !== "string") {
    return null;
  }
  if ("baseRef" in payload || "mergeBase" in payload) {
    return JSON.stringify(
      branchDiffSignature(payload as unknown as GitBranchDiff),
    );
  }
  if ("scope" in payload) {
    return JSON.stringify(
      commitGraphSignature(payload as unknown as GitCommitGraph),
    );
  }
  if ("repositoryRoot" in payload && "items" in payload) {
    return JSON.stringify(changesSignature(payload as unknown as GitChanges));
  }
  if ("relativePath" in payload && "items" in payload) {
    return JSON.stringify(
      fileHistorySignature(payload as unknown as GitFileHistory),
    );
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function headCommitSignature(headCommit: GitChanges["headCommit"]) {
  return headCommit
    ? {
        revision: headCommit.revision,
        shortHash: headCommit.shortHash,
        summary: headCommit.summary,
      }
    : null;
}

function changesSignature(payload: GitChanges) {
  return {
    status: payload.status,
    repositoryRoot: payload.repositoryRoot ?? null,
    currentBranch: payload.currentBranch ?? null,
    headCommit: headCommitSignature(payload.headCommit ?? null),
    message: payload.message ?? null,
    items: payload.items.map((item) => ({
      path: item.path,
      status: item.status,
      documentPath: item.documentPath ?? null,
    })),
  };
}

function branchDiffSignature(payload: GitBranchDiff) {
  return {
    status: payload.status,
    repositoryRoot: payload.repositoryRoot ?? null,
    currentBranch: payload.currentBranch ?? null,
    headCommit: headCommitSignature(payload.headCommit ?? null),
    baseRef: payload.baseRef ?? null,
    headRef: payload.headRef ?? null,
    mergeBase: payload.mergeBase ?? null,
    baseCandidates: payload.baseCandidates,
    providerBaseCandidates: payload.providerBaseCandidates?.map(
      (candidate) => ({
        provider: candidate.provider,
        label: candidate.label,
        baseRef: candidate.baseRef,
        sourceBranch: candidate.sourceBranch,
        targetBranch: candidate.targetBranch,
        available: candidate.available,
        message: candidate.message ?? null,
      }),
    ),
    message: payload.message ?? null,
    items: payload.items.map((item) => ({
      path: item.path,
      oldPath: item.oldPath ?? null,
      status: item.status,
      documentPath: item.documentPath ?? null,
    })),
  };
}

function commitGraphSignature(payload: GitCommitGraph) {
  return {
    status: payload.status,
    scope: payload.scope,
    repositoryRoot: payload.repositoryRoot ?? null,
    relativePath: payload.relativePath ?? null,
    currentBranch: payload.currentBranch ?? null,
    headCommit: headCommitSignature(payload.headCommit ?? null),
    message: payload.message ?? null,
    hasMore: payload.hasMore ?? null,
    nextCursor: payload.nextCursor ?? null,
    items: payload.items.map((item) => ({
      revision: item.revision,
      shortHash: item.shortHash,
      parentRevision: item.parentRevision ?? null,
      parentShortHash: item.parentShortHash ?? null,
      parentRevisions: item.parentRevisions,
      parentShortHashes: item.parentShortHashes,
      summary: item.summary,
      author: item.author,
      date: item.date,
      fileStatus: item.fileStatus,
    })),
  };
}

function fileHistorySignature(payload: GitFileHistory) {
  return {
    status: payload.status,
    relativePath: payload.relativePath ?? null,
    message: payload.message ?? null,
    hasMore: payload.hasMore ?? null,
    nextCursor: payload.nextCursor ?? null,
    items: payload.items.map((item) => ({
      revision: item.revision,
      shortHash: item.shortHash,
      parentRevision: item.parentRevision ?? null,
      parentShortHash: item.parentShortHash ?? null,
      summary: item.summary,
      author: item.author,
      date: item.date,
      fileStatus: item.fileStatus,
    })),
  };
}

export function useSourceControlLoaders({
  config,
  effectiveGitTimelinePath,
  gitTimelineRefreshToken,
  host,
  isFileHistoryView,
  isRepoGraphView,
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
}) {
  const isWslMitigated = workspacePerformanceMode === "wsl-mitigated";

  function scheduleSourceControlRefresh() {
    scheduleDebouncedSourceControlRefresh(timers.refreshTimerRef, () =>
      setGitTimelineRefreshToken((token) => token + 1),
    );
  }

  function runSilentGitChangesRefresh(anchorPath: string, reason: string) {
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
  }

  function scheduleSilentGitChangesRefresh(
    anchorPath: string,
    reason: string,
    options: { delayMs?: number; skipIfCached?: boolean } = {},
  ) {
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
  }

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
  }, [isWslMitigated, requestsRef, rootDirectory, timers, workspaceSidebarTab]);

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
  }, [host, isWslMitigated, rootDirectory]);

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
  }, [isWslMitigated, requestsRef, rootDirectoryRef, workspaceSidebarTab]);

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

  useEffect(() => {
    if (!isFileHistoryView) {
      return;
    }
    if (
      !effectiveGitTimelinePath ||
      !isSupportedDocumentPath(effectiveGitTimelinePath)
    ) {
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
    isFileHistoryView,
    requestsRef,
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
