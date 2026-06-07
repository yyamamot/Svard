import { describe, expect, it, vi } from "vitest";

import type { HostAdapter } from "../../src/core/types";
import { SourceControlRequests } from "../../src/ui/hooks/sourceControlRequests";

function createHost() {
  return {
    getGitChanges: vi.fn().mockResolvedValue({
      status: "ok",
      repositoryRoot: "/workspace",
      currentBranch: "main",
      headCommit: null,
      items: [],
      message: null,
    }),
    getGitFileHistory: vi.fn().mockResolvedValue({
      status: "ok",
      relativePath: "docs/guide.md",
      items: [],
      message: null,
    }),
  } as unknown as HostAdapter;
}

describe("SourceControlRequests", () => {
  it("deduplicates in-flight Changes requests and reports cache state", async () => {
    const host = createHost();
    const requests = new SourceControlRequests(host);

    const first = requests.getOrStartGitChangesRequest("/workspace", "visible");
    const second = requests.getOrStartGitChangesRequest(
      "/workspace",
      "metadata-event",
    );

    expect(first.deduped).toBe(false);
    expect(second.deduped).toBe(true);
    expect(first.request).toBe(second.request);
    expect(host.getGitChanges).toHaveBeenCalledTimes(1);

    const changes = await first.request;
    requests.setGitChangesCache("/workspace", changes);

    expect(requests.hasGitChangesCache("/workspace")).toBe(true);
    expect(requests.getGitChangesCache("/workspace")).toBe(changes);
    expect(requests.gitChangesCacheAgeMs("/workspace")).toBeGreaterThanOrEqual(
      0,
    );
  });

  it("deduplicates in-flight File History requests", async () => {
    const host = createHost();
    const requests = new SourceControlRequests(host);

    const first = requests.getOrStartGitFileHistoryRequest(
      "/workspace/docs/guide.md",
    );
    const second = requests.getOrStartGitFileHistoryRequest(
      "/workspace/docs/guide.md",
    );

    expect(first.deduped).toBe(false);
    expect(second.deduped).toBe(true);
    expect(first.request).toBe(second.request);
    expect(host.getGitFileHistory).toHaveBeenCalledTimes(1);

    const history = await first.request;
    requests.setGitFileHistoryCache("/workspace/docs/guide.md", history);

    expect(requests.getGitFileHistoryCache("/workspace/docs/guide.md")).toBe(
      history,
    );
  });
});
