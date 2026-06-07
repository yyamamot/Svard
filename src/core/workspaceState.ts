import type {
  DocumentPayload,
  RecentDirectoryEntry,
  RecentDocumentEntry,
  WorkspaceState,
} from "./types";
import { pathBasename } from "./pathDisplay";

const maxRecentDocuments = 50;
const maxRecentDirectories = 20;
export const maxWorkspacePathStateEntries = 200;

export function fileName(path: string): string {
  return pathBasename(path);
}

export function addRecentDocument(
  recentDocuments: RecentDocumentEntry[],
  document: DocumentPayload,
  now = new Date().toISOString(),
): RecentDocumentEntry[] {
  return [
    {
      path: document.path,
      name: fileName(document.path),
      format: document.format,
      lastOpenedAt: now,
    },
    ...recentDocuments.filter((entry) => entry.path !== document.path),
  ].slice(0, maxRecentDocuments);
}

export function addRecentDirectory(
  recentDirectories: RecentDirectoryEntry[],
  path: string,
  now = new Date().toISOString(),
): RecentDirectoryEntry[] {
  return [
    {
      path,
      name: fileName(path) || path,
      lastOpenedAt: now,
    },
    ...recentDirectories.filter((entry) => entry.path !== path),
  ].slice(0, maxRecentDirectories);
}

export function sortedOpenTabPaths(workspace: WorkspaceState): string[] {
  const pinned = workspace.pinnedTabs.filter((path) =>
    workspace.openTabs.includes(path),
  );
  const regular = workspace.openTabs.filter((path) => !pinned.includes(path));
  return [...pinned, ...regular];
}

export function pruneRecentTabs(
  recentTabs: string[],
  openTabs: string[],
): string[] {
  const openTabSet = new Set(openTabs);
  const selected = new Set<string>();
  return recentTabs.filter((path) => {
    if (!openTabSet.has(path) || selected.has(path)) {
      return false;
    }
    selected.add(path);
    return true;
  });
}

export function updateRecentTabs(
  recentTabs: string[],
  activePath: string | null | undefined,
  openTabs: string[],
): string[] {
  const pruned = pruneRecentTabs(recentTabs, openTabs);
  if (!activePath || !openTabs.includes(activePath)) {
    return pruned;
  }
  return [activePath, ...pruned.filter((path) => path !== activePath)];
}

export function nextRecentTabPath(
  recentTabs: string[],
  activePath: string | null | undefined,
  openTabs: string[],
): string | null {
  return (
    pruneRecentTabs(recentTabs, openTabs).find((path) => path !== activePath) ??
    null
  );
}

function documentPathIdentity(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const isAbsolute = normalized.startsWith("/");
  const parts: string[] = [];

  normalized.split("/").forEach((part) => {
    if (!part || part === ".") {
      return;
    }
    if (part === "..") {
      if (parts.length > 0 && parts.at(-1) !== "..") {
        parts.pop();
      } else if (!isAbsolute) {
        parts.push(part);
      }
      return;
    }
    parts.push(part);
  });

  const joined = parts.join("/");
  if (isAbsolute) {
    return `/${joined}`;
  }
  return joined || ".";
}

export function upsertOpenTab(
  tabs: DocumentPayload[],
  nextDocument: DocumentPayload,
): DocumentPayload[] {
  let replaced = false;
  const nextIdentity = documentPathIdentity(nextDocument.path);
  const deduped = tabs.flatMap((tab) => {
    if (documentPathIdentity(tab.path) !== nextIdentity) {
      return [tab];
    }
    if (replaced) {
      return [];
    }
    replaced = true;
    return [nextDocument];
  });

  return replaced ? deduped : [...deduped, nextDocument];
}

export function togglePinnedTab(pinnedTabs: string[], path: string): string[] {
  return pinnedTabs.includes(path)
    ? pinnedTabs.filter((item) => item !== path)
    : [...pinnedTabs, path];
}

export function closeOtherOpenTabPaths(
  openTabs: string[],
  pinnedTabs: string[],
  targetPath: string,
): string[] {
  return openTabs.filter(
    (path) => path === targetPath || pinnedTabs.includes(path),
  );
}

export function removeWorkspacePathStateEntries(
  entries: Record<string, number>,
  removedPaths: string[],
): Record<string, number>;
export function removeWorkspacePathStateEntries(
  entries: Record<string, string>,
  removedPaths: string[],
): Record<string, string>;
export function removeWorkspacePathStateEntries<T>(
  entries: Record<string, T>,
  removedPaths: string[],
): Record<string, T> {
  const removed = new Set(removedPaths);
  return Object.fromEntries(
    Object.entries(entries).filter(([path]) => !removed.has(path)),
  ) as Record<string, T>;
}

export function pruneWorkspacePathState<T>(
  entries: Record<string, T>,
  priorityPaths: string[],
  maxEntries = maxWorkspacePathStateEntries,
): Record<string, T> {
  const entryList = Object.entries(entries);
  if (entryList.length <= maxEntries) {
    return entries;
  }

  const priority = new Set(priorityPaths.filter(Boolean));
  const selected = new Set<string>();

  for (const [path] of entryList) {
    if (priority.has(path) && selected.size < maxEntries) {
      selected.add(path);
    }
  }

  for (let index = entryList.length - 1; index >= 0; index -= 1) {
    if (selected.size >= maxEntries) {
      break;
    }
    const [path] = entryList[index]!;
    if (selected.has(path)) {
      continue;
    }
    selected.add(path);
  }

  return Object.fromEntries(
    entryList.filter(([path]) => selected.has(path)),
  ) as Record<string, T>;
}
