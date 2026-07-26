import { describe, expect, it } from "vitest";
import { activeFileForTurn } from "../../src/ui/agent/AgentPanelHost";

describe("Agent active file context", () => {
  it("snapshots the currently displayed document path for a turn", () => {
    const first = activeFileForTurn({ path: "/workspace/docs/first.md" });
    const second = activeFileForTurn({ path: "/workspace/docs/second.md" });

    expect(first).toEqual({ path: "/workspace/docs/first.md" });
    expect(second).toEqual({ path: "/workspace/docs/second.md" });
  });

  it("allows a turn without a displayed document", () => {
    expect(activeFileForTurn(null)).toBeNull();
  });
});
