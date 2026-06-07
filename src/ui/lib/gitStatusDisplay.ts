import type { GitDiffStatus } from "../../core/types";

export interface GitStatusDisplay {
  className: string;
  label: string;
  shortLabel: string;
}

export function gitStatusDisplay(
  status?: GitDiffStatus,
): GitStatusDisplay | null {
  switch (status) {
    case "modified":
    case "binary":
      return {
        className: "git-status-modified",
        label:
          status === "binary" ? "Binary changed in Git" : "Modified in Git",
        shortLabel: "M",
      };
    case "added":
      return {
        className: "git-status-added",
        label: "Added in Git",
        shortLabel: "A",
      };
    case "untracked":
      return {
        className: "git-status-untracked",
        label: "Untracked in Git",
        shortLabel: "U",
      };
    case "deleted":
      return {
        className: "git-status-deleted",
        label: "Deleted in Git",
        shortLabel: "D",
      };
    case "renamed":
      return {
        className: "git-status-modified",
        label: "Renamed in Git",
        shortLabel: "R",
      };
    default:
      return null;
  }
}
