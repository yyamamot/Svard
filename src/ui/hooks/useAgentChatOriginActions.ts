import { useEffect, useRef } from "react";
import type { AgentChatOriginAction, HostAdapter } from "../../core/types";

export function useAgentChatOriginActions(
  host: HostAdapter,
  onAction: (action: AgentChatOriginAction) => void,
) {
  const actionRef = useRef(onAction);
  actionRef.current = onAction;
  useEffect(() => {
    let disposed = false;
    let handle: { dispose(): void } | null = null;
    void host
      .watchAgentChatOriginAction((action) => {
        if (!disposed) actionRef.current(action);
      })
      .then((nextHandle) => {
        if (disposed) nextHandle.dispose();
        else handle = nextHandle;
      })
      .catch(() => undefined);
    return () => {
      disposed = true;
      handle?.dispose();
    };
  }, [host]);
}
