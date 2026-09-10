import type { DocumentPayload, SourceLocation } from "../../../core/types";

export function sourceReference(
  document: DocumentPayload,
  line?: number,
  hash?: string,
  sourceLocation?: SourceLocation,
): string {
  const lineSuffix = line ? `:${line}` : "";
  const hashSuffix = hash ? `#${encodeURIComponent(hash)}` : "";
  return `${sourceLocation?.sourcePath ?? document.path}${lineSuffix}${hashSuffix}`;
}

export function htmlMayContainElement(html: string, tagName: string): boolean {
  return new RegExp(`<\\s*${tagName}(?:\\s|>|/)`, "i").test(html);
}
