import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fileTreeRevealPaths,
  normalizeRevealPath,
} from "../lib/fileTreeReveal";
import type {
  AppConfig,
  DirectoryEntry,
  DirectoryWatchEvent,
  WatchHandle,
  WorkspacePerformanceMode,
} from "../../core/types";
import {
  perfBasename,
  perfDuration,
  perfNow,
  tracePerf,
} from "../lib/perfTrace";

const fileTreeWatchReloadDebounceMs = 100;

interface FileTreeHost {
  listDirectory(path: string): Promise<DirectoryEntry[]>;
  watchDirectory(
    path: string,
    onChange: (event: DirectoryWatchEvent) => void,
    onError?: (message: string) => void,
    options?: { recursive?: boolean },
  ): Promise<WatchHandle>;
  clearDocumentLinkCache?(path: string): Promise<void>;
}

interface UseFileTreeStateOptions {
  host: FileTreeHost;
  activePath?: string;
  revealDisabled?: boolean;
  contextKey?: string;
  persistWorkspace: (partial: Partial<AppConfig["workspace"]>) => Promise<void>;
  workspacePerformanceMode?: WorkspacePerformanceMode;
  showInlineNotice: (
    message: string,
    options?: { tone?: "info" | "success" | "warning" | "error" },
  ) => void;
  onWorkspaceFileChange?: (event: WorkspaceFileChangeEvent) => void;
}

export interface WorkspaceFileChangeEvent {
  reason: "manual-refresh" | "directory-watch";
  changedPath: string | null;
}

interface FileTreeTiming {
  basename: string;
  durationMs?: number;
  entryCount: number;
  reason: "manual-refresh" | "directory-watch" | "directory-load";
  status: "ready" | "failed" | "unchanged";
}

declare global {
  interface Window {
    __SVARD_FILE_TREE_TIMING__?: FileTreeTiming;
  }
}

function updateFileTreeTiming(timing: FileTreeTiming): void {
  if (typeof window === "undefined") {
    return;
  }
  window.__SVARD_FILE_TREE_TIMING__ = timing;
}

