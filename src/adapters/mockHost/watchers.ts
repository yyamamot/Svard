import {
  ensureMockDirectoryWatchTrigger,
  ensureMockDocumentWatchTrigger,
  ensureMockGitStatusTrigger,
  ensureMockNativeFileDropTrigger,
  mockDirectoryWatchers,
  mockDocumentWatchers,
  mockGitStatusWatchers,
  mockNativeFileDropWatchers,
} from "./state";
import type {
  DesktopOpenRequest,
  DirectoryWatchEvent,
  GitStatusWatchEvent,
  NativeFileDropEvent,
  WatchHandle,
  HostAdapter,
} from "../../core/types";

export type MockWatcherFacade = Pick<
  HostAdapter,
  | "watchDocument"
  | "watchDirectory"
  | "watchNativeFileDrop"
  | "watchGitStatus"
  | "takePendingOpenRequests"
  | "watchOpenRequests"
>;

export function createMockWatcherFacade(): MockWatcherFacade {
  return {
    watchDocument,
    watchDirectory,
    watchNativeFileDrop,
    watchGitStatus,
    takePendingOpenRequests,
    watchOpenRequests,
  };
}

export async function watchDocument(
  path: string,
  onChange: () => void,
  _onError?: (message: string) => void,
): Promise<{ dispose(): void }> {
  ensureMockDocumentWatchTrigger();
  const watchers = mockDocumentWatchers.get(path) ?? new Set<() => void>();
  watchers.add(onChange);
  mockDocumentWatchers.set(path, watchers);
  return {
    dispose() {
      watchers.delete(onChange);
      if (watchers.size === 0) {
        mockDocumentWatchers.delete(path);
      }
    },
  };
}

export async function watchDirectory(
  path: string,
  onChange: (event: DirectoryWatchEvent) => void,
  _onError?: (message: string) => void,
  _options?: { recursive?: boolean },
): Promise<WatchHandle> {
  ensureMockDirectoryWatchTrigger();
  const watchers =
    mockDirectoryWatchers.get(path) ??
    new Set<(event: DirectoryWatchEvent) => void>();
  watchers.add(onChange);
  mockDirectoryWatchers.set(path, watchers);
  return {
    dispose() {
      watchers.delete(onChange);
      if (watchers.size === 0) {
        mockDirectoryWatchers.delete(path);
      }
    },
  };
}

export async function watchNativeFileDrop(
  onEvent: (event: NativeFileDropEvent) => void,
): Promise<WatchHandle> {
  ensureMockNativeFileDropTrigger();
  mockNativeFileDropWatchers.add(onEvent);
  return {
    dispose() {
      mockNativeFileDropWatchers.delete(onEvent);
    },
  };
}

export async function watchGitStatus(
  _paths: string[],
  onChange: (event: GitStatusWatchEvent) => void,
  _onError?: (message: string) => void,
): Promise<WatchHandle> {
  ensureMockGitStatusTrigger();
  mockGitStatusWatchers.add(onChange);
  return {
    dispose() {
      mockGitStatusWatchers.delete(onChange);
    },
  };
}

export async function takePendingOpenRequests(): Promise<DesktopOpenRequest[]> {
  if (typeof window !== "undefined") {
    const target = window as unknown as {
      __SVARD_PENDING_OPEN_REQUESTS__?: DesktopOpenRequest[];
    };
    const requests = target.__SVARD_PENDING_OPEN_REQUESTS__ ?? [];
    target.__SVARD_PENDING_OPEN_REQUESTS__ = [];
    return requests;
  }
  return [];
}

export async function watchOpenRequests(
  _handler: (request: DesktopOpenRequest) => void,
): Promise<WatchHandle> {
  return {
    dispose() {
      // Browser harness does not receive desktop open events.
    },
  };
}
