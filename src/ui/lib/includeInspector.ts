import type {
  AsciiDocIncludeGraphNode,
  AsciiDocIncludeGraphStatus,
  DocumentPayload,
} from "../../core/types";

export interface IncludeInspectorItem {
  id: string;
  label: string;
  displayPath: string;
  status: AsciiDocIncludeGraphStatus;
  reason?: string;
  path?: string;
  sourcePath?: string;
  sourceLine?: number;
  sourceReference?: string;
  depth: number;
}

export function buildIncludeInspectorItems(
  document: DocumentPayload | null,
): IncludeInspectorItem[] {
  if (!document?.includeGraph || document.format !== "asciidoc") {
    return [];
  }
  const nodesById = new Map(
    document.includeGraph.nodes.map((node) => [node.id, node]),
  );
  return document.includeGraph.nodes
    .filter((node) => node.kind === "include")
    .map((node) => includeNodeToItem(node, nodesById, document));
}

function includeNodeToItem(
  node: AsciiDocIncludeGraphNode,
  nodesById: Map<string, AsciiDocIncludeGraphNode>,
  document: DocumentPayload,
): IncludeInspectorItem {
  const sourcePath = node.sourceLocation?.sourcePath;
  const sourceLine = node.sourceLocation?.line;
  const displayPath = displayPathForNode(node, document);
  return {
    id: node.id,
    label: basename(displayPath),
    displayPath,
    status: node.status,
    reason: node.reason,
    path: node.path,
    sourcePath,
    sourceLine,
    sourceReference:
      sourcePath && sourceLine ? `${sourcePath}:${sourceLine}` : undefined,
    depth: includeDepth(node, nodesById),
  };
}

function displayPathForNode(
  node: AsciiDocIncludeGraphNode,
  document: DocumentPayload,
) {
  const raw = node.path ?? node.displayPath;
  const workspaceRoot = document.asciidocContext?.workspaceRoot;
  const documentDir =
    document.asciidocContext?.documentDir ?? document.basePath;
  const relative =
    relativePath(raw, workspaceRoot) ?? relativePath(raw, documentDir);
  return relative ?? node.displayPath ?? basename(raw);
}

function includeDepth(
  node: AsciiDocIncludeGraphNode,
  nodesById: Map<string, AsciiDocIncludeGraphNode>,
) {
  let depth = 0;
  let current: AsciiDocIncludeGraphNode | undefined = node;
  while (current?.parentId) {
    current = nodesById.get(current.parentId);
    if (!current || current.kind === "root") {
      break;
    }
    depth += 1;
  }
  return depth;
}

function relativePath(path: string, root?: string | null) {
  if (!root || !path.startsWith(`${root}/`)) {
    return null;
  }
  return path.slice(root.length + 1);
}

function basename(path: string) {
  return path.split("/").filter(Boolean).at(-1) ?? path;
}
