import { act } from "react";
import { describe, expect, it, vi } from "vitest";
import { Bot } from "lucide-react";
import { AgentChatDisplayMenu } from "../../src/ui/agent/AgentChatDisplayMenu";
import {
  buildAgentChatDisplayMenu,
  type AgentChatDisplayMenuItem,
} from "../../src/ui/agent/agentChatDisplay";
import { createReactRootHarness } from "./helpers/reactHarness";

describe("Agent Chat display menu model", () => {
  it("offers right, bottom, and detached locations in the normal viewer", () => {
    expect(
      buildAgentChatDisplayMenu({
        detached: false,
        diffOpen: false,
        mainOpen: false,
        mainPlacement: "right",
        moving: false,
        snapshotAvailable: true,
      }),
    ).toEqual([
      {
        action: "showRight",
        checked: false,
        disabled: false,
        label: "Right side",
      },
      {
        action: "showBottom",
        checked: false,
        disabled: false,
        label: "Bottom",
      },
      {
        action: "openDetached",
        checked: false,
        disabled: false,
        label: "Separate window",
      },
    ]);
  });

  it("uses a Diff-specific Main target and keeps hide separate from close", () => {
    const items = buildAgentChatDisplayMenu({
      detached: false,
      diffOpen: true,
      mainOpen: true,
      mainPlacement: "bottom",
      moving: false,
      snapshotAvailable: true,
    });

    expect(items.map((item) => item.label)).toEqual([
      "Diff Preview",
      "Separate window",
      "Hide AI Chat",
    ]);
    expect(items[0]?.checked).toBe(true);
  });

  it("offers focus and reattach only while Detached", () => {
    expect(
      buildAgentChatDisplayMenu({
        detached: true,
        diffOpen: false,
        mainOpen: false,
        mainPlacement: "right",
        moving: false,
        snapshotAvailable: false,
      }).map((item) => item.action),
    ).toEqual(["focusDetached", "attachMain"]);
  });

  it("disables direct Detached launch until the snapshot is ready", () => {
    const detached = buildAgentChatDisplayMenu({
      detached: false,
      diffOpen: false,
      mainOpen: false,
      mainPlacement: "right",
      moving: false,
      snapshotAvailable: false,
    }).find((item) => item.action === "openDetached");

    expect(detached?.disabled).toBe(true);
  });
});

describe("AgentChatDisplayMenu", () => {
  const items: AgentChatDisplayMenuItem[] = [
    { action: "showRight", checked: true, label: "Right side" },
    { action: "showBottom", checked: false, label: "Bottom" },
    { action: "openDetached", disabled: true, label: "Separate window" },
    { action: "hide", label: "Hide AI Chat" },
  ];

  it("opens an accessible menu and dispatches a selected action", async () => {
    const harness = createReactRootHarness();
    const onSelect = vi.fn();
    harness.render(
      <AgentChatDisplayMenu
        items={items}
        onSelect={onSelect}
        reviewId="display-trigger"
        triggerIcon={<Bot size={16} />}
      />,
    );

    const trigger = harness.byReviewId("display-trigger");
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    await harness.click(trigger);
    expect(harness.byReviewId("agent-display-menu")).toBeTruthy();
    expect(
      harness.buttonByText("Right side").getAttribute("aria-checked"),
    ).toBe("true");

    await harness.click(harness.buttonByText("Bottom"));
    expect(onSelect).toHaveBeenCalledWith("showBottom");
    expect(
      harness.container.querySelector('[data-review-id="agent-display-menu"]'),
    ).toBeNull();
    harness.cleanup();
  });

  it("supports arrow navigation, Escape, and trigger focus restoration", async () => {
    const harness = createReactRootHarness();
    harness.render(
      <AgentChatDisplayMenu
        items={items}
        onSelect={() => undefined}
        reviewId="display-trigger"
        triggerIcon={<Bot size={16} />}
      />,
    );
    const trigger = harness.byReviewId("display-trigger");
    await harness.click(trigger);
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(document.activeElement?.textContent).toContain("Right side");

    await act(async () => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "ArrowDown",
        }),
      );
    });
    expect(document.activeElement?.textContent).toContain("Bottom");

    await act(async () => {
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "Escape",
        }),
      );
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });
    expect(document.activeElement).toBe(trigger);
    expect(
      harness.container.querySelector('[data-review-id="agent-display-menu"]'),
    ).toBeNull();
    harness.cleanup();
  });

  it("waits for the open guard and suppresses duplicate trigger requests", async () => {
    const harness = createReactRootHarness();
    let resolveGuard: ((value: boolean) => void) | null = null;
    const onBeforeOpen = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveGuard = resolve;
        }),
    );
    harness.render(
      <AgentChatDisplayMenu
        items={items}
        onBeforeOpen={onBeforeOpen}
        onSelect={() => undefined}
        reviewId="display-trigger"
        triggerIcon={<Bot size={16} />}
      />,
    );

    const trigger = harness.byReviewId("display-trigger");
    trigger.click();
    trigger.click();
    expect(onBeforeOpen).toHaveBeenCalledTimes(1);
    expect(
      harness.container.querySelector('[data-review-id="agent-display-menu"]'),
    ).toBeNull();

    await act(async () => {
      resolveGuard?.(true);
      await Promise.resolve();
    });
    expect(harness.byReviewId("agent-display-menu")).toBeTruthy();
    harness.cleanup();
  });
});
