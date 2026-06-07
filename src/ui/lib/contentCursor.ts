export type ContentCursorDirection = "next" | "previous";

export type ContentCursorCommandHandler = (
  direction: ContentCursorDirection,
) => boolean;

export const contentCursorActiveClass = "content-cursor-active";
export const contentCursorActiveReviewId = "content-cursor-active";

const previousReviewIdAttribute = "data-content-cursor-previous-review-id";

const targetSelector = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "ul",
  "ol",
  "table",
  ".source-block-frame",
  "pre",
  ".imageblock",
  "img",
  ".diagram-slot",
  ".diagram-inline",
  ".diagram-inline-diagnostic",
  ".diagram-inline-image",
].join(",");

function hasHiddenAncestor(element: HTMLElement) {
  for (
    let current: HTMLElement | null = element;
    current;
    current = current.parentElement
  ) {
    if (
      current.hidden ||
      current.getAttribute("aria-hidden") === "true" ||
      current.style.display === "none" ||
      current.style.visibility === "hidden"
    ) {
      return true;
    }
    const view = current.ownerDocument.defaultView;
    if (view) {
      const style = view.getComputedStyle(current);
      if (style.display === "none" || style.visibility === "hidden") {
        return true;
      }
    }
  }
  return false;
}

function isMediaOrDiagram(element: HTMLElement) {
  return (
    element.matches(
      "img,.imageblock,.diagram-slot,.diagram-inline,.diagram-inline-diagnostic,.diagram-inline-image",
    ) || element.querySelector("img,.diagram-slot,.diagram-inline") !== null
  );
}

function hasReadableContent(element: HTMLElement) {
  if (isMediaOrDiagram(element)) {
    return true;
  }
  return (element.textContent ?? "").trim().length > 0;
}

function shouldSkipElement(element: HTMLElement) {
  if (hasHiddenAncestor(element)) {
    return true;
  }
  if (element.closest("button,[role='button'],.diagram-inline-actions")) {
    return true;
  }
  if (
    element.matches("p") &&
    !element.textContent?.trim() &&
    isMediaOrDiagram(element)
  ) {
    return true;
  }
  return !hasReadableContent(element);
}

function restoreReviewId(element: HTMLElement) {
  const previousReviewId = element.getAttribute(previousReviewIdAttribute);
  if (previousReviewId === null) {
    element.removeAttribute("data-review-id");
  } else {
    element.setAttribute("data-review-id", previousReviewId);
    element.removeAttribute(previousReviewIdAttribute);
  }
}

function setActiveReviewId(element: HTMLElement) {
  if (!element.hasAttribute(previousReviewIdAttribute)) {
    const previousReviewId = element.getAttribute("data-review-id");
    if (previousReviewId !== null) {
      element.setAttribute(previousReviewIdAttribute, previousReviewId);
    }
  }
  element.setAttribute("data-review-id", contentCursorActiveReviewId);
}

function activeElement(root: ParentNode) {
  return root.querySelector<HTMLElement>(`.${contentCursorActiveClass}`);
}

export function extractContentCursorTargets(root: ParentNode | null) {
  if (!root) {
    return [];
  }

  const accepted: HTMLElement[] = [];
  for (const element of root.querySelectorAll<HTMLElement>(targetSelector)) {
    if (shouldSkipElement(element)) {
      continue;
    }
    if (accepted.some((target) => target.contains(element))) {
      continue;
    }
    accepted.push(element);
  }
  return accepted;
}

export function clearContentCursor(...roots: Array<ParentNode | null>) {
  for (const root of roots) {
    if (!root) {
      continue;
    }
    root
      .querySelectorAll<HTMLElement>(`.${contentCursorActiveClass}`)
      .forEach((element) => {
        element.classList.remove(contentCursorActiveClass);
        restoreReviewId(element);
      });
  }
}

function nearestViewportTargetIndex(
  targets: HTMLElement[],
  scrollContainer: HTMLElement | null,
) {
  const containerTop = scrollContainer?.getBoundingClientRect().top ?? 0;
  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  targets.forEach((target, index) => {
    const distance = Math.abs(
      target.getBoundingClientRect().top - containerTop,
    );
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  return nearestIndex;
}

export function moveContentCursor({
  root,
  scrollContainer,
  direction,
}: {
  root: ParentNode | null;
  scrollContainer: HTMLElement | null;
  direction: ContentCursorDirection;
}) {
  const targets = extractContentCursorTargets(root);
  if (targets.length === 0) {
    return false;
  }

  const active = root ? activeElement(root) : null;
  const activeIndex = active ? targets.indexOf(active) : -1;
  const baseIndex =
    activeIndex >= 0
      ? activeIndex
      : nearestViewportTargetIndex(targets, scrollContainer);
  const delta = direction === "next" ? 1 : -1;
  const nextIndex = Math.min(
    Math.max(baseIndex + delta, 0),
    targets.length - 1,
  );
  const nextTarget = targets[nextIndex];

  clearContentCursor(root);
  nextTarget.classList.add(contentCursorActiveClass);
  setActiveReviewId(nextTarget);
  nextTarget.scrollIntoView({ block: "center", inline: "nearest" });
  return true;
}
