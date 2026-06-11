import type {
  RenderedBlockDiff,
  RenderedStructuredChildChangeKind,
  RenderedStructuredChildRole,
} from "./types";

export interface RenderedStructuredChildHighlight {
  active?: boolean;
  changeIndex?: number;
  childIndex: number;
  contentCursorActive?: boolean;
  kind: RenderedStructuredChildChangeKind;
  role: RenderedStructuredChildRole;
}

export function renderedStructuredChildHighlightsForSide({
  activeChangeIndex,
  block,
  changeIndexForChild,
  contentCursorActiveForChild,
  side,
}: {
  activeChangeIndex?: number;
  block: RenderedBlockDiff;
  changeIndexForChild: (childIndex: number) => number | null;
  contentCursorActiveForChild?: (childIndex: number) => boolean;
  side: "left" | "right";
}): RenderedStructuredChildHighlight[] {
  if (
    block.kind !== "changed" ||
    (block.blockKind !== "definition-list" && block.blockKind !== "admonition")
  ) {
    return [];
  }
  return (block.structuredChanges ?? []).flatMap((structuredChange) => {
    const childIndex =
      side === "left" ? structuredChange.leftIndex : structuredChange.rightIndex;
    if (childIndex === undefined) {
      return [];
    }
    const changeIndex = changeIndexForChild(childIndex) ?? undefined;
    return [
      {
        active:
          changeIndex !== undefined && activeChangeIndex === changeIndex,
        changeIndex,
        childIndex,
        contentCursorActive: contentCursorActiveForChild?.(childIndex),
        kind: structuredChange.kind,
        role: structuredChange.role,
      },
    ];
  });
}

export function applyRenderedStructuredChildHighlights(
  html: string,
  highlights: readonly RenderedStructuredChildHighlight[],
): string {
  if (highlights.length === 0) {
    return html;
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  for (const highlight of highlights) {
    if (highlight.role === "definition-item") {
      applyDefinitionItemHighlight(doc, highlight);
    } else {
      applyAdmonitionContentHighlight(doc, highlight);
    }
  }
  return doc.body.innerHTML;
}

function applyTargetMetadata(
  element: Element,
  highlight: RenderedStructuredChildHighlight,
) {
  element.classList.add(
    "git-rendered-structured-child-change",
    highlight.kind,
  );
  element.setAttribute(
    "data-review-id",
    "git-rendered-structured-child-change",
  );
  if (highlight.changeIndex !== undefined) {
    element.setAttribute("data-change-index", String(highlight.changeIndex));
  }
  if (highlight.active) {
    element.classList.add("active-change");
    element.setAttribute("data-active-change", "true");
  }
  if (highlight.contentCursorActive) {
    element.classList.add("content-cursor-active");
    element.setAttribute("data-content-cursor-active", "true");
  }
}

function applyContextHighlight(
  element: Element,
  highlight: RenderedStructuredChildHighlight,
) {
  element.classList.add(
    "git-rendered-structured-child-context",
    highlight.kind,
  );
}

function definitionItems(doc: Document): Array<{
  descriptions: Element[];
  term: Element;
}> {
  const list = doc.body.matches("dl")
    ? doc.body
    : doc.body.querySelector("dl");
  if (!list) {
    return [];
  }
  const items: Array<{ descriptions: Element[]; term: Element }> = [];
  const children = Array.from(list.children);
  let index = 0;
  while (index < children.length) {
    const term = children[index];
    if (!term || term.tagName.toLowerCase() !== "dt") {
      index += 1;
      continue;
    }
    const descriptions: Element[] = [];
    index += 1;
    while (
      index < children.length &&
      children[index]?.tagName.toLowerCase() === "dd"
    ) {
      descriptions.push(children[index] as Element);
      index += 1;
    }
    items.push({ descriptions, term });
  }
  return items;
}

function applyDefinitionItemHighlight(
  doc: Document,
  highlight: RenderedStructuredChildHighlight,
) {
  const item = definitionItems(doc)[highlight.childIndex];
  if (!item) {
    return;
  }
  applyContextHighlight(item.term, highlight);
  const target = item.descriptions[0] ?? item.term;
  applyTargetMetadata(target, highlight);
  for (const description of item.descriptions.slice(1)) {
    applyContextHighlight(description, highlight);
  }
}

function markdownAlertContentTargets(doc: Document): Element[] {
  const alert = doc.body.querySelector(".markdown-alert");
  if (!alert) {
    return [];
  }
  const children = Array.from(alert.children).filter(
    (child) => !child.classList.contains("markdown-alert-title"),
  );
  return children.length > 0 ? children : [alert];
}

function applyAdmonitionContentHighlight(
  doc: Document,
  highlight: RenderedStructuredChildHighlight,
) {
  const content =
    doc.body.querySelector(".admonitionblock td.content") ??
    markdownAlertContentTargets(doc)[0];
  if (!content) {
    return;
  }
  applyTargetMetadata(content, highlight);
}
