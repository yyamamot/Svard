import { act, useEffect, useRef, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockHostAdapter } from "../../src/adapters/mockHostAdapter";
import { defaultConfig } from "../../src/core/defaultConfig";
import { AgentPanelHost } from "../../src/ui/agent/AgentPanelHost";
import {
  DiffAgentDock,
  type DiffAgentDockControls,
} from "../../src/ui/components/DiffAgentDock";
import {
  createReactRootHarness,
  type ReactRootHarness,
} from "./helpers/reactHarness";

function PortalPanel({ host }: { host: MockHostAdapter }) {
  const firstTargetRef = useRef<HTMLDivElement>(null);
  const secondTargetRef = useRef<HTMLDivElement>(null);
  const [second, setSecond] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalTarget(second ? secondTargetRef.current : firstTargetRef.current);
  }, [second]);

  return (
    <>
      <button type="button" onClick={() => setSecond((current) => !current)}>
        Move panel
      </button>
      <button
        type="button"
        onClick={() => setFocusRequest((current) => current + 1)}
      >
        Focus composer
      </button>
      <div ref={firstTargetRef} data-target="first" />
      <div ref={secondTargetRef} data-target="second" />
      <AgentPanelHost
        activeDocument={null}
        focusRequest={focusRequest}
        host={host}
        open
        onClose={() => undefined}
        placement="diffDock"
        portalTarget={portalTarget}
        providerConfig={structuredClone(defaultConfig).agentProviders}
        workspaceRoot="/workspace"
      />
    </>
  );
}

describe("Diff Agent dock", () => {
  let harness: ReactRootHarness;

  beforeEach(() => {
    harness = createReactRootHarness();
  });

  afterEach(() => {
    harness.cleanup();
  });

  it("preserves the draft while moving the same panel between targets", async () => {
    harness.render(<PortalPanel host={new MockHostAdapter()} />);
    const first = harness.container.querySelector<HTMLElement>(
      '[data-target="first"]',
    );
    await vi.waitFor(() =>
      expect(first?.querySelector("textarea")).toBeTruthy(),
    );
    await harness.setTextAreaValue(
      first?.querySelector<HTMLTextAreaElement>("textarea"),
      "任意の質問を保持する",
    );

    await harness.click(harness.buttonByText("Move panel"));
    const second = harness.container.querySelector<HTMLElement>(
      '[data-target="second"]',
    );
    await vi.waitFor(() =>
      expect(
        second?.querySelector<HTMLTextAreaElement>("textarea")?.value,
      ).toBe("任意の質問を保持する"),
    );
    expect(first?.querySelector("textarea")).toBeNull();
  });

  it("focuses the free-form composer on request", async () => {
    harness.render(<PortalPanel host={new MockHostAdapter()} />);
    await harness.click(harness.buttonByText("Focus composer"));
    await vi.waitFor(() =>
      expect(document.activeElement?.tagName).toBe("TEXTAREA"),
    );
    expect((document.activeElement as HTMLTextAreaElement).value).toBe("");
  });

  it("renders the requested session-only height", () => {
    const heightChange = vi.fn();
    const targetChange = vi.fn();
    const controls: DiffAgentDockControls = {
      available: true,
      heightPx: 318,
      open: true,
      onHeightChange: heightChange,
      onMountTargetChange: targetChange,
      onToggle: vi.fn(),
    };
    harness.render(<DiffAgentDock controls={controls} />);

    const dock = harness.container.querySelector<HTMLElement>(
      '[data-review-id="git-diff-agent-dock"]',
    );
    expect(dock?.style.height).toBe("318px");
    expect(
      harness.container.querySelector(
        '[data-review-id="git-diff-agent-dock-resizer"]',
      ),
    ).toBeTruthy();
    expect(targetChange).toHaveBeenCalled();

    harness.container
      .querySelector<HTMLElement>(
        '[data-review-id="git-diff-agent-dock-resizer"]',
      )
      ?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowUp" }),
      );
    expect(heightChange).toHaveBeenCalledWith(220);
  });

  it("does not render a mount target while hidden", () => {
    const controls: DiffAgentDockControls = {
      available: true,
      heightPx: null,
      open: false,
      onHeightChange: vi.fn(),
      onMountTargetChange: vi.fn(),
      onToggle: vi.fn(),
    };
    act(() => harness.render(<DiffAgentDock controls={controls} />));
    expect(
      harness.container.querySelector('[data-review-id="git-diff-agent-dock"]'),
    ).toBeNull();
  });
});
