import { useCallback, useMemo, useState } from "react";
import type { AgentQuotedContext } from "../../core/types";
import type { DiffAgentDockControls } from "../components/DiffAgentDock";
import type { SelectionRevealTarget } from "../lib/diffDocumentSelection";

export function useDiffAgentDockState({
  available,
  chatOpen,
  diffOpen,
  onChatOpenChange,
  registerQuotedContext,
}: {
  available: boolean;
  chatOpen: boolean;
  diffOpen: boolean;
  onChatOpenChange: (open: boolean) => void;
  registerQuotedContext: (
    snapshot: AgentQuotedContext,
    revealTarget: SelectionRevealTarget,
  ) => boolean;
}) {
  const [heightPx, setHeightPx] = useState<number | null>(null);
  const [mountTarget, setMountTarget] = useState<HTMLDivElement | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);

  const requestComposerFocus = useCallback(() => {
    setFocusRequest((current) => current + 1);
  }, []);

  const toggle = useCallback(() => {
    if (!available) return;
    const nextOpen = !chatOpen;
    onChatOpenChange(nextOpen);
    if (nextOpen) requestComposerFocus();
  }, [available, chatOpen, onChatOpenChange, requestComposerFocus]);

  const addQuotedContext = useCallback(
    (snapshot: AgentQuotedContext, revealTarget: SelectionRevealTarget) => {
      if (!registerQuotedContext(snapshot, revealTarget)) return;
      onChatOpenChange(true);
      requestComposerFocus();
    },
    [onChatOpenChange, registerQuotedContext, requestComposerFocus],
  );

  const agentDock = useMemo<DiffAgentDockControls>(
    () => ({
      available,
      heightPx,
      open: chatOpen && diffOpen,
      onHeightChange: setHeightPx,
      onMountTargetChange: setMountTarget,
      onToggle: toggle,
    }),
    [available, chatOpen, diffOpen, heightPx, toggle],
  );

  return {
    addQuotedContext,
    agentDock,
    focusRequest,
    mainPanelOpen: chatOpen && mountTarget === null,
    mountTarget,
    requestComposerFocus,
  };
}
