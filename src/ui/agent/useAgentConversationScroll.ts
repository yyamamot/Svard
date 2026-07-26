import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentChatState } from "./agentChatState";

export const agentConversationFollowThreshold = 96;

export function agentConversationIsNearBottom(
  conversation: Pick<
    HTMLElement,
    "clientHeight" | "scrollHeight" | "scrollTop"
  >,
): boolean {
  return (
    conversation.scrollHeight -
      conversation.scrollTop -
      conversation.clientHeight <=
    agentConversationFollowThreshold
  );
}

export function useAgentConversationScroll(state: AgentChatState) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const conversationFollowRef = useRef(true);
  const [newActivityAvailable, setNewActivityAvailable] = useState(false);
  const historyPrependScrollRef = useRef<{
    height: number;
    top: number;
  } | null>(null);

  const followLatestConversation = useCallback(() => {
    conversationFollowRef.current = true;
    setNewActivityAvailable(false);
    const conversation = scrollRef.current;
    if (!conversation) return;
    if (typeof conversation.scrollTo === "function") {
      conversation.scrollTo({
        top: conversation.scrollHeight,
        behavior: "auto",
      });
    } else {
      conversation.scrollTop = conversation.scrollHeight;
    }
  }, []);

  const handleConversationScroll = useCallback(() => {
    const conversation = scrollRef.current;
    if (!conversation) return;
    const followsLatest = agentConversationIsNearBottom(conversation);
    conversationFollowRef.current = followsLatest;
    if (followsLatest) {
      setNewActivityAvailable(false);
    }
  }, []);

  const resetConversationFollow = useCallback(() => {
    conversationFollowRef.current = true;
    setNewActivityAvailable(false);
  }, []);

  useEffect(() => {
    const prepend = historyPrependScrollRef.current;
    if (prepend && scrollRef.current) {
      scrollRef.current.scrollTop =
        prepend.top + scrollRef.current.scrollHeight - prepend.height;
      historyPrependScrollRef.current = null;
      return;
    }
    if (!scrollRef.current) return;
    if (conversationFollowRef.current) {
      followLatestConversation();
    } else {
      setNewActivityAvailable(true);
    }
  }, [followLatestConversation, state]);

  return {
    followLatestConversation,
    handleConversationScroll,
    historyPrependScrollRef,
    newActivityAvailable,
    resetConversationFollow,
    scrollRef,
  };
}
