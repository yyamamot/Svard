export type DocumentReviewState = "unreviewed" | "viewed" | "needs-attention";

export type DocumentReviewStateByPath = Record<string, DocumentReviewState>;

export interface DocumentReviewSessionSummary {
  total: number;
  reviewed: number;
  needsAttention: number;
}

export interface DocumentReviewSessionControls {
  stateByPath: DocumentReviewStateByPath;
  summary: DocumentReviewSessionSummary;
  markViewed: (path: string) => void;
  markNeedsAttention: (path: string) => void;
  reset: (path: string) => void;
}

export const emptyDocumentReviewSessionSummary: DocumentReviewSessionSummary = {
  total: 0,
  reviewed: 0,
  needsAttention: 0,
};

export const emptyDocumentReviewSessionControls: DocumentReviewSessionControls =
  {
    stateByPath: {},
    summary: emptyDocumentReviewSessionSummary,
    markViewed: () => undefined,
    markNeedsAttention: () => undefined,
    reset: () => undefined,
  };

export function summarizeDocumentReviewSession({
  stateByPath,
  targetPaths,
}: {
  stateByPath: DocumentReviewStateByPath;
  targetPaths: readonly string[];
}): DocumentReviewSessionSummary {
  let reviewed = 0;
  let needsAttention = 0;
  const paths = uniqueDocumentReviewPaths(targetPaths);
  for (const path of paths) {
    const state = stateByPath[path] ?? "unreviewed";
    if (state === "viewed") {
      reviewed += 1;
    } else if (state === "needs-attention") {
      reviewed += 1;
      needsAttention += 1;
    }
  }
  return {
    total: paths.length,
    reviewed,
    needsAttention,
  };
}

export function uniqueDocumentReviewPaths(paths: readonly string[]): string[] {
  return [...new Set(paths.filter(Boolean))];
}

export function nextDocumentReviewPath({
  currentPath,
  stateByPath,
  targetPaths,
}: {
  currentPath?: string | null;
  stateByPath: DocumentReviewStateByPath;
  targetPaths: readonly string[];
}): string | null {
  const paths = uniqueDocumentReviewPaths(targetPaths);
  if (paths.length === 0) {
    return null;
  }
  const unreviewed = paths.find(
    (path) => (stateByPath[path] ?? "unreviewed") === "unreviewed",
  );
  if (unreviewed) {
    return unreviewed;
  }
  const currentIndex = currentPath ? paths.indexOf(currentPath) : -1;
  return paths[(currentIndex + 1 + paths.length) % paths.length] ?? null;
}

export function previousDocumentReviewPath({
  currentPath,
  targetPaths,
}: {
  currentPath?: string | null;
  targetPaths: readonly string[];
}): string | null {
  const paths = uniqueDocumentReviewPaths(targetPaths);
  if (paths.length === 0) {
    return null;
  }
  const currentIndex = currentPath ? paths.indexOf(currentPath) : -1;
  const fallbackIndex = currentIndex === -1 ? 0 : currentIndex;
  return paths[(fallbackIndex - 1 + paths.length) % paths.length] ?? null;
}

export function documentReviewStateLabel(
  state: DocumentReviewState | undefined,
): string {
  switch (state) {
    case "viewed":
      return "Viewed";
    case "needs-attention":
      return "Needs attention";
    default:
      return "Unreviewed";
  }
}
