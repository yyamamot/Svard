import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type {
  AgentImageAttachment,
  AgentQuotedContext,
  AgentResponseMode,
  AgentTurnInput,
  HostAdapter,
} from "../../core/types";
import type {
  AgentChatAction,
  AgentChatState,
  AgentConversationTurn,
} from "./agentChatState";

export interface PreparedAgentTurn {
  sourceTurnId: string | null;
  action: "queue" | "stopAndSend";
  question: string;
  responseMode: AgentResponseMode;
  images: AgentImageAttachment[];
  quotedContexts: AgentConversationTurn["quotedContexts"];
  selectionIds: string[];
  input: Omit<AgentTurnInput, "clientTurnId">;
}

export function useAgentRunningTurnControl({
  activeTurnId,
  dispatch,
  dispatchPreparedTurn,
  host,
  onQuotedContextsAccepted,
  open,
  selectionImageAttachmentsRef,
  sessionIdRef,
  sessionReadyRef,
  setActionNotice,
  setImages,
  setQuestion,
  setRestoredQuotedContexts,
  state,
}: {
  activeTurnId: string | null;
  dispatch: Dispatch<AgentChatAction>;
  dispatchPreparedTurn: (prepared: PreparedAgentTurn) => Promise<void>;
  host: HostAdapter;
  onQuotedContextsAccepted?: (snapshotIds: string[]) => void;
  open: boolean;
  selectionImageAttachmentsRef: MutableRefObject<
    Map<string, AgentImageAttachment>
  >;
  sessionIdRef: MutableRefObject<string>;
  sessionReadyRef: MutableRefObject<boolean>;
  setActionNotice: Dispatch<SetStateAction<string | null>>;
  setImages: Dispatch<SetStateAction<AgentImageAttachment[]>>;
  setQuestion: Dispatch<SetStateAction<string>>;
  setRestoredQuotedContexts: Dispatch<SetStateAction<AgentQuotedContext[]>>;
  state: AgentChatState;
}) {
  const [pendingTurn, setPendingTurn] = useState<PreparedAgentTurn | null>(
    null,
  );
  const [runningAction, setRunningAction] = useState<
    "queue" | "steer" | "stopAndSend" | null
  >(null);
  const dispatchPreparedTurnRef = useRef(dispatchPreparedTurn);
  dispatchPreparedTurnRef.current = dispatchPreparedTurn;

  async function sendSteer(prepared: PreparedAgentTurn, targetTurnId: string) {
    try {
      const outcome = await host.steerAgentTurn({
        ...prepared.input,
        clientTurnId: targetTurnId,
        clientSteerId: crypto.randomUUID(),
      });
      if (outcome.status === "failed") {
        setActionNotice(outcome.message);
        return;
      }
      dispatch({
        type: "steerAccepted",
        turnId: targetTurnId,
        question: prepared.question,
      });
      setQuestion("");
      setImages((current) =>
        current.filter(
          (image) => !outcome.imageAttachmentIds.includes(image.attachmentId),
        ),
      );
      for (const [imageId, image] of selectionImageAttachmentsRef.current) {
        if (outcome.imageAttachmentIds.includes(image.attachmentId)) {
          selectionImageAttachmentsRef.current.delete(imageId);
        }
      }
      setRestoredQuotedContexts((current) =>
        current.filter(
          (context) => !prepared.selectionIds.includes(context.snapshotId),
        ),
      );
      onQuotedContextsAccepted?.(prepared.selectionIds);
      setActionNotice("Steering applied to the current response.");
    } catch (error) {
      setActionNotice(
        error instanceof Error ? error.message : "Steering could not be sent.",
      );
    } finally {
      setRunningAction(null);
    }
  }

  async function handlePrepared(
    prepared: PreparedAgentTurn,
    activeAction: "queue" | "steer" | "stopAndSend",
    targetTurnId: string,
  ) {
    if (activeAction === "steer") {
      await sendSteer(prepared, targetTurnId);
      return;
    }
    setPendingTurn({ ...prepared, action: activeAction });
    setRunningAction(activeAction);
    if (activeAction === "stopAndSend") {
      dispatch({ type: "suppressRestore", turnId: targetTurnId });
      setActionNotice("Stopping the current response before sending.");
      await host.cancelAgentTurn(sessionIdRef.current, targetTurnId);
    } else {
      setActionNotice("Queued after the current response.");
    }
  }

  function cancelQueuedTurn() {
    if (!pendingTurn) return;
    setPendingTurn(null);
    setRunningAction(null);
    setActionNotice("Queued input returned to the composer.");
  }

  useEffect(() => {
    if (!pendingTurn) return;
    if (!open) {
      setPendingTurn(null);
      setRunningAction(null);
      return;
    }
    if (state.disconnectedMessage) {
      setPendingTurn(null);
      setRunningAction(null);
      setActionNotice(
        pendingTurn.images.length > 0
          ? "Queued input returned to the composer. Attach the image again after reconnecting."
          : "Queued input returned to the composer after disconnecting.",
      );
      return;
    }
    const sourceTurn = state.turns.find(
      (turn) => turn.id === pendingTurn.sourceTurnId,
    );
    if (!sourceTurn) {
      setPendingTurn(null);
      setRunningAction(null);
      setQuestion("");
      return;
    }
    if (
      activeTurnId ||
      sourceTurn.status === "running" ||
      !sessionReadyRef.current
    ) {
      return;
    }
    const queued = pendingTurn;
    setPendingTurn(null);
    setRunningAction(null);
    void dispatchPreparedTurnRef.current(queued);
  }, [
    activeTurnId,
    open,
    pendingTurn,
    sessionReadyRef,
    setActionNotice,
    setQuestion,
    state.disconnectedMessage,
    state.turns,
  ]);

  return {
    cancelQueuedTurn,
    handlePrepared,
    pendingTurn,
    runningAction,
    setRunningAction,
  };
}
