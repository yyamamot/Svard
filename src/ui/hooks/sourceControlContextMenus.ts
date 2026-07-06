import { isSupportedDocumentPath } from "../../core/documentFormat";
import type {
  GitBranchDiff,
  GitBranchDiffEntry,
  GitChangeEntry,
  GitCommitGraphItem,
  GitFileHistoryItem,
} from "../../core/types";
import type { ContextMenuItem } from "../types";

type CopyText = (label: string, value: string) => void | Promise<void>;

export function buildTimelineItemContextMenuItems({
  compareBase,
  copyText,
  item,
  onCompareWithSelected,
  onOpenChanges,
  onSelectForCompare,
  onViewCommit,
}: {
  compareBase: GitFileHistoryItem | null;
  copyText: CopyText;
  item: GitFileHistoryItem;
  onCompareWithSelected: () => void;
  onOpenChanges: () => void;
  onSelectForCompare: () => void;
  onViewCommit: () => void;
}): ContextMenuItem[] {
  const items: ContextMenuItem[] = [
    {
      id: "open-changes",
      label: "Open Changes",
      onSelect: onOpenChanges,
    },
    {
      id: "view-commit",
      label: "View Commit",
      onSelect: onViewCommit,
    },
    {
      id: "select-for-compare",
      label: "Select for Compare",
      onSelect: onSelectForCompare,
    },
  ];
  if (compareBase && compareBase.revision !== item.revision) {
    items.push({
      id: "compare-with-selected",
      label: "Compare with Selected",
      onSelect: onCompareWithSelected,
    });
  }
  items.push(...commitCopyItems(item, copyText));
  return items;
}

export function buildSourceControlChangeContextMenuItems({
  compareWithGitRef,
  copyText,
  item,
  markNeedsAttention,
  markViewed,
  openSourceControlChange,
  resetReviewState,
  showGitFileHistory,
}: {
  compareWithGitRef: (
    kind: "branch" | "tag" | "commit",
    path?: string,
  ) => void | Promise<void>;
  copyText: CopyText;
  item: GitChangeEntry;
  markNeedsAttention?: (path: string) => void;
  markViewed?: (path: string) => void;
  openSourceControlChange: (
    path: string | null | undefined,
  ) => void | Promise<void>;
  resetReviewState?: (path: string) => void;
  showGitFileHistory: (path?: string) => void | Promise<void>;
}): ContextMenuItem[] {
  const documentPath = item.documentPath ?? undefined;
  const path = documentPath ?? item.path;
  const supported = Boolean(
    documentPath && isSupportedDocumentPath(documentPath),
  );
  const items: ContextMenuItem[] = [
    {
      id: "open-changes",
      label: "Open rendered diff",
      enabled: supported,
      title: supported
        ? undefined
        : "Preview diff is available for markup documents only",
      onSelect: () => openSourceControlChange(documentPath),
    },
  ];
  if (
    supported &&
    documentPath &&
    (markViewed || markNeedsAttention || resetReviewState)
  ) {
    items.push(
      {
        id: "mark-review-viewed",
        label: "Mark viewed",
        onSelect: () => markViewed?.(documentPath),
      },
      {
        id: "mark-review-needs-attention",
        label: "Mark needs attention",
        onSelect: () => markNeedsAttention?.(documentPath),
      },
      {
        id: "reset-review-state",
        label: "Reset review state",
        onSelect: () => resetReviewState?.(documentPath),
      },
    );
  }
  items.push(
    {
      id: "show-file-history",
      label: "Show File History",
      enabled: supported,
      title: supported
        ? undefined
        : "File History is available for markup documents only",
      onSelect: () => showGitFileHistory(documentPath),
    },
    {
      id: "compare-with-branch",
      label: "Compare with Branch...",
      enabled: supported,
      title: supported
        ? undefined
        : "Git ref compare is available for markup documents only",
      onSelect: () => compareWithGitRef("branch", documentPath),
    },
    {
      id: "compare-with-tag",
      label: "Compare with Tag...",
      enabled: supported,
      title: supported
        ? undefined
        : "Git ref compare is available for markup documents only",
      onSelect: () => compareWithGitRef("tag", documentPath),
    },
    {
      id: "compare-with-commit",
      label: "Compare with Commit...",
      enabled: supported,
      title: supported
        ? undefined
        : "Git ref compare is available for markup documents only",
      onSelect: () => compareWithGitRef("commit", documentPath),
    },
    {
      id: "copy-path",
      label: "Copy Path",
      onSelect: () => copyText("Path", path),
    },
    {
      id: "copy-relative-path",
      label: "Copy Relative Path",
      onSelect: () => copyText("Relative path", item.path),
    },
  );
  return items;
}

