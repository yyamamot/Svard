import { isSupportedDocumentPath } from "../../core/documentFormat";
import { isExternalUrl, splitPathAndHash } from "./path";

export function linkHoverDestination(
  target: EventTarget | null,
): string | null {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  const link = target.closest("a[href]") as HTMLAnchorElement | null;
  const href = link?.getAttribute("href") ?? "";
  if (!href) {
    return null;
  }

  if (href.startsWith("#") || isExternalUrl(href)) {
    return href;
  }

  if (isSupportedDocumentPath(splitPathAndHash(href).path)) {
    return href;
  }

  return href;
}
