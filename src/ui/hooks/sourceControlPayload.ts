import type { Dispatch, SetStateAction } from "react";

import type {
  GitBranchDiff,
  GitChanges,
  GitCommitGraph,
  GitFileHistory,
} from "../../core/types";

export function setSourceControlPayload<T>(
  setter: Dispatch<SetStateAction<T | null>>,
  next: T | null,
) {
  setter((current) =>
    sourceControlPayloadEqual(current, next) ? current : next,
  );
}

export function sourceControlPayloadEqual<T>(
  current: T | null,
  next: T | null,
) {
  if (current === next) {
    return true;
  }
  if (!current || !next) {
    return false;
  }
  const currentSignature = sourceControlPayloadSignature(current);
  const nextSignature = sourceControlPayloadSignature(next);
  if (currentSignature === null || nextSignature === null) {
    return false;
  }
  return currentSignature === nextSignature;
}

export function sourceControlPayloadSignature(payload: unknown): string | null {
  if (!isRecord(payload) || typeof payload.status !== "string") {
    return null;
  }
  if ("baseRef" in payload || "mergeBase" in payload) {
    return JSON.stringify(
      branchDiffSignature(payload as unknown as GitBranchDiff),
    );
  }
  if ("scope" in payload) {
    return JSON.stringify(
      commitGraphSignature(payload as unknown as GitCommitGraph),
    );
  }
  if ("repositoryRoot" in payload && "items" in payload) {
    return JSON.stringify(changesSignature(payload as unknown as GitChanges));
  }
  if ("relativePath" in payload && "items" in payload) {
    return JSON.stringify(
      fileHistorySignature(payload as unknown as GitFileHistory),
    );
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function headCommitSignature(headCommit: GitChanges["headCommit"]) {
  return headCommit
    ? {
        revision: headCommit.revision,
        shortHash: headCommit.shortHash,
        summary: headCommit.summary,
      }
    : null;
}

function changesSignature(payload: GitChanges) {
  return {
    status: payload.status,
    repositoryRoot: payload.repositoryRoot ?? null,
    currentBranch: payload.currentBranch ?? null,
    headCommit: headCommitSignature(payload.headCommit ?? null),
    message: payload.message ?? null,
    items: payload.items.map((item) => ({
      path: item.path,
      status: item.status,
      documentPath: item.documentPath ?? null,
    })),
  };
}

function branchDiffSignature(payload: GitBranchDiff) {
  return {
    status: payload.status,
    repositoryRoot: payload.repositoryRoot ?? null,
    currentBranch: payload.currentBranch ?? null,
    headCommit: headCommitSignature(payload.headCommit ?? null),
    baseRef: payload.baseRef ?? null,
    headRef: payload.headRef ?? null,
    mergeBase: payload.mergeBase ?? null,
    baseCandidates: payload.baseCandidates,
    providerBaseCandidates: payload.providerBaseCandidates?.map(
      (candidate) => ({
        provider: candidate.provider,
        label: candidate.label,
        baseRef: candidate.baseRef,
        sourceBranch: candidate.sourceBranch,
        targetBranch: candidate.targetBranch,
        available: candidate.available,
        message: candidate.message ?? null,
      }),
    ),
    message: payload.message ?? null,
    items: payload.items.map((item) => ({
      path: item.path,
      oldPath: item.oldPath ?? null,
      status: item.status,
      documentPath: item.documentPath ?? null,
    })),
  };
}

function commitGraphSignature(payload: GitCommitGraph) {
  return {
    status: payload.status,
    scope: payload.scope,
    repositoryRoot: payload.repositoryRoot ?? null,
    relativePath: payload.relativePath ?? null,
    currentBranch: payload.currentBranch ?? null,
    headCommit: headCommitSignature(payload.headCommit ?? null),
    message: payload.message ?? null,
    hasMore: payload.hasMore ?? null,
    nextCursor: payload.nextCursor ?? null,
    items: payload.items.map((item) => ({
      revision: item.revision,
      shortHash: item.shortHash,
      parentRevision: item.parentRevision ?? null,
      parentShortHash: item.parentShortHash ?? null,
      parentRevisions: item.parentRevisions,
      parentShortHashes: item.parentShortHashes,
      summary: item.summary,
      author: item.author,
      date: item.date,
      fileStatus: item.fileStatus,
    })),
  };
}

function fileHistorySignature(payload: GitFileHistory) {
  return {
    status: payload.status,
    relativePath: payload.relativePath ?? null,
    message: payload.message ?? null,
    hasMore: payload.hasMore ?? null,
    nextCursor: payload.nextCursor ?? null,
    items: payload.items.map((item) => ({
      revision: item.revision,
      shortHash: item.shortHash,
      parentRevision: item.parentRevision ?? null,
      parentShortHash: item.parentShortHash ?? null,
      summary: item.summary,
      author: item.author,
      date: item.date,
      fileStatus: item.fileStatus,
    })),
  };
}
