import { isSupportedDocumentPath } from "../../core/documentFormat";
import type { GitChanges, GitDiffStatus } from "../../core/types";
import { gitStatusDisplay } from "./gitStatusDisplay";

export interface GitDirectoryStatusSummary {
  status: GitDiffStatus;
  className: string;
  count: number;
  modifiedCount: number;
  addedCount: number;
  deletedCount: number;
  untrackedCount: number;
  label: string;
}

const statusRank: Partial<Record<GitDiffStatus, number>> = {
  deleted: 3,
  modified: 2,
  binary: 2,
  renamed: 2,
  added: 1,
  untracked: 1,
};

export function buildGitDirectoryStatusSummary(
  gitStatusByPath: Record<string, GitDiffStatus>,
): Record<string, GitDirectoryStatusSummary> {
  const summaries: Record<
    string,
    {
      count: number;
      status: GitDiffStatus;
      rank: number;
      modifiedCount: number;
      addedCount: number;
      deletedCount: number;
      untrackedCount: number;
    }
  > = {};

  for (const [path, status] of Object.entries(gitStatusByPath)) {
    const rank = statusRank[status];
    if (!rank) {
      continue;
    }
    let parent = parentPath(path);
    while (parent) {
      const current = summaries[parent];
      if (!current) {
        summaries[parent] = {
          count: 1,
          status,
          rank,
          modifiedCount: modifiedBucketCount(status),
          addedCount: status === "added" ? 1 : 0,
          deletedCount: status === "deleted" ? 1 : 0,
          untrackedCount: status === "untracked" ? 1 : 0,
        };
      } else {
        current.count += 1;
        current.modifiedCount += modifiedBucketCount(status);
        current.addedCount += status === "added" ? 1 : 0;
        current.deletedCount += status === "deleted" ? 1 : 0;
        current.untrackedCount += status === "untracked" ? 1 : 0;
        if (rank > current.rank) {
          current.status = status;
          current.rank = rank;
        }
      }
      parent = parentPath(parent);
    }
  }

  return Object.fromEntries(
    Object.entries(summaries).flatMap(([path, summary]) => {
      const display = gitStatusDisplay(summary.status);
      if (!display) {
        return [];
      }
      return [
        [
          path,
          {
            status: summary.status,
            className: display.className,
            count: summary.count,
            modifiedCount: summary.modifiedCount,
            addedCount: summary.addedCount,
            deletedCount: summary.deletedCount,
            untrackedCount: summary.untrackedCount,
            label: directoryStatusLabel(summary),
          },
        ],
      ];
    }),
  );
}

export function mergeGitStatusWithChanges(
  gitStatusByPath: Record<string, GitDiffStatus>,
  changes: GitChanges | null,
): Record<string, GitDiffStatus> {
  if (!changes || changes.status !== "ok") {
    return gitStatusByPath;
  }
  const next = { ...gitStatusByPath };
  for (const item of changes.items) {
    if (
      item.documentPath &&
      isSupportedDocumentPath(item.documentPath) &&
      statusRank[item.status]
    ) {
      next[item.documentPath] = item.status;
    }
  }
  return next;
}

function modifiedBucketCount(status: GitDiffStatus): number {
  return status === "modified" || status === "binary" || status === "renamed"
    ? 1
    : 0;
}

function directoryStatusLabel(summary: {
  count: number;
  modifiedCount: number;
  addedCount: number;
  deletedCount: number;
  untrackedCount: number;
}): string {
  const prefix =
    summary.count === 1
      ? "1 changed document"
      : `${summary.count} changed documents`;
  const parts = [
    countLabel(summary.modifiedCount, "modified"),
    countLabel(summary.addedCount, "added"),
    countLabel(summary.deletedCount, "deleted"),
    countLabel(summary.untrackedCount, "untracked"),
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? `${prefix}: ${parts.join(", ")}` : prefix;
}

function countLabel(count: number, label: string): string | null {
  return count > 0 ? `${count} ${label}` : null;
}

function parentPath(path: string): string | null {
  const trimmed = path.replace(/[\\/]+$/u, "");
  if (!trimmed || /^[\\/]+$/u.test(trimmed) || /^[A-Za-z]:$/u.test(trimmed)) {
    return null;
  }
  const index = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  if (index < 0) {
    return null;
  }
  if (index === 0) {
    return trimmed.slice(0, 1);
  }
  if (index === 2 && /^[A-Za-z]:/u.test(trimmed)) {
    return trimmed.slice(0, 2);
  }
  return trimmed.slice(0, index);
}
