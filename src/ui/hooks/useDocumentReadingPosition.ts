import {
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
  type RefObject,
} from "react";
import type { DocumentPayload, RenderResult } from "../../core/types";
import type { SafeHtml } from "../lib/safeHtml";
import type { PaneId } from "../types";
import { bindReadingPosition } from "../lib/bindReadingPosition";
import {
  createReadingPositionController,
  type ReadingPositionController,
} from "../lib/readingPositionController";

export function useDocumentReadingPosition() {
  const [controller] = useState(createReadingPositionController);
  useSyncExternalStore(controller.subscribe, controller.getRevision);
  useEffect(() => {
    const onInput = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (event instanceof KeyboardEvent) {
        if (target.closest('input,textarea,select,[contenteditable="true"]'))
          return;
        if (
          ![
            "ArrowDown",
            "ArrowUp",
            "PageDown",
            "PageUp",
            "Home",
            "End",
            " ",
          ].includes(event.key)
        )
          return;
      }
      const pane = target.closest<HTMLElement>(".viewer-pane")?.dataset.paneId;
      if (pane === "left" || pane === "right") controller.cancel(pane);
    };
    const events = ["wheel", "touchstart", "pointerdown", "click", "keydown"];
    events.forEach((event) =>
      document.addEventListener(event, onInput, {
        capture: true,
        passive: true,
      }),
    );
    return () => {
      events.forEach((event) =>
        document.removeEventListener(event, onInput, true),
      );
      controller.dispose();
    };
  }, [controller]);
  return controller;
}

export function usePaneReadingPosition({
  controller,
  paneId,
  articleRef,
  payload,
  result,
  html,
  renderIdentity,
  zoom,
  error,
}: {
  controller?: ReadingPositionController;
  paneId: PaneId;
  articleRef: RefObject<HTMLElement | null>;
  payload: DocumentPayload | null;
  result: RenderResult | null;
  html: SafeHtml;
  renderIdentity: string;
  zoom: number;
  error: string | null;
}) {
  // Called after ViewerPane commits its HTML and layout identity.
  useLayoutEffect(() => {
    if (error) {
      controller?.cancel(paneId);
      return;
    }
    const article = articleRef.current;
    const viewer = article?.closest<HTMLElement>(".viewer-pane");
    if (!controller || !article || !viewer || !payload || !result) return;
    return bindReadingPosition(controller, paneId, {
      article,
      viewer,
      payload,
      zoom,
    });
  }, [
    controller,
    paneId,
    articleRef,
    payload,
    result,
    html,
    renderIdentity,
    zoom,
    error,
  ]);
}
