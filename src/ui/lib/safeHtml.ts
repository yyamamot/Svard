export type SafeHtml = string & { readonly __safeHtmlBrand: unique symbol };

export const emptySafeHtml = "" as SafeHtml;

export function markSafeHtml(html: string): SafeHtml {
  return html as SafeHtml;
}

export function unwrapSafeHtml(html: SafeHtml): string {
  return html;
}

export function setElementSafeHtml(element: Element, html: SafeHtml): void {
  element.innerHTML = unwrapSafeHtml(html);
}

export function dangerouslySetSafeHtml(html: SafeHtml): { __html: string } {
  return { __html: unwrapSafeHtml(html) };
}
