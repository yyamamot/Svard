export interface DiffTargetContext {
  side: "left" | "right";
  surface: "rendered" | "source" | "table";
  container: HTMLElement;
}

export function diffContextForTarget(
  target: HTMLElement,
): DiffTargetContext | null {
  const renderedPane = target.closest<HTMLElement>(".git-rendered-pane");
  if (renderedPane) {
    return {
      side: renderedPane.matches(
        '[data-review-id="git-full-preview-left-pane"], [data-review-id="git-rendered-left-pane"]',
      )
        ? "left"
        : "right",
      surface: "rendered",
      container: renderedPane,
    };
  }
  const sourcePane = target.closest<HTMLElement>(".git-diff-pane");
  if (sourcePane) {
    return {
      side: sourcePane.matches('[data-review-id="git-diff-left-pane"]')
        ? "left"
        : "right",
      surface: "source",
      container: sourcePane,
    };
  }
  const tablePane = target.closest<HTMLElement>(".git-diff-table-pane");
  if (tablePane) {
    return {
      side: tablePane.matches('[data-review-id="git-diff-table-left-pane"]')
        ? "left"
        : "right",
      surface: "table",
      container: tablePane,
    };
  }
  return null;
}
