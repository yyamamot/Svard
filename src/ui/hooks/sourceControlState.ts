import type {
  GitCommitGraph,
  GitChanges,
  GitFileHistory,
  GitRefList,
} from "../../core/types";

export interface GitFileHistoryGitStateEntry {
  path: string;
  changes: GitChanges;
}

export function emptyGitRefList(): GitRefList {
  return {
    status: "ok",
    relativePath: null,
    items: [],
    message: null,
    hasMore: false,
    nextCursor: null,
  };
}

export function mergeGitCommitGraphPage(
  current: GitCommitGraph | null,
  page: GitCommitGraph,
) {
  if (!current || page.status !== "ok" || page.metrics?.staleCursor) {
    return page;
  }
  const seen = new Set(current.items.map((item) => item.revision));
  return {
    ...page,
    items: [
      ...current.items,
      ...page.items.filter((item) => !seen.has(item.revision)),
    ],
  };
}

export function mergeGitFileHistoryPage(
  current: GitFileHistory | null,
  page: GitFileHistory,
) {
  if (!current || page.status !== "ok" || page.metrics?.staleCursor) {
    return page;
  }
  const seen = new Set(current.items.map((item) => item.revision));
  return {
    ...page,
    items: [
      ...current.items,
      ...page.items.filter((item) => !seen.has(item.revision)),
    ],
  };
}

export function mergeGitRefPage(current: GitRefList, page: GitRefList) {
  if (page.metrics?.staleCursor) {
    return page;
  }
  const seen = new Set(
    current.items.map((item) => `${item.kind}:${item.name}:${item.revision}`),
  );
  return {
    ...page,
    items: [
      ...current.items,
      ...page.items.filter(
        (item) => !seen.has(`${item.kind}:${item.name}:${item.revision}`),
      ),
    ],
  };
}
