import { isSupportedDocumentPath } from "../../core/documentFormat";
import { renderDocument } from "../../core/renderDocument";
import type {
  DocumentLinkResolution,
  DocumentPayload,
  Heading,
  RenderResult,
} from "../../core/types";
import { fileName, isExternalUrl, splitPathAndHash } from "./path";

export const linkPreviewDelayMs = 250;
export const linkPreviewCacheLimit = 20;
export const linkPreviewSnippetLimit = 160;

export interface LinkPreviewState {
  status: "loading" | "ready" | "degraded";
  key: string;
  x: number;
  y: number;
  title?: string;
  heading?: string;
  snippet?: string;
  message?: string;
}

export interface LinkPreviewSnapshot {
  href: string;
  currentDocument: DocumentPayload;
  renderResult: RenderResult | null;
  article: HTMLElement | null;
  x: number;
  y: number;
}

export interface BuildLinkPreviewOptions extends LinkPreviewSnapshot {
  resolveDocumentLink: (
    href: string,
    documentPath: string,
  ) => Promise<DocumentLinkResolution>;
  loadDocument: (path: string) => Promise<DocumentPayload>;
}

export function linkPreviewKey(documentPath: string, href: string): string {
  return `${documentPath}\u0000${href}`;
}

export function shouldPreviewLinkHref(href: string): boolean {
  if (!href || isExternalUrl(href)) {
    return false;
  }
  if (/^\s*(?:javascript|vbscript|data|asset|file):/iu.test(href)) {
    return false;
  }
  if (href.startsWith("#")) {
    return true;
  }
  return isSupportedDocumentPath(splitPathAndHash(href).path);
}

export function rememberLinkPreviewCache(
  cache: Map<string, LinkPreviewState>,
  key: string,
  preview: LinkPreviewState,
) {
  if (cache.has(key)) {
    cache.delete(key);
  }
  cache.set(key, preview);
  while (cache.size > linkPreviewCacheLimit) {
    const oldest = cache.keys().next().value;
    if (!oldest) {
      break;
    }
    cache.delete(oldest);
  }
}

export async function buildLinkPreview({
  href,
  currentDocument,
  renderResult,
  article,
  x,
  y,
  resolveDocumentLink,
  loadDocument,
}: BuildLinkPreviewOptions): Promise<LinkPreviewState | null> {
  const key = linkPreviewKey(currentDocument.path, href);
  if (!shouldPreviewLinkHref(href)) {
    return null;
  }

  if (href.startsWith("#")) {
    return previewFromRenderedDocument({
      key,
      x,
      y,
      documentPath: currentDocument.path,
      hash: decodeURIComponent(href.slice(1)),
      headings: renderResult?.headings ?? [],
      article,
    });
  }

  try {
    const target = splitPathAndHash(href);
    const resolved = await resolveDocumentLink(href, currentDocument.path);
    if (resolved.status !== "resolved" || !resolved.path) {
      return {
        status: "degraded",
        key,
        x,
        y,
        title: "Preview unavailable",
        message: sanitizePreviewText(
          resolved.message ?? "Document link is not available.",
        ),
      };
    }

    const document = await loadDocument(resolved.path);
    const hash = resolved.hash ?? target.hash ?? undefined;
    try {
      const result = await renderDocument(document, { timeoutMs: 1500 });
      const parser = new DOMParser();
      const doc = parser.parseFromString(result.html, "text/html");
      const sourceTitleHeadings = extractSourceHeadings(document.source).filter(
        (heading) => heading.level === 1,
      );
      const headings = result.headings.some((heading) => heading.level === 1)
        ? result.headings
        : [...sourceTitleHeadings, ...result.headings];
      return previewFromRenderedDocument({
        key,
        x,
        y,
        documentPath: document.path,
        hash,
        headings,
        article: doc.body,
      });
    } catch {
      return previewFromSource({
        key,
        x,
        y,
        document,
        hash,
      });
    }
  } catch (error) {
    return {
      status: "degraded",
      key,
      x,
      y,
      title: "Preview unavailable",
      message: sanitizePreviewText(
        error instanceof Error ? error.message : "Document preview failed.",
      ),
    };
  }
}

function previewFromSource({
  key,
  x,
  y,
  document,
  hash,
}: {
  key: string;
  x: number;
  y: number;
  document: DocumentPayload;
  hash?: string | null;
}): LinkPreviewState {
  const headings = extractSourceHeadings(document.source);
  const title = documentTitle(document.path, headings);
  const heading = hash ? headings.find((item) => item.id === hash) : undefined;
  if (hash && !heading) {
    return {
      status: "degraded",
      key,
      x,
      y,
      title,
      message: "Target heading is not available.",
      snippet: firstSourceSnippet(document.source),
    };
  }
  return {
    status: "ready",
    key,
    x,
    y,
    title,
    heading: heading?.text ?? headings[0]?.text,
    snippet: sourceSnippetAfterHeading(document.source, heading),
  };
}

