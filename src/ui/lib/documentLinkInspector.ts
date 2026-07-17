import { isSupportedDocumentPath } from "../../core/documentFormat";
import { pathBasename } from "../../core/pathDisplay";
import type { DocumentPayload } from "../../core/types";
import { isExternalUrl, splitPathAndHash } from "./path";
import { unwrapSafeHtml, type SafeHtml } from "./safeHtml";

export interface DocumentLinkEdge {
  sourcePath: string;
  targetPath: string;
  hash: string | null;
  count: number;
}

export interface DocumentLinkRecord {
  path: string;
  links: DocumentLinkEdge[];
  updatedAt: number;
}

export type DocumentLinksByPath = Record<string, DocumentLinkRecord>;

export interface DocumentLinkInspectorRow {
  id: string;
  path: string;
  label: string;
  displayPath: string;
  hash: string | null;
  count: number;
}

export interface DocumentBacklinkInspectorRow extends DocumentLinkInspectorRow {
  sourcePath: string;
}

export interface DocumentLinkInspectorModel {
  outgoing: DocumentLinkInspectorRow[];
  backlinks: DocumentBacklinkInspectorRow[];
}

interface CollectDocumentLinksOptions {
  document: Pick<DocumentPayload, "path">;
  html: SafeHtml;
}

interface BuildLinkInspectorModelOptions {
  activePath: string | null | undefined;
  documentLinksByPath: DocumentLinksByPath;
  openDocumentPaths: ReadonlySet<string>;
  rootDirectory?: string | null;
}

export function collectResolvedDocumentLinksFromHtml({
  document,
  html,
}: CollectDocumentLinksOptions): DocumentLinkEdge[] {
  if (!unwrapSafeHtml(html).includes("<a")) {
    return [];
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(unwrapSafeHtml(html), "text/html");
  const grouped = new Map<string, DocumentLinkEdge>();

  for (const anchor of Array.from(doc.querySelectorAll("a[href]"))) {
    const href = anchor.getAttribute("href")?.trim();
    if (!href || shouldSkipHref(href)) {
      continue;
    }
    const { path, hash } = splitPathAndHash(href);
    if (!path || !isSupportedDocumentPath(path) || path === document.path) {
      continue;
    }
    const key = linkKey(document.path, path, hash);
    const current = grouped.get(key);
    if (current) {
      current.count += 1;
      continue;
    }
    grouped.set(key, {
      sourcePath: document.path,
      targetPath: path,
      hash,
      count: 1,
    });
  }

  return Array.from(grouped.values());
}

export function buildLinkInspectorModel({
  activePath,
  documentLinksByPath,
  openDocumentPaths,
  rootDirectory,
}: BuildLinkInspectorModelOptions): DocumentLinkInspectorModel {
  if (!activePath) {
    return { outgoing: [], backlinks: [] };
  }

  const activeRecord: DocumentLinkRecord | undefined =
    documentLinksByPath[activePath];
  const outgoing =
    activeRecord?.links
      .filter((link) => openDocumentPaths.has(link.targetPath))
      .map((link) => linkToRow(link, rootDirectory)) ?? [];

  const backlinks: DocumentBacklinkInspectorRow[] = [];
  for (const sourcePath of Array.from(openDocumentPaths).sort()) {
    if (sourcePath === activePath) {
      continue;
    }
    const record: DocumentLinkRecord | undefined =
      documentLinksByPath[sourcePath];
    if (!record) {
      continue;
    }
    for (const link of record.links as DocumentLinkEdge[]) {
      if (link.targetPath !== activePath) {
        continue;
      }
      backlinks.push({
        ...linkToRow(
          {
            ...link,
            targetPath: sourcePath,
          },
          rootDirectory,
        ),
        id: `backlink:${linkKey(sourcePath, activePath, link.hash)}`,
        sourcePath,
      });
    }
  }

  return { outgoing, backlinks };
}

export function pruneDocumentLinksForOpenDocuments(
  documentLinksByPath: DocumentLinksByPath,
  openDocumentPaths: ReadonlySet<string>,
): DocumentLinksByPath {
  let changed = false;
  const next: DocumentLinksByPath = {};
  for (const [path, record] of Object.entries(documentLinksByPath)) {
    if (!openDocumentPaths.has(path)) {
      changed = true;
      continue;
    }
    next[path] = record;
  }
  return changed ? next : documentLinksByPath;
}

function shouldSkipHref(href: string) {
  return (
    href.startsWith("#") ||
    isExternalUrl(href) ||
    /^[a-z][a-z0-9+.-]*:/i.test(href)
  );
}

function linkToRow(
  link: Pick<DocumentLinkEdge, "targetPath" | "hash" | "count">,
  rootDirectory?: string | null,
): DocumentLinkInspectorRow {
  const displayPath = displayDocumentPath(link.targetPath, rootDirectory);
  return {
    id: `link:${linkKey("", link.targetPath, link.hash)}`,
    path: link.targetPath,
    label: pathBasename(displayPath),
    displayPath: link.hash ? `${displayPath}#${link.hash}` : displayPath,
    hash: link.hash,
    count: link.count,
  };
}

function linkKey(sourcePath: string, targetPath: string, hash: string | null) {
  return `${sourcePath}\u0000${targetPath}\u0000${hash ?? ""}`;
}

function displayDocumentPath(path: string, rootDirectory?: string | null) {
  const normalizedRoot = rootDirectory?.replace(/[\\/]+$/u, "");
  if (normalizedRoot && path.startsWith(`${normalizedRoot}/`)) {
    return path.slice(normalizedRoot.length + 1);
  }
  if (normalizedRoot && path.startsWith(`${normalizedRoot}\\`)) {
    return path.slice(normalizedRoot.length + 1).replaceAll("\\", "/");
  }
  return pathBasename(path);
}
