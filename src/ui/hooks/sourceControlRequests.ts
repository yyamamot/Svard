import type {
  GitBranchDiff,
  GitChanges,
  GitCommitGraph,
  GitCommitGraphScope,
  GitFileHistory,
  HostAdapter,
} from "../../core/types";
import { perfNow, tracePerf } from "../lib/perfTrace";

export const sourceControlInitialHistoryLimit = 20;
export const sourceControlHistoryPageLimit = 50;

export function sourceControlChangesCacheKey(anchorPath: string): string {
  return `changes:${anchorPath}`;
}

export class SourceControlRequests {
  private readonly gitChangesCache = new Map<string, GitChanges>();
  private readonly gitChangesCacheUpdatedAt = new Map<string, number>();
  private readonly gitChangesInFlight = new Map<string, Promise<GitChanges>>();
  private readonly gitBranchDiffCache = new Map<string, GitBranchDiff>();
  private readonly gitBranchDiffInFlight = new Map<
    string,
    Promise<GitBranchDiff>
  >();
  private readonly gitFileHistoryCache = new Map<string, GitFileHistory>();
  private readonly gitFileHistoryInFlight = new Map<
    string,
    Promise<GitFileHistory>
  >();
  private readonly gitCommitGraphPageCache = new Map<string, GitCommitGraph>();
  private readonly gitCommitGraphPageInFlight = new Map<
    string,
    Promise<GitCommitGraph>
  >();
  private readonly gitFileHistoryPageCache = new Map<string, GitFileHistory>();
  private readonly gitFileHistoryPageInFlight = new Map<
    string,
    Promise<GitFileHistory>
  >();

  constructor(private readonly host: HostAdapter) {}

  hasGitChangesCache(anchorPath: string): boolean {
    return this.gitChangesCache.has(sourceControlChangesCacheKey(anchorPath));
  }

  getGitChangesCache(anchorPath: string): GitChanges | null {
    return (
      this.gitChangesCache.get(sourceControlChangesCacheKey(anchorPath)) ?? null
    );
  }

  setGitChangesCache(anchorPath: string, changes: GitChanges) {
    const cacheKey = sourceControlChangesCacheKey(anchorPath);
    this.gitChangesCache.set(cacheKey, changes);
    this.gitChangesCacheUpdatedAt.set(cacheKey, perfNow());
  }

  gitChangesCacheAgeMs(anchorPath: string): number | null {
    const updatedAt = this.gitChangesCacheUpdatedAt.get(
      sourceControlChangesCacheKey(anchorPath),
    );
    return typeof updatedAt === "number" ? perfNow() - updatedAt : null;
  }

  getOrStartGitChangesRequest(anchorPath: string, reason: string) {
    const cacheKey = sourceControlChangesCacheKey(anchorPath);
    const cached = this.getGitChangesCache(anchorPath);
    const existingRequest = this.gitChangesInFlight.get(cacheKey);
    const request =
      existingRequest ??
      this.host.getGitChanges(anchorPath).finally(() => {
        this.gitChangesInFlight.delete(cacheKey);
      });
    if (!existingRequest) {
      this.gitChangesInFlight.set(cacheKey, request);
    } else {
      tracePerf("sourceControl.getGitChanges.deduped", {
        key: "changes",
        reason,
      });
    }
    return {
      cached,
      deduped: Boolean(existingRequest),
      request,
    };
  }

  getBranchDiffCache(cacheKey: string): GitBranchDiff | null {
    return this.gitBranchDiffCache.get(cacheKey) ?? null;
  }

  setBranchDiffCache(cacheKey: string, branchDiff: GitBranchDiff) {
    this.gitBranchDiffCache.set(cacheKey, branchDiff);
  }

