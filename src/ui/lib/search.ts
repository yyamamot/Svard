import type { SearchHitSummary } from "../types";

export function compactText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function previousHeadingLabel(
  element: Element,
  article: HTMLElement,
): string {
  const sectionHeading = element
    .closest("section")
    ?.querySelector("h1, h2, h3, h4, h5, h6");
  if (sectionHeading?.textContent) {
    return compactText(sectionHeading.textContent);
  }

  let current: Element | null =
    element.closest("p, li, td, th, pre, blockquote, div") ?? element;
  while (current && current !== article) {
    let sibling = current.previousElementSibling;
    while (sibling) {
      if (/^H[1-6]$/.test(sibling.tagName) && sibling.textContent) {
        return compactText(sibling.textContent);
      }
      const nestedHeading = sibling.querySelector("h1, h2, h3, h4, h5, h6");
      if (nestedHeading?.textContent) {
        return compactText(nestedHeading.textContent);
      }
      sibling = sibling.previousElementSibling;
    }
    current = current.parentElement;
  }

  return "Match";
}

export function searchSnippet(element: Element): string {
  const block = element.closest("p, li, td, th, pre, blockquote, div");
  const text = compactText(block?.textContent ?? element.textContent ?? "");
  if (text.length <= 96) {
    return text;
  }
  const hitText = compactText(element.textContent ?? "");
  const hitIndex = hitText
    ? text.toLowerCase().indexOf(hitText.toLowerCase())
    : -1;
  if (hitIndex < 0) {
    return `${text.slice(0, 96)}...`;
  }
  const start = Math.max(0, hitIndex - 36);
  const end = Math.min(text.length, hitIndex + hitText.length + 48);
  return `${start > 0 ? "..." : ""}${text.slice(start, end)}${end < text.length ? "..." : ""}`;
}

export function sameSearchHits(
  left: SearchHitSummary[],
  right: SearchHitSummary[],
): boolean {
  return (
    left.length === right.length &&
    left.every(
      (item, index) =>
        item.index === right[index]?.index &&
        item.heading === right[index]?.heading &&
        item.snippet === right[index]?.snippet,
    )
  );
}
