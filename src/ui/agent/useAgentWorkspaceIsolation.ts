import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { AgentEvent, HostAdapter } from "../../core/types";

export interface AgentWorkspaceOperationToken {
  generation: number;
  sessionId: string;
  workspaceRoot: string;
}

interface PendingWorkspaceCleanup {
  promise: Promise<void> | null;
  sessionId: string;
  turnId: string | null;
}

export function useAgentWorkspaceIsolation({
  activeTurnId,
  host,
  onCleanupFailure,
  onReset,
  resumeClosedSessionRef,
  sessionIdRef,
  sessionReadyRef,
  sessionStartingRef,
  setSessionLifecycle,
  workspaceRoot,
}: {
  activeTurnId: string | null;
  host: HostAdapter;
  onCleanupFailure: () => void;
  onReset: () => void;
  resumeClosedSessionRef: MutableRefObject<boolean>;
  sessionIdRef: MutableRefObject<string>;
  sessionReadyRef: MutableRefObject<boolean>;
  sessionStartingRef: MutableRefObject<boolean>;
  setSessionLifecycle: Dispatch<
    SetStateAction<"idle" | "starting" | "ready" | "closed">
  >;
  workspaceRoot: string | null;
}) {
  const activeTurnIdRef = useRef(activeTurnId);
  activeTurnIdRef.current = activeTurnId;
  const currentWorkspaceRootRef = useRef(workspaceRoot);
  currentWorkspaceRootRef.current = workspaceRoot;
  const trackedWorkspaceRootRef = useRef(workspaceRoot);
  const sessionWorkspaceRootRef = useRef<string | null>(null);
  const generationRef = useRef(0);
  const onResetRef = useRef(onReset);
  onResetRef.current = onReset;
  const onCleanupFailureRef = useRef(onCleanupFailure);
  onCleanupFailureRef.current = onCleanupFailure;
  const pendingCleanupsRef = useRef(new Map<string, PendingWorkspaceCleanup>());
  const transitionRef = useRef<Promise<boolean> | null>(null);
  const [generation, setGeneration] = useState(0);

  const queueCleanup = useCallback(
    (sessionId: string, turnId: string | null = null) => {
      const current = pendingCleanupsRef.current.get(sessionId);
      if (current) {
        current.turnId ??= turnId;
        return;
      }
      pendingCleanupsRef.current.set(sessionId, {
        promise: null,
        sessionId,
        turnId,
      });
    },
    [],
  );

  const runPendingCleanups = useCallback(async (): Promise<boolean> => {
    for (const cleanup of [...pendingCleanupsRef.current.values()]) {
      if (!cleanup.promise) {
        cleanup.promise = (async () => {
          if (cleanup.turnId) {
            await host
              .cancelAgentTurn(cleanup.sessionId, cleanup.turnId)
              .catch(() => undefined);
          }
          await host.closeAgentSession(cleanup.sessionId);
        })();
      }
      try {
        await cleanup.promise;
        if (pendingCleanupsRef.current.get(cleanup.sessionId) === cleanup) {
          pendingCleanupsRef.current.delete(cleanup.sessionId);
        }
      } catch {
        cleanup.promise = null;
        onCleanupFailureRef.current();
        return false;
      }
    }
    return true;
  }, [host]);

  const cleanupSession = useCallback(
    async (
      sessionId: string,
      turnId: string | null = null,
    ): Promise<boolean> => {
      queueCleanup(sessionId, turnId);
      return runPendingCleanups();
    },
    [queueCleanup, runPendingCleanups],
  );

  const transitionWorkspace = useCallback(
    (nextWorkspaceRoot: string | null, force = false): Promise<boolean> => {
      if (!force && trackedWorkspaceRootRef.current === nextWorkspaceRoot) {
        return transitionRef.current ?? runPendingCleanups();
      }

      const previousSessionId = sessionIdRef.current;
      const previousTurnId = activeTurnIdRef.current;
      const nextGeneration = generationRef.current + 1;

      trackedWorkspaceRootRef.current = nextWorkspaceRoot;
      generationRef.current = nextGeneration;
      sessionWorkspaceRootRef.current = null;
      sessionReadyRef.current = false;
      sessionStartingRef.current = false;
      resumeClosedSessionRef.current = false;
      sessionIdRef.current = crypto.randomUUID();
      setSessionLifecycle("idle");
      setGeneration(nextGeneration);
      onResetRef.current();

      queueCleanup(previousSessionId, previousTurnId);
      const previousTransition = transitionRef.current ?? Promise.resolve(true);
      const transition = previousTransition.then(() => runPendingCleanups());
      transitionRef.current = transition;
      void transition.then(
        () => {
          if (transitionRef.current === transition) {
            transitionRef.current = null;
          }
        },
        () => {
          if (transitionRef.current === transition) {
            transitionRef.current = null;
          }
        },
      );
      return transition;
    },
    [
      queueCleanup,
      resumeClosedSessionRef,
      runPendingCleanups,
      sessionIdRef,
      sessionReadyRef,
      sessionStartingRef,
      setSessionLifecycle,
    ],
  );

  useEffect(() => {
    void transitionWorkspace(workspaceRoot).catch(() => undefined);
  }, [transitionWorkspace, workspaceRoot]);

  async function ensureWorkspaceBoundary(): Promise<boolean> {
    if (trackedWorkspaceRootRef.current !== workspaceRoot) {
      return transitionWorkspace(workspaceRoot);
    }
    if (
      sessionReadyRef.current &&
      sessionWorkspaceRootRef.current !== workspaceRoot
    ) {
      return transitionWorkspace(workspaceRoot, true);
    }
    return transitionRef.current ?? runPendingCleanups();
  }

  function createOperationToken(
    sessionId: string,
    operationWorkspaceRoot: string,
  ): AgentWorkspaceOperationToken {
    return {
      generation: generationRef.current,
      sessionId,
      workspaceRoot: operationWorkspaceRoot,
    };
  }

  function isOperationCurrent(token: AgentWorkspaceOperationToken): boolean {
    return (
      token.generation === generationRef.current &&
      token.sessionId === sessionIdRef.current &&
      token.workspaceRoot === trackedWorkspaceRootRef.current &&
      token.workspaceRoot === currentWorkspaceRootRef.current
    );
  }

  function bindSession(token: AgentWorkspaceOperationToken): boolean {
    if (!isOperationCurrent(token)) return false;
    sessionWorkspaceRootRef.current = token.workspaceRoot;
    return true;
  }

  function guardEvents(
    token: AgentWorkspaceOperationToken,
    handleEvent: (event: AgentEvent) => void,
  ) {
    return (event: AgentEvent) => {
      if (isOperationCurrent(token)) {
        handleEvent(event);
      }
    };
  }

  function isSessionCurrent(): boolean {
    return (
      sessionReadyRef.current &&
      sessionWorkspaceRootRef.current === workspaceRoot &&
      trackedWorkspaceRootRef.current === workspaceRoot
    );
  }

  return {
    bindSession,
    cleanupSession,
    createOperationToken,
    ensureWorkspaceBoundary,
    generation,
    guardEvents,
    isOperationCurrent,
    isSessionCurrent,
    sessionWorkspaceRootRef,
  };
}
