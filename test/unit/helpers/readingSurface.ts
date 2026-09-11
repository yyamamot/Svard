import type { DocumentPayload } from "../../../src/core/types";
import type { ReadingSurface } from "../../../src/ui/lib/documentReadingPosition";

export function readingSurface(path = "/workspace/a.md") {
  const viewer = document.createElement("section");
  viewer.className = "viewer-pane";
  viewer.dataset.paneId = "left";
  const article = document.createElement("article");
  viewer.append(article);
  document.body.append(viewer);
  const payload: DocumentPayload = {
    path,
    basePath: "/workspace",
    source: "# Chapter\n\nReading paragraph",
    format: "markdown",
    updatedAt: "1",
  };
  const geometry = { height: 5000, width: 800, viewport: 500 };
  Object.defineProperties(viewer, {
    scrollHeight: { get: () => geometry.height },
    clientHeight: { get: () => geometry.viewport },
  });
  Object.defineProperties(article, {
    scrollHeight: { get: () => geometry.height },
    clientHeight: { get: () => geometry.height },
    clientWidth: { get: () => geometry.width },
  });
  viewer.getBoundingClientRect = () => rect(100, geometry.viewport);
  article.dataset.renderedDocumentPath = path;
  article.dataset.renderRevision = "0";
  article.dataset.layoutRevision = "0";
  article.dataset.layoutCommit = "1";
  article.dataset.layoutState = "ready";
  const add = (
    tag: string,
    y: number,
    attributes: Record<string, string> = {},
  ) => {
    const element = document.createElement(tag);
    element.textContent = tag === "h2" ? "Chapter" : "Reading paragraph";
    for (const [key, value] of Object.entries(attributes))
      element.setAttribute(key, value);
    const position = { y, visible: true };
    element.getBoundingClientRect = () =>
      rect(100 + position.y - viewer.scrollTop, 30);
    element.getClientRects = () =>
      (position.visible
        ? [element.getBoundingClientRect()]
        : []) as unknown as DOMRectList;
    article.append(element);
    return { element, position };
  };
  const heading = add("h2", 500, { id: "chapter" });
  const paragraph = add("p", 1200, {
    "data-source-reference": `${path}:20`,
    "data-source-line": "20",
  });
  const surface: ReadingSurface = { article, viewer, payload, zoom: 100 };
  return { surface, geometry, heading, paragraph, add };
}

function rect(top: number, height: number): DOMRect {
  return {
    top,
    bottom: top + height,
    height,
    left: 0,
    right: 800,
    width: 800,
    x: 0,
    y: top,
    toJSON: () => ({}),
  };
}
