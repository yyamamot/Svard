import { useCallback, useEffect, useMemo, useState } from "react";
import { isSupportedDocumentPath } from "../../core/documentFormat";
import { perfDuration, perfNow, tracePerf } from "../lib/perfTrace";
import type {
  BookmarkEntry,
  DirectoryEntry,
  DocumentPayload,
  GitDiffStatus,
  HostAdapter,
  WorkspacePerformanceMode,
} from "../../core/types";

const gitStatusDebounceMs = 100;

export function shouldSkipGitStatusHints(
  workspacePerformanceMode: WorkspacePerformanceMode,
): boolean {
  return workspacePerformanceMode === "wsl-mitigated";
}

export function collectGitStatusPaths({
  bookmarks,
  childrenByDirectory,
  tabs,
}: {
  bookmarks: BookmarkEntry[];
  childrenByDirectory: Record<string, DirectoryEntry[]>;
  tabs: DocumentPayload[];
}): string[] {
  const paths = new Set<string>();

  for (const tab of tabs) {
    if (isSupportedDocumentPath(tab.path)) {
      paths.add(tab.path);
    }
  }
  for (const entries of Object.values(childrenByDirectory)) {
    for (const entry of entries) {
      if (entry.kind === "file" && isSupportedDocumentPath(entry.path)) {
        paths.add(entry.path);
      }
    }
  }
  for (const bookmark of bookmarks) {
    if (bookmark.kind === "file" && isSupportedDocumentPath(bookmark.path)) {
      paths.add(bookmark.path);
    }
  }

  return [...paths].sort();
}

export function useGitStatusHints({
  bookmarks,
  childrenByDirectory,
  host,
  tabs,
  workspacePerformanceMode = "normal",
}: {
  bookmarks: BookmarkEntry[];
  childrenByDirectory: Record<string, DirectoryEntry[]>;
  host: HostAdapter;
  tabs: DocumentPayload[];
  workspacePerformanceMode?: WorkspacePerformanceMode;
}): Record<string, GitDiffStatus> {
  const [statusByPath, setStatusByPath] = useState<
    Record<string, GitDiffStatus>
  >({});
  const paths = useMemo(
    () => collectGitStatusPaths({ bookmarks, childrenByDirectory, tabs }),
    [bookmarks, childrenByDirectory, tabs],
  );
  const [refreshToken, setRefreshToken] = useState(0);
  const refreshGitStatus = useCallback(
    (disposed: () => boolean) => {
      const startedAt = perfNow();
      void host
        .getGitStatusSummary(paths)
        .then((entries) => {
          tracePerf("useGitStatusHints.host.getGitStatusSummary", {
            count: paths.length,
            durationMs: perfDuration(startedAt),
          });
          if (disposed()) {
            return;
          }
          const next: Record<string, GitDiffStatus> = {};
          for (const entry of entries) {
            next[entry.path] = entry.status;
          }
          setStatusByPath(next);
        })
        .catch(() => {
          tracePerf("useGitStatusHints.host.getGitStatusSummary.failed", {
            count: paths.length,
            durationMs: perfDuration(startedAt),
          });
          if (!disposed()) {
            setStatusByPath({});
          }
        });
    },
    [host, paths],
  );

  useEffect(() => {
    if (paths.length === 0) {
      setStatusByPath({});
      return;
    }
    if (shouldSkipGitStatusHints(workspacePerformanceMode)) {
      tracePerf("useGitStatusHints.skipped", {
        mode: workspacePerformanceMode,
        reason: "wsl-workspace",
        count: paths.length,
      });
      setStatusByPath({});
      return;
    }
    let disposed = false;
    const timer = window.setTimeout(() => {
      tracePerf("useGitStatusHints.refresh", { count: paths.length });
      refreshGitStatus(() => disposed);
    }, gitStatusDebounceMs);

    return () => {
      disposed = true;
      window.clearTimeout(timer);
    };
  }, [paths, refreshGitStatus, refreshToken, workspacePerformanceMode]);

  useEffect(() => {
    if (paths.length === 0) {
      return;
    }
    if (shouldSkipGitStatusHints(workspacePerformanceMode)) {
      tracePerf("useGitStatusHints.skipped", {
        mode: workspacePerformanceMode,
        reason: "wsl-workspace-watch",
        count: paths.length,
      });
      return;
    }
    let disposed = false;
    let handle: { dispose(): void } | null = null;
    const startedAt = perfNow();
    void host
      .watchGitStatus(
        paths,
        () => {
          if (!disposed) {
            setRefreshToken((current) => current + 1);
          }
        },
        () => {
          // Existing path-set refresh remains the fallback when native Git metadata watch is unavailable.
        },
      )
      .then((nextHandle) => {
        tracePerf("useGitStatusHints.host.watchGitStatus", {
          count: paths.length,
          durationMs: perfDuration(startedAt),
        });
        if (disposed) {
          nextHandle.dispose();
          return;
        }
        handle = nextHandle;
      })
      .catch(() => {
        tracePerf("useGitStatusHints.host.watchGitStatus.failed", {
          count: paths.length,
          durationMs: perfDuration(startedAt),
        });
        // Silent fallback: keep the regular debounce refresh behavior.
      });

    return () => {
      disposed = true;
      handle?.dispose();
    };
  }, [host, paths, workspacePerformanceMode]);

  return statusByPath;
}
