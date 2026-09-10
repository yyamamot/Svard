import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applySourceControlAllDiffsScenario,
  isSourceControlAllDiffsScenario,
  // @ts-expect-error UI scenario handlers are runtime JavaScript modules.
} from "../../scripts/ui-review/scenarios/handlers/gitDiff/sourceControlAllDiffs.mjs";

const calls = vi.hoisted(() => [] as string[]);
vi.mock(
  "../../scripts/ui-review/scenarios/handlers/gitDiff/attachCurrentChange.mjs",
  () => ({
    exerciseAttachCurrentChange: vi.fn(async () => {
      calls.push("attach");
    }),
  }),
);
vi.mock(
  "../../scripts/ui-review/scenarios/handlers/gitDiff/sourceControlAllDiffs/agentContext.mjs",
  () => ({
    exerciseDiffContextReliability: vi.fn(async () => {
      calls.push("reliability");
    }),
    exerciseAllDiffsSelection: vi.fn(async () => {
      calls.push("selection");
    }),
    exerciseAllDiffsMediaContext: vi.fn(async () => {
      calls.push("media");
    }),
  }),
);
vi.mock(
  "../../scripts/ui-review/scenarios/handlers/gitDiff/sourceControlAllDiffs/linkBoundary.mjs",
  () => ({
    exerciseAllDiffsLinkBoundary: vi.fn(async () => {
      calls.push("links");
    }),
  }),
);
vi.mock(
  "../../scripts/ui-review/scenarios/handlers/gitDiff/sourceControlAllDiffs/keybindings.mjs",
  () => ({
    exerciseAllDiffsKeybindings: vi.fn(async () => {
      calls.push("keys");
    }),
  }),
);
vi.mock(
  "../../scripts/ui-review/scenarios/handlers/gitDiff/sourceControlAllDiffs/mouseGestures.mjs",
  () => ({
    exerciseAllDiffsMouseGestures: vi.fn(async () => {
      calls.push("gestures");
    }),
  }),
);
vi.mock(
  "../../scripts/ui-review/scenarios/handlers/gitDiff/sourceControlAllDiffs/sourceFallback.mjs",
  () => ({
    applyTooComplexSourceFallbackScenario: vi.fn(async () => {
      calls.push("fallback");
    }),
  }),
);
vi.mock(
  "../../scripts/ui-review/scenarios/handlers/gitDiff/sourceControlAllDiffs/streamInspection.mjs",
  () => ({
    inspectAllDiffsStream: vi.fn(async () => {
      calls.push("stream");
    }),
  }),
);

const routes = [
  ["viewer-all-diffs", ["links"]],
  ["viewer-source-control-all-diffs", ["stream"]],
  ["viewer-source-control-all-diffs-mouse-gestures", ["stream", "gestures"]],
  ["viewer-source-control-all-diffs-keybindings", ["stream", "keys"]],
  ["viewer-source-control-all-diffs-privacy", ["stream"]],
  ["viewer-source-control-all-diffs-selection", ["selection"]],
  ["viewer-source-control-all-diffs-media-context", ["media"]],
  ["viewer-agent-chat-diff-context-reliability", ["reliability"]],
  ["viewer-agent-chat-attach-current-change", ["attach"]],
  ["viewer-git-diff-too-complex-source-fallback", ["fallback"]],
] as const;

const openSteps = [
  "click:sidebar-tab-source-control",
  "wait:source-control-changes-list",
  "click:source-control-all-diffs",
  "wait:source-control-all-diffs-panel",
  "wait:diff-stream-file-section",
  "wait:diff-stream-rendered-block",
];

function createPage() {
  return {
    locator(selector: string) {
      const id = /data-review-id="([^"]+)"/.exec(selector)?.[1];
      const locator = {
        first: () => locator,
        click: async () => {
          calls.push(`click:${id}`);
        },
        waitFor: async () => {
          calls.push(`wait:${id}`);
        },
      };
      return locator;
    },
  };
}

beforeEach(() => {
  calls.length = 0;
});

describe("All Diffs scenario dispatch", () => {
  it.each(routes)(
    "preserves ordered steps and early return for %s",
    async (scenario, leafSteps) => {
      expect(isSourceControlAllDiffsScenario(scenario)).toBe(true);
      await applySourceControlAllDiffsScenario(createPage(), { scenario });
      expect(calls).toEqual(
        scenario === "viewer-git-diff-too-complex-source-fallback"
          ? leafSteps
          : [...openSteps, ...leafSteps],
      );
    },
  );

  it.each([
    "viewer-basic",
    "viewer-source-control-changes",
    "viewer-all-diffs-unknown",
    undefined,
    null,
  ])("does not claim unrelated scenario %s", (scenario) => {
    expect(isSourceControlAllDiffsScenario(scenario)).toBe(false);
  });

  it("waits for the panel before executing the selected scenario", async () => {
    const failure = new Error("panel unavailable");
    const page = createPage();
    const locator = page.locator;
    page.locator = (selector) => {
      const result = locator(selector);
      if (selector.includes("source-control-all-diffs-panel")) {
        result.waitFor = async () => {
          throw failure;
        };
      }
      return result;
    };
    await expect(
      applySourceControlAllDiffsScenario(page, {
        scenario: "viewer-all-diffs",
      }),
    ).rejects.toBe(failure);
    expect(calls).toEqual(openSteps.slice(0, 3));
  });
});
