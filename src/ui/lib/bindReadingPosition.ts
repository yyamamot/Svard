import {
  articleLayoutStateEvent,
  waitForArticleLayoutStability,
} from "./articleLayoutStability";
import {
  restoreDocumentReadingPosition,
  type ReadingSurface,
} from "./documentReadingPosition";
import type { ReadingPositionController } from "./readingPositionController";
import type { PaneId } from "../types";
import { expandCollapsedSectionsContaining } from "./sectionCollapse";

export function bindReadingPosition(
  controller: ReadingPositionController,
  pane: PaneId,
  surface: ReadingSurface,
) {
  const detach = controller.attach(pane, surface);
  const { article, viewer } = surface;
  const commit = article.dataset.layoutCommit;
  const revision = article.dataset.renderRevision;
  let disposed = false;
  let cancelWait: (() => void) | undefined;
  const isCurrent = () =>
    !disposed &&
    article.isConnected &&
    controller.surfaceFor(pane) === surface &&
    article.dataset.renderedDocumentPath === surface.payload.path &&
    article.dataset.layoutCommit === commit &&
    article.dataset.renderRevision === revision &&
    article.dataset.layoutRevision === revision;
  const currentRequest = () => {
    const request = controller.pendingFor(pane);
    return isCurrent() && request?.path === surface.payload.path
      ? request
      : undefined;
  };
  const apply = (timeout = false) => {
    const request = currentRequest();
    if (!request) return;
    if (request.target) {
      const { headingId, sourceLine } = request.target;
      const target = headingId
        ? [...article.querySelectorAll<HTMLElement>("[id]")].find(
            (node) => node.id === headingId,
          )
        : [...article.querySelectorAll<HTMLElement>("[data-source-line]")]
            .filter((node) => Number.isFinite(Number(node.dataset.sourceLine)))
            .sort(
              (a, b) =>
                Math.abs(Number(a.dataset.sourceLine) - (sourceLine ?? 0)) -
                Math.abs(Number(b.dataset.sourceLine) - (sourceLine ?? 0)),
            )[0];
      if (target) {
        expandCollapsedSectionsContaining(target);
        target.scrollIntoView({
          block: headingId ? "start" : "center",
          behavior: "auto",
        });
      }
      controller.cancel(pane);
    } else {
      restoreDocumentReadingPosition(surface, request.saved, timeout);
      request.applied = true;
      if (timeout) controller.cancel(pane);
    }
  };
  const ready = () => {
    const request = currentRequest();
    if (!request) return;
    controller.startDeadline(pane, request);
    if (article.dataset.layoutState === "ready") apply();
    else if (article.dataset.layoutState === "timeout") apply(true);
  };
  const changed = () => {
    const request = currentRequest();
    if (!request) return;
    cancelWait?.();
    cancelWait = waitForArticleLayoutStability({
      article,
      isCurrent: () => isCurrent() && controller.pendingFor(pane) === request,
      onComplete: (state) => apply(state === "timeout"),
    });
  };
  article.addEventListener(articleLayoutStateEvent, ready);
  article.addEventListener("load", changed, true);
  const observer =
    typeof ResizeObserver === "undefined" ? null : new ResizeObserver(changed);
  observer?.observe(article);
  observer?.observe(viewer);
  const unsubscribe = controller.subscribe(ready);
  ready();
  return () => {
    disposed = true;
    cancelWait?.();
    unsubscribe();
    observer?.disconnect();
    article.removeEventListener(articleLayoutStateEvent, ready);
    article.removeEventListener("load", changed, true);
    detach();
  };
}
