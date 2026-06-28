import { isSupportedDocumentPath } from "../../core/documentFormat";
import type {
  DirectoryEntry,
  DocumentPayload,
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

export type OpenDocumentTreeNode =
  | {
      kind: "directory";
      name: string;
      key: string;
      children: OpenDocumentTreeNode[];
      hasActive: boolean;
      hasChanged: boolean;
    }
  | {
      kind: "document";
      row: FileTreeDocumentRow;
    };

export interface OpenDocumentTreeModel {
  nodes: OpenDocumentTreeNode[];
  documentCount: number;
  changedCount: number;
  activeSectionKeys: Set<string>;
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

export function buildOpenDocumentTree({
  activePath,
  gitStatusByPath,
  orderedTabs,
  rootDirectory,
}: {
  activePath?: string;
  gitStatusByPath: Record<string, GitDiffStatus>;
  orderedTabs: readonly DocumentPayload[];
  rootDirectory: string;
}): OpenDocumentTreeModel {
  const rows = buildOpenDocumentRows({
    activePath,
    gitStatusByPath,
    orderedTabs,
    rootDirectory,
  });
  const rootNodes: OpenDocumentTreeNode[] = [];
  const directoryByKey = new Map<
    string,
    Extract<OpenDocumentTreeNode, { kind: "directory" }>
  >();
  const activeSectionKeys = new Set<string>();

  for (const row of rows) {
    const segments = row.relativePath.split(/[\\/]+/).filter(Boolean);
    segments.pop();
    let children = rootNodes;
    let keyPrefix = "loaded";
    const ancestorKeys: string[] = [];

    for (const segment of segments) {
      const key = `${keyPrefix}/${segment}`;
      let directory = directoryByKey.get(key);
      if (!directory) {
        directory = {
          kind: "directory",
          name: segment,
          key,
          children: [],
          hasActive: false,
          hasChanged: false,
        };
        directoryByKey.set(key, directory);
        children.push(directory);
      }
      ancestorKeys.push(key);
      children = directory.children;
      keyPrefix = key;
    }

    if (row.isActive) {
      for (const key of ancestorKeys) {
        activeSectionKeys.add(key);
      }
    }
    children.push({ kind: "document", row });
  }

  markOpenDocumentDirectoryState(rootNodes);

  return {
    nodes: rootNodes,
    documentCount: rows.length,
    changedCount: rows.filter((row) => row.isChanged).length,
    activeSectionKeys,
  };
}

function buildOpenDocumentRows({
  activePath,
  gitStatusByPath,
  orderedTabs,
  rootDirectory,
}: {
  activePath?: string;
  gitStatusByPath: Record<string, GitDiffStatus>;
  orderedTabs: readonly DocumentPayload[];
  rootDirectory: string;
}): FileTreeDocumentRow[] {
  const seen = new Set<string>();
  const rows: FileTreeDocumentRow[] = [];

  for (const tab of orderedTabs) {
    if (
      seen.has(tab.path) ||
      !isSupportedDocumentPath(tab.path) ||
      !isPathInsideRoot(tab.path, rootDirectory)
    ) {
      continue;
    }
    seen.add(tab.path);
    const rawGitStatus = gitStatusByPath[tab.path];
    const gitStatus = gitStatusDisplay(rawGitStatus);
    const name = fileName(tab.path);
    rows.push({
      entry: {
        kind: "file",
        name,
        path: tab.path,
      },
      relativePath: relativeDocumentPath(tab.path, rootDirectory),
      gitStatus,
      gitStatusLabel: gitStatus
        ? fileGitStatusBadgeLabel(gitStatus, name)
        : undefined,
      isChanged: Boolean(gitStatus),
      isActive: activePath === tab.path,
      isOpen: true,
      sortStatusRank: changedDocumentStatusRank(rawGitStatus),
    });
  }

  return rows.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );
}

function isPathInsideRoot(path: string, rootDirectory: string): boolean {
  if (!rootDirectory) {
    return false;
  }
  const normalizedRoot = rootDirectory.replace(/[/\\]+$/, "");
  return (
    path === normalizedRoot ||
    path.startsWith(`${normalizedRoot}/`) ||
    path.startsWith(`${normalizedRoot}\\`)
  );
}

function markOpenDocumentDirectoryState(nodes: OpenDocumentTreeNode[]): {
  hasActive: boolean;
  hasChanged: boolean;
} {
  let hasActive = false;
  let hasChanged = false;
  nodes.sort(compareOpenDocumentTreeNodes);

  for (const node of nodes) {
    if (node.kind === "document") {
      hasActive ||= node.row.isActive;
      hasChanged ||= node.row.isChanged;
      continue;
    }
    const childState = markOpenDocumentDirectoryState(node.children);
    node.hasActive = childState.hasActive;
    node.hasChanged = childState.hasChanged;
    hasActive ||= childState.hasActive;
    hasChanged ||= childState.hasChanged;
  }

  return { hasActive, hasChanged };
}

function compareOpenDocumentTreeNodes(
  left: OpenDocumentTreeNode,
  right: OpenDocumentTreeNode,
): number {
  if (left.kind !== right.kind) {
    return left.kind === "directory" ? -1 : 1;
  }
  const leftName = left.kind === "directory" ? left.name : left.row.entry.name;
  const rightName =
    right.kind === "directory" ? right.name : right.row.entry.name;
  return leftName.localeCompare(rightName);
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
  if (
    isOrderedDocumentsMode(viewMode, experimentalStaticSiteOrderSourcesEnabled)
  ) {
    return documentRows.filter((row) => row.isChanged);
  }
  return [...documentRows.filter((row) => row.isChanged)].sort(
    (left, right) =>
      left.sortStatusRank - right.sortStatusRank ||
      left.relativePath.localeCompare(right.relativePath),
  );
}

export function relativeDocumentPath(
  path: string,
  rootDirectory: string,
): string {
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

export function collectResolvedDocumentOrderPaths(
  nodes: DocumentOrderNode[],
): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();
  collectResolvedDocumentOrderPathsInto(nodes, paths, seen);
  return paths;
}

function collectResolvedDocumentOrderPathsInto(
  nodes: DocumentOrderNode[],
  paths: string[],
  seen: Set<string>,
) {
  for (const node of nodes) {
    if (node.kind === "section") {
      collectResolvedDocumentOrderPathsInto(node.children, paths, seen);
      continue;
    }
    if (node.status !== "resolved" || seen.has(node.path)) {
      continue;
    }
    seen.add(node.path);
    paths.push(node.path);
  }
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
      const childNodes = sectionDocument
        ? node.children.slice(1)
        : node.children;
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
