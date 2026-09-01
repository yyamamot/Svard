import { createElement } from "react";
import type { LucideIcon } from "lucide-react";
import { selectionVisibleTextForRange } from "../../lib/documentSelection";

export function menuIcon(Icon: LucideIcon) {
  return createElement(Icon, { size: 14 });
}

export function documentSelectionAtPoint(
  article: HTMLElement | null,
  clientX: number,
  clientY: number,
) {
  const selection = window.getSelection();
  if (!article || !selection?.rangeCount || selection.isCollapsed) {
    return "";
  }
  const range = selection.getRangeAt(0);
  const text = selectionVisibleTextForRange(range);
  if (!text) {
    return "";
  }
  const ancestor = range.commonAncestorContainer;
  const node =
    ancestor.nodeType === Node.ELEMENT_NODE ? ancestor : ancestor.parentElement;
  if (!node || !article.contains(node)) {
    return "";
  }
  const rects = Array.from(range.getClientRects());
  const insideSelection = rects.some(
    (rect) =>
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom,
  );
  if (insideSelection) {
    return text;
  }
  let clicked = document.elementFromPoint(clientX, clientY);
  while (clicked && article.contains(clicked)) {
    try {
      if (range.intersectsNode(clicked)) {
        return text;
      }
    } catch {
      return "";
    }
    if (clicked === article) break;
    clicked = clicked.parentElement;
  }
  return "";
}

export function sourceRangeForSelection() {
  const selection = window.getSelection();
  if (!selection?.rangeCount || selection.isCollapsed) {
    return undefined;
  }
  const range = selection.getRangeAt(0);
  const sourceBlock = sourcePreForNode(range.commonAncestorContainer);
  if (
    !sourceBlock ||
    sourceBlock.closest(".source-block-frame.source-block-collapsed")
  ) {
    return undefined;
  }
  const source = range.cloneContents().textContent ?? "";
  return source || undefined;
}

function sourcePreForNode(node: Node) {
  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as HTMLElement)
      : node.parentElement;
  return element?.closest<HTMLPreElement>(".source-block-frame pre") ?? null;
}
