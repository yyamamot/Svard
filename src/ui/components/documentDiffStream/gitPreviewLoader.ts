import type {
  DocumentDiffPreview,
  DocumentDiffStreamPreview,
  GitBranchDiffPreviewBatchItem,
  GitDiffPreviewBatchEntry,
} from "../../../core/types";

type StreamItem = DocumentDiffStreamPreview["items"][number];

export interface DocumentDiffStreamGitPreviewLoader {
  loadSingle(input: {
    documentPath: string;
    item: StreamItem;
    preview: DocumentDiffStreamPreview;
  }): Promise<DocumentDiffPreview>;
  loadBatch(input: {
    items: StreamItem[];
    preview: DocumentDiffStreamPreview;
  }): Promise<GitDiffPreviewBatchEntry[]> | null;
}

export interface DocumentDiffStreamGitPreviewMethods {
  getGitDiffPreview(path: string): Promise<DocumentDiffPreview>;
  getGitDiffPreviews?(
    repositoryRoot: string,
    relativePaths: string[],
  ): Promise<GitDiffPreviewBatchEntry[]>;
  getGitBranchFileDiff?(
    path: string,
    input: {
      baseRef: string;
      headRef?: string | null;
      path: string;
      oldPath?: string | null;
    },
  ): Promise<DocumentDiffPreview>;
  getGitBranchFileDiffs?(
    repositoryRoot: string,
    options: {
      baseRef: string;
      headRef?: string | null;
      items: GitBranchDiffPreviewBatchItem[];
    },
  ): Promise<GitDiffPreviewBatchEntry[]>;
  getGitFileCommitDiff?(
    path: string,
    revision: string,
  ): Promise<DocumentDiffPreview>;
  getGitFileCommitDiffs?(
    repositoryRoot: string,
    revision: string,
    relativePaths: string[],
  ): Promise<GitDiffPreviewBatchEntry[]>;
}

export function createDocumentDiffStreamGitPreviewLoader({
  getGitDiffPreview,
  getGitDiffPreviews,
  getGitBranchFileDiff,
  getGitBranchFileDiffs,
  getGitFileCommitDiff,
  getGitFileCommitDiffs,
}: DocumentDiffStreamGitPreviewMethods): DocumentDiffStreamGitPreviewLoader {
  return {
    loadSingle({ documentPath, item, preview }) {
      if (
        preview.source === "git-branch-stream" &&
        preview.baseRef &&
        getGitBranchFileDiff
      ) {
        return getGitBranchFileDiff(preview.repositoryRoot ?? documentPath, {
          baseRef: preview.baseRef,
          headRef: preview.headRef,
          path: item.path,
          oldPath: item.oldPath,
        });
      }
      if (
        preview.source === "git-commit-stream" &&
        preview.revision &&
        getGitFileCommitDiff
      ) {
        return getGitFileCommitDiff(documentPath, preview.revision);
      }
      return getGitDiffPreview(documentPath);
    },
    loadBatch({ items, preview }) {
      if (!preview.repositoryRoot) {
        return null;
      }
      if (preview.source === "git-changes-stream" && getGitDiffPreviews) {
        return getGitDiffPreviews(
          preview.repositoryRoot,
          items.map((item) => item.path),
        );
      }
      if (
        preview.source === "git-branch-stream" &&
        preview.baseRef &&
        getGitBranchFileDiffs
      ) {
        return getGitBranchFileDiffs(preview.repositoryRoot, {
          baseRef: preview.baseRef,
          headRef: preview.headRef,
          items: items.map((item) => ({
            path: item.path,
            oldPath: item.oldPath,
          })),
        });
      }
      if (
        preview.source === "git-commit-stream" &&
        preview.revision &&
        getGitFileCommitDiffs
      ) {
        return getGitFileCommitDiffs(
          preview.repositoryRoot,
          preview.revision,
          items.map((item) => item.path),
        );
      }
      return null;
    },
  };
}
