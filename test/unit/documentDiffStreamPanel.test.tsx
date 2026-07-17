import { describe, expect, it, vi } from "vitest";
import { setupDocumentDiffStreamPanelTest } from "./documentDiffStreamPanelHarness";
import { requiredDiffStreamProps } from "./documentDiffStreamTestUtils";

describe("DocumentDiffStreamPanel shell", () => {
  const test = setupDocumentDiffStreamPanelTest();

  it("renders the All diffs shell and view controls", async () => {
    await test.render({
      config: null,
      preview: {
        source: "git-changes-stream",
        items: [],
      },
      getGitDiffPreview: vi.fn(),
      ...requiredDiffStreamProps(),
      onClose: vi.fn(),
    });

    expect(
      test.container.querySelector(
        '[data-review-id="source-control-all-diffs-panel"]',
      ),
    ).not.toBeNull();
    expect(
      test.container.querySelector('[data-review-id="diff-stream-navigation"]'),
    ).not.toBeNull();
    expect(
      test.container.querySelector(".diff-stream-view-toggle"),
    ).not.toBeNull();
    expect(test.container.textContent).toContain("All diffs");
    expect(test.container.textContent).toContain("0 document diffs");
  });

  it("renders unsupported files as blocker rows without fetching previews", async () => {
    const getGitDiffPreview = vi.fn();

    await test.render({
      config: null,
      preview: {
        source: "git-changes-stream",
        items: [
          {
            kind: "blocker",
            path: "assets/logo.png",
            status: "modified",
            reason: "Preview diff is available for markup documents only.",
          },
        ],
      },
      getGitDiffPreview,
      ...requiredDiffStreamProps(),
      onClose: vi.fn(),
    });

    expect(getGitDiffPreview).not.toHaveBeenCalled();
    expect(
      test.container.querySelector('[data-review-id="diff-stream-blocker-row"]')
        ?.textContent,
    ).toContain("Preview diff is available for markup documents only.");
    expect(
      test.container.querySelector(
        '[data-review-id="diff-stream-change-ruler"]',
      ),
    ).toBeNull();
  });
});
