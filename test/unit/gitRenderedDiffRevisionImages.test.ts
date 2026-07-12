import { describe, expect, it, vi } from "vitest";

import { resolveGitRenderedDiffLocalImage } from "../../src/ui/lib/gitRenderedDiff/renderSummary";
import type {
  GitDiffResourceSource,
  LocalImageResolveContext,
} from "../../src/core/types";

describe("git rendered diff revision images", () => {
  it("hydrates the same image path from each side resource source", async () => {
    const resolveLocalImage = vi.fn(
      async (
        _source: string,
        _documentPath: string,
        _context: LocalImageResolveContext | null | undefined,
        _repositoryRoot?: string | null,
        resourceSource?: GitDiffResourceSource | null,
      ) => ({
        status: "resolved" as const,
        mediaType: "image/svg+xml",
        encoding: "utf8" as const,
        content: `<svg><text>${resourceSource?.kind}</text></svg>`,
      }),
    );

    const leftSource = { kind: "commit" as const, revision: "head-oid" };
    const rightSource = { kind: "worktree" as const };
    const [left, right] = await Promise.all([
      resolveGitRenderedDiffLocalImage(
        resolveLocalImage,
        "/images/diagram.svg",
        "/workspace/docs/guide.md",
        null,
        { repositoryRoot: "/workspace", source: leftSource },
      ),
      resolveGitRenderedDiffLocalImage(
        resolveLocalImage,
        "/images/diagram.svg",
        "/workspace/docs/guide.md",
        null,
        { repositoryRoot: "/workspace", source: rightSource },
      ),
    ]);

    expect(resolveLocalImage).toHaveBeenCalledTimes(2);
    expect(resolveLocalImage.mock.calls.map((call) => call[4])).toEqual([
      leftSource,
      rightSource,
    ]);
    expect(left.content).toContain("commit");
    expect(right.content).toContain("worktree");
    expect(left.content).not.toBe(right.content);
  });
});
