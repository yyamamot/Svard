import { perfBasename } from "./perfTrace";
import type { GitChanges } from "../../core/types";

export interface PostDiffGitMarkerRefreshDecision {
  shouldInvalidate: boolean;
  matchedActiveDocument: boolean;
  trace: {
    basename: string | null;
    changedBasename: string | null;
    matchedActiveDocument: boolean;
    reason: string;
  };
}

export function shouldInvalidatePostDiffGitMarkersForWorkspaceFileChange({
  activeDocumentPath,
  changedPath,
  reason,
}: {
  activeDocumentPath: string | null;
  changedPath: string | null;
  reason: string;
}): PostDiffGitMarkerRefreshDecision {
  const matchedActiveDocument =
    Boolean(activeDocumentPath) &&
    Boolean(changedPath) &&
    activeDocumentPath === changedPath;

  return {
    shouldInvalidate: matchedActiveDocument,
    matchedActiveDocument,
    trace: {
      basename: perfBasename(activeDocumentPath),
      changedBasename: perfBasename(changedPath),
      matchedActiveDocument,
      reason,
    },
  };
}

export function shouldInvalidatePostDiffGitMarkersForGitRefreshReason(
  reason: string,
): boolean {
  return !reason.startsWith("file-tree-");
}

export interface PostDiffGitMarkerGitChangesRefreshDecision {
  shouldRefresh: boolean;
  matchedActiveDocument: boolean;
  activeDocumentStillDirty: boolean;
  trace: {
    basename: string | null;
    activeDocumentStillDirty: boolean;
    changeCount: number;
    matchedActiveDocument: boolean;
    reason: string;
  };
}

export function shouldRefreshPostDiffGitMarkersForGitChanges({
  activeDocumentPath,
  changes,
  hasActiveMarkerContext,
  reason,
}: {
  activeDocumentPath: string | null;
  changes: GitChanges;
  hasActiveMarkerContext: boolean;
  reason: string;
}): PostDiffGitMarkerGitChangesRefreshDecision {
  const activeDocumentStillDirty = Boolean(
    activeDocumentPath &&
      changes.items.some((item) => item.documentPath === activeDocumentPath),
  );
  const matchedActiveDocument = activeDocumentStillDirty;
  const isRelevantReason =
    reason === "metadata-event" || reason === "visibility-restore";
  const shouldRefresh =
    hasActiveMarkerContext && isRelevantReason && changes.status === "ok";

  return {
    shouldRefresh,
    matchedActiveDocument,
    activeDocumentStillDirty,
    trace: {
      basename: perfBasename(activeDocumentPath),
      activeDocumentStillDirty,
      changeCount: changes.items.length,
      matchedActiveDocument,
      reason,
    },
  };
}