export function buildSourceControlBranchDiffContextMenuItems({
  branchDiff,
  copyText,
  item,
  openGitBranchDiffItem,
  showGitFileHistory,
}: {
  branchDiff: GitBranchDiff | null;
  copyText: CopyText;
  item: GitBranchDiffEntry;
  openGitBranchDiffItem: (item: GitBranchDiffEntry) => void | Promise<void>;
  showGitFileHistory: (path?: string) => void | Promise<void>;
}): ContextMenuItem[] {
  const documentPath = item.documentPath ?? undefined;
  const path = documentPath ?? item.path;
  const supported = Boolean(
    documentPath && isSupportedDocumentPath(documentPath),
  );
  const range = `${branchDiff?.baseRef ?? "base"}...${branchDiff?.headRef ?? "HEAD"}`;
  const items: ContextMenuItem[] = [
    {
      id: "open-branch-diff",
      label: "Open Branch Diff",
      enabled: supported,
      title: supported
        ? undefined
        : "Preview diff is available for markup documents only",
      onSelect: () => openGitBranchDiffItem(item),
    },
    {
      id: "show-file-history",
      label: "Show File History",
      enabled: supported,
      title: supported
        ? undefined
        : "File History is available for markup documents only",
      onSelect: () => showGitFileHistory(documentPath),
    },
    {
      id: "copy-path",
      label: "Copy Path",
      onSelect: () => copyText("Path", path),
    },
  ];
  if (item.oldPath) {
    items.push({
      id: "copy-old-path",
      label: "Copy Old Path",
      onSelect: () => copyText("Old path", item.oldPath ?? ""),
    });
  }
  items.push(
    {
      id: "copy-base-ref",
      label: "Copy Base Ref",
      onSelect: () => copyText("Base ref", branchDiff?.baseRef ?? ""),
    },
    {
      id: "copy-diff-range",
      label: "Copy Diff Range",
      onSelect: () => copyText("Diff range", range),
    },
    {
      id: "copy-status",
      label: "Copy Status",
      onSelect: () => copyText("Status", item.status),
    },
  );
  return items;
}

export function buildSourceControlGraphContextMenuItems({
  compareBase,
  copyText,
  item,
  onCompareWithSelected,
  onSelectForCompare,
  onViewCommit,
}: {
  compareBase: GitFileHistoryItem | null;
  copyText: CopyText;
  item: GitCommitGraphItem;
  onCompareWithSelected: () => void;
  onSelectForCompare: () => void;
  onViewCommit: () => void;
}): ContextMenuItem[] {
  const items: ContextMenuItem[] = [
    {
      id: "view-commit",
      label: "View Commit",
      onSelect: onViewCommit,
    },
    {
      id: "select-for-compare",
      label: "Select for Compare",
      onSelect: onSelectForCompare,
    },
  ];
  if (compareBase && compareBase.revision !== item.revision) {
    items.push({
      id: "compare-with-selected",
      label: "Compare with Selected",
      onSelect: onCompareWithSelected,
    });
  }
  items.push(...commitCopyItems(item, copyText));
  return items;
}

function commitCopyItems(
  item: Pick<GitFileHistoryItem, "revision" | "summary">,
  copyText: CopyText,
): ContextMenuItem[] {
  return [
    {
      id: "copy-commit-id",
      label: "Copy Commit ID",
      onSelect: () => copyText("Commit ID", item.revision),
    },
    {
      id: "copy-commit-message",
      label: "Copy Commit Message",
      onSelect: () => copyText("Commit message", item.summary),
    },
  ];
}
