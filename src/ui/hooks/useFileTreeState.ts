import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AppConfig,
  DirectoryEntry,
  DirectoryWatchEvent,
  WatchHandle,
  WorkspacePerformanceMode,
} from "../../core/types";
import { tracePerf } from "../lib/perfTrace";

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

export function useFileTreeState({
  host,
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

    try {
      const nextEntries = await host.listDirectory(path);
      setChildrenByDirectory((current) => ({
        ...current,
        [path]: nextEntries,
      }));
      return nextEntries;
    } catch (listError) {
      const message =
        listError instanceof Error
          ? listError.message
          : "Directory load failed";
      setDirectoryErrors((current) => ({ ...current, [path]: message }));
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
      }, 250);
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
