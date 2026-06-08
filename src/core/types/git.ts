export type GitDiffStatus =
  | "clean"
  | "modified"
  | "added"
  | "deleted"
  | "renamed"
  | "untracked"
  | "binary"
  | "not-in-repo"
  | "error";

export interface GitStatusEntry {
  path: string;
  status: GitDiffStatus;
}

export interface GitStatusWatchEvent {
  kind: string;
}

export type GitFileHistoryStatus =
  | "ok"
  | "not-in-repo"
  | "untracked"
  | "no-history"
  | "unsupported"
  | "error";

export interface GitFileHistoryItem {
  revision: string;
  shortHash: string;
  parentRevision?: string | null;
  parentShortHash?: string | null;
  summary: string;
  author: string;
  date: string;
  fileStatus: GitDiffStatus;
}

export interface GitFileHistory {
  status: GitFileHistoryStatus;
  relativePath?: string | null;
  items: GitFileHistoryItem[];
  message?: string | null;
  hasMore?: boolean | null;
  nextCursor?: string | null;
  metrics?: GitFileHistoryMetrics | null;
}

export type GitFileHistoryCacheStatus =
  | "miss"
  | "hit"
  | "incremental"
  | "fallback";

export interface GitFileHistoryMetrics {
  cacheStatus: GitFileHistoryCacheStatus;
  durationMs: number;
  discoveryMs: number;
  statusMs: number;
  headMs: number;
  walkMs: number;
  blobLookupMs: number;
  walkedCommits: number;
  matchedCommits: number;
  returnedCommits?: number | null;
  hasMore?: boolean | null;
  staleCursor?: boolean | null;
}

export type GitRefKind = "branch" | "tag" | "commit";

export type GitRefListStatus =
  | "ok"
  | "not-in-repo"
  | "untracked"
  | "unsupported"
  | "error";

export interface GitRefItem {
  kind: GitRefKind;
  name: string;
  revision: string;
  shortRevision: string;
  summary?: string | null;
}

export interface GitRefList {
  status: GitRefListStatus;
  relativePath?: string | null;
  items: GitRefItem[];
  message?: string | null;
  hasMore?: boolean | null;
  nextCursor?: string | null;
  metrics?: GitRefListMetrics | null;
}

export interface GitRefListMetrics {
  kind: GitRefKind;
  durationMs: number;
  returnedRefs: number;
  walkedCommits: number;
  hasMore: boolean;
  cursorPresent?: boolean | null;
  staleCursor?: boolean | null;
}

export type DocumentDiffSource = "git" | "file";

export type GitDiffLineKind = "context" | "added" | "removed";

export interface GitDiffLine {
  kind: GitDiffLineKind;
  oldLine?: number | null;
  newLine?: number | null;
  text: string;
}

export interface GitDiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: GitDiffLine[];
}

export interface GitDiffPreview {
  source?: DocumentDiffSource;
  repositoryRoot?: string | null;
  relativePath?: string | null;
  leftPath?: string | null;
  rightPath?: string | null;
  status: GitDiffStatus;
  leftLabel: string;
  rightLabel: string;
  hunks: GitDiffHunk[];
  message?: string | null;
  leftText?: string | null;
  rightText?: string | null;
}

export type DocumentDiffPreview = GitDiffPreview;

export interface GitCommitChangedFile {
  path: string;
  status: GitDiffStatus;
  documentPath?: string | null;
}

export type GitChangesStatus = "ok" | "not-in-repo" | "no-history" | "error";

export interface GitChangeEntry {
  path: string;
  status: GitDiffStatus;
  documentPath?: string | null;
}

export interface GitChanges {
  status: GitChangesStatus;
  repositoryRoot?: string | null;
  currentBranch?: string | null;
  headCommit?: GitHeadCommit | null;
  items: GitChangeEntry[];
  message?: string | null;
}

export type GitBranchDiffStatus = "ok" | "not-in-repo" | "no-history" | "error";

export interface GitBranchDiffEntry {
  path: string;
  oldPath?: string | null;
  status: GitDiffStatus;
  documentPath?: string | null;
}

export interface GitBranchDiff {
  status: GitBranchDiffStatus;
  repositoryRoot?: string | null;
  currentBranch?: string | null;
  headCommit?: GitHeadCommit | null;
  baseRef?: string | null;
  headRef?: string | null;
  mergeBase?: string | null;
  baseCandidates: string[];
  providerBaseCandidates?: GitBranchDiffProviderBaseCandidate[];
  items: GitBranchDiffEntry[];
  message?: string | null;
}

export interface GitBranchDiffProviderBaseCandidate {
  provider: "github" | "gitlab";
  label: string;
  baseRef: string;
  sourceBranch: string;
  targetBranch: string;
  available: boolean;
  message?: string | null;
}

export type GitCommitGraphStatus =
  | "ok"
  | "not-in-repo"
  | "untracked"
  | "no-history"
  | "unsupported"
  | "error";

export type GitCommitGraphScope = "repository" | "file";

export interface GitCommitGraphItem {
  revision: string;
  shortHash: string;
  parentRevision?: string | null;
  parentShortHash?: string | null;
  parentRevisions: string[];
  parentShortHashes: string[];
  summary: string;
  author: string;
  date: string;
  fileStatus: GitDiffStatus;
}

export interface GitHeadCommit {
  revision: string;
  shortHash: string;
  summary: string;
}

export interface GitCommitGraph {
  status: GitCommitGraphStatus;
  scope: GitCommitGraphScope;
  repositoryRoot?: string | null;
  relativePath?: string | null;
  currentBranch?: string | null;
  headCommit?: GitHeadCommit | null;
  items: GitCommitGraphItem[];
  message?: string | null;
  hasMore?: boolean | null;
  nextCursor?: string | null;
  metrics?: GitCommitGraphMetrics | null;
}

export interface GitCommitGraphMetrics {
  cacheStatus: GitFileHistoryCacheStatus;
  durationMs: number;
  walkedCommits: number;
  returnedCommits: number;
  hasMore: boolean;
  staleCursor?: boolean | null;
}

export interface GitCommitDetails {
  revision: string;
  shortHash: string;
  summary: string;
  author: string;
  date: string;
  files: GitCommitChangedFile[];
  message?: string | null;
}
