import type { DocumentFormat } from "./types";

export const supportedDocumentExtensions = [
  ".adoc",
  ".asciidoc",
  ".asc",
  ".md",
  ".markdown",
] as const;

export function documentFormatForPath(path: string): DocumentFormat {
  const cleanPath = path.split("#", 1)[0].toLowerCase();
  if (cleanPath.endsWith(".md") || cleanPath.endsWith(".markdown")) {
    return "markdown";
  }
  return "asciidoc";
}

export function isSupportedDocumentPath(path: string): boolean {
  return /\.(adoc|asciidoc|asc|md|markdown)(#.*)?$/i.test(path);
}
