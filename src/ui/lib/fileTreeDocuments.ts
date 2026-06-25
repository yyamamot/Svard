import { isSupportedDocumentPath } from "../../core/documentFormat";
import type {
  DirectoryEntry,
  DocumentOrderNode,
  DocumentOrderResult,
  GitDiffStatus,
} from "../../core/types";
import { fileGitStatusBadgeLabel } from "./gitStatusBadgeLabels";
import { gitStatusDisplay } from "./gitStatusDisplay";
import { fileName } from "./path";

export type DocumentsViewMode =
  | "tree"
  | "documents-path"
  | "documents-mkdocs"
  | "documents-antora"
  | "documents-vitepress"
  | "documents-docusaurus";

export interface FileTreeDocumentRow {
  entry: DirectoryEntry;
  relativePath: string;
  gitStatus: ReturnType<typeof gitStatusDisplay>;
  gitStatusLabel?: string;
  isChanged: boolean;
  isActive: boolean;
  isOpen: boolean;
  sortStatusRank: number;
}

export function buildFileTreeDocumentRows({
  activePath,
  childrenByDirectory,
  gitStatusByPath,
  openDocumentPaths,
  rootDirectory,
}: {
  activePath?: string;
  childrenByDirectory: Record<string, DirectoryEntry[]>;
  gitStatusByPath: Record<string, GitDiffStatus>;
  openDocumentPaths: ReadonlySet<string>;
  rootDirectory: string;
}): FileTreeDocumentRow[] {
  const byPath = new Map<string, DirectoryEntry>();
  for (const entries of Object.values(childrenByDirectory)) {
    for (const entry of entries) {
      if (entry.kind === "file" && isSupportedDocumentPath(entry.path)) {
        byPath.set(entry.path, entry);
      }
    }
  }

  return [...byPath.values()]
    .sort((left, right) =>
      relativeDocumentPath(left.path, rootDirectory).localeCompare(
        relativeDocumentPath(right.path, rootDirectory),
      ),
    )
    .map((entry) => {
      const rawGitStatus = gitStatusByPath[entry.path];
      const gitStatus = gitStatusDisplay(rawGitStatus);
      const gitStatusLabel = gitStatus
        ? fileGitStatusBadgeLabel(gitStatus, entry.name)
        : undefined;
      return {
        entry,
        relativePath: relativeDocumentPath(entry.path, rootDirectory),
        gitStatus,
        gitStatusLabel,
        isChanged: Boolean(gitStatus),
        isActive: activePath === entry.path,
        isOpen: openDocumentPaths.has(entry.path),
        sortStatusRank: changedDocumentStatusRank(rawGitStatus),
      };
    });
}

export function filterVisibleDocumentRows(
  documentRows: FileTreeDocumentRow[],
  documentsFilter: "all" | "changed",
  viewMode: DocumentsViewMode,
  experimentalStaticSiteOrderSourcesEnabled: boolean,
): FileTreeDocumentRow[] {
  if (documentsFilter !== "changed") {
    return documentRows;
  }
  if (isOrderedDocumentsMode(viewMode, experimentalStaticSiteOrderSourcesEnabled)) {
    return documentRows.filter((row) => row.isChanged);
  }
  return [...documentRows.filter((row) => row.isChanged)].sort(
    (left, right) =>
      left.sortStatusRank - right.sortStatusRank ||
      left.relativePath.localeCompare(right.relativePath),
  );
}

export function relativeDocumentPath(path: string, rootDirectory: string): string {
  if (!rootDirectory) {
    return path;
  }
  const normalizedRoot = rootDirectory.replace(/[/\\]+$/, "");
  if (path === normalizedRoot) {
    return fileName(path);
  }
  if (
    path.startsWith(`${normalizedRoot}/`) ||
    path.startsWith(`${normalizedRoot}\\`)
  ) {
    return path.slice(normalizedRoot.length + 1);
  }
  return path;
}

export function isOrderedDocumentsMode(
  viewMode: DocumentsViewMode,
  experimentalStaticSiteOrderSourcesEnabled: boolean,
): boolean {
  return (
    viewMode === "documents-mkdocs" ||
    viewMode === "documents-antora" ||
    (experimentalStaticSiteOrderSourcesEnabled &&
      (viewMode === "documents-vitepress" ||
        viewMode === "documents-docusaurus"))
  );
}

export function documentOrderSectionKey(
  source: DocumentOrderResult["source"],
  ancestry: string[],
  title: string,
  depth: number,
): string {
  return `${source}:${ancestry.join(".")}:${depth}:${title}`;
}

export function sectionHeaderDocument(
  node: Extract<DocumentOrderNode, { kind: "section" }>,
): Extract<DocumentOrderNode, { kind: "document" }> | undefined {
  const firstChild = node.children[0];
  if (
    firstChild?.kind === "document" &&
    firstChild.status === "resolved" &&
    firstChild.title === node.title
  ) {
    return firstChild;
  }
  return undefined;
}

export function collectDocumentOrderPaths(
  nodes: DocumentOrderNode[],
): Set<string> {
  const paths = new Set<string>();
  for (const node of nodes) {
    if (node.kind === "section") {
      for (const path of collectDocumentOrderPaths(node.children)) {
        paths.add(path);
      }
    } else if (node.status === "resolved") {
      paths.add(node.path);
    }
  }
  return paths;
}

function changedDocumentStatusRank(status?: GitDiffStatus): number {
  switch (status) {
    case "deleted":
      return 0;
    case "renamed":
      return 1;
    case "modified":
      return 2;
    case "added":
      return 3;
    case "untracked":
      return 4;
    case "binary":
      return 5;
    default:
      return 99;
  }
}
