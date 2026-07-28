import { act, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockHostAdapter } from "../../src/adapters/mockHostAdapter";
import { defaultConfig } from "../../src/core/defaultConfig";
import { AgentPanelHost } from "../../src/ui/agent/AgentPanelHost";
import type { MainAgentPanelPlacement } from "../../src/ui/agent/agentPanelTypes";
import { CodexMainSplit } from "../../src/ui/components/CodexMainSplit";
import {
  createReactRootHarness,
  type ReactRootHarness,
} from "./helpers/reactHarness";

function rect(width: number, height: number): DOMRect {
  return {
    bottom: height,
    height,
    left: 0,
    right: width,
    top: 0,
    width,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  };
}

function AgentDockHarness({ host }: { host: MockHostAdapter }) {
  const [placement, setPlacement] = useState<MainAgentPanelPlacement>("right");
  return (
    <CodexMainSplit
      open
      placement={placement}
      viewer={<div data-review-id="test-viewer">Viewer</div>}
      panel={
        <AgentPanelHost
          activeDocument={null}
          host={host}
          open
          onClose={() => undefined}
          onMainPlacementChange={setPlacement}
          placement={placement === "bottom" ? "mainBottom" : "mainRight"}
          providerConfig={structuredClone(defaultConfig).agentProviders}
          workspaceRoot="/workspace"
        />
      }
    />
  );
}

describe("Main bottom AI Chat panel", () => {
  let harness: ReactRootHarness;

  beforeEach(() => {
    harness = createReactRootHarness();
  });

  afterEach(() => {
    harness.cleanup();
  });

  it("moves the same Agent view between right and bottom without losing draft state", async () => {
    harness.render(<AgentDockHarness host={new MockHostAdapter()} />);
    const composer =
      harness.container.querySelector<HTMLTextAreaElement>("textarea");
    await harness.setTextAreaValue(composer, "配置変更後も保持する質問");

    await harness.click(
      harness.container.querySelector<HTMLButtonElement>(
        '[aria-label="Move AI Chat to bottom"]',
      ),
    );

    const split = harness.byReviewId("codex-main-split");
    expect(split.dataset.agentPlacement).toBe("bottom");
    expect(
      harness.container.querySelector<HTMLTextAreaElement>("textarea")?.value,
    ).toBe("配置変更後も保持する質問");
    expect(
      harness.container.querySelector('[aria-label="Move AI Chat to right"]'),
    ).toBeTruthy();

    await harness.click(
      harness.container.querySelector<HTMLButtonElement>(
        '[aria-label="Move AI Chat to right"]',
      ),
    );
    expect(split.dataset.agentPlacement).toBe("right");
    expect(
      harness.container.querySelector<HTMLTextAreaElement>("textarea")?.value,
    ).toBe("配置変更後も保持する質問");
  });

  it("keeps a session-only bottom height within the main area bounds", () => {
    harness.render(
      <CodexMainSplit
        open
        panel={<div>AI</div>}
        placement="bottom"
        viewer={<div>Viewer</div>}
      />,
    );
    const split = harness.byReviewId("codex-main-split");
    const pane = split.querySelector<HTMLElement>(".codex-ai-pane");
    const resizer = split.querySelector<HTMLElement>(".codex-main-resizer");
    expect(split.style.getPropertyValue("--codex-bottom-height")).toBe(
      "clamp(240px, 34vh, 360px)",
    );
    expect(resizer?.getAttribute("aria-orientation")).toBe("horizontal");
    split.getBoundingClientRect = () => rect(1000, 600);
    if (pane) pane.getBoundingClientRect = () => rect(1000, 240);

    act(() => {
      resizer?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowUp" }),
      );
    });
    expect(split.style.getPropertyValue("--codex-bottom-height")).toBe("256px");

    if (pane) pane.getBoundingClientRect = () => rect(1000, 360);
    act(() => {
      resizer?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowUp" }),
      );
    });
    expect(split.style.getPropertyValue("--codex-bottom-height")).toBe("360px");

    if (pane) pane.getBoundingClientRect = () => rect(1000, 220);
    act(() => {
      resizer?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowDown" }),
      );
    });
    expect(split.style.getPropertyValue("--codex-bottom-height")).toBe("220px");
  });

  it("keeps bottom sizing independent while viewer content switches to Split View", () => {
    const panel = <textarea defaultValue="session draft" />;
    harness.render(
      <CodexMainSplit
        open
        panel={panel}
        placement="bottom"
        viewer={<div data-review-id="single-viewer" />}
      />,
    );
    const split = harness.byReviewId("codex-main-split");
    const rightWidth = split.style.getPropertyValue("--codex-document-width");
    const pane = split.querySelector<HTMLElement>(".codex-ai-pane");
    const resizer = split.querySelector<HTMLElement>(".codex-main-resizer");
    split.getBoundingClientRect = () => rect(1000, 600);
    if (pane) pane.getBoundingClientRect = () => rect(1000, 240);
    act(() => {
      resizer?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowUp" }),
      );
    });

    harness.render(
      <CodexMainSplit
        open
        panel={panel}
        placement="right"
        viewer={<div data-review-id="viewer-split" />}
      />,
    );
    expect(harness.byReviewId("codex-main-split").dataset.agentPlacement).toBe(
      "right",
    );
    expect(
      harness
        .byReviewId("codex-main-split")
        .style.getPropertyValue("--codex-document-width"),
    ).toBe(rightWidth);
    expect(harness.container.querySelector("textarea")?.value).toBe(
      "session draft",
    );

    harness.render(
      <CodexMainSplit
        open
        panel={panel}
        placement="bottom"
        viewer={<div data-review-id="viewer-split" />}
      />,
    );
    expect(
      harness
        .byReviewId("codex-main-split")
        .style.getPropertyValue("--codex-bottom-height"),
    ).toBe("256px");
    expect(harness.byReviewId("viewer-split")).toBeTruthy();
  });

  it("does not expose the normal placement control in the Diff Drawer", () => {
    harness.render(
      <AgentPanelHost
        activeDocument={null}
        host={new MockHostAdapter()}
        open
        onClose={() => undefined}
        onMainPlacementChange={vi.fn()}
        placement="diffDock"
        providerConfig={structuredClone(defaultConfig).agentProviders}
        workspaceRoot="/workspace"
      />,
    );
    expect(
      harness.container.querySelector('[aria-label="Move AI Chat to bottom"]'),
    ).toBeNull();
    expect(
      harness.container.querySelector('[aria-label="Move AI Chat to right"]'),
    ).toBeNull();
  });
});
