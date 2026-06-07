import type { PaneId, ViewerPaneSnapshot } from "../types";
import { emptySafeHtml } from "./safeHtml";

export function createEmptyPaneSnapshot(id: PaneId): ViewerPaneSnapshot {
  return {
    id,
    documentPayload: null,
    renderResult: null,
    documentHtml: emptySafeHtml,
    query: "",
    searchIndex: 0,
    searchHits: [],
    activeHeadingId: null,
    navigationBackStack: [],
    navigationForwardStack: [],
  };
}
