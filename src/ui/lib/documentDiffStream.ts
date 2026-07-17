import type {
  DocumentDiffStreamItem,
  GitChangeEntry,
  GitBranchDiffEntry,
  GitCommitChangedFile,
  GitDiffStatus,
} from "../../core/types";
import { isSupportedDocumentPath } from "../../core/documentFormat";

const blockerStatuses = new Set<GitDiffStatus>([
  "binary",
  "deleted",
  "not-in-repo",
  "error",
]);

export function buildDocumentDiffStreamItems(
  changes: readonly (
    | GitChangeEntry
    | GitBranchDiffEntry
    | GitCommitChangedFile
  )[],
  options: { repositoryRoot?: string | null } = {},
): DocumentDiffStreamItem[] {
  const seen = new Set<string>();
  const items: DocumentDiffStreamItem[] = [];
  for (const change of changes) {
    const documentPath =
      change.documentPath ??
      documentPathFromRepositoryRelativePath(
        change.path,
        options.repositoryRoot,
      );
    if (!documentPath || !isSupportedDocumentPath(documentPath)) {
      continue;
    }
    const key = documentPath || change.path;
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    const supported = !blockerStatuses.has(change.status);
    items.push({
      path: change.path,
      oldPath: "oldPath" in change ? change.oldPath : null,
      status: change.status,
      documentPath,
      kind: supported ? "document" : "blocker",
      reason: supported ? null : documentDiffStreamBlockerReason(change),
    });
  }
  return items;
}

function documentPathFromRepositoryRelativePath(
  path: string,
  repositoryRoot?: string | null,
): string | null {
  if (!isSupportedDocumentPath(path)) {
    return null;
  }
  if (path.startsWith("/")) {
    return path;
  }
  return repositoryRoot ? `${repositoryRoot.replace(/\/$/, "")}/${path}` : path;
}

export function documentDiffStreamBlockerReason(
  change: Pick<GitChangeEntry, "documentPath" | "path" | "status">,
): string {
  if (!change.documentPath) {
    return "Preview diff is available for markup documents only.";
  }
  if (!isSupportedDocumentPath(change.documentPath)) {
    return "Preview diff is available for markup documents only.";
  }
  if (change.status === "deleted") {
    return "Deleted documents stay in the stream as a review blocker.";
  }
  if (change.status === "binary") {
    return "Binary files are not rendered in All diffs.";
  }
  if (change.status === "not-in-repo") {
    return "This path is not available in the repository.";
  }
  if (change.status === "error") {
    return "This file cannot be previewed right now.";
  }
  return "This file cannot be rendered in All diffs.";
}
