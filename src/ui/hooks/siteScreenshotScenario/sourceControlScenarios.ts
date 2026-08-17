import { fixtureDirectory } from "./helpers";
import type { SiteScreenshotScenarioContext } from "./types";

export async function runSourceControlScenarios(
  context: SiteScreenshotScenarioContext,
) {
  const {
    dismissInlineNotice,
    fixturePath,
    openDirectory,
    openDocument,
    scenario,
    setConfig,
    setRootDirectory,
    showGitDiff,
  } = context;

  if (
    scenario === "source-control" ||
    scenario === "source-control-changes" ||
    scenario === "source-control-ref-context-menu"
  ) {
    const directory = fixtureDirectory(fixturePath);
    const applySourceControlState = () => {
      setRootDirectory(directory);
      setConfig((current) =>
        current
          ? {
              ...current,
              sidebarVisible: true,
              rightSidebarVisible: false,
              layout: {
                ...current.layout,
                leftSidebarWidth: 360,
              },
              workspace: {
                ...current.workspace,
                sidebarTab: "sourceControl",
                sourceControlView: "changes",
              },
            }
          : current,
      );
    };
    const openRefCompareContextMenu = () => {
      const item = document.querySelector<HTMLElement>(
        '[data-review-id="source-control-change-item"]:not([aria-disabled="true"])',
      );
      if (!item) return;
      item.focus();
      const rect = item.getBoundingClientRect();
      item.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + Math.min(rect.width - 24, 260),
          clientY: rect.top + rect.height / 2,
          button: 2,
        }),
      );
      window.setTimeout(() => {
        document
          .querySelector<HTMLElement>(
            '[data-review-id="context-menu-item-compare-with-branch"]',
          )
          ?.focus();
      }, 80);
    };

    applySourceControlState();
    window.setTimeout(applySourceControlState, 300);
    window.setTimeout(applySourceControlState, 900);
    window.setTimeout(applySourceControlState, 1500);
    if (scenario === "source-control-ref-context-menu") {
      window.setTimeout(openRefCompareContextMenu, 3600);
      window.setTimeout(openRefCompareContextMenu, 5200);
    }
    return true;
  }

  if (scenario === "source-control-all-diffs") {
    const directory = fixtureDirectory(fixturePath);
    await openDirectory(directory);
    await openDocument(fixturePath);
    const applyAllDiffsSourceControlState = () => {
      setRootDirectory(directory);
      setConfig((current) =>
        current
          ? {
              ...current,
              sidebarVisible: true,
              rightSidebarVisible: false,
              layout: { ...current.layout, leftSidebarWidth: 330 },
              workspace: {
                ...current.workspace,
                sidebarTab: "sourceControl",
                sourceControlView: "changes",
              },
            }
          : current,
      );
    };
    applyAllDiffsSourceControlState();
    const restoreState = window.setInterval(
      applyAllDiffsSourceControlState,
      500,
    );
    const allDiffs = await new Promise<HTMLButtonElement>((resolve, reject) => {
      const startedAt = Date.now();
      const find = () => {
        const button = document.querySelector<HTMLButtonElement>(
          '[data-review-id="source-control-all-diffs"]',
        );
        if (button) return resolve(button);
        if (Date.now() - startedAt > 10_000)
          return reject(new Error("All Diffs action did not appear."));
        window.setTimeout(find, 50);
      };
      find();
    });
    window.clearInterval(restoreState);
    allDiffs.click();
    await new Promise<void>((resolve, reject) => {
      const startedAt = Date.now();
      const find = () => {
        const panel = document.querySelector(
          '[data-review-id="source-control-all-diffs-panel"]',
        );
        const sections = document.querySelectorAll(
          '[data-review-id="diff-stream-file-section"]',
        );
        if (panel && sections.length > 1) return resolve();
        if (Date.now() - startedAt > 15_000)
          return reject(new Error("All Diffs review did not finish loading."));
        window.setTimeout(find, 100);
      };
      find();
    });
    const keepAllDiffsOpen = () => {
      if (
        document.querySelector(
          '[data-review-id="source-control-all-diffs-panel"]',
        )
      ) {
        return;
      }
      document
        .querySelector<HTMLButtonElement>(
          '[data-review-id="source-control-all-diffs"]',
        )
        ?.click();
    };
    window.setInterval(keepAllDiffsOpen, 750);
    return true;
  }

  if (scenario === "source-control-open-diff") {
    const directory = fixtureDirectory(fixturePath);
    const applySourceControlDiffState = () => {
      dismissInlineNotice();
      setRootDirectory(directory);
      setConfig((current) =>
        current
          ? {
              ...current,
              sidebarVisible: true,
              rightSidebarVisible: false,
              layout: {
                ...current.layout,
                leftSidebarWidth: 360,
              },
              workspace: {
                ...current.workspace,
                sidebarTab: "sourceControl",
                sourceControlView: "changes",
              },
            }
          : current,
      );
    };

    applySourceControlDiffState();
    await showGitDiff(fixturePath);
    applySourceControlDiffState();
    window.setTimeout(applySourceControlDiffState, 300);
    window.setTimeout(applySourceControlDiffState, 900);
    window.setTimeout(applySourceControlDiffState, 1500);
    return true;
  }

  if (
    scenario === "source-control-branch-diff" ||
    scenario === "source-control-branch-diff-preview" ||
    scenario === "source-control-repo-graph" ||
    scenario === "source-control-file-history"
  ) {
    const directory = fixtureDirectory(fixturePath);
    const sourceControlView =
      scenario === "source-control-branch-diff" ||
      scenario === "source-control-branch-diff-preview"
        ? "branchDiff"
        : "graph";
    const applySourceControlReviewState = () => {
      const focusHistorySidebar =
        scenario === "source-control-repo-graph" ||
        scenario === "source-control-file-history";
      dismissInlineNotice();
      setRootDirectory(directory);
      setConfig((current) =>
        current
          ? {
              ...current,
              sidebarVisible: true,
              rightSidebarVisible: false,
              layout: {
                ...current.layout,
                leftSidebarWidth: focusHistorySidebar ? 560 : 390,
              },
              workspace: {
                ...current.workspace,
                sidebarTab: "sourceControl",
                sourceControlView,
              },
            }
          : current,
      );
    };
    const selectBranchDiffBase = () => {
      const select = document.querySelector<HTMLSelectElement>(
        '[data-review-id="source-control-branch-diff-base"]',
      );
      if (
        !select ||
        !Array.from(select.options).some((option) => option.value === "main")
      ) {
        return;
      }
      select.value = "main";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const clickReviewControl = (reviewId: string) => {
      document
        .querySelector<HTMLButtonElement>(`[data-review-id="${reviewId}"]`)
        ?.click();
    };
    const openFirstBranchDiffItem = () => {
      document
        .querySelector<HTMLButtonElement>(
          '[data-review-id="source-control-branch-diff-item"]:not([aria-disabled="true"])',
        )
        ?.click();
    };

    await openDirectory(directory);
    await openDocument(fixturePath);
    applySourceControlReviewState();
    if (scenario === "source-control-file-history") {
      clickReviewControl("source-control-view-file-history");
    } else if (scenario === "source-control-repo-graph") {
      clickReviewControl("source-control-view-repo-graph");
    } else {
      clickReviewControl("source-control-view-branch-diff");
      selectBranchDiffBase();
    }
    window.setTimeout(applySourceControlReviewState, 300);
    window.setTimeout(() => {
      if (scenario === "source-control-file-history") {
        clickReviewControl("source-control-view-file-history");
      } else if (scenario === "source-control-repo-graph") {
        clickReviewControl("source-control-view-repo-graph");
      } else {
        clickReviewControl("source-control-view-branch-diff");
        selectBranchDiffBase();
      }
    }, 900);
    window.setTimeout(() => {
      applySourceControlReviewState();
      if (
        scenario === "source-control-branch-diff" ||
        scenario === "source-control-branch-diff-preview"
      ) {
        selectBranchDiffBase();
      }
    }, 1800);
    if (scenario === "source-control-branch-diff-preview") {
      window.setTimeout(openFirstBranchDiffItem, 3500);
      window.setTimeout(openFirstBranchDiffItem, 5200);
    }
    return true;
  }

  return false;
}
