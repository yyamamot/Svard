import type { DocumentPayload } from "../../core/types";

export interface ReadingSurface {
  article: HTMLElement;
  viewer: HTMLElement;
  payload: DocumentPayload;
  zoom: number;
}

interface ReadingAnchor {
  id: string;
  offset: number;
  fingerprint: number;
}

export interface DocumentReadingPosition {
  top: number;
  version: string;
  width: number;
  height: number;
  viewportHeight: number;
  zoom: number;
  source?: ReadingAnchor;
  heading?: ReadingAnchor;
}

const versions = new WeakMap<DocumentPayload, string>();
const headingSelector = "h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]";

function fingerprint(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  }
  return hash;
}

function version(payload: DocumentPayload): string {
  let value = versions.get(payload);
  if (!value) {
    value = `${payload.updatedAt ?? ""}:${payload.source.length}:${fingerprint(payload.source)}`;
    versions.set(payload, value);
  }
  return value;
}

function uniqueVisibleTargets(
  article: HTMLElement,
  selector: string,
  attribute: string,
) {
  const groups = new Map<string, HTMLElement[]>();
  for (const element of article.querySelectorAll<HTMLElement>(selector)) {
    const id = element.getAttribute(attribute);
    if (id) groups.set(id, [...(groups.get(id) ?? []), element]);
  }
  return [...groups].flatMap(([id, elements]) => {
    const element = elements[0]!;
    return elements.length === 1 &&
      !element.closest('[hidden],[aria-hidden="true"]') &&
      element.getClientRects().length > 0 &&
      element.getBoundingClientRect().height > 0
      ? [{ id, element }]
      : [];
  });
}

function captureAnchor(
  surface: ReadingSurface,
  selector: string,
  attribute: string,
) {
  const viewerTop = surface.viewer.getBoundingClientRect().top;
  let nearest: ReadingAnchor | undefined;
  for (const { id, element } of uniqueVisibleTargets(
    surface.article,
    selector,
    attribute,
  )) {
    const offset = element.getBoundingClientRect().top - viewerTop;
    if (!nearest || Math.abs(offset) < Math.abs(nearest.offset)) {
      nearest = {
        id,
        offset,
        fingerprint: fingerprint(element.textContent ?? ""),
      };
    }
  }
  return nearest;
}

export function captureDocumentReadingPosition(
  surface: ReadingSurface,
): DocumentReadingPosition {
  return {
    top: surface.viewer.scrollTop,
    version: version(surface.payload),
    width: surface.article.clientWidth,
    height: surface.article.scrollHeight,
    viewportHeight: surface.viewer.clientHeight,
    zoom: surface.zoom,
    source: captureAnchor(
      surface,
      "[data-source-reference]",
      "data-source-reference",
    ),
    heading: captureAnchor(surface, headingSelector, "id"),
  };
}

export function restoreDocumentReadingPosition(
  surface: ReadingSurface,
  saved?: DocumentReadingPosition,
  pixelOnly = false,
) {
  const sameLayout =
    saved &&
    saved.version === version(surface.payload) &&
    saved.width === surface.article.clientWidth &&
    saved.height === surface.article.scrollHeight &&
    saved.viewportHeight === surface.viewer.clientHeight &&
    saved.zoom === surface.zoom;
  let top = saved?.top ?? 0;
  if (saved && !sameLayout && !pixelOnly) {
    for (const [anchor, selector, attribute] of [
      [saved.source, "[data-source-reference]", "data-source-reference"],
      [saved.heading, headingSelector, "id"],
    ] as const) {
      if (!anchor) continue;
      const target = uniqueVisibleTargets(
        surface.article,
        selector,
        attribute,
      ).find(
        ({ id, element }) =>
          id === anchor.id &&
          // A source line may now point to different content after an edit.
          (attribute === "id" ||
            fingerprint(element.textContent ?? "") === anchor.fingerprint),
      );
      if (!target) continue;
      top =
        surface.viewer.scrollTop +
        target.element.getBoundingClientRect().top -
        surface.viewer.getBoundingClientRect().top -
        anchor.offset;
      break;
    }
  }
  surface.viewer.scrollTop = Math.max(
    0,
    Math.min(
      Number.isFinite(top) ? top : 0,
      Math.max(0, surface.viewer.scrollHeight - surface.viewer.clientHeight),
    ),
  );
}
