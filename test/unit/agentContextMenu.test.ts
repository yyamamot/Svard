import { describe, expect, it } from "vitest";
import {
  agentContextPressure,
  agentContextPressureLabel,
  formatAgentContextTokens,
} from "../../src/ui/agent/AgentContextMenu";

describe("Agent context meter", () => {
  it("uses the contracted remaining-context thresholds", () => {
    expect(agentContextPressure(26)).toBe("normal");
    expect(agentContextPressure(25)).toBe("gettingFull");
    expect(agentContextPressure(11)).toBe("gettingFull");
    expect(agentContextPressure(10)).toBe("nearlyFull");
    expect(agentContextPressureLabel("gettingFull")).toBe("Getting full");
    expect(formatAgentContextTokens(187_500)).toBe("187.5K");
  });
});
