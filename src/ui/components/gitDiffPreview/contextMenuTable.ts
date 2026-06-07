import type { MouseEvent } from "react";
import {
  tableFromNode,
  tableFromSelectionRange,
} from "../../hooks/documentLinks/tableActions";

export function resolveDiffContextTable({
  container,
  event,
  selection,
  target,
}: {
  container: HTMLElement;
  event: Pick<MouseEvent<HTMLElement>, "clientX" | "clientY">;
  selection: string;
  target: HTMLElement;
}) {
  const activeSelection = window.getSelection();
  const selectedTable =
    selection && activeSelection
      ? (tableFromNode(activeSelection.anchorNode) ??
        tableFromNode(activeSelection.focusNode) ??
        tableFromSelectionRange(container))
      : null;
  const pointTable = document
    .elementFromPoint?.(event.clientX, event.clientY)
    ?.closest("table") as HTMLTableElement | null;
  return (
    (target.closest("table") as HTMLTableElement | null) ??
    pointTable ??
    selectedTable
  );
}
