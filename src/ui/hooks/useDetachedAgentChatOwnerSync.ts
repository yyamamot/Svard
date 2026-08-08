import { useEffect, useRef } from "react";
import type {
  AgentQuotedContext,
  DocumentPayload,
  HostAdapter,
} from "../../core/types";
import type { useDetachedAgentChat } from "./useDetachedAgentChat";

export function useDetachedAgentChatOwnerSync({
  activeDocument,
  detachedAgentChat,
  host,
  onError,
  quotedContexts,
  workspaceRoot,
}: {
  activeDocument: DocumentPayload | null;
  detachedAgentChat: ReturnType<typeof useDetachedAgentChat>;
  host: HostAdapter;
  onError(message: string): void;
  quotedContexts: AgentQuotedContext[];
  workspaceRoot: string | null;
}) {
  const previousCountRef = useRef(quotedContexts.length);
  useEffect(() => {
    const previousCount = previousCountRef.current;
    previousCountRef.current = quotedContexts.length;
    if (!detachedAgentChat.detached) return;
    const focusAfterDelivery = quotedContexts.length > previousCount;
    void host
      .routeAgentChatOwnerSync({
        activeDocument,
        quotedContexts,
        workspaceRoot,
      })
      .then(() => {
        if (focusAfterDelivery) void detachedAgentChat.focus();
      })
      .catch((error: unknown) => {
        onError(
          error instanceof Error
            ? error.message
            : "AI Chat context could not be delivered.",
        );
      });
  }, [
    activeDocument,
    detachedAgentChat.detached,
    detachedAgentChat.focus,
    host,
    onError,
    quotedContexts,
    workspaceRoot,
  ]);
}
