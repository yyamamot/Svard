import { useEffect, useRef } from "react";

import type { WorkspaceEnvironment } from "../../core/types";
import { tracePerf } from "../lib/perfTrace";
import type { InlineNoticeOptions } from "../types";

export function useWorkspacePerformanceNotice({
  showInlineNotice,
  workspaceEnvironment,
}: {
  showInlineNotice: (
    message: string,
    options?: InlineNoticeOptions,
  ) => void;
  workspaceEnvironment: WorkspaceEnvironment | null;
}) {
  const wslWorkspaceNoticeShownRef = useRef(false);

  useEffect(() => {
    if (
      workspaceEnvironment?.performanceMode !== "wsl-mitigated" ||
      wslWorkspaceNoticeShownRef.current
    ) {
      return;
    }
    wslWorkspaceNoticeShownRef.current = true;
    tracePerf("workspace.wslMitigation.enabled", {
      mode: workspaceEnvironment.performanceMode,
      locationKind: workspaceEnvironment.locationKind,
      reason: "wsl-workspace",
    });
    showInlineNotice(
      "WSL workspace detected. File tree and Git metadata are loaded on demand because Windows access to WSL files can be slow. Use refresh or expand folders to pick up new files.",
      { tone: "info" },
    );
  }, [showInlineNotice, workspaceEnvironment]);
}
