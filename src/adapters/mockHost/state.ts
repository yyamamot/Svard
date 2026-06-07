import { defaultConfig } from "../../core/defaultConfig";
import { fixturePath } from "../../core/fixtures";
import type {
  AppConfig,
  DirectoryWatchEvent,
  GitStatusWatchEvent,
  NativeFileDropEvent,
} from "../../core/types";

export let currentConfig: AppConfig = {
  ...structuredClone(defaultConfig),
  workspace: {
    ...structuredClone(defaultConfig.workspace),
    lastDirectory: "/workspace",
    activePath: fixturePath,
    openTabs: [fixturePath],
  },
};

export function setCurrentConfig(config: AppConfig): void {
  currentConfig = structuredClone(config);
}

export const mockGitStatusWatchers = new Set<
  (event: GitStatusWatchEvent) => void
>();
export const mockDocumentWatchers = new Map<string, Set<() => void>>();
export const mockDirectoryWatchers = new Map<
  string,
  Set<(event: DirectoryWatchEvent) => void>
>();
export const mockNativeFileDropWatchers = new Set<
  (event: NativeFileDropEvent) => void
>();

export function ensureMockGitStatusTrigger(): void {
  if (typeof window === "undefined") {
    return;
  }
  const target = window as unknown as {
    __SVARD_TRIGGER_GIT_STATUS_CHANGE__?: () => void;
  };
  target.__SVARD_TRIGGER_GIT_STATUS_CHANGE__ = () => {
    for (const watcher of [...mockGitStatusWatchers]) {
      watcher({ kind: "changed" });
    }
  };
}

export function ensureMockDocumentWatchTrigger(): void {
  if (typeof window === "undefined") {
    return;
  }
  const target = window as unknown as {
    __SVARD_TRIGGER_DOCUMENT_CHANGE__?: (path: string) => void;
  };
  target.__SVARD_TRIGGER_DOCUMENT_CHANGE__ = (path: string) => {
    for (const watcher of [...(mockDocumentWatchers.get(path) ?? [])]) {
      watcher();
    }
  };
}

export function ensureMockDirectoryWatchTrigger(): void {
  if (typeof window === "undefined") {
    return;
  }
  const target = window as unknown as {
    __SVARD_TRIGGER_DIRECTORY_CHANGE__?: (
      path: string,
      kind?: string,
      changedPath?: string,
    ) => void;
  };
  target.__SVARD_TRIGGER_DIRECTORY_CHANGE__ = (
    path: string,
    kind = "modified",
    changedPath?: string,
  ) => {
    for (const watcher of [...(mockDirectoryWatchers.get(path) ?? [])]) {
      watcher({ path, changedPath, kind });
    }
  };
}

export function ensureMockNativeFileDropTrigger(): void {
  if (typeof window === "undefined") {
    return;
  }
  const target = window as unknown as {
    __SVARD_TRIGGER_NATIVE_FILE_DROP__?: (event: NativeFileDropEvent) => void;
  };
  target.__SVARD_TRIGGER_NATIVE_FILE_DROP__ = (event: NativeFileDropEvent) => {
    for (const watcher of [...mockNativeFileDropWatchers]) {
      watcher(event);
    }
  };
}

export function recordMockEditorOpenRequest(path: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const target = window as unknown as {
    __SVARD_EDITOR_OPEN_REQUESTS__?: string[];
  };
  target.__SVARD_EDITOR_OPEN_REQUESTS__ = [
    ...(target.__SVARD_EDITOR_OPEN_REQUESTS__ ?? []),
    path,
  ];
}
