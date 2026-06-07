import { describe, expect, it } from "vitest";

import {
  directoryGitStatusBadgeLabel,
  fileGitStatusBadgeLabel,
} from "../../src/ui/lib/gitStatusBadgeLabels";
import { gitStatusDisplay } from "../../src/ui/lib/gitStatusDisplay";

describe("git status badge labels", () => {
  it.each([
    ["modified", "Modified in Git. Open diff for guide.md"],
    ["added", "Added in Git. Open diff for guide.md"],
    ["untracked", "Untracked in Git. Open diff for guide.md"],
    ["deleted", "Deleted in Git. Open diff for guide.md"],
    ["renamed", "Renamed in Git. Open diff for guide.md"],
    ["binary", "Binary changed in Git. Open diff for guide.md"],
  ] as const)("describes %s file badge action", (status, expected) => {
    const display = gitStatusDisplay(status);
    expect(display).not.toBeNull();
    expect(fileGitStatusBadgeLabel(display!, "guide.md")).toBe(expected);
  });

  it("describes directory badges as descendant changed document counts", () => {
    expect(
      directoryGitStatusBadgeLabel(
        {
          status: "modified",
          className: "git-status-modified",
          count: 4,
          modifiedCount: 2,
          addedCount: 1,
          deletedCount: 0,
          untrackedCount: 1,
          label: "4 changed documents: 2 modified, 1 added, 1 untracked",
        },
        "docs",
      ),
    ).toBe("4 changed documents under docs: 2 modified, 1 added, 1 untracked");
  });
});
