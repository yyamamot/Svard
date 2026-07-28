import type { Dispatch, MutableRefObject, SetStateAction } from "react";

type PendingSessionAction = () => void | Promise<void>;
type PendingFullAccessTransaction = () => Promise<boolean>;

export function createAgentFullAccessActions({
  pendingFullAccessTransactionRef,
  pendingSessionActionRef,
  resumeClosedSessionTransaction,
  setConfirmClosedFullAccessResume,
  setConfirmFullAccess,
  startIdleSession,
}: {
  pendingFullAccessTransactionRef: MutableRefObject<PendingFullAccessTransaction | null>;
  pendingSessionActionRef: MutableRefObject<PendingSessionAction | null>;
  resumeClosedSessionTransaction: (confirmed: boolean) => Promise<boolean>;
  setConfirmClosedFullAccessResume: Dispatch<SetStateAction<boolean>>;
  setConfirmFullAccess: Dispatch<SetStateAction<boolean>>;
  startIdleSession: (confirmed?: boolean) => Promise<boolean>;
}) {
  function cancelFullAccessStart() {
    pendingSessionActionRef.current = null;
    pendingFullAccessTransactionRef.current = null;
    setConfirmFullAccess(false);
    setConfirmClosedFullAccessResume(false);
  }

  async function confirmFullAccessStart(closedSession: boolean) {
    setConfirmFullAccess(false);
    setConfirmClosedFullAccessResume(false);
    const sessionAction = pendingSessionActionRef.current;
    const transaction = pendingFullAccessTransactionRef.current;
    pendingSessionActionRef.current = null;
    pendingFullAccessTransactionRef.current = null;
    const ready = closedSession
      ? await resumeClosedSessionTransaction(true)
      : transaction
        ? await transaction()
        : await startIdleSession(true);
    if (ready && sessionAction) {
      await sessionAction();
    }
  }

  return { cancelFullAccessStart, confirmFullAccessStart };
}