export function useFileTreeState({
  host,
  activePath,
  revealDisabled = false,
  contextKey,
  persistWorkspace,
  workspacePerformanceMode = "normal",
  showInlineNotice,
  onWorkspaceFileChange,
}: UseFileTreeStateOptions) {
  const onWorkspaceFileChangeRef = useRef(onWorkspaceFileChange);
  const [rootDirectory, setRootDirectory] = useState("");
  const [childrenByDirectory, setChildrenByDirectory] = useState<
    Record<string, DirectoryEntry[]>
  >({});
  const [expandedDirectories, setExpandedDirectories] = useState<Set<string>>(
    new Set(),
  );
  const [loadingDirectories, setLoadingDirectories] = useState<Set<string>>(
    new Set(),
  );
  const [directoryErrors, setDirectoryErrors] = useState<
    Record<string, string>
  >({});
  const [revealRequest, setRevealRequest] = useState<{
    id: number;
    path: string;
  } | null>(null);
  const revealSequence = useRef(0);
  const mounted = useRef(true);
  const persistWorkspaceRef = useRef(persistWorkspace);
  persistWorkspaceRef.current = persistWorkspace;
  const acknowledgeReveal = useCallback((id: number) => {
    setRevealRequest((current) => (current?.id === id ? null : current));
  }, []);
  const cancelReveal = useCallback(() => {
    revealSequence.current += 1;
    setRevealRequest(null);
  }, []);
  const revealContext = JSON.stringify([
    rootDirectory,
    activePath,
    contextKey,
    revealDisabled,
  ]);
  const liveContext = useRef(revealContext);
  // Invalidate by generation as well as identity, including a switch away and back.
  if (liveContext.current !== revealContext) {
    liveContext.current = revealContext;
    revealSequence.current += 1;
  }
  const expandedRef = useRef(expandedDirectories);
  expandedRef.current = expandedDirectories;
  const revealPaths = fileTreeRevealPaths(rootDirectory, activePath);
  const canRevealCurrentFile = !revealDisabled && revealPaths !== null;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      revealSequence.current += 1;
    };
  }, []);

  async function revealCurrentFile(): Promise<void> {
    if (!canRevealCurrentFile || !revealPaths || !activePath) return;
    const id = ++revealSequence.current;
    const isCurrent = () =>
      mounted.current &&
      revealSequence.current === id &&
      liveContext.current === revealContext;
    const listings: Record<string, DirectoryEntry[]> = {};
    const ancestors: string[] = [];
    let directory = rootDirectory;
    try {
      // Fresh listings verify each ancestor and the target even when cached.
      for (let index = 0; index < revealPaths.length; index += 1) {
        const entries = await host.listDirectory(directory);
        if (!isCurrent()) return;
        listings[directory] = entries;
        const isFile = index === revealPaths.length - 1;
        const entry = entries.find(
          (candidate) =>
            normalizeRevealPath(candidate.path) === revealPaths[index] &&
            candidate.kind === (isFile ? "file" : "directory"),
        );
        if (!entry) throw new Error("Reveal target unavailable");
        if (!isFile) {
          directory = entry.path;
          ancestors.push(directory);
        }
      }
      if (!isCurrent()) return;
      const nextExpanded = new Set([...expandedRef.current, ...ancestors]);
      expandedRef.current = nextExpanded;
      setChildrenByDirectory((current) => ({ ...current, ...listings }));
      setExpandedDirectories(nextExpanded);
      setDirectoryErrors((current) => {
        const next = { ...current };
        for (const path of Object.keys(listings)) delete next[path];
        return next;
      });
      setRevealRequest({ id, path: activePath });
      await persistWorkspaceRef.current({
        expandedDirectories: [...nextExpanded],
      });
    } catch {
      if (isCurrent()) {
        showInlineNotice(
          "Unable to reveal the current file in the file tree.",
          { tone: "warning" },
        );
      }
    }
  }

  const watchedDirectories = useMemo(
    () =>
      [
        ...new Set([
          rootDirectory,
          ...[...expandedDirectories].filter((path) => path !== rootDirectory),
        ]),
      ].filter((path) => path.length > 0),
    [rootDirectory, expandedDirectories],
  );
  const watchedDirectoryKey = watchedDirectories.join("\0");

  useEffect(() => {
    onWorkspaceFileChangeRef.current = onWorkspaceFileChange;
  }, [onWorkspaceFileChange]);

  async function loadDirectoryEntries(path: string): Promise<DirectoryEntry[]> {
    setLoadingDirectories((current) => new Set(current).add(path));
    setDirectoryErrors((current) => {
      const next = { ...current };
      delete next[path];
      return next;
    });

    const startedAt = perfNow();
    try {
      const nextEntries = await host.listDirectory(path);
      setChildrenByDirectory((current) => ({
        ...current,
        [path]: nextEntries,
      }));
      updateFileTreeTiming({
        basename: perfBasename(path),
        durationMs: perfDuration(startedAt),
        entryCount: nextEntries.length,
        reason: "directory-load",
        status: "ready",
      });
      return nextEntries;
    } catch (listError) {
      const message =
        listError instanceof Error
          ? listError.message
          : "Directory load failed";
      setDirectoryErrors((current) => ({ ...current, [path]: message }));
      updateFileTreeTiming({
        basename: perfBasename(path),
        durationMs: perfDuration(startedAt),
        entryCount: 0,
        reason: "directory-load",
        status: "failed",
      });
      throw listError;
    } finally {
      setLoadingDirectories((current) => {
        const next = new Set(current);
        next.delete(path);
        return next;
      });
    }
  }

  async function toggleDirectory(path: string) {
    const nextExpanded = new Set(expandedDirectories);

    if (nextExpanded.has(path)) {
      nextExpanded.delete(path);
      setExpandedDirectories(nextExpanded);
      await persistWorkspace({
        expandedDirectories: [...nextExpanded],
      });
      return;
    }

    nextExpanded.add(path);
    setExpandedDirectories(nextExpanded);
    await persistWorkspace({
      expandedDirectories: [...nextExpanded],
    });

    await loadDirectoryEntries(path).catch(() => undefined);
  }

  async function refreshTree() {
    if (!rootDirectory) {
      showInlineNotice("Open a folder to refresh the file tree.", {
        tone: "info",
      });
      return;
    }

    const directories = [rootDirectory, ...expandedDirectories];
    const startedAt = perfNow();
    const refreshed = await Promise.all(
      directories.map((path) =>
        host
          .listDirectory(path)
          .then((entries) => [path, entries] as const)
          .catch((refreshError) => {
            setDirectoryErrors((current) => ({
              ...current,
              [path]:
                refreshError instanceof Error
                  ? refreshError.message
                  : "Directory refresh failed",
            }));
            return [path, childrenByDirectory[path] ?? []] as const;
          }),
      ),
    );
    setChildrenByDirectory((current) => ({
      ...current,
      ...Object.fromEntries(refreshed),
    }));
    updateFileTreeTiming({
      basename: perfBasename(rootDirectory),
      durationMs: perfDuration(startedAt),
      entryCount: refreshed.reduce(
        (count, [, entries]) => count + entries.length,
        0,
      ),
      reason: "manual-refresh",
      status: "ready",
    });
    onWorkspaceFileChangeRef.current?.({
      reason: "manual-refresh",
      changedPath: null,
    });
    showInlineNotice("File tree refreshed", { tone: "success" });
  }

  async function collapseTree() {
    setExpandedDirectories(new Set());
    setChildrenByDirectory((current) => ({
      [rootDirectory]: current[rootDirectory] ?? [],
    }));
    setDirectoryErrors({});
    await persistWorkspace({ expandedDirectories: [] });
  }

  useEffect(() => {
    if (watchedDirectories.length === 0) {
      return;
    }
    if (workspacePerformanceMode === "wsl-mitigated") {
      tracePerf("fileTree.watchDirectory.skipped", {
        mode: workspacePerformanceMode,
        reason: "wsl-workspace",
        count: watchedDirectories.length,
      });
      return;
    }

    let disposed = false;
    const handles: WatchHandle[] = [];
    const debounceTimers = new Map<string, number>();

    function clearDebounce(path: string) {
      const timer = debounceTimers.get(path);
      if (timer !== undefined) {
        window.clearTimeout(timer);
        debounceTimers.delete(path);
      }
    }

    function scheduleReload(path: string, changedPath = path) {
      clearDebounce(path);
      const timer = window.setTimeout(() => {
        debounceTimers.delete(path);
        if (disposed) {
          return;
        }
        setLoadingDirectories((current) => new Set(current).add(path));
        setDirectoryErrors((current) => {
          const next = { ...current };
          delete next[path];
          return next;
        });
        if (host.clearDocumentLinkCache && changedPath.endsWith(".md")) {
          void host
            .clearDocumentLinkCache(changedPath)
            .then(() => {
              tracePerf("documentLink.cache.clear", {
                status: "ok",
                reason: "directory-watch",
              });
            })
            .catch(() => {
              tracePerf("documentLink.cache.clear", {
                status: "failed",
                reason: "directory-watch",
              });
            });
        }
        onWorkspaceFileChangeRef.current?.({
          reason: "directory-watch",
          changedPath,
        });
        const startedAt = perfNow();
        void host
          .listDirectory(path)
          .then((entries) => {
            if (disposed) {
              return;
            }
            setChildrenByDirectory((current) => ({
              ...current,
              [path]: entries,
            }));
            updateFileTreeTiming({
              basename: perfBasename(path),
              durationMs: perfDuration(startedAt),
              entryCount: entries.length,
              reason: "directory-watch",
              status: "ready",
            });
          })
          .catch((watchError) => {
            if (disposed) {
              return;
            }
            setDirectoryErrors((current) => ({
              ...current,
              [path]:
                watchError instanceof Error
                  ? watchError.message
                  : "Directory refresh failed",
            }));
            updateFileTreeTiming({
              basename: perfBasename(path),
              durationMs: perfDuration(startedAt),
              entryCount: 0,
              reason: "directory-watch",
              status: "failed",
            });
          })
          .finally(() => {
            if (disposed) {
              return;
            }
            setLoadingDirectories((current) => {
              const next = new Set(current);
              next.delete(path);
              return next;
            });
          });
      }, fileTreeWatchReloadDebounceMs);
      debounceTimers.set(path, timer);
    }

    for (const path of watchedDirectories) {
      void host
        .watchDirectory(
          path,
          (event) => {
            if (!disposed) {
              scheduleReload(path, event.changedPath ?? event.path ?? path);
            }
          },
          (message) => {
            if (!disposed) {
              setDirectoryErrors((current) => ({
                ...current,
                [path]: message,
              }));
            }
          },
          { recursive: path === rootDirectory },
        )
        .then((handle) => {
          if (disposed) {
            handle.dispose();
            return;
          }
          handles.push(handle);
        })
        .catch((watchError) => {
          if (!disposed) {
            setDirectoryErrors((current) => ({
              ...current,
              [path]:
                watchError instanceof Error
                  ? watchError.message
                  : "Directory watch failed",
            }));
          }
        });
    }

    return () => {
      disposed = true;
      for (const timer of debounceTimers.values()) {
        window.clearTimeout(timer);
      }
      for (const handle of handles) {
        handle.dispose();
      }
    };
  }, [host, watchedDirectoryKey, workspacePerformanceMode]);

  return {
    rootDirectory,
    setRootDirectory,
    cancelReveal,
    acknowledgeReveal,
    canRevealCurrentFile,
    revealCurrentFile,
    revealRequest:
      revealRequest?.id === revealSequence.current ? revealRequest : null,
    childrenByDirectory,
    setChildrenByDirectory,
    expandedDirectories,
    setExpandedDirectories,
    loadingDirectories,
    directoryErrors,
    setDirectoryErrors,
    loadDirectoryEntries,
    toggleDirectory,
    refreshTree,
    collapseTree,
  };
}
