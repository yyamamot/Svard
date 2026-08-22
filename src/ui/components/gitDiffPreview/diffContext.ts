export interface DiffTargetContext {
  side: "left" | "right";
  surface: "rendered" | "source" | "table";
  container: HTMLElement;
}

function outermostMatchingAncestor(
  target: HTMLElement,
  selector: string,
): HTMLElement | null {
  let match: HTMLElement | null = null;
  for (
    let element: HTMLElement | null = target;
    element;
    element = element.parentElement
  ) {
    if (element.matches(selector)) {
      match = element;
    }
  }
  return match;
}

export function diffContextForTarget(
  target: HTMLElement,
): DiffTargetContext | null {
  const renderedPane = outermostMatchingAncestor(
    target,
    '[data-review-id="git-full-preview-left-pane"], [data-review-id="git-full-preview-right-pane"], [data-review-id="git-rendered-left-pane"], [data-review-id="git-rendered-right-pane"], [data-review-id="diff-stream-left-pane"], [data-review-id="diff-stream-right-pane"]',
  );
  if (renderedPane) {
    return {
      side: renderedPane.matches(
        '[data-review-id="git-full-preview-left-pane"], [data-review-id="git-rendered-left-pane"], [data-review-id="diff-stream-left-pane"]',
      )
        ? "left"
        : "right",
      surface: "rendered",
      container: renderedPane,
    };
  }
  const sourcePane = outermostMatchingAncestor(
    target,
    '[data-review-id="git-diff-left-pane"], [data-review-id="git-diff-right-pane"]',
  );
  if (sourcePane) {
    return {
      side: sourcePane.matches('[data-review-id="git-diff-left-pane"]')
        ? "left"
        : "right",
      surface: "source",
      container: sourcePane,
    };
  }
  const tablePane = outermostMatchingAncestor(
    target,
    '[data-review-id="git-diff-table-left-pane"], [data-review-id="git-diff-table-right-pane"]',
  );
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
