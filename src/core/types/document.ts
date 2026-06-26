export type DocumentFormat = "asciidoc" | "markdown";

export interface DocumentPayload {
  path: string;
  basePath: string;
  format: DocumentFormat;
  source: string;
  updatedAt: string;
  includeFiles?: AsciiDocIncludeFile[];
  includeGraph?: AsciiDocIncludeGraph;
  resourceContext?: DocumentResourceContext;
  asciidocContext?: AsciiDocRenderContext | null;
}

export interface AsciiDocIncludeFile {
  path: string;
  source: string;
}

export type AsciiDocIncludeGraphStatus =
  | "active"
  | "skipped"
  | "blocked"
  | "missing"
  | "recursive"
  | "depth-limit";

export interface AsciiDocIncludeGraphSourceLocation {
  sourcePath?: string;
  line: number;
  column?: number;
}

export interface AsciiDocIncludeGraphNode {
  id: string;
  path?: string;
  displayPath: string;
  kind: "root" | "include";
  status: AsciiDocIncludeGraphStatus;
  reason?: string;
  sourceLocation?: AsciiDocIncludeGraphSourceLocation;
  parentId?: string;
}

export interface AsciiDocIncludeGraphEdge {
  fromId: string;
  toId: string;
  sourceLocation?: AsciiDocIncludeGraphSourceLocation;
  status: AsciiDocIncludeGraphStatus;
}

export interface AsciiDocIncludeGraph {
  nodes: AsciiDocIncludeGraphNode[];
  edges: AsciiDocIncludeGraphEdge[];
}

export interface AsciiDocRenderContext {
  baseDir: string;
  workspaceRoot: string;
  documentDir: string;
  attributes: Record<string, string>;
  resourceRoots: string[];
}

export interface DocumentResourceContext {
  workspaceRoot: string;
  documentDir: string;
  resourceRoots: string[];
}

export type LocalImageResolveContext =
  | AsciiDocRenderContext
  | DocumentResourceContext;

export interface DirectoryEntry {
  name: string;
  path: string;
  kind: "file" | "directory";
}

export type DocumentOrderSource =
  | "mkdocs"
  | "zensical"
  | "antora"
  | "vitepress"
  | "docusaurus";

export type DocumentOrderNode =
  | {
      kind: "section";
      title: string;
      depth: number;
      children: DocumentOrderNode[];
    }
  | {
      kind: "document";
      title: string;
      path: string;
      displayPath: string;
      depth: number;
      status: "resolved" | "missing" | "external" | "unsupported";
    };

export interface DocumentOrderResult {
  source: DocumentOrderSource;
  nodes: DocumentOrderNode[];
  message?: string;
}

export interface DocumentOrderCatalog {
  orders: DocumentOrderResult[];
}

export interface WorkspaceSearchInput {
  rootPath: string;
  query: string;
  maxFiles: number;
  maxMatches: number;
  maxBytesPerFile: number;
}

export interface WorkspaceSearchResultItem {
  path: string;
  displayPath: string;
  line: number;
  heading?: string | null;
  snippet: string;
  matchCount: number;
  sourceReference: string;
}

export interface WorkspaceSearchResult {
  status: "ok" | "empty" | "error";
  rootPath: string;
  query: string;
  results: WorkspaceSearchResultItem[];
  totalMatches: number;
  searchedFiles: number;
  skippedFiles: number;
  capped: boolean;
  message?: string | null;
}

export interface WorkspacePathResolutionInput {
  documentPath?: string | null;
  basePath?: string | null;
  lastDirectory?: string | null;
  recentDirectories: string[];
  expandedDirectories: string[];
}

export type WorkspaceLocationKind =
  | "local"
  | "wsl-unc"
  | "network-unc"
  | "unknown";

export type WorkspacePerformanceMode = "normal" | "wsl-mitigated";

export interface WorkspaceEnvironment {
  locationKind: WorkspaceLocationKind;
  performanceMode: WorkspacePerformanceMode;
}

export interface WorkspacePathResolution {
  initialDirectory?: string | null;
  expandedDirectories: string[];
  environment?: WorkspaceEnvironment | null;
}

export interface DocumentLinkResolutionInput {
  documentPath: string;
  href: string;
  kind?: "local" | "wikilink";
  target?: string | null;
  label?: string | null;
}

export type DocumentLinkResolutionStatus =
  | "resolved"
  | "anchor"
  | "external"
  | "blocked";

export interface DocumentLinkResolutionMetrics {
  kind: string;
  status: string;
  cacheStatus?: string | null;
  noteCount?: number | null;
  scannedDirs?: number | null;
  durationMs?: number | null;
  performanceMode?: WorkspacePerformanceMode | null;
  reason?: string | null;
}

export interface DocumentLinkResolution {
  status: DocumentLinkResolutionStatus;
  path?: string | null;
  href?: string | null;
  hash?: string | null;
  message?: string | null;
  metrics?: DocumentLinkResolutionMetrics | null;
}
