import { Copy, Link as LinkIcon } from "lucide-react";
import type { ContextMenuItem } from "../../types";
import {
  tableToCsv,
  tableToMarkdown,
  tableToTsv,
} from "../../lib/tableClipboard";
import type { CopyText } from "./types";
import { menuIcon } from "./shared";

export function tableFromNode(node: Node | null): HTMLTableElement | null {
  const element =
    node instanceof HTMLElement ? node : (node?.parentElement ?? null);
  return element?.closest("table") as HTMLTableElement | null;
}

export function tableFromSelectionRange(
  article: HTMLElement | null,
): HTMLTableElement | null {
  const activeSelection = window.getSelection();
  if (!activeSelection?.rangeCount || !article) {
    return null;
  }
  const range = activeSelection.getRangeAt(0);
  for (const candidate of article.querySelectorAll("table")) {
    if (range.intersectsNode(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function addTableItems(
  items: ContextMenuItem[],
  targetTable: HTMLTableElement,
  copyText: CopyText,
) {
  const tableReference =
    targetTable.getAttribute("data-source-reference") ?? undefined;
  items.push({
    id: "copy-table-tsv",
    label: "Copy as TSV",
    icon: menuIcon(Copy),
    onSelect: () => copyText("Table TSV", tableToTsv(targetTable)),
  });
  items.push({
    id: "copy-table-csv",
    label: "Copy as CSV",
    icon: menuIcon(Copy),
    onSelect: () => copyText("Table CSV", tableToCsv(targetTable)),
  });
  items.push({
    id: "copy-table-markdown",
    label: "Copy as Markdown Table",
    icon: menuIcon(Copy),
    onSelect: () => copyText("Markdown table", tableToMarkdown(targetTable)),
  });
  if (tableReference) {
    items.push({
      id: "copy-table-reference",
      label: "Copy Table Reference",
      icon: menuIcon(LinkIcon),
      onSelect: () => copyText("Table reference", tableReference),
    });
  }
}
