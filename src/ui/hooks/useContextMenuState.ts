import { useCallback, useState } from "react";
import type { MouseEvent } from "react";
import type { ContextMenuItem, ContextMenuState } from "../types";

export function useContextMenuState() {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const openContextMenu = useCallback(
    (
      event: MouseEvent<HTMLElement>,
      items: ContextMenuItem[],
      sourceReviewId?: string,
    ) => {
      if (items.length === 0) {
        return false;
      }

      event.preventDefault();
      event.stopPropagation();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        items,
        sourceReviewId,
      });
      return true;
    },
    [],
  );

  return {
    contextMenu,
    closeContextMenu,
    openContextMenu,
  };
}