function previewFromRenderedDocument({
  key,
  x,
  y,
  documentPath,
  hash,
  headings,
  article,
}: {
  key: string;
  x: number;
  y: number;
  documentPath: string;
  hash?: string | null;
  headings: Heading[];
  article: HTMLElement | null;
}): LinkPreviewState {
  const title = documentTitle(documentPath, headings);
  const heading = hash ? headings.find((item) => item.id === hash) : undefined;
  const targetElement = hash
    ? article?.querySelector<HTMLElement>(`#${escapeCssIdentifier(hash)}`)
    : null;

  if (hash && !heading && !targetElement) {
    return {
      status: "degraded",
      key,
      x,
      y,
      title,
      message: "Target heading is not available.",
      snippet: firstDocumentSnippet(article),
    };
  }

  const fallbackHeading =
    headings.find((item) => item.level === 1) ?? headings[0];
  return {
    status: "ready",
    key,
    x,
    y,
    title,
    heading: heading?.text ?? fallbackHeading?.text,
    snippet: snippetForTarget(targetElement, article),
  };
}

function documentTitle(documentPath: string, headings: Heading[]): string {
  return (
    headings.find((item) => item.level === 1)?.text ?? fileName(documentPath)
  );
}

function snippetForTarget(
  target: HTMLElement | null | undefined,
  article: HTMLElement | null,
): string | undefined {
  if (!article) {
    return undefined;
  }
  const start =
    target ?? article.querySelector<HTMLElement>("h1,h2,h3,h4,h5,h6");
  let current = start?.nextElementSibling ?? article.firstElementChild;
  while (current instanceof HTMLElement) {
    if (/^H[1-6]$/u.test(current.tagName) && current !== start) {
      break;
    }
    const text = sanitizePreviewText(current.textContent ?? "");
    if (text && text !== start?.textContent?.trim()) {
      return clampSnippet(text);
    }
    current = current.nextElementSibling;
  }
  return firstDocumentSnippet(article);
}

function firstDocumentSnippet(article: HTMLElement | null): string | undefined {
  const text = sanitizePreviewText(article?.textContent ?? "");
  return text ? clampSnippet(text) : undefined;
}

function clampSnippet(value: string): string {
  return value.length > linkPreviewSnippetLimit
    ? `${value.slice(0, linkPreviewSnippetLimit - 1)}…`
    : value;
}

function sanitizePreviewText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function extractSourceHeadings(source: string): Heading[] {
  const headings: Heading[] = [];
  const lines = source.split(/\r?\n/u);
  for (const line of lines) {
    const asciidoc = /^(={1,6})\s+(.+)$/u.exec(line);
    const markdown = /^(#{1,6})\s+(.+)$/u.exec(line);
    const match = asciidoc ?? markdown;
    if (!match) {
      continue;
    }
    const text = sanitizePreviewText(match[2]);
    headings.push({
      id: slugHeading(text),
      level: match[1].length,
      text,
    });
  }
  return headings;
}

function sourceSnippetAfterHeading(
  source: string,
  heading: Heading | undefined,
): string | undefined {
  const lines = source.split(/\r?\n/u);
  let include = !heading;
  for (const line of lines) {
    const text = sanitizePreviewText(line);
    if (!text) {
      continue;
    }
    if (/^(={1,6}|#{1,6})\s+/u.test(text)) {
      include = heading
        ? text.replace(/^(={1,6}|#{1,6})\s+/u, "") === heading.text
        : false;
      continue;
    }
    if (include && !isSourceControlLine(text)) {
      return clampSnippet(text);
    }
  }
  return firstSourceSnippet(source);
}

function firstSourceSnippet(source: string): string | undefined {
  for (const line of source.split(/\r?\n/u)) {
    const text = sanitizePreviewText(line);
    if (
      text &&
      !/^(={1,6}|#{1,6})\s+/u.test(text) &&
      !isSourceControlLine(text)
    ) {
      return clampSnippet(text);
    }
  }
  return undefined;
}

function isSourceControlLine(value: string): boolean {
  return value.startsWith(":") || value === "----" || value.startsWith("[");
}

function slugHeading(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
}

function escapeCssIdentifier(value: string): string {
  return typeof CSS !== "undefined" && typeof CSS.escape === "function"
    ? CSS.escape(value)
    : value.replace(/[^A-Za-z0-9_-]/gu, "\\$&");
}
