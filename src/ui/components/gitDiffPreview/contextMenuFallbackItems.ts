import { Copy, FilePenLine, Link as LinkIcon } from "lucide-react";
import type { ContextMenuItem } from "../../types";
import { menuIcon } from "../../hooks/documentLinks/shared";
import type { CopyText } from "../../hooks/documentLinks/types";

export function addDiffDocumentPathItems(
  items: ContextMenuItem[],
  documentPath: string,
  actions: {
    copyText: CopyText;
    openPathInEditor: (path: string) => Promise<void>;
  },
) {
  items.push({
    id: "open-in-editor",
    label: "Open in Editor",
    icon: menuIcon(FilePenLine),
    onSelect: () => actions.openPathInEditor(documentPath),
  });
  items.push({
    id: "copy-document-path",
    label: "Copy Document Path",
    icon: menuIcon(Copy),
    onSelect: () => actions.copyText("Path", documentPath),
  });
}

export function addCopyPaneTextItem(
  items: ContextMenuItem[],
  container: HTMLElement,
  copyText: CopyText,
) {
  const value = (container.textContent ?? "").trim();
  if (!value) {
    return;
  }
  items.push({
    id: "copy-pane-text",
    label: "Copy Pane Text",
    icon: menuIcon(Copy),
    onSelect: () => copyText("Pane text", value),
  });
}

export function addDiffPreSourceItems(
  items: ContextMenuItem[],
  target: HTMLElement,
  copyText: CopyText,
) {
  const pre = target.closest("pre");
  if (!pre) {
    return;
  }
  const sourceReference =
    pre.getAttribute("data-source-reference") ?? undefined;
  items.push({
    id: "copy-source",
    label: "Copy Source",
    icon: menuIcon(Copy),
    onSelect: () => copyText("Source block", pre.textContent ?? ""),
  });
  if (sourceReference) {
    items.push({
      id: "copy-source-reference",
      label: "Copy Source Reference",
      icon: menuIcon(LinkIcon),
      onSelect: () => copyText("Source reference", sourceReference),
    });
  }
}