  getOrStartBranchDiffRequest(
    cacheKey: string,
    requestFactory: () => Promise<GitBranchDiff>,
  ) {
    const existingRequest = this.gitBranchDiffInFlight.get(cacheKey);
    const request =
      existingRequest ??
      requestFactory().finally(() => {
        this.gitBranchDiffInFlight.delete(cacheKey);
      });
    if (!existingRequest) {
      this.gitBranchDiffInFlight.set(cacheKey, request);
    } else {
      tracePerf("sourceControl.getGitBranchDiff.deduped", {
        key: "branchDiff",
      });
    }
    return {
      deduped: Boolean(existingRequest),
      request,
    };
  }

  getGitFileHistoryCache(path: string): GitFileHistory | null {
    return this.gitFileHistoryCache.get(path) ?? null;
  }

  setGitFileHistoryCache(path: string, history: GitFileHistory) {
    this.gitFileHistoryCache.set(path, history);
  }

  getOrStartGitFileHistoryRequest(path: string, limit?: number) {
    const existingRequest = this.gitFileHistoryInFlight.get(path);
    const request =
      existingRequest ??
      this.host.getGitFileHistory(path, { limit }).finally(() => {
        this.gitFileHistoryInFlight.delete(path);
      });
    if (!existingRequest) {
      this.gitFileHistoryInFlight.set(path, request);
    } else {
      tracePerf("sourceControl.getGitFileHistory.deduped", {
        key: "fileHistory",
      });
    }
    return {
      deduped: Boolean(existingRequest),
      request,
    };
  }

  getGitCommitGraphPageCache(cacheKey: string): GitCommitGraph | null {
    return this.gitCommitGraphPageCache.get(cacheKey) ?? null;
  }

  getOrStartGitCommitGraphPageRequest({
    cacheKey,
    pathOrRoot,
    scope,
    path,
    limit,
    cursor,
  }: {
    cacheKey: string;
    pathOrRoot: string;
    scope: GitCommitGraphScope;
    path?: string | null;
    limit: number;
    cursor: string;
  }) {
    const cached = this.gitCommitGraphPageCache.get(cacheKey) ?? null;
    const existingRequest = this.gitCommitGraphPageInFlight.get(cacheKey);
    const request =
      existingRequest ??
      this.host
        .getGitCommitGraph(pathOrRoot, {
          scope,
          path,
          limit,
          cursor,
        })
        .then((graph) => {
          if (graph.status === "ok") {
            this.gitCommitGraphPageCache.set(cacheKey, graph);
          }
          return graph;
        })
        .finally(() => {
          this.gitCommitGraphPageInFlight.delete(cacheKey);
        });
    if (!existingRequest) {
      this.gitCommitGraphPageInFlight.set(cacheKey, request);
    } else {
      tracePerf("sourceControl.getGitCommitGraph.page.deduped", {
        key: "graphPage",
      });
    }
    return {
      cached,
      deduped: Boolean(existingRequest),
      request,
    };
  }

  getGitFileHistoryPageCache(cacheKey: string): GitFileHistory | null {
    return this.gitFileHistoryPageCache.get(cacheKey) ?? null;
  }

  getOrStartGitFileHistoryPageRequest({
    cacheKey,
    path,
    limit,
    cursor,
  }: {
    cacheKey: string;
    path: string;
    limit: number;
    cursor: string;
  }) {
    const cached = this.gitFileHistoryPageCache.get(cacheKey) ?? null;
    const existingRequest = this.gitFileHistoryPageInFlight.get(cacheKey);
    const request =
      existingRequest ??
      this.host
        .getGitFileHistory(path, { limit, cursor })
        .then((history) => {
          if (history.status === "ok") {
            this.gitFileHistoryPageCache.set(cacheKey, history);
          }
          return history;
        })
        .finally(() => {
          this.gitFileHistoryPageInFlight.delete(cacheKey);
        });
    if (!existingRequest) {
      this.gitFileHistoryPageInFlight.set(cacheKey, request);
    } else {
      tracePerf("sourceControl.getGitFileHistory.page.deduped", {
        key: "fileHistoryPage",
      });
    }
    return {
      cached,
      deduped: Boolean(existingRequest),
      request,
    };
  }
}
