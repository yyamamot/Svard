import { perfBasename } from "./perfTrace";

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
