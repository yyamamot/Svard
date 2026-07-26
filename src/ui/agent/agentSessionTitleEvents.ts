import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { AgentEvent, AgentSessionPage } from "../../core/types";

type SessionTitleEvent = Extract<AgentEvent, { type: "sessionTitleUpdated" }>;

export function applyAgentSessionTitleEvent(
  event: SessionTitleEvent,
  sequenceRef: MutableRefObject<number>,
  eventsRef: MutableRefObject<Map<string, { sequence: number; title: string }>>,
  setSessionPage: Dispatch<SetStateAction<AgentSessionPage | null>>,
) {
  const sequence = ++sequenceRef.current;
  eventsRef.current.set(event.clientSessionId, {
    sequence,
    title: event.title,
  });
  setSessionPage((current) =>
    current
      ? {
          ...current,
          sessions: current.sessions.map((session) =>
            session.clientSessionId === event.clientSessionId
              ? { ...session, title: event.title }
              : session,
          ),
        }
      : current,
  );
}
