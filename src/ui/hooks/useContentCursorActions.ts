import { useCallback, type RefObject } from "react";
import type { DocumentDiffPreview } from "../../core/types";
import {
  clearContentCursor,
  moveContentCursor,
  type ContentCursorCommandHandler,
} from "../lib/contentCursor";

interface UseContentCursorActionsOptions {
  articleRef: RefObject<HTMLElement | null>;
  viewerRef: RefObject<HTMLElement | null>;
  documentDiffPreview: DocumentDiffPreview | null;
  diffContentCursorCommandRef: RefObject<ContentCursorCommandHandler | null>;
  diffContentCursorClearRef: RefObject<(() => void) | null>;
}

function visibleDiffContentCursorRoots() {
  const paneReviewIds = [
    "git-full-preview-right-pane",
    "git-rendered-right-pane",
    "git-full-preview-left-pane",
    "git-rendered-left-pane",
  ];
  return paneReviewIds
    .map((reviewId) =>
      document.querySelector<HTMLElement>(
        `[data-review-id="${reviewId}"] .git-rendered-scroll`,
      ),
    )
    .filter((root): root is HTMLElement => root !== null);
}

export function useContentCursorActions({
  articleRef,
  viewerRef,
  documentDiffPreview,
  diffContentCursorCommandRef,
  diffContentCursorClearRef,
}: UseContentCursorActionsOptions) {
  const clearActiveContentCursor = useCallback(() => {
    clearContentCursor(articleRef.current);
    diffContentCursorClearRef.current?.();
    clearContentCursor(...visibleDiffContentCursorRoots());
  }, [articleRef, diffContentCursorClearRef]);

  const moveActiveContentCursor = useCallback(
    (direction: "next" | "previous") => {
      if (documentDiffPreview) {
        return diffContentCursorCommandRef.current?.(direction) ?? false;
      }
      return moveContentCursor({
        root: articleRef.current,
        scrollContainer: viewerRef.current,
        direction,
      });
    },
    [articleRef, diffContentCursorCommandRef, documentDiffPreview, viewerRef],
  );

  return {
    clearActiveContentCursor,
    moveActiveContentCursor,
  };
}
