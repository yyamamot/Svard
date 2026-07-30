import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentChatHandoffSnapshot, HostAdapter } from "../../core/types";

export function useDetachedAgentChat({
  host,
  onError,
  onOpenChange,
}: {
  host: HostAdapter;
  onError: (message: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [detached, setDetached] = useState(false);
  const [moving, setMoving] = useState(false);
  const [reattachSnapshot, setReattachSnapshot] =
    useState<AgentChatHandoffSnapshot | null>(null);
  const reattachPendingRef = useRef(false);
  const rollbackToMainPendingRef = useRef(false);
  const rollbackHasDetachedRef = useRef(false);

  useEffect(() => {
    let disposed = false;
    let handle: { dispose(): void } | null = null;
    void host
      .watchAgentChatReattach((snapshot) => {
        if (disposed) return;
        reattachPendingRef.current = true;
        setReattachSnapshot(snapshot);
        setDetached(false);
        setMoving(false);
        onOpenChange(true);
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
  }, [host, onOpenChange]);

  useEffect(() => {
    let disposed = false;
    let handle: { dispose(): void } | null = null;
    void host
      .watchAgentChatClosed(() => {
        if (disposed) return;
        setReattachSnapshot(null);
        setDetached(false);
        setMoving(false);
        onOpenChange(false);
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
  }, [host, onOpenChange]);

  const detach = useCallback(
    async (snapshot: AgentChatHandoffSnapshot) => {
      setMoving(true);
      setReattachSnapshot(null);
      let readyHandle: { dispose(): void } | null = null;
      let timeoutId: number | null = null;
      let windowOpened = false;
      try {
        let expectedHandoffId: string | null = null;
        let observedHandoffId: string | null = null;
        let resolveReady: () => void = () => undefined;
        const ready = new Promise<void>((resolve) => {
          resolveReady = resolve;
        });
        readyHandle = await host.watchAgentChatReady((handoffId) => {
          observedHandoffId = handoffId;
          if (expectedHandoffId === handoffId) resolveReady();
        });
        expectedHandoffId = await host.openAgentChatWindow({ snapshot });
        windowOpened = true;
        if (observedHandoffId === expectedHandoffId) resolveReady();
        const timeout = new Promise<never>((_, reject) => {
          timeoutId = window.setTimeout(
            () =>
              reject(
                new Error("AI Chat did not finish moving within 10 seconds."),
              ),
            10_000,
          );
        });
        await Promise.race([ready, timeout]);
        setDetached(true);
        setMoving(false);
        return true;
      } catch (error) {
        rollbackToMainPendingRef.current = true;
        rollbackHasDetachedRef.current = windowOpened;
        setReattachSnapshot({
          ...snapshot,
          lastEventSequence: host.getAgentEventSequence(
            snapshot.clientSessionId,
          ),
        });
        setDetached(false);
        setMoving(true);
        onOpenChange(true);
        onError(
          error instanceof Error
            ? error.message
            : "AI Chat could not open in a separate window.",
        );
        return false;
      } finally {
        readyHandle?.dispose();
        if (timeoutId !== null) window.clearTimeout(timeoutId);
      }
    },
    [host, onError, onOpenChange],
  );

  const focus = useCallback(async () => {
    try {
      return await host.focusAgentChatWindow();
    } catch {
      return false;
    }
  }, [host]);

  const acknowledgeReattach = useCallback(() => {
    if (rollbackToMainPendingRef.current) {
      rollbackToMainPendingRef.current = false;
      rollbackHasDetachedRef.current = false;
      setMoving(false);
      setReattachSnapshot(null);
      void host.closeAgentChatWindow().catch((error: unknown) => {
        onError(
          error instanceof Error
            ? error.message
            : "The unused detached AI Chat window could not be closed.",
        );
      });
      return;
    }
    if (!reattachPendingRef.current) return;
    reattachPendingRef.current = false;
    void host
      .acknowledgeAgentChatReattach()
      .then(() => setReattachSnapshot(null))
      .catch((error: unknown) => {
        onError(
          error instanceof Error
            ? error.message
            : "AI Chat could not finish returning to Main.",
        );
      });
  }, [host, onError]);

  const failReattach = useCallback(
    (message: string) => {
      if (rollbackToMainPendingRef.current) {
        const keepDetached = rollbackHasDetachedRef.current;
        rollbackToMainPendingRef.current = false;
        rollbackHasDetachedRef.current = false;
        setMoving(false);
        setDetached(keepDetached);
        setReattachSnapshot(null);
        onError(message);
        if (keepDetached) void host.focusAgentChatWindow();
        return;
      }
      if (!reattachPendingRef.current) {
        setMoving(false);
        setDetached(false);
        onError(message);
        return;
      }
      reattachPendingRef.current = false;
      setReattachSnapshot(null);
      setDetached(true);
      setMoving(false);
      onError(message);
      void host.focusAgentChatWindow();
    },
    [host, onError],
  );

  return {
    acknowledgeReattach,
    detached,
    moving,
    detach,
    focus,
    failReattach,
    reattachSnapshot,
  };
}
