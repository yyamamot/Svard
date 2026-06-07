import { describe, expect, it, vi } from "vitest";

import { Topbar } from "../../src/ui/components/Topbar";
import type { CommandId } from "../../src/core/commands";
import type { DocumentPayload } from "../../src/core/types";
import type { WorkspaceTab } from "../../src/ui/types";
import { createReactRootHarness } from "./helpers/reactHarness";

const documentPayload: DocumentPayload = {
  path: "/workspace/docs/01-specification.md",
  basePath: "/workspace/docs",
  format: "markdown",
  source: "# Specification",
  updatedAt: "2026-05-24T00:00:00.000Z",
};

const documentTab: WorkspaceTab = {
  id: documentPayload.path,
  kind: "document",
  path: documentPayload.path,
  document: documentPayload,
};

function renderTopbar({
  splitEnabled = false,
  sidebarVisible = true,
  rightSidebarVisible = true,
  rightSidebarAvailable = true,
  zenModeActive = false,
  onDispatchCommand = vi.fn<(commandId: CommandId) => void>(),
}: Partial<{
  splitEnabled: boolean;
  sidebarVisible: boolean;
  rightSidebarVisible: boolean;
  rightSidebarAvailable: boolean;
  zenModeActive: boolean;
  onDispatchCommand: (commandId: CommandId) => void;
}> = {}) {
  const harness = createReactRootHarness();
  harness.render(
    <Topbar
      sidebarVisible={sidebarVisible}
      rightSidebarVisible={rightSidebarVisible}
      rightSidebarAvailable={rightSidebarAvailable}
      zenModeActive={zenModeActive}
      activeTitle="01-specification.md"
      activeTabId={documentTab.id}
      tabs={[documentTab]}
      visibleTabs={[documentTab]}
      overflowTabs={[]}
      tabMoreOpen={false}
      splitEnabled={splitEnabled}
      onActivateTab={() => undefined}
      onCloseTab={() => undefined}
      onToggleTabMore={() => undefined}
      onDispatchCommand={onDispatchCommand}
    />,
  );
  return { harness, onDispatchCommand };
}

describe("Topbar direct layout controls", () => {
  it("keeps app actions menu-first and exposes direct layout controls", () => {
    const { harness } = renderTopbar();

    expect(
      harness.container.querySelector('[data-review-id="quick-open-trigger"]'),
    ).toBeNull();
    expect(
      harness.container.querySelector('[data-review-id="preferences-open"]'),
    ).toBeNull();
    expect(harness.byReviewId("left-sidebar-toggle")).toBeTruthy();
    expect(harness.byReviewId("zen-mode-toggle")).toBeTruthy();
    expect(harness.byReviewId("split-view-toggle")).toBeTruthy();
    expect(harness.byReviewId("right-sidebar-toggle")).toBeTruthy();
    expect(
      harness.container.querySelector('[data-review-id="layout-menu-trigger"]'),
    ).toBeNull();
    expect(
      harness.container.querySelector('[data-review-id="layout-menu"]'),
    ).toBeNull();
    expect(
      harness.container.querySelector(
        '[data-review-id="history-menu-trigger"]',
      ),
    ).toBeNull();

    harness.cleanup();
  });

  it("dispatches sidebar toggle commands from topbar buttons", async () => {
    const { harness, onDispatchCommand } = renderTopbar();

    await harness.click(harness.byReviewId("left-sidebar-toggle"));
    await harness.click(harness.byReviewId("right-sidebar-toggle"));

    expect(onDispatchCommand).toHaveBeenCalledWith("sidebar.toggleLeft");
    expect(onDispatchCommand).toHaveBeenCalledWith("sidebar.toggleRight");

    harness.cleanup();
  });

  it("dispatches direct zen and split commands", async () => {
    const { harness, onDispatchCommand } = renderTopbar();

    await harness.click(harness.byReviewId("zen-mode-toggle"));
    await harness.click(harness.byReviewId("split-view-toggle"));

    expect(onDispatchCommand).toHaveBeenCalledWith("view.toggleZenMode");
    expect(onDispatchCommand).toHaveBeenCalledWith("view.splitRight");

    harness.cleanup();
  });

  it("dispatches close split when split view is active", async () => {
    const { harness, onDispatchCommand } = renderTopbar({
      splitEnabled: true,
    });

    await harness.click(harness.byReviewId("split-view-toggle"));

    expect(onDispatchCommand).toHaveBeenCalledWith("view.closeSplit");

    harness.cleanup();
  });

  it("reflects active layout state in labels and aria state", () => {
    const { harness } = renderTopbar({
      splitEnabled: true,
      zenModeActive: true,
      sidebarVisible: false,
      rightSidebarVisible: true,
    });

    expect(
      harness.byReviewId("zen-mode-toggle").getAttribute("aria-pressed"),
    ).toBe("true");
    expect(harness.byReviewId("zen-mode-toggle").title).toBe("Exit Zen Mode");
    expect(
      harness.byReviewId("split-view-toggle").getAttribute("aria-pressed"),
    ).toBe("true");
    expect(harness.byReviewId("split-view-toggle").title).toBe(
      "Close Split View",
    );
    expect(
      harness.byReviewId("left-sidebar-toggle").getAttribute("aria-pressed"),
    ).toBe("false");
    expect(
      harness.byReviewId("right-sidebar-toggle").getAttribute("aria-pressed"),
    ).toBe("true");

    harness.cleanup();
  });

  it("marks right sidebar toggle unavailable when the surface hides it", () => {
    const { harness, onDispatchCommand } = renderTopbar({
      rightSidebarVisible: true,
      rightSidebarAvailable: false,
    });

    const rightSidebarToggle = harness.byReviewId(
      "right-sidebar-toggle",
    ) as HTMLButtonElement;

    expect(rightSidebarToggle.disabled).toBe(true);
    expect(rightSidebarToggle.getAttribute("aria-disabled")).toBe("true");
    expect(rightSidebarToggle.getAttribute("aria-pressed")).toBe("true");
    expect(rightSidebarToggle.title).toBe(
      "Right sidebar is unavailable while Preferences is open",
    );
    rightSidebarToggle.click();
    expect(onDispatchCommand).not.toHaveBeenCalledWith("sidebar.toggleRight");

    harness.cleanup();
  });
});
