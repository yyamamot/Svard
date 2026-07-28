import { useEffect, useState } from "react";
import { defaultInlineNoticeTimeout } from "../lib/notice";

export const workspaceChangedAgentNotice =
  "Workspace changed. AI Chat is ready for a new conversation.";

export function useAgentActionNotice() {
  const [actionNotice, setActionNotice] = useState<string | null>(null);

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
