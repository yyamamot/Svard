import { useMemo, useRef } from "react";
import type { ContentCursorCommandHandler } from "../lib/contentCursor";
import type { DocumentDiffStreamCommandBridge } from "../lib/documentDiffStreamCommands";

export function useDiffOverlayCommandRefs() {
  const diffContentCursorCommandRef =
    useRef<ContentCursorCommandHandler | null>(null);
  const diffContentCursorClearRef = useRef<(() => void) | null>(null);
  const diffStreamCommandRef =
    useRef<DocumentDiffStreamCommandBridge | null>(null);

  return useMemo(
    () => ({
      diffContentCursorClearRef,
      diffContentCursorCommandRef,
      diffStreamCommandRef,
    }),
    [],
  );
}
