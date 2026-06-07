import { createElement } from "react";
import type { LucideIcon } from "lucide-react";
import { isSupportedDocumentPath } from "../../../core/documentFormat";
import { splitPathAndHash } from "../../lib/path";

export function menuIcon(Icon: LucideIcon) {
  return createElement(Icon, { size: 14 });
}

export function isSupportedDocumentHref(href: string): boolean {
  return isSupportedDocumentPath(splitPathAndHash(href).path);
}

export function documentSelectionAtPoint(
  article: HTMLElement | null,
  clientX: number,
  clientY: number,
) {
  const selection = window.getSelection();
  const text = selection?.toString() ?? "";
  if (!text || !article || !selection?.rangeCount) {
    return "";
  }
  const range = selection.getRangeAt(0);
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
  return insideSelection ? text : "";
}
