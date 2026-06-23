import type { GitDirectoryStatusSummary } from "./gitDirectoryStatusSummary";
import type { GitStatusDisplay } from "./gitStatusDisplay";

export function fileGitStatusBadgeLabel(
  display: GitStatusDisplay,
  basename: string,
): string {
  return `${display.label}. Open rendered diff for ${basename}`;
}

export function directoryGitStatusBadgeLabel(
  summary: GitDirectoryStatusSummary,
  folderName: string,
): string {
  const prefix =
    summary.count === 1
      ? `1 changed document under ${folderName}`
      : `${summary.count} changed documents under ${folderName}`;
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
