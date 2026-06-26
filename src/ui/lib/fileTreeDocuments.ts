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
  | "documents-zensical"
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

export type StableDocumentOrderSource = Extract<
  DocumentOrderResult["source"],
  "mkdocs" | "zensical" | "antora"
>;

export interface DocumentOrderNavigationTarget {
  path: string;
  title: string;
  displayPath?: string;
}

export interface DocumentOrderNavigationState {
  source: StableDocumentOrderSource;
  sourceLabel: string;
  activePath: string;
  previous: DocumentOrderNavigationTarget | null;
  next: DocumentOrderNavigationTarget | null;
  activeSectionKeys: Set<string>;
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
    viewMode === "documents-zensical" ||
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

export function buildDocumentOrderNavigation({
  activePath,
  loadedDocumentPaths,
  order,
}: {
  activePath?: string;
  loadedDocumentPaths: ReadonlySet<string>;
  order: DocumentOrderResult;
}): DocumentOrderNavigationState | null {
  if (
    !activePath ||
    (order.source !== "mkdocs" &&
      order.source !== "zensical" &&
      order.source !== "antora")
  ) {
    return null;
  }

  const activeSectionKeys = new Set<string>();
  const targets = flattenDocumentOrderTargets({
    loadedDocumentPaths,
    nodes: order.nodes,
    sectionAncestors: [],
    source: order.source,
    targetAncestors: [],
  });
  const activeIndex = targets.findIndex((target) => target.path === activePath);
  if (activeIndex === -1) {
    return null;
  }

  for (const key of targets[activeIndex]?.sectionKeys ?? []) {
    activeSectionKeys.add(key);
  }

  return {
    source: order.source,
    sourceLabel:
      order.source === "mkdocs"
        ? "MkDocs"
        : order.source === "zensical"
          ? "Zensical"
          : "Antora",
    activePath,
    previous: targetToNavigationTarget(targets[activeIndex - 1]),
    next: targetToNavigationTarget(targets[activeIndex + 1]),
    activeSectionKeys,
  };
}

interface FlattenDocumentOrderTarget {
  path: string;
  title: string;
  displayPath?: string;
  sectionKeys: string[];
}

function flattenDocumentOrderTargets({
  loadedDocumentPaths,
  nodes,
  sectionAncestors,
  source,
  targetAncestors,
}: {
  loadedDocumentPaths: ReadonlySet<string>;
  nodes: DocumentOrderNode[];
  sectionAncestors: string[];
  source: StableDocumentOrderSource;
  targetAncestors: string[];
}): FlattenDocumentOrderTarget[] {
  const targets: FlattenDocumentOrderTarget[] = [];

  nodes.forEach((node, index) => {
    if (node.kind === "section") {
      const nextAncestry = [...targetAncestors, String(index)];
      const sectionKey = documentOrderSectionKey(
        source,
        nextAncestry,
        node.title,
        node.depth,
      );
      const sectionDocument = sectionHeaderDocument(node);
      if (
        sectionDocument?.status === "resolved" &&
        loadedDocumentPaths.has(sectionDocument.path)
      ) {
        targets.push({
          path: sectionDocument.path,
          title: sectionDocument.title,
          displayPath: sectionDocument.displayPath,
          sectionKeys: [...sectionAncestors, sectionKey],
        });
      }
      const childNodes = sectionDocument ? node.children.slice(1) : node.children;
      targets.push(
        ...flattenDocumentOrderTargets({
          loadedDocumentPaths,
          nodes: childNodes,
          sectionAncestors: [...sectionAncestors, sectionKey],
          source,
          targetAncestors: nextAncestry,
        }),
      );
      return;
    }

    if (node.status === "resolved" && loadedDocumentPaths.has(node.path)) {
      targets.push({
        path: node.path,
        title: node.title,
        displayPath: node.displayPath,
        sectionKeys: sectionAncestors,
      });
    }
  });

  return targets;
}

function targetToNavigationTarget(
  target: FlattenDocumentOrderTarget | undefined,
): DocumentOrderNavigationTarget | null {
  if (!target) {
    return null;
  }
  return {
    path: target.path,
    title: target.title,
    displayPath: target.displayPath,
  };
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
