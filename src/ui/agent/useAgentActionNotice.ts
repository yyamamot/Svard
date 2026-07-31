import { useEffect, useState } from "react";
import { defaultInlineNoticeTimeout } from "../lib/notice";

export const workspaceChangedAgentNotice =
  "Workspace changed. AI Chat is ready for a new conversation.";
export const workspaceCleanupFailedAgentNotice =
  "The previous AI Chat could not be closed. Try sending again after cleanup succeeds.";
export const providerCleanupFailedAgentNotice =
  "The disconnected AI Chat could not be cleaned up. Retry cleanup before reconnecting.";

export function useAgentActionNotice(initialNotice: string | null = null) {
  const [actionNotice, setActionNotice] = useState<string | null>(
    initialNotice,
  );

  useEffect(() => {
    if (actionNotice !== workspaceChangedAgentNotice) {
      return;
    }
    const timeoutId = window.setTimeout(
      () =>
        setActionNotice((current) =>
          current === workspaceChangedAgentNotice ? null : current,
        ),
      defaultInlineNoticeTimeout("info"),
    );
    return () => window.clearTimeout(timeoutId);
  }, [actionNotice]);

  return [actionNotice, setActionNotice] as const;
}
