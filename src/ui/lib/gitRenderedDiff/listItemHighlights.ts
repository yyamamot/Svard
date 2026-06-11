import type {
  RenderedBlockDiff,
  RenderedListItemChildChangeKind,
} from "./types";

export interface RenderedListItemHighlight {
  active?: boolean;
  changeIndex?: number;
  contentCursorActive?: boolean;
  itemIndex: number;
  kind: RenderedListItemChildChangeKind;
}

export function renderedListItemHighlightsForSide({
  activeChangeIndex,
  block,
  changeIndexForItem,
  contentCursorActiveForItem,
  side,
}: {
  activeChangeIndex?: number;
  block: RenderedBlockDiff;
  changeIndexForItem: (itemIndex: number) => number | null;
  contentCursorActiveForItem?: (
    childChangeIndex: number,
    itemIndex: number,
  ) => boolean;
  side: "left" | "right";
}): RenderedListItemHighlight[] {
  if (block.kind !== "changed" || block.blockKind !== "list") {
    return [];
  }
  return (block.childChanges ?? []).flatMap((childChange, childChangeIndex) => {
    const itemIndex =
      side === "left" ? childChange.leftIndex : childChange.rightIndex;
    if (itemIndex === undefined) {
      return [];
    }
    const changeIndex = changeIndexForItem(itemIndex) ?? undefined;
    return [
      {
        active:
          changeIndex !== undefined && activeChangeIndex === changeIndex,
        changeIndex,
        contentCursorActive: contentCursorActiveForItem?.(
          childChangeIndex,
          itemIndex,
        ),
        itemIndex,
        kind: childChange.kind,
      },
    ];
  });
}

export function applyRenderedListItemHighlights(
  html: string,
  highlights: readonly RenderedListItemHighlight[],
): string {
  if (highlights.length === 0 || !html.includes("<li")) {
    return html;
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  const highlightByIndex = new Map(
    highlights.map((highlight) => [highlight.itemIndex, highlight]),
  );

  doc.body.querySelectorAll(":scope > ul, :scope > ol").forEach((list) => {
    Array.from(list.children)
      .filter((child) => child.tagName.toLowerCase() === "li")
      .forEach((item, index) => {
        const highlight = highlightByIndex.get(index);
        if (!highlight) {
          return;
        }
        item.classList.add("git-rendered-list-item-change", highlight.kind);
        item.setAttribute("data-review-id", "git-rendered-list-item-change");
        if (highlight.changeIndex !== undefined) {
          item.setAttribute("data-change-index", String(highlight.changeIndex));
        }
        if (highlight.active) {
          item.classList.add("active-change");
          item.setAttribute("data-active-change", "true");
        }
        if (highlight.contentCursorActive) {
          item.classList.add("content-cursor-active");
          item.setAttribute("data-content-cursor-active", "true");
        }
      });
  });

  return doc.body.innerHTML;
}
