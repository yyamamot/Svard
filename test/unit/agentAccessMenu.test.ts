import { describe, expect, it } from "vitest";
import { calculateAgentAccessPopoverPosition } from "../../src/ui/agent/AgentAccessMenu";

describe("calculateAgentAccessPopoverPosition", () => {
  it("opens above the trigger and stays inside the viewport", () => {
    expect(
      calculateAgentAccessPopoverPosition({
        trigger: { left: 24, top: 500 },
        popover: { width: 300, height: 240 },
        viewportWidth: 960,
        viewportHeight: 640,
      }),
    ).toEqual({ left: 24, top: 252 });
  });

  it("clamps narrow and short layouts to the viewport gap", () => {
    expect(
      calculateAgentAccessPopoverPosition({
        trigger: { left: 900, top: 120 },
        popover: { width: 300, height: 240 },
        viewportWidth: 960,
        viewportHeight: 640,
      }),
    ).toEqual({ left: 652, top: 8 });
  });
});
