import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useAgentActionNotice,
  workspaceChangedAgentNotice,
} from "../../src/ui/agent/useAgentActionNotice";
import { defaultInlineNoticeTimeout } from "../../src/ui/lib/notice";
import {
  createReactRootHarness,
  type ReactRootHarness,
} from "./helpers/reactHarness";

describe("useAgentActionNotice", () => {
  let harness: ReactRootHarness;
  let showWorkspaceChanged: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    harness = createReactRootHarness();
    function NoticeProbe() {
      const [notice, setNotice] = useAgentActionNotice();
      showWorkspaceChanged = () => setNotice(workspaceChangedAgentNotice);
      return <p>{notice}</p>;
    }
    harness.render(<NoticeProbe />);
  });

  afterEach(() => {
    harness.cleanup();
    vi.useRealTimers();
  });

  it("dismisses the workspace-change notice after its transient interval", () => {
    act(() => showWorkspaceChanged());
    expect(harness.container.textContent).toContain(
      workspaceChangedAgentNotice,
    );

    act(() => {
      vi.advanceTimersByTime(defaultInlineNoticeTimeout("info"));
    });
    expect(harness.container.textContent).not.toContain(
      workspaceChangedAgentNotice,
    );
  });
});
