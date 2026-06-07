export interface ReorderDragState {
  fromIndex: number;
  overIndex: number;
  pointerId: number;
  startX: number;
  startY: number;
  status: "pending" | "dragging";
}

export function findReorderIndex(
  listElement: HTMLElement | null,
  itemReviewId: string,
  clientX: number,
  clientY: number,
): number | null {
  if (!listElement) {
    return null;
  }

  const element = document.elementFromPoint(clientX, clientY);
  const row =
    element instanceof HTMLElement
      ? element.closest<HTMLElement>(`[data-review-id="${itemReviewId}"]`)
      : null;
  if (!row || !listElement.contains(row)) {
    return null;
  }

  const rows = Array.from(
    listElement.querySelectorAll<HTMLElement>(
      `[data-review-id="${itemReviewId}"]`,
    ),
  );
  const index = rows.indexOf(row);
  return index >= 0 ? index : null;
}

export function sourceControlEmptyTitle(status: string | undefined): string {
  switch (status) {
    case "not-in-repo":
      return "Not in Git repository";
    case "untracked":
      return "Untracked file";
    case "no-history":
      return "No Git history";
    case "unsupported":
      return "Unsupported document";
    case "error":
      return "Git unavailable";
    default:
      return "Source Control unavailable";
  }
}
