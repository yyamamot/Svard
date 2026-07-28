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

export function useAgentWorkspaceIsolation({
  activeTurnId,
  host,
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
  const transitionRef = useRef<Promise<void> | null>(null);
  const [generation, setGeneration] = useState(0);

  const transitionWorkspace = useCallback(
    (nextWorkspaceRoot: string | null, force = false): Promise<void> => {
      if (!force && trackedWorkspaceRootRef.current === nextWorkspaceRoot) {
        return transitionRef.current ?? Promise.resolve();
      }

      const previousSessionId = sessionIdRef.current;
      const previousTurnId = activeTurnIdRef.current;
      const hadLiveRuntime =
        sessionReadyRef.current ||
        sessionStartingRef.current ||
        previousTurnId !== null;
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

      const previousTransition =
        transitionRef.current?.catch(() => undefined) ?? Promise.resolve();
      const transition = previousTransition.then(async () => {
        if (!hadLiveRuntime) return;
        if (previousTurnId) {
          await host
            .cancelAgentTurn(previousSessionId, previousTurnId)
            .catch(() => undefined);
        }
        await host.closeAgentSession(previousSessionId).catch(() => undefined);
      });
      transitionRef.current = transition;
      void transition.finally(() => {
        if (transitionRef.current === transition) {
          transitionRef.current = null;
        }
      });
      return transition;
    },
    [
      host,
      resumeClosedSessionRef,
      sessionIdRef,
      sessionReadyRef,
      sessionStartingRef,
      setSessionLifecycle,
    ],
  );

  useEffect(() => {
    void transitionWorkspace(workspaceRoot);
  }, [transitionWorkspace, workspaceRoot]);

  async function ensureWorkspaceBoundary(): Promise<void> {
    if (trackedWorkspaceRootRef.current !== workspaceRoot) {
      await transitionWorkspace(workspaceRoot);
      return;
    }
    if (
      sessionReadyRef.current &&
      sessionWorkspaceRootRef.current !== workspaceRoot
    ) {
      await transitionWorkspace(workspaceRoot, true);
      return;
    }
    await (transitionRef.current ?? Promise.resolve());
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
    createOperationToken,
    ensureWorkspaceBoundary,
    generation,
    guardEvents,
    isOperationCurrent,
    isSessionCurrent,
    sessionWorkspaceRootRef,
  };
}
