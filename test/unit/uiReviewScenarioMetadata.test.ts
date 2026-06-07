import { describe, expect, it } from "vitest";

import {
  isPreferencesLayoutScenario,
  isPreferencesPageScenario,
  optionalCoreMarkersForScenario,
  preferenceScenarioIds,
  requiredMarkersForScenario,
  scenarioContractFor,
  uiReviewScenarioContractIds,
} from "../../scripts/ui-review/scenarios/metadata.mjs";

describe("UI review scenario metadata", () => {
  it("defines Preferences scenario behavior in one place", () => {
    expect(preferenceScenarioIds).toEqual(
      expect.arrayContaining([
        "viewer-preferences",
        "viewer-preferences-tab",
        "viewer-preferences-kroki-remote-self-managed",
        "viewer-preferences-remote-providers",
        "viewer-preferences-diagrams-polish",
        "viewer-preferences-security-persistence",
        "viewer-preferences-zen-mode",
        "viewer-preferences-stable-size",
        "viewer-preferences-keybindings",
      ]),
    );
    expect(isPreferencesPageScenario("viewer-preferences-tab")).toBe(true);
    expect(isPreferencesPageScenario("viewer-basic")).toBe(false);
    expect(isPreferencesLayoutScenario("viewer-preferences")).toBe(true);
  });

  it("keeps marker expectations with the scenario metadata", () => {
    expect(
      optionalCoreMarkersForScenario("viewer-preferences-security-persistence"),
    ).toEqual([
      "document-viewer",
      "document-body",
      "right-sidebar",
      "right-sidebar-tabs",
      "right-sidebar-tab-contents",
      "right-sidebar-tab-search",
      "toc",
    ]);
    expect(
      requiredMarkersForScenario("viewer-preferences-security-persistence"),
    ).toEqual(
      expect.arrayContaining([
        "preferences-page",
        "preferences-tab-security",
        "show-external-images-control",
      ]),
    );
    expect(requiredMarkersForScenario("viewer-basic")).toEqual([]);
  });

  it("keeps Git and Source Control marker expectations in scenario metadata", () => {
    expect(uiReviewScenarioContractIds).toEqual(
      expect.arrayContaining([
        "viewer-git-timeline-file-history-cache",
        "viewer-source-control-changes",
        "viewer-diff-preview-regression-suite",
        "viewer-diff-code-fence-word-highlight",
      ]),
    );
    expect(scenarioContractFor("viewer-source-control-changes")).toMatchObject({
      group: "source-control",
      handler: "gitDiff",
      documented: true,
    });
    expect(
      optionalCoreMarkersForScenario("viewer-git-timeline-file-history-cache"),
    ).toEqual(["file-tree", "tree-root", "tree-refresh", "tree-collapse-all"]);
    expect(
      requiredMarkersForScenario("viewer-diff-preview-regression-suite"),
    ).toEqual(
      expect.arrayContaining([
        "git-diff-preview-panel",
        "git-full-preview-diff",
        "git-diff-word-highlight",
      ]),
    );
    expect(
      requiredMarkersForScenario("viewer-diff-code-fence-word-highlight"),
    ).toEqual(
      expect.arrayContaining([
        "git-diff-preview-panel",
        "git-full-preview-diff",
        "git-full-preview-block",
      ]),
    );
  });
});
