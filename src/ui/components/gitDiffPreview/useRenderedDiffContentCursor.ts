import { useEffect, useState } from "react";
import type { RefObject } from "react";
import type { ContentCursorCommandHandler } from "../../lib/contentCursor";
import {
  nextRenderedDiffContentCursorTarget,
  renderedDiffContentCursorTargets,
} from "../../lib/gitRenderedDiff";
import type {
  RenderedDiffContentCursorTarget,
  RenderedDiffPresentation,
  RenderedDiffPresentationEntry,
} from "../../lib/gitRenderedDiff";
import type { DiffView } from "./types";

interface UseRenderedDiffContentCursorOptions {
  activeChangeIndex: number;
  contentCursorClearRef?: RefObject<(() => void) | null>;
  contentCursorCommandRef?: RefObject<ContentCursorCommandHandler | null>;
  panelRef: RefObject<HTMLElement | null>;
  previewRelativePath?: string | null;
  renderedChangedEntries: RenderedDiffPresentationEntry[];
  renderedPresentation: RenderedDiffPresentation;
  setActiveChangeIndex: (index: number) => void;
  view: DiffView;
}

export function useRenderedDiffContentCursor({
  activeChangeIndex,
  contentCursorClearRef,
  contentCursorCommandRef,
  panelRef,
  previewRelativePath,
  renderedChangedEntries,
  renderedPresentation,
  setActiveChangeIndex,
  view,
}: UseRenderedDiffContentCursorOptions) {
  const [contentCursorActive, setContentCursorActive] =
    useState<RenderedDiffContentCursorTarget | null>(null);

  function clearRenderedContentCursor() {
    setContentCursorActive(null);
  }

  function currentRenderedEntries() {
    if (view === "preview") {
      return renderedPresentation.entries;
    }
    if (view === "rendered") {
      return renderedChangedEntries;
    }
    return [];
  }

  function moveRenderedContentCursor(direction: "next" | "previous") {
    if (view !== "preview" && view !== "rendered") {
      return false;
    }

    const nextTarget = nextRenderedDiffContentCursorTarget({
      targets: renderedDiffContentCursorTargets(
        renderedPresentation,
        currentRenderedEntries(),
      ),
      activeTarget: contentCursorActive,
      activeChangeIndex,
      direction,
    });
    if (nextTarget) {
      setContentCursorActive(nextTarget);
      setActiveChangeIndex(nextTarget.changeIndex);
      return true;
    }
    return false;
  }

  useEffect(() => {
    if (!contentCursorCommandRef) {
      return;
    }
    contentCursorCommandRef.current = moveRenderedContentCursor;
    return () => {
      contentCursorCommandRef.current = null;
    };
  });

  useEffect(() => {
    if (!contentCursorClearRef) {
      return;
    }
    contentCursorClearRef.current = clearRenderedContentCursor;
    return () => {
      contentCursorClearRef.current = null;
    };
  });

  useEffect(() => {
    clearRenderedContentCursor();
  }, [view, previewRelativePath]);

  useEffect(() => {
    const active = panelRef.current?.querySelector<HTMLElement>(
      '[data-content-cursor-active="true"]',
    );
    active?.scrollIntoView({ block: "center", inline: "nearest" });
  }, [contentCursorActive, panelRef]);

  return {
    clearRenderedContentCursor,
    contentCursorActive,
  };
}
